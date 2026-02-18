import { AppSocket, MatchBaseConfiguration } from '@server-types/index.ts';
import {
  Card,
  CardId,
  ExpansionListElement,
  Match,
  MatchConfiguration,
  Player,
  PlayerId,
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
import { AddPlayerResult, GameLobbySessionCoordinatorService } from './game-lobby-session-coordinator-service.ts';

const createDefaultMatchConfiguration = (): MatchConfiguration => ({
  expansions: [
    {
      'title': 'Base',
      'name': 'base-v2',
      'order': 1,
    },
    {
      'title': 'Intrigue',
      'name': 'intrigue',
      'order': 2,
    },
    {
      'title': 'Seaside',
      'name': 'seaside',
      'order': 3,
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

  // Returns true when a player with the session already belongs to this game.
  public hasSession(sessionId: string): boolean {
    return this.runtimeState.players.some((player) => player.sessionId === sessionId);
  }

  // Returns the count of currently connected players.
  public getConnectedPlayerCount(): number {
    return this.runtimeState.players.filter((player) => player.connected).length;
  }

  // Returns the count of currently connected human players.
  public getConnectedHumanCount(): number {
    return this.runtimeState.players.filter((player) => player.connected && !player.isComputer).length;
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
  public addPlayer(sessionId: string, socket: AppSocket): AddPlayerResult {
    const result = this.gameLobbySessionCoordinatorService.addPlayer(this.runtimeState, {
      sessionId,
      socket,
      callbacks: {
        onStartMatch: this.startMatch,
        onClearMatch: this.clearMatch,
        onMatchConfigurationUpdated: this.onMatchConfigurationUpdated,
        onGameStateChanged: this.onGameStateChanged,
      },
      registerRemovalVoteHandler: this.registerRemovalVoteHandler,
    });
    return result;
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

    const artifactsPatch = jsonPatch.compare(currentConfig.artifacts, newConfig.artifacts);
    if (artifactsPatch.length) {
      // Persist selected artifacts between sessions.
      this.configStore.persistArtifacts(newConfig.artifacts);
      this.defaultMatchConfiguration.artifacts = structuredClone(newConfig.artifacts);
    }

    const patch = jsonPatch.compare(currentConfig, newConfig);
    if (!patch.length || !this.runtimeState.matchConfiguration) {
      return;
    }

    jsonPatch.applyPatch(this.runtimeState.matchConfiguration, patch);
    this.defaultMatchConfiguration.preselectedKingdoms = newConfig.kingdomSupply.map((supply) => supply.cards[0]);
    this.runtimeState.matchConfiguration.preselectedKingdoms = newConfig.kingdomSupply.map((supply) => supply.cards[0]);
    // Lobby phase update for all clients.
    this.io.in(this.runtimeState.roomName).emit('matchConfigurationUpdated', this.runtimeState.matchConfiguration);
  };

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
    this.gameLobbySessionCoordinatorService.onRemoveDisconnectedPlayerVote(
      this.runtimeState,
      voterId,
      targetPlayerId,
    );
    this.onGameStateChanged?.();
  };
}
