import {AppSocket, MatchBaseConfiguration} from '@server-types/index.ts';
import {
  Card,
  CardId,
  CardNoId,
  ExpansionListElement,
  Match,
  MatchConfiguration,
  Player,
  PlayerId,
  ServerEmitEvents,
  ServerListenEvents,
} from 'shared/types/index.ts';
import {createComputerPlayer, createNewPlayer} from '../utils/create-new-player.ts';
import {MatchController} from './match-controller.ts';
import jsonPatch from 'fast-json-patch';
import {fisherYatesShuffle} from '../utils/fisher-yates-shuffler.ts';
import {Server} from 'socket.io';
import {FileGameConfigurationStore, GameConfigurationStore} from './game-configuration-store.ts';
import {LobbySocketBindings} from './lobby-socket-bindings.ts';
import {ExpansionSearchService} from './expansion-search-service.ts';
import {ExpansionCompatibilityService} from './expansion-compatibility-service.ts';

// Factory signature for creating a match controller instance.
export type MatchControllerFactory = (
  socketMap: Map<PlayerId, AppSocket>,
  cardSearchFn: (searchTerm: string) => CardNoId[],
) => MatchController;

// Default match controller factory used by the composition root.
export const defaultMatchControllerFactory: MatchControllerFactory = (socketMap, cardSearchFn) =>
  new MatchController(socketMap, cardSearchFn);

// Dependencies injected by the server composition root.
export interface GameDependencies {
  io: Server<ServerListenEvents, ServerEmitEvents>;
  matchControllerFactory?: MatchControllerFactory;
  configStore?: GameConfigurationStore;
  lobbySocketBindings?: LobbySocketBindings;
  expansionSearchService?: ExpansionSearchService;
  expansionCompatibilityService?: ExpansionCompatibilityService;
}

const defaultMatchConfiguration: MatchConfiguration = {
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
};

export class Game {
  public players: Player[] = [];
  public owner: Player | undefined;
  public matchStarted: boolean = false;
  // Track pending removal votes for disconnected human players in queue order.
  private _pendingRemovalQueue: PlayerId[] = [];
  private _removalVotes: Map<PlayerId, Set<PlayerId>> = new Map();

  private _socketMap: Map<PlayerId, AppSocket> = new Map();
  // Socket.io server injected from composition root.
  private readonly _io: Server<ServerListenEvents, ServerEmitEvents>;
  // Match controller factory injected from composition root for explicit wiring.
  private readonly _matchControllerFactory: MatchControllerFactory;
  // Store abstraction for persisted lobby configuration.
  private readonly _configStore: GameConfigurationStore;
  // Socket binding helper that owns lobby transport event registrations.
  private readonly _lobbySocketBindings: LobbySocketBindings;
  // Search service that owns all lobby card-like indexes.
  private readonly _expansionSearchService: ExpansionSearchService;
  // Compatibility service that enforces expansion mutual-exclusion rules.
  private readonly _expansionCompatibilityService: ExpansionCompatibilityService;
  private _matchController: MatchController | undefined;
  private _matchConfiguration: MatchConfiguration | undefined;
  private _availableExpansion: ExpansionListElement[] = [];
  // When true, the game ends automatically if no human players remain connected.
  private readonly _endMatchWhenNoHumans: boolean;

  constructor({
    io,
    matchControllerFactory = defaultMatchControllerFactory,
    configStore = new FileGameConfigurationStore(),
    lobbySocketBindings = new LobbySocketBindings(),
    expansionSearchService = new ExpansionSearchService(),
    expansionCompatibilityService = new ExpansionCompatibilityService(),
  }: GameDependencies) {
    console.log(`[game] created`);
    this._io = io;
    this._matchControllerFactory = matchControllerFactory;
    this._configStore = configStore;
    this._lobbySocketBindings = lobbySocketBindings;
    this._expansionSearchService = expansionSearchService;
    this._expansionCompatibilityService = expansionCompatibilityService;
    // Configure whether to end the match when all human players leave (default: true).
    const endOnNoHumansEnv = Deno.env.get('END_MATCH_ON_NO_HUMANS') ?? 'true';
    this._endMatchWhenNoHumans = endOnNoHumansEnv.toLowerCase() !== 'false';
    // Hydrate lobby defaults from persisted local files.
    this._configStore.load(defaultMatchConfiguration);

    this._expansionSearchService.rebuildIndexes();

    this.createNewMatch();
  }

  private createNewMatch() {
    this._matchController = this._matchControllerFactory(
      this._socketMap,
      (searchTerm: string) => this.onSearchCards(searchTerm),
    );
    this._matchConfiguration = { ...structuredClone(defaultMatchConfiguration) };
  }

  // Returns the currently selected expansion names used by lobby card search filtering.
  private getSelectedExpansionNames(): Set<string> {
    const selectedExpansions = this._matchConfiguration?.expansions ?? defaultMatchConfiguration.expansions;
    return new Set(selectedExpansions.map((expansion) => expansion.name));
  }

  private onSearchCards = (searchStr: string) => {
    const filteredCards = this._expansionSearchService.searchKingdomCards(searchStr, this.getSelectedExpansionNames());
    console.debug(
      `[game] kingdom search '${searchStr}' returned ${filteredCards.length} eligible card(s)`,
    );
    return filteredCards;
  };

  // Returns event search results for the given query.
  private onSearchEvents = (searchStr: string) => {
    return this._expansionSearchService.searchEvents(searchStr);
  };

  // Returns landmark search results for the given query.
  private onSearchLandmarks = (searchStr: string) => {
    return this._expansionSearchService.searchLandmarks(searchStr);
  };

  // Returns artifact search results for the given query.
  private onSearchArtifacts = (searchStr: string) => {
    return this._expansionSearchService.searchArtifacts(searchStr);
  };

  // Returns project search results for the given query.
  private onSearchProjects = (searchStr: string) => {
    return this._expansionSearchService.searchProjects(searchStr);
  };

  public expansionLoaded(expansion: ExpansionListElement) {
    console.log(`[game] expansion '${expansion.name}' loaded`);
    this._availableExpansion.push(expansion);
    this._io.in('game').emit(
      'expansionList',
      this._availableExpansion.sort((a, b) => b.order - a.order),
    );

    this._expansionSearchService.rebuildIndexes();
  }

  // Exports the current match state and card library for local debug tooling.
  public exportMatchState(): { match: Match; cardLibrary: Record<CardId, Card> } | null {
    if (!this._matchController) return null;
    return this._matchController.exportMatchState();
  }

  // Merges a partial match update into the live match state and broadcasts it.
  public mergeMatchState(partial: Partial<Match>): { ok: boolean; errors?: string[] } {
    if (!this._matchController) {
      return { ok: false, errors: ['match not initialized'] };
    }
    return this._matchController.applyPartialMatchUpdate(partial);
  }

  public addPlayer(sessionId: string, socket: AppSocket) {
    if (this.players.length >= 6) {
      console.info(`[game] game has 6 players, rejecting`);
      socket.disconnect(true);
      return;
    }

    let player = this.players.find((p) => p.sessionId === sessionId);

    if (this.matchStarted && !player) {
      console.info(`[game] match has already started, and player not found in game, rejecting`);
      socket.disconnect();
      return;
    }

    if (player) {
      console.info(`[game] ${player} already in match - assigning socket ID`);
      player.socketId = socket.id;
      player.sessionId = sessionId;
      player.connected = true;
    } else {
      player = createNewPlayer(sessionId, socket);
      this.players.push(player);
    }

    socket.join('game');
    player.connected = true;
    this._socketMap.set(player.id, socket);

    socket.emit('setPlayerList', this.players);
    this._io.in('game').emit('playerConnected', player);
    socket.emit('setPlayer', player);

    if (!this.owner || this.owner.isComputer) {
      console.info(`[game] game owner does not exist, setting to ${player}`);
      this.owner = player;
    }

    if (this.owner?.id === player.id) {
      this.bindOwnerLobbyHandlers(socket, player.id);
    }

    this._io.in('game').emit('gameOwnerUpdated', this.owner.id);

    console.log(`[game] ${player} added to game`);

    if (this.matchStarted) {
      console.info('[game] game already started');
      // Restore the current turn order for reconnecting clients.
      socket.emit('setPlayerList', this.players);
      // Remove any pending removal vote if the player reconnects.
      this.removePendingRemovalPlayer(player.id);
      this._matchController?.playerReconnected(player.id, socket);
      this.registerRemovalVoteHandler(socket, player.id);
      // Resume flow if no human players remain disconnected.
      const hasDisconnectedHuman = this.players.some((p) => !p.connected && !p.isComputer);
      if (!hasDisconnectedHuman) {
        void this._matchController?.runGameAction('checkForRemainingPlayerActions');
      }
    } else {
      console.info(`[game] not yet started, sending player to match configuration`);
      socket.emit(
        'expansionList',
        this._availableExpansion.sort((a, b) => a.order - b.order),
      );

      socket.emit('matchConfigurationUpdated', this._matchConfiguration!);
      this._lobbySocketBindings.bindPlayerLobbyHandlers(socket, {
        onUpdatePlayerName: this.onUpdatePlayerName,
        onPlayerReady: this.onPlayerReady,
      });
    }

    socket.on(
      'disconnect',
      (arg) => this.onPlayerDisconnected(player.id, arg.toString()),
    );
  }

  private onPlayerDisconnected = (playerId: number, reason: string) => {
    console.info(`[game] ${playerId} disconnected - ${reason}`);

    const player = this.players.find((player) => player.id === playerId);
    if (!player) {
      this._socketMap.delete(playerId);
      console.warn(`[game] player disconnected, but cannot find player object`);
      return;
    }

    player.connected = false;
    player.ready = false;

    const hasConnectedHuman = this.players.some((p) => p.connected && !p.isComputer);
    if (!hasConnectedHuman && this._endMatchWhenNoHumans) {
      console.log('[game] no human players left in game, clearing game state completely');
      this.clearMatch();
      return;
    }

    if (player.id === this.owner?.id) {
      this._lobbySocketBindings.unbindOwnerLobbyHandlers(this._socketMap.get(player.id));

      const replacement = this.players.find((p) => p.connected && !p.isComputer);
      if (replacement) {
        this.owner = replacement;
        this._io.in('game').emit('gameOwnerUpdated', replacement.id);
        const replacementSocket = this._socketMap.get(replacement.id);
        if (replacementSocket) {
          this.bindOwnerLobbyHandlers(replacementSocket, replacement.id);
        }
      }
    }

    if (this.matchStarted) {
      this._matchController?.playerDisconnected(player.id);
      // Begin removal vote flow for disconnected humans.
      if (!player.isComputer) {
        this.addPendingRemovalPlayer(player.id);
      }
    }
    this._io.in('game').emit('playerDisconnected', player);
  };

  private clearMatch = () => {
    console.log(`[game] clearing match`);

    this._socketMap.forEach((socket) => {
      socket.offAnyIncoming();
      socket.leave('game');
    });

    this._socketMap.clear();
    this.players = [];
    this.owner = undefined;
    this.matchStarted = false;
    this.createNewMatch();
  };

  private onMatchConfigurationUpdated = async (newConfig: MatchConfiguration) => {
    console.info(`[game] received expansionSelected socket event`);
    console.debug(newConfig);

    const currentConfig = structuredClone(this._matchConfiguration ?? {}) as MatchConfiguration;
    // Enforce expansion mutual-exclusion rules before applying the updated lobby config.
    await this._expansionCompatibilityService.applyMutualExclusions(currentConfig, newConfig);

    const kingdomPatch = jsonPatch.compare(currentConfig.kingdomSupply, newConfig.kingdomSupply);
    if (kingdomPatch.length) {
      this._configStore.persistPreselectedKingdoms(newConfig.kingdomSupply);
      defaultMatchConfiguration.kingdomSupply = structuredClone(newConfig.kingdomSupply);
    }

    const bannedKingdomsPatch = jsonPatch.compare(currentConfig.bannedKingdoms, newConfig.bannedKingdoms);
    if (bannedKingdomsPatch.length) {
      this._configStore.persistBannedKingdoms(newConfig.bannedKingdoms);
      defaultMatchConfiguration.bannedKingdoms = structuredClone(newConfig.bannedKingdoms);
    }

    const eventsPatch = jsonPatch.compare(currentConfig.events, newConfig.events);
    if (eventsPatch.length) {
      // Persist selected events between sessions.
      this._configStore.persistEvents(newConfig.events);
      defaultMatchConfiguration.events = structuredClone(newConfig.events);
    }

    const landmarksPatch = jsonPatch.compare(currentConfig.landmarks, newConfig.landmarks);
    if (landmarksPatch.length) {
      // Persist selected landmarks between sessions.
      this._configStore.persistLandmarks(newConfig.landmarks);
      defaultMatchConfiguration.landmarks = structuredClone(newConfig.landmarks);
    }

    const artifactsPatch = jsonPatch.compare(currentConfig.artifacts, newConfig.artifacts);
    if (artifactsPatch.length) {
      // Persist selected artifacts between sessions.
      this._configStore.persistArtifacts(newConfig.artifacts);
      defaultMatchConfiguration.artifacts = structuredClone(newConfig.artifacts);
    }

    const patch = jsonPatch.compare(currentConfig, newConfig);

    if (patch.length) {
      jsonPatch.applyPatch(this._matchConfiguration, patch);
      defaultMatchConfiguration.preselectedKingdoms = newConfig.kingdomSupply.map((supply) => supply.cards[0]);
      this._matchConfiguration!.preselectedKingdoms = newConfig.kingdomSupply.map((supply) => supply.cards[0]);
      // lobby phase – raw object still useful for the config screen
      this._io.in('game').emit('matchConfigurationUpdated', this._matchConfiguration!);
    }
  };

  private onUpdatePlayerName = (playerId: number, name: string) => {
    console.info(
      `[game] player ${playerId} request to update name to '${name}'`,
    );

    const player = this.players.find((player) => player.id === playerId);

    if (player) {
      player.name = name;
      console.info(`[game] ${player} name updated to '${name}'`);
    } else {
      console.info(`[game] player ${playerId} not found`);
    }

    this._io.in('game').emit('playerNameUpdated', playerId, name);
  };

  private onPlayerReady = (playerId: number) => {
    const player = this.players.find((player) => player.id === playerId);

    if (!player) {
      console.warn(`[game] received player ready event from ${playerId} but could not find Player object`);
      return;
    }

    console.info(`[game] received ready event from ${player}`);

    player.ready = !player.ready;
    console.info(`[game] marking ${player} as ${player.ready}`);
    this._io.in('game').except(player.socketId).emit('playerReady', playerId, player.ready);

    if (this.players.some((p) => !p.ready && p.connected)) {
      console.debug(`[game] not all players ready yet`);
      return;
    }

    this.startMatch();
  };

  // Adds one or more computer players to the lobby, owned by the game owner.
  private onAddComputerPlayer = (ownerId: PlayerId, count: number = 1) => {
    if (!this.owner || this.owner.id !== ownerId) {
      console.warn(`[game] ignoring addComputerPlayer from non-owner ${ownerId}`);
      return;
    }

    if (this.matchStarted) {
      console.warn('[game] match already started, cannot add computer players');
      return;
    }

    for (let i = 0; i < count; i++) {
      if (this.players.length >= 6) {
        console.warn('[game] player limit reached, cannot add computer player');
        break;
      }

      const bot = createComputerPlayer();
      this.players.push(bot);
      this._io.in('game').emit('playerConnected', bot);
    }
  };

  private startMatch() {
    console.log(`[game] all connected players ready, proceeding to start match`);

    this.matchStarted = true;

    this._socketMap.forEach((socket) => {
      this._lobbySocketBindings.unbindPlayerLobbyHandlers(socket);
      this._lobbySocketBindings.unbindOwnerLobbyHandlers(socket);
    });

    const colors = ['#10FF19', '#3c69ff', '#FF0BF2', '#FFF114', '#FF1F11', '#FF9900'];
    const players = fisherYatesShuffle(
      this.players
        .filter((p) => p.connected)
        .map((p, idx) => {
          // Keep computer players ready to avoid blocking match start.
          p.ready = p.isComputer;
          p.color = colors[idx];
          return p;
        }),
    );

    // Lock in turn order for the active match.
    this.players = players;

    this._io.in('game').emit('setPlayerList', players);

    this._matchController?.on('gameOver', this.clearMatch);

    void this._matchController?.initialize(
      {
        ...structuredClone(defaultMatchConfiguration),
        ...this._matchConfiguration,
        players,
      } as MatchConfiguration,
    );

    // Register removal vote handlers once the match is active.
    for (const [playerId, socket] of this._socketMap.entries()) {
      this.registerRemovalVoteHandler(socket, playerId);
    }
  }

  // Registers the socket handler for removal votes.
  private registerRemovalVoteHandler(socket: AppSocket, playerId: PlayerId) {
    socket.on('removeDisconnectedPlayer', (targetPlayerId: PlayerId) => {
      this.onRemoveDisconnectedPlayerVote(playerId, targetPlayerId);
    });
  }

  // Handles a connected human player's vote to remove a disconnected player.
  private onRemoveDisconnectedPlayerVote(voterId: PlayerId, targetPlayerId: PlayerId) {
    if (!this.matchStarted) return;
    // Only allow voting for the current pending target.
    if (this.getPendingRemovalPlayerId() !== targetPlayerId) return;

    const voter = this.players.find((p) => p.id === voterId);
    const target = this.players.find((p) => p.id === targetPlayerId);
    if (!voter || !target) return;
    if (voter.isComputer || !voter.connected) return;
    if (target.isComputer || target.connected) return;

    const connectedHumans = this.players.filter((p) => p.connected && !p.isComputer && p.id !== targetPlayerId);
    if (!connectedHumans.length) return;

    const votes = this._removalVotes.get(targetPlayerId) ?? new Set<PlayerId>();
    votes.add(voterId);
    this._removalVotes.set(targetPlayerId, votes);

    const allVoted = connectedHumans.every((p) => votes.has(p.id));
    if (!allVoted) return;

    // Remove the player from the match and resume play.
    this.players = this.players.filter((p) => p.id !== targetPlayerId);
    this._socketMap.delete(targetPlayerId);
    this._matchController?.removePlayerFromMatch(targetPlayerId);
    this._io.in('game').emit('setPlayerList', this.players);

    if (this.owner?.id === targetPlayerId) {
      const replacement = this.players.find((p) => p.connected && !p.isComputer);
      if (replacement) {
        this.owner = replacement;
        this._io.in('game').emit('gameOwnerUpdated', replacement.id);
      }
    }

    this.removePendingRemovalPlayer(targetPlayerId);
    void this._matchController?.runGameAction('checkForRemainingPlayerActions');
  }

  // Returns the current pending removal target, if any.
  private getPendingRemovalPlayerId(): PlayerId | undefined {
    return this._pendingRemovalQueue[0];
  }

  // Adds a disconnected human player to the removal queue.
  private addPendingRemovalPlayer(playerId: PlayerId) {
    if (this._pendingRemovalQueue.includes(playerId)) return;
    this._pendingRemovalQueue.push(playerId);
    this.sortPendingRemovalQueue();
    // Ensure we track votes for the pending player.
    this._removalVotes.set(playerId, this._removalVotes.get(playerId) ?? new Set());
  }

  // Removes a player from the pending queue and clears their votes.
  private removePendingRemovalPlayer(playerId: PlayerId) {
    this._pendingRemovalQueue = this._pendingRemovalQueue.filter((id) => id !== playerId);
    this._removalVotes.delete(playerId);
    this.sortPendingRemovalQueue();
  }

  // Keeps the queue ordered by current player list while filtering out reconnected/computer players.
  private sortPendingRemovalQueue() {
    const disconnectedHumans = new Set(
      this.players
        .filter((p) => !p.connected && !p.isComputer)
        .map((p) => p.id),
    );
    this._pendingRemovalQueue = this._pendingRemovalQueue.filter((id) => disconnectedHumans.has(id));
    const order = new Map(this.players.map((p, idx) => [p.id, idx]));
    this._pendingRemovalQueue.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  }

  // Binds owner-only lobby handlers for the provided owner socket.
  private bindOwnerLobbyHandlers(socket: AppSocket, ownerId: PlayerId) {
    this._lobbySocketBindings.bindOwnerLobbyHandlers(socket, {
      onMatchConfigurationUpdated: this.onMatchConfigurationUpdated,
      onAddComputerPlayer: (count?: number) => this.onAddComputerPlayer(ownerId, count),
      onSearchCards: (playerId, searchTerm) => {
        this._socketMap.get(playerId)?.emit('searchCardResponse', this.onSearchCards(searchTerm));
      },
      onSearchEvents: (playerId, searchTerm) => {
        this._socketMap.get(playerId)?.emit('searchEventResponse', this.onSearchEvents(searchTerm));
      },
      onSearchLandmarks: (playerId, searchTerm) => {
        this._socketMap.get(playerId)?.emit('searchLandmarkResponse', this.onSearchLandmarks(searchTerm));
      },
      onSearchArtifacts: (playerId, searchTerm) => {
        this._socketMap.get(playerId)?.emit('searchArtifactResponse', this.onSearchArtifacts(searchTerm));
      },
      onSearchProjects: (playerId, searchTerm) => {
        this._socketMap.get(playerId)?.emit('searchProjectResponse', this.onSearchProjects(searchTerm));
      },
    });
  }
}
