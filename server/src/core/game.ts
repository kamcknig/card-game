import { AppSocket, MatchBaseConfiguration } from '@server-types/index.ts';
import {
  Card,
  CardId,
  DebugRuntimeContext,
  ExpansionListElement,
  MatchConfigurationDeleteResult,
  MatchConfigurationLoadResult,
  MatchConfigurationSaveNameCheckResult,
  MatchConfigurationSaveResult,
  Match,
  MatchConfiguration,
  Player,
  PlayerId,
  SavedMatchConfigurationEntry,
  ServerEmitEvents,
  ServerListenEvents,
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
  GameLobbySessionCoordinatorService,
  RemoveLobbyPlayerResult,
} from './game-lobby-session-coordinator-service.ts';
import { MatchConfigurationSaveService } from './match-configuration-save-service.ts';

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
    private readonly matchConfigurationSaveService: MatchConfigurationSaveService,
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
      callbacks: {
        onStartMatch: this.startMatch,
        onClearMatch: this.clearMatch,
        onMatchConfigurationUpdated: this.onMatchConfigurationUpdated,
        onCheckMatchConfigurationSaveName: this.onCheckMatchConfigurationSaveName,
        onSaveMatchConfiguration: this.onSaveMatchConfiguration,
        onRequestSavedMatchConfigurationList: this.onRequestSavedMatchConfigurationList,
        onLoadSavedMatchConfiguration: this.onLoadSavedMatchConfiguration,
        onDeleteSavedMatchConfiguration: this.onDeleteSavedMatchConfiguration,
        onGameStateChanged: this.onGameStateChanged,
      },
      registerRemovalVoteHandler: this.registerRemovalVoteHandler,
    });
    return result;
  }

  // Removes one player from this lobby game before match start.
  public removePlayerFromLobby(playerId: PlayerId): RemoveLobbyPlayerResult {
    return this.gameLobbySessionCoordinatorService.removePlayerFromLobby(this.runtimeState, {
      playerId,
      callbacks: {
        onStartMatch: this.startMatch,
        onClearMatch: this.clearMatch,
        onMatchConfigurationUpdated: this.onMatchConfigurationUpdated,
        onCheckMatchConfigurationSaveName: this.onCheckMatchConfigurationSaveName,
        onSaveMatchConfiguration: this.onSaveMatchConfiguration,
        onRequestSavedMatchConfigurationList: this.onRequestSavedMatchConfigurationList,
        onLoadSavedMatchConfiguration: this.onLoadSavedMatchConfiguration,
        onDeleteSavedMatchConfiguration: this.onDeleteSavedMatchConfiguration,
        onGameStateChanged: this.onGameStateChanged,
      },
    });
  }

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

    const kingdomPatch = jsonPatch.compare(currentConfig.kingdomSupply, newConfig.kingdomSupply);
    if (kingdomPatch.length) {
      this.configStore.persistPreselectedKingdoms(newConfig.kingdomSupply);
      this.defaultMatchConfiguration.kingdomSupply = structuredClone(newConfig.kingdomSupply);
    }

    const bannedKingdomsPatch = jsonPatch.compare(currentConfig.bannedKingdoms, newConfig.bannedKingdoms);
    if (bannedKingdomsPatch.length) {
      this.configStore.persistBannedKingdoms(newConfig.bannedKingdoms);
      this.defaultMatchConfiguration.bannedKingdoms = structuredClone(newConfig.bannedKingdoms);
    }

    const eventsPatch = jsonPatch.compare(currentConfig.events, newConfig.events);
    if (eventsPatch.length) {
      // Persist selected events between sessions.
      this.configStore.persistEvents(newConfig.events);
      this.defaultMatchConfiguration.events = structuredClone(newConfig.events);
    }

    const landmarksPatch = jsonPatch.compare(currentConfig.landmarks, newConfig.landmarks);
    if (landmarksPatch.length) {
      // Persist selected landmarks between sessions.
      this.configStore.persistLandmarks(newConfig.landmarks);
      this.defaultMatchConfiguration.landmarks = structuredClone(newConfig.landmarks);
    }

    const projectsPatch = jsonPatch.compare(currentConfig.projects, newConfig.projects);
    if (projectsPatch.length) {
      // Persist selected projects between sessions.
      this.configStore.persistProjects(newConfig.projects);
      this.defaultMatchConfiguration.projects = structuredClone(newConfig.projects);
    }

    const waysPatch = jsonPatch.compare(currentConfig.ways, newConfig.ways);
    if (waysPatch.length) {
      // Persist selected ways between sessions.
      this.configStore.persistWays(newConfig.ways);
      this.defaultMatchConfiguration.ways = structuredClone(newConfig.ways);
    }

    const traitsPatch = jsonPatch.compare(currentConfig.traits, newConfig.traits);
    if (traitsPatch.length) {
      // Persist selected traits between sessions.
      this.configStore.persistTraits(newConfig.traits);
      this.defaultMatchConfiguration.traits = structuredClone(newConfig.traits);
    }

    const alliesPatch = jsonPatch.compare(currentConfig.allies, newConfig.allies);
    if (alliesPatch.length) {
      // Persist selected ally between sessions.
      this.configStore.persistAllies(newConfig.allies);
      this.defaultMatchConfiguration.allies = structuredClone(newConfig.allies);
    }

    const propheciesPatch = jsonPatch.compare(currentConfig.prophecies, newConfig.prophecies);
    if (propheciesPatch.length) {
      // Persist selected prophecy between sessions.
      this.configStore.persistProphecies(newConfig.prophecies);
      this.defaultMatchConfiguration.prophecies = structuredClone(newConfig.prophecies);
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

  // Sends save-name availability checks to one owner client.
  private onCheckMatchConfigurationSaveName = (playerId: PlayerId, name: string): void => {
    const result: MatchConfigurationSaveNameCheckResult = this.matchConfigurationSaveService.checkSaveName(name);
    this.runtimeState.socketMap.get(playerId)?.emit('matchConfigurationSaveNameChecked', result);
  };

  // Persists current lobby match configuration as a named save file.
  private onSaveMatchConfiguration = (playerId: PlayerId, name: string): void => {
    const configuration = this.runtimeState.matchConfiguration ?? structuredClone(this.defaultMatchConfiguration);
    const result: MatchConfigurationSaveResult = this.matchConfigurationSaveService.saveConfiguration(
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
    const loadResult = this.matchConfigurationSaveService.loadConfiguration(key);
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
    const deleteResult = this.matchConfigurationSaveService.deleteConfiguration(key);
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
    const saves: SavedMatchConfigurationEntry[] = this.matchConfigurationSaveService.listSavedConfigurations();
    this.runtimeState.socketMap.get(playerId)?.emit('savedMatchConfigurationList', saves);
  }

  // Starts gameplay after readiness checks have completed.
  private startMatch = (): void => {
    this.gameMatchLifecycleCoordinatorService.startMatch(this.runtimeState, {
      defaultMatchConfiguration: this.defaultMatchConfiguration,
      onGameOver: this.clearMatch,
      registerRemovalVoteHandler: this.registerRemovalVoteHandler,
    });
    this.onGameStateChanged?.();
  };

  // Registers the socket handler for disconnected-player removal votes.
  private registerRemovalVoteHandler = (socket: AppSocket, playerId: PlayerId): void => {
    socket.on('removeDisconnectedPlayer', (targetPlayerId: PlayerId) => {
      this.onRemoveDisconnectedPlayerVote(playerId, targetPlayerId);
    });
  };

  // Handles a connected human player's vote to remove a disconnected player.
  private onRemoveDisconnectedPlayerVote = (voterId: PlayerId, targetPlayerId: PlayerId): void => {
    this.gameLobbySessionCoordinatorService.onRemoveDisconnectedPlayerVote(this.runtimeState, voterId, targetPlayerId);
    this.onGameStateChanged?.();
  };
}
