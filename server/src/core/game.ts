import { AppSocket, MatchBaseConfiguration } from '@server-types/index.ts';
import {
  AllyNoId,
  Card,
  CardId,
  CardNoId,
  DebugRuntimeContext,
  EventNoId,
  ExpansionListElement,
  LandmarkNoId,
  MatchConfigurationDeleteResult,
  MatchConfigurationLoadResult,
  MatchConfigurationSaveNameCheckResult,
  MatchConfigurationSaveResult,
  Match,
  MatchConfiguration,
  Player,
  PlayerId,
  ProjectNoId,
  ProphecyNoId,
  SavedMatchConfigurationEntry,
  ServerEmitEvents,
  ServerListenEvents,
  Supply,
  TraitNoId,
  WayNoId,
} from 'shared/types/index.ts';
import jsonPatch from 'fast-json-patch';
import { Server } from 'socket.io';
import { GameConfigurationStore } from './game-configuration-store.ts';
import { ExpansionCompatibilityService } from './expansion-compatibility-service.ts';
import { LoggerService } from './logger-service.ts';
import { GameRuntimeState } from './game-runtime-state.ts';
import { GameMatchLifecycleCoordinatorService } from './game-match-lifecycle-coordinator-service.ts';
import { ServerConfigService } from './server-config-service.ts';
import {
  AddPlayerResult,
  GameLobbyCallbacks,
  GameLobbySessionCoordinatorService,
  RemoveLobbyPlayerResult,
} from './game-lobby-session-coordinator-service.ts';
import type { MatchConfigurationSaveStore } from './match-configuration-save-store.ts';

const createDefaultMatchConfiguration = (): MatchConfiguration => ({
  expansions: [
    {
      title: 'Base',
      name: 'base-v2',
      order: 1,
    },
    {
      title: 'Intrigue',
      name: 'intrigue',
      order: 2,
    },
    {
      title: 'Seaside',
      name: 'seaside',
      order: 3,
    },
  ],
  preselectedKingdoms: [],
  bannedKingdoms: [],
  players: [],
  basicSupply: [],
  kingdomSupply: [],
  events: [],
  // Default landmark selection for new lobbies.
  landmarks: [],
  // Default project selection for new lobbies.
  projects: [],
  // Default way selection for new lobbies.
  ways: [],
  // Default trait selection for new lobbies.
  traits: [],
  // Default ally selection for new lobbies.
  allies: [],
  // Default prophecy selection for new lobbies.
  prophecies: [],
  // Default boons selection for new lobbies.
  boons: [],
  // Default hexes selection for new lobbies.
  hexes: [],
  // Default states selection for new lobbies.
  states: [],
  // Default artifacts selection for new lobbies.
  artifacts: [],
  playerStartingHand: { ...MatchBaseConfiguration.playerStartingHand },
});

/**
 * Game process orchestrator for lobby/match runtime state.
 *
 * This class intentionally stays thin and delegates to lifecycle/session
 * coordinators so startup and runtime behavior remain easy to reason about.
 */
export class Game {
  // Per-game default configuration template used for resets and persistence overlays.
  private readonly defaultMatchConfiguration: MatchConfiguration = createDefaultMatchConfiguration();
  // Shared mutable runtime state used by coordinators.
  private readonly runtimeState: GameRuntimeState = {
    gameId: '',
    gameName: '',
    roomName: '',
    players: [],
    owner: undefined,
    matchStarted: false,
    postGamePhase: false,
    matchScopeId: undefined,
    socketMap: new Map<PlayerId, AppSocket>(),
    matchScope: undefined,
    matchController: undefined,
    matchConfiguration: undefined,
    availableExpansion: [],
  };
  constructor(
    // Stable game identifier used for socket room isolation and diagnostics.
    private readonly gameId: string,
    // Human-readable lobby name for this game.
    private readonly gameName: string,
    // Socket room name for all per-game traffic.
    private readonly gameRoomName: string,
    // Socket.io server injected from composition root.
    private readonly io: Server<ServerListenEvents, ServerEmitEvents>,
    // Store abstraction for persisted lobby configuration.
    private readonly configStore: GameConfigurationStore,
    // Compatibility service that enforces expansion mutual-exclusion rules.
    private readonly expansionCompatibilityService: ExpansionCompatibilityService,
    // Service that provides consistent logging.
    private readonly loggerService: LoggerService,
    // Centralized server env configuration provider.
    private readonly serverConfigService: ServerConfigService,
    // Stores named match-configuration save files for lobby owners.
    private readonly matchConfigurationSaveService: MatchConfigurationSaveStore,
    // Coordinator that owns match lifecycle transitions and match scope creation.
    private readonly gameMatchLifecycleCoordinatorService: GameMatchLifecycleCoordinatorService,
    // Coordinator that owns lobby/session events and owner-only lobby handlers.
    private readonly gameLobbySessionCoordinatorService: GameLobbySessionCoordinatorService,
    // Optional callback for outer lobby directory to refresh game summaries.
    private readonly onGameStateChanged?: () => void,
  ) {
    this.runtimeState.gameId = this.gameId;
    this.runtimeState.gameName = this.gameName;
    this.runtimeState.roomName = this.gameRoomName;
    this.loggerService.log('[game] created');
    this.gameMatchLifecycleCoordinatorService.initialize(this.runtimeState, this.defaultMatchConfiguration);
  }

  // Exposes the stable game identifier.
  public get id(): string {
    return this.gameId;
  }

  // Exposes the human-readable game name.
  public get name(): string {
    return this.gameName;
  }

  // Exposes the per-game socket room name used for isolation.
  public get roomName(): string {
    return this.runtimeState.roomName;
  }

  // Exposes current runtime players for callers that need readonly lobby state.
  public get players(): Player[] {
    return this.runtimeState.players;
  }

  // Exposes current runtime lobby owner.
  public get owner(): Player | undefined {
    return this.runtimeState.owner;
  }

  // Exposes whether gameplay has started.
  public get matchStarted(): boolean {
    return this.runtimeState.matchStarted;
  }

  // Exposes active match scope identifier for diagnostics.
  public get matchScopeId(): number | undefined {
    return this.runtimeState.matchScopeId;
  }

  // Returns true when the active match controller has completed initialization.
  public isMatchControllerInitialized(): boolean {
    return this.runtimeState.matchController?.isInitialized() ?? false;
  }

  // Returns game + match runtime identifiers used by debug overlays and APIs.
  public getDebugRuntimeContext(): DebugRuntimeContext {
    return {
      gameId: this.runtimeState.gameId,
      gameName: this.runtimeState.gameName,
      matchScopeId: this.runtimeState.matchScopeId,
      tooltipDefaultCloseDelayMs: this.serverConfigService.getTooltipDefaultCloseDelayMs(),
    };
  }

  // Returns true when a player with the session already belongs to this game.
  public hasSession(sessionId: string): boolean {
    return this.runtimeState.players.some(player => player.sessionId === sessionId);
  }

  // Returns the count of currently connected players.
  public getConnectedPlayerCount(): number {
    return this.runtimeState.players.filter(player => player.connected).length;
  }

  // Returns the count of currently connected human players.
  public getConnectedHumanCount(): number {
    return this.runtimeState.players.filter(player => player.connected && !player.isComputer).length;
  }

  // Finds a player by session identifier in this game runtime.
  public getPlayerBySession(sessionId: string): Player | undefined {
    return this.runtimeState.players.find(player => player.sessionId === sessionId);
  }

  // Finds a player by player identifier in this game runtime.
  public getPlayerById(playerId: PlayerId): Player | undefined {
    return this.runtimeState.players.find(player => player.id === playerId);
  }

  // Handles expansion-loaded events from startup loaders.
  public expansionLoaded(expansion: ExpansionListElement): void {
    this.gameMatchLifecycleCoordinatorService.expansionLoaded(this.runtimeState, expansion);
  }

  // Exports the current match state and card library for local debug tooling.
  public exportMatchState(): { match: Match; cardLibrary: Record<CardId, Card> } | null {
    return this.gameMatchLifecycleCoordinatorService.exportMatchState(this.runtimeState);
  }

  // Merges a partial match update into the live match state and broadcasts it.
  public mergeMatchState(partial: Partial<Match>): { ok: boolean; errors?: string[] } {
    return this.gameMatchLifecycleCoordinatorService.mergeMatchState(this.runtimeState, partial);
  }

  /**
   * Forcibly ends the active match immediately, bypassing end-condition evaluation.
   * Used exclusively by the debug API.
   */
  public forceEndGame(): Promise<{ ok: boolean; error?: string }> {
    return this.gameMatchLifecycleCoordinatorService.forceEndGame(this.runtimeState);
  }

  /**
   * Performs a debug undo by restoring the most recent snapshot without a vote.
   * Used exclusively by the debug API to verify snapshot/restore plumbing.
   */
  public debugPerformUndo(): Promise<{ ok: boolean; error?: string }> {
    return this.gameMatchLifecycleCoordinatorService.debugPerformUndo(this.runtimeState);
  }

  // Disposes match-lifetime resources for clean process shutdown.
  public dispose(): void {
    this.gameMatchLifecycleCoordinatorService.dispose(this.runtimeState);
  }

  // Adds or reconnects a player to the active lobby/match runtime.
  // The username is passed through to player creation so the display name matches the auth identity.
  public addPlayer(sessionId: string, socket: AppSocket, username: string): AddPlayerResult {
    const result = this.gameLobbySessionCoordinatorService.addPlayer(this.runtimeState, {
      sessionId,
      socket,
      username,
      callbacks: this.buildLobbyCallbacks(),
      registerRemovalVoteHandler: this.registerRemovalVoteHandler,
    });
    return result;
  }

  // Removes one player from this lobby game before match start.
  public removePlayerFromLobby(playerId: PlayerId): RemoveLobbyPlayerResult {
    return this.gameLobbySessionCoordinatorService.removePlayerFromLobby(this.runtimeState, {
      playerId,
      callbacks: this.buildLobbyCallbacks(),
    });
  }

  // Builds the full callback set for lobby and post-game coordinator methods.
  // Centralizing construction here ensures both addPlayer and removePlayerFromLobby,
  // as well as post-game re-bindings, always receive a consistent callback set.
  private buildLobbyCallbacks(): GameLobbyCallbacks {
    return {
      onStartMatch: this.startMatch,
      onClearMatch: this.clearMatch,
      onMatchConfigurationUpdated: this.onMatchConfigurationUpdated,
      onCheckMatchConfigurationSaveName: this.onCheckMatchConfigurationSaveName,
      onSaveMatchConfiguration: this.onSaveMatchConfiguration,
      onRequestSavedMatchConfigurationList: this.onRequestSavedMatchConfigurationList,
      onLoadSavedMatchConfiguration: this.onLoadSavedMatchConfiguration,
      onDeleteSavedMatchConfiguration: this.onDeleteSavedMatchConfiguration,
      onGameStateChanged: this.onGameStateChanged,
      onRestartMatch: this.onRestartMatch,
      onEditMatch: this.onEditMatch,
    };
  }

  // Enters post-game phase after match ends; defers clearMatch until all players leave.
  // Delegates to the coordinator to reset ready states and bind summary-screen handlers.
  private enterPostGamePhase = (): void => {
    this.loggerService.log('[game] match ended, entering post-game phase');
    this.gameLobbySessionCoordinatorService.enterPostGamePhase(
      this.runtimeState,
      this.buildLobbyCallbacks(),
    );
    this.onGameStateChanged?.();
  };

  // Restarts the match immediately with all remaining connected players and current config.
  // Players are already validated ready by the coordinator before this callback fires.
  // The stale-controller guard in startMatch creates a fresh scope automatically.
  private onRestartMatch = (): void => {
    this.loggerService.info('[game] owner restarting match from post-game phase');
    // Reset match flags — startMatch's stale-controller guard handles creating a fresh scope.
    this.runtimeState.postGamePhase = false;
    this.runtimeState.matchStarted = false;
    // Re-broadcast ownership so clients seed gameOwnerIdStore before the next game summary renders.
    if (this.runtimeState.owner) {
      this.io.in(this.runtimeState.roomName).emit('gameOwnerUpdated', this.runtimeState.owner.id);
    }
    this.startMatch();
  };

  // Resets match scope, preserves config, and returns all players to match configuration.
  // Rebinds standard lobby handlers so the configuration screen is fully functional.
  private onEditMatch = (): void => {
    this.loggerService.info('[game] owner editing match from post-game phase');

    // Preserve current config before createNewMatch resets it to defaults.
    const savedConfig = structuredClone(this.runtimeState.matchConfiguration);

    // Fresh match scope clears the stale match controller without touching players/sockets.
    this.gameMatchLifecycleCoordinatorService.createNewMatch(
      this.runtimeState,
      this.defaultMatchConfiguration,
    );

    // Restore the configuration that was in use when the match ended.
    this.runtimeState.matchConfiguration = savedConfig ?? structuredClone(this.defaultMatchConfiguration);
    this.runtimeState.matchStarted = false;
    this.runtimeState.postGamePhase = false;

    // Reset all non-computer players to not-ready for the new lobby phase.
    for (const player of this.runtimeState.players) {
      if (!player.isComputer) {
        player.ready = false;
      }
    }

    // Rebind standard lobby handlers (player ready, owner config) on all connected sockets.
    this.gameLobbySessionCoordinatorService.rebindLobbyHandlersAfterPostGame(
      this.runtimeState,
      this.buildLobbyCallbacks(),
    );

    // Navigate all clients to configuration; they see the current config pre-loaded.
    this.io.in(this.runtimeState.roomName).emit('setPlayerList', this.runtimeState.players);
    this.io
      .in(this.runtimeState.roomName)
      // Sort a copy — shared lobby state must never be reordered in place by an emit.
      .emit('expansionList', [...this.runtimeState.availableExpansion].sort((a, b) => a.order - b.order));
    this.io
      .in(this.runtimeState.roomName)
      .emit('matchConfigurationUpdated', this.runtimeState.matchConfiguration!);

    this.onGameStateChanged?.();
  };

  // Clears all current runtime state and resets to a new lobby match shell.
  private clearMatch = (): void => {
    this.gameMatchLifecycleCoordinatorService.clearMatch(this.runtimeState, this.defaultMatchConfiguration);
    this.onGameStateChanged?.();
  };

  // Persists and applies lobby configuration updates from the owner.
  private onMatchConfigurationUpdated = async (newConfig: MatchConfiguration): Promise<void> => {
    this.loggerService.info('[game] received expansionSelected socket event');
    this.loggerService.debug(newConfig);

    const currentConfig = structuredClone(this.runtimeState.matchConfiguration ?? {}) as MatchConfiguration;
    // Enforce expansion mutual-exclusion rules before applying the updated lobby config.
    await this.expansionCompatibilityService.applyMutualExclusions(currentConfig, newConfig);

    // Every persisted lobby-config field follows the same shape: diff current
    // vs. new, and when changed, persist it and mirror it onto the in-memory
    // default so future lobby resets see the latest selection. The `persist`
    // cast is safe because `key` and `persist` always originate from the same
    // table row — each row's value type matches what its store method expects.
    // `kingdomSupply` persists via `persistPreselectedKingdoms` (store method
    // naming predates this table; the config field itself is still `kingdomSupply`).
    const configPersistFields: ReadonlyArray<{ key: keyof MatchConfiguration; persist: (value: unknown) => void }> = [
      { key: 'kingdomSupply', persist: value => this.configStore.persistPreselectedKingdoms(value as Supply[]) },
      { key: 'bannedKingdoms', persist: value => this.configStore.persistBannedKingdoms(value as CardNoId[]) },
      { key: 'events', persist: value => this.configStore.persistEvents(value as EventNoId[]) },
      { key: 'landmarks', persist: value => this.configStore.persistLandmarks(value as LandmarkNoId[]) },
      { key: 'projects', persist: value => this.configStore.persistProjects(value as ProjectNoId[]) },
      { key: 'ways', persist: value => this.configStore.persistWays(value as WayNoId[]) },
      { key: 'traits', persist: value => this.configStore.persistTraits(value as TraitNoId[]) },
      { key: 'allies', persist: value => this.configStore.persistAllies(value as AllyNoId[]) },
      { key: 'prophecies', persist: value => this.configStore.persistProphecies(value as ProphecyNoId[]) },
    ];

    for (const field of configPersistFields) {
      const fieldPatch = jsonPatch.compare(currentConfig[field.key], newConfig[field.key]);
      if (!fieldPatch.length) continue;
      field.persist(newConfig[field.key]);
      (this.defaultMatchConfiguration as unknown as Record<string, unknown>)[field.key] = structuredClone(
        newConfig[field.key],
      );
    }

    const patch = jsonPatch.compare(currentConfig, newConfig);
    if (!patch.length || !this.runtimeState.matchConfiguration) {
      return;
    }

    jsonPatch.applyPatch(this.runtimeState.matchConfiguration, patch);
    this.defaultMatchConfiguration.preselectedKingdoms = newConfig.kingdomSupply.map(supply => supply.cards[0]);
    this.runtimeState.matchConfiguration.preselectedKingdoms = newConfig.kingdomSupply.map(supply => supply.cards[0]);
    // Lobby phase update for all clients.
    this.io.in(this.runtimeState.roomName).emit('matchConfigurationUpdated', this.runtimeState.matchConfiguration);
  };

  // Resolves the authenticated username for a player by their player id.
  // Returns an empty string for computer players or when the player is not found.
  private getUsernameForPlayer(playerId: PlayerId): string {
    return this.runtimeState.players.find(p => p.id === playerId)?.name ?? '';
  }

  // Sends save-name availability checks to one owner client.
  private onCheckMatchConfigurationSaveName = (playerId: PlayerId, name: string): void => {
    const username = this.getUsernameForPlayer(playerId);
    const result: MatchConfigurationSaveNameCheckResult = this.matchConfigurationSaveService.checkSaveName(username, name);
    this.runtimeState.socketMap.get(playerId)?.emit('matchConfigurationSaveNameChecked', result);
  };

  // Persists current lobby match configuration as a named save file.
  private onSaveMatchConfiguration = (playerId: PlayerId, name: string): void => {
    const username = this.getUsernameForPlayer(playerId);
    const configuration = this.runtimeState.matchConfiguration ?? structuredClone(this.defaultMatchConfiguration);
    const result: MatchConfigurationSaveResult = this.matchConfigurationSaveService.saveConfiguration(
      username,
      name,
      configuration,
    );
    this.runtimeState.socketMap.get(playerId)?.emit('matchConfigurationSaveCompleted', result);
    if (result.ok) {
      this.emitSavedConfigurationList(playerId);
    }
  };

  // Sends the current saved-configuration list to one owner client.
  private onRequestSavedMatchConfigurationList = (playerId: PlayerId): void => {
    this.emitSavedConfigurationList(playerId);
  };

  // Loads one saved configuration and applies it through the existing update flow.
  private onLoadSavedMatchConfiguration = async (playerId: PlayerId, key: string): Promise<void> => {
    const username = this.getUsernameForPlayer(playerId);
    const loadResult = this.matchConfigurationSaveService.loadConfiguration(username, key);
    if (!loadResult.ok) {
      const result: MatchConfigurationLoadResult = {
        ok: false,
        key: loadResult.key,
        message: loadResult.message,
      };
      this.runtimeState.socketMap.get(playerId)?.emit('matchConfigurationLoadCompleted', result);
      return;
    }

    const baseConfiguration = structuredClone(this.runtimeState.matchConfiguration ?? this.defaultMatchConfiguration);
    const mergedConfiguration = {
      ...baseConfiguration,
      ...loadResult.configuration,
    } as MatchConfiguration;
    await this.onMatchConfigurationUpdated(mergedConfiguration);
    const result: MatchConfigurationLoadResult = {
      ok: true,
      key: loadResult.key,
    };
    this.runtimeState.socketMap.get(playerId)?.emit('matchConfigurationLoadCompleted', result);
  };

  // Deletes one saved configuration and emits the current saved list back to owner.
  private onDeleteSavedMatchConfiguration = (playerId: PlayerId, key: string): void => {
    const username = this.getUsernameForPlayer(playerId);
    const deleteResult = this.matchConfigurationSaveService.deleteConfiguration(username, key);
    const result: MatchConfigurationDeleteResult = deleteResult.ok
      ? {
          ok: true,
          key: deleteResult.key,
        }
      : {
          ok: false,
          key: deleteResult.key,
          message: deleteResult.message,
        };
    this.runtimeState.socketMap.get(playerId)?.emit('matchConfigurationDeleteCompleted', result);
    if (result.ok) {
      this.emitSavedConfigurationList(playerId);
    }
  };

  // Emits the saved-configuration list to one owner client.
  private emitSavedConfigurationList(playerId: PlayerId): void {
    const username = this.getUsernameForPlayer(playerId);
    const saves: SavedMatchConfigurationEntry[] = this.matchConfigurationSaveService.listSavedConfigurations(username);
    this.runtimeState.socketMap.get(playerId)?.emit('savedMatchConfigurationList', saves);
  }

  // Starts gameplay after readiness checks have completed.
  private startMatch = (): void => {
    this.gameMatchLifecycleCoordinatorService.startMatch(this.runtimeState, {
      defaultMatchConfiguration: this.defaultMatchConfiguration,
      // Wire post-game phase entry instead of immediate clearMatch so players can
      // return, restart, or edit from the summary screen before state is wiped.
      onGameOver: this.enterPostGamePhase,
      registerRemovalVoteHandler: this.registerRemovalVoteHandler,
    });
    this.onGameStateChanged?.();
  };

  // Registers the socket handlers for disconnected-player removal votes.
  private registerRemovalVoteHandler = (socket: AppSocket, playerId: PlayerId): void => {
    socket.on('removeDisconnectedPlayer', (targetPlayerId: PlayerId) => {
      this.onRemoveDisconnectedPlayerVote(playerId, targetPlayerId);
    });
    socket.on('retractRemoveDisconnectedPlayer', (targetPlayerId: PlayerId) => {
      this.onRetractRemovalVote(playerId, targetPlayerId);
    });
  };

  // Handles a connected human player's vote to remove a disconnected player.
  private onRemoveDisconnectedPlayerVote = (voterId: PlayerId, targetPlayerId: PlayerId): void => {
    this.gameLobbySessionCoordinatorService.onRemoveDisconnectedPlayerVote(this.runtimeState, voterId, targetPlayerId);
    this.onGameStateChanged?.();
  };

  // Handles a voter withdrawing a removal vote for a disconnected player.
  private onRetractRemovalVote = (voterId: PlayerId, targetPlayerId: PlayerId): void => {
    this.gameLobbySessionCoordinatorService.onRetractRemovalVote(this.runtimeState, voterId, targetPlayerId);
    this.onGameStateChanged?.();
  };
}
