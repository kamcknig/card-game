import {AppSocket, MatchBaseConfiguration} from '../types.ts';
import {
  Card,
  CardId,
  CardNoId,
  EventNoId,
  ExpansionListElement,
  LandmarkNoId,
  Match,
  MatchConfiguration,
  Player,
  PlayerId,
} from 'shared/shared-types';
import {createComputerPlayer, createNewPlayer} from '../utils/create-new-player.ts';
import {io} from '../server.ts';
import {MatchController} from './match-controller.ts';
import {expansionLibrary, rawCardLibrary} from '@expansions/expansion-library.ts';
import {applyPatch, compare} from 'fast-json-patch';
import Fuse, {IFuseOptions} from 'fuse.js';
import {fisherYatesShuffle} from '../utils/fisher-yates-shuffler.ts';

const defaultMatchConfiguration: MatchConfiguration = {
  expansions: [
    {
      'title': 'Base',
      'name': 'base-v2',
      'order': 1
    },
    {
      'title': 'Intrigue',
      'name': 'intrigue',
      'order': 2
    },
    {
      'title': 'Seaside',
      'name': 'seaside',
      'order': 3
    }
  ],
  preselectedKingdoms: [],
  bannedKingdoms: [],
  players: [],
  basicSupply: [],
  kingdomSupply: [],
  events: [],
  // Default landmark selection for new lobbies.
  landmarks: [],
  // Default boons selection for new lobbies.
  boons: [],
  playerStartingHand: { ...MatchBaseConfiguration.playerStartingHand }
};

export class Game {
  public players: Player[] = [];
  public owner: Player | undefined;
  public matchStarted: boolean = false;
  // Track pending removal votes for disconnected human players in queue order.
  private _pendingRemovalQueue: PlayerId[] = [];
  private _removalVotes: Map<PlayerId, Set<PlayerId>> = new Map();

  private _socketMap: Map<PlayerId, AppSocket> = new Map();
  private _matchController: MatchController | undefined;
  private _matchConfiguration: MatchConfiguration | undefined;
  private _availableExpansion: ExpansionListElement[] = [];
  private _fuse: Fuse<CardNoId> | undefined;
  // Event search uses a separate index from kingdom cards.
  private _eventFuse: Fuse<EventNoId> | undefined;
  // Landmark search uses a separate index from events and kingdom cards.
  private _landmarkFuse: Fuse<LandmarkNoId> | undefined;
  // When true, the game ends automatically if no human players remain connected.
  private readonly _endMatchWhenNoHumans: boolean;

  constructor() {
    console.log(`[game] created`);
    // Configure whether to end the match when all human players leave (default: true).
    const endOnNoHumansEnv = Deno.env.get('END_MATCH_ON_NO_HUMANS') ?? 'true';
    this._endMatchWhenNoHumans = endOnNoHumansEnv.toLowerCase() !== 'false';
    try {
      defaultMatchConfiguration.bannedKingdoms = JSON.parse(Deno.readTextFileSync('./banned-kingdoms.json')) as CardNoId[];
    } catch (e) {
      console.warn(`Couldn't read banned-kingdoms.json`);
      console.error(e);
    }

    // Load preselected events from disk when available.
    try {
      console.info(`[game] loading preselected kingdoms from disk`);
      const preselectedKingdoms = JSON.parse(Deno.readTextFileSync('./preselected-kingdoms.json')) as {
        name: string;
        cards: CardNoId[]
      }[];

      if (preselectedKingdoms?.length > 0) {
        console.debug(preselectedKingdoms);
      }

      defaultMatchConfiguration.preselectedKingdoms = preselectedKingdoms.map(supply => supply.cards[0]);
    } catch (e) {
      console.warn(`Couldn't read preselected-kingdoms.json`);
      console.error(e);
    }

    try {
      console.info(`[game] loading preselected events from disk`);

      const preselectedEvents = JSON.parse(Deno.readTextFileSync('./preselected-events.json')) as EventNoId[];

      if (preselectedEvents?.length > 0) {
        console.debug(preselectedEvents);
      }

      defaultMatchConfiguration.events = preselectedEvents;
    } catch (e) {
      console.warn(`Couldn't read preselected-events.json`);
      console.error(e);
    }

    try {
      console.info(`[game] loading preselected landmarks from disk`);

      const preselectedLandmarks = JSON.parse(Deno.readTextFileSync('./preselected-landmarks.json')) as LandmarkNoId[];

      if (preselectedLandmarks?.length > 0) {
        console.debug(preselectedLandmarks);
      }

      defaultMatchConfiguration.landmarks = preselectedLandmarks;
    } catch (e) {
      console.warn(`Couldn't read preselected-landmarks.json`);
      console.error(e);
    }

    this.initializeFuseSearch();
    this.initializeEventFuse();
    this.initializeLandmarkFuse();

    this.createNewMatch();
  }

  private createNewMatch() {
    this._matchController = new MatchController(
      this._socketMap,
      (searchTerm: string) => this.onSearchCards(searchTerm)
    );
    this._matchConfiguration = { ...structuredClone(defaultMatchConfiguration) }
  }

  private initializeFuseSearch() {
    console.info(`[game] initializing fuse search`);

    if (this._fuse) {
      this._fuse.remove(() => true);
      this._fuse = undefined;
    }

    const libraryArr = Object.values(rawCardLibrary);
    const index = Fuse.createIndex(['cardName'], libraryArr);

    const fuseOptions: IFuseOptions<CardNoId> = {
      ignoreDiacritics: true,
      minMatchCharLength: 1,
      distance: 2,
      keys: ['cardName']
    };
    this._fuse = new Fuse(libraryArr, fuseOptions, index);
  }

  // Builds the event search index from loaded expansion events.
  private initializeEventFuse() {
    console.info(`[game] initializing event fuse search`);

    if (this._eventFuse) {
      this._eventFuse.remove(() => true);
      this._eventFuse = undefined;
    }

    const eventLibraryArr = Object.values(expansionLibrary)
      .flatMap(expansion => Object.values(expansion.events ?? {}));
    const index = Fuse.createIndex(['cardName'], eventLibraryArr);

    const fuseOptions: IFuseOptions<EventNoId> = {
      ignoreDiacritics: true,
      minMatchCharLength: 1,
      distance: 2,
      keys: ['cardName']
    };
    this._eventFuse = new Fuse(eventLibraryArr, fuseOptions, index);
  }

  // Builds the landmark search index from loaded expansion landmarks.
  private initializeLandmarkFuse() {
    console.info(`[game] initializing landmark fuse search`);

    if (this._landmarkFuse) {
      this._landmarkFuse.remove(() => true);
      this._landmarkFuse = undefined;
    }

    const landmarkLibraryArr = Object.values(expansionLibrary)
      .flatMap(expansion => Object.values(expansion.landmarks ?? {}));
    const index = Fuse.createIndex(['cardName'], landmarkLibraryArr);

    const fuseOptions: IFuseOptions<LandmarkNoId> = {
      ignoreDiacritics: true,
      minMatchCharLength: 1,
      distance: 2,
      keys: ['cardName']
    };
    this._landmarkFuse = new Fuse(landmarkLibraryArr, fuseOptions, index);
  }

  private onSearchCards = (searchStr: string) => {
    const results = this._fuse?.search(searchStr);
    return results?.map(r => r.item) ?? [];
  };

  // Returns event search results for the given query.
  private onSearchEvents = (searchStr: string) => {
    const results = this._eventFuse?.search(searchStr);
    return results?.map(r => r.item) ?? [];
  };

  // Returns landmark search results for the given query.
  private onSearchLandmarks = (searchStr: string) => {
    const results = this._landmarkFuse?.search(searchStr);
    return results?.map(r => r.item) ?? [];
  };

  public expansionLoaded(expansion: ExpansionListElement) {
    console.log(`[game] expansion '${expansion.name}' loaded`);
    this._availableExpansion.push(expansion);
    io.in('game').emit(
      'expansionList',
      this._availableExpansion.sort((a, b) => b.order - a.order),
    );

    this.initializeFuseSearch();
    this.initializeEventFuse();
    this.initializeLandmarkFuse();
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
      console.info(`[game] match has already started, and player not found in game, rejecting`,);
      socket.disconnect();
      return;
    }

    if (player) {
      console.info(`[game] ${player} already in match - assigning socket ID`);
      player.socketId = socket.id;
      player.sessionId = sessionId;
      player.connected = true;
    }
    else {
      player = createNewPlayer(sessionId, socket);
      this.players.push(player);
    }

    socket.join('game');
    player.connected = true;
    this._socketMap.set(player.id, socket);

    socket.emit('setPlayerList', this.players);
    io.in('game').emit('playerConnected', player);
    socket.emit('setPlayer', player);

    if (!this.owner || this.owner.isComputer) {
      console.info(`[game] game owner does not exist, setting to ${player}`);
      this.owner = player;
    }

    if (this.owner?.id === player.id) {
      socket.on('matchConfigurationUpdated', this.onMatchConfigurationUpdated);
      // Allow the owner to add computer players during lobby.
      socket.on('addComputerPlayer', (count?: number) => this.onAddComputerPlayer(player.id, count));
      socket.on('searchCards', (playerId, searchTerm) => {
        this._socketMap.get(playerId)?.emit('searchCardResponse', this.onSearchCards(searchTerm));
      });
      // Relay event search results to the requesting client.
      socket.on('searchEvents', (playerId, searchTerm) => {
        this._socketMap.get(playerId)?.emit('searchEventResponse', this.onSearchEvents(searchTerm));
      });
      // Relay landmark search results to the requesting client.
      socket.on('searchLandmarks', (playerId, searchTerm) => {
        this._socketMap.get(playerId)?.emit('searchLandmarkResponse', this.onSearchLandmarks(searchTerm));
      });
    }

    io.in('game').emit('gameOwnerUpdated', this.owner.id);

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
      const hasDisconnectedHuman = this.players.some(p => !p.connected && !p.isComputer);
      if (!hasDisconnectedHuman) {
        void this._matchController?.runGameAction('checkForRemainingPlayerActions');
      }
    }
    else {
      console.info(`[game] not yet started, sending player to match configuration`,);
      socket.emit(
        'expansionList',
        this._availableExpansion.sort((a, b) => a.order - b.order),
      );

      socket.emit('matchConfigurationUpdated', this._matchConfiguration!);
      socket.on('updatePlayerName', this.onUpdatePlayerName);
      socket.on('playerReady', this.onPlayerReady);
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
      console.log('[game] no human players left in game, clearing game state completely',);
      this.clearMatch()
      return;
    }

    if (player.id === this.owner?.id) {
      this._socketMap.get(player.id)?.off('matchConfigurationUpdated');
      this._socketMap.get(player.id)?.off('searchCards');
      this._socketMap.get(player.id)?.off('searchEvents');
      this._socketMap.get(player.id)?.off('searchLandmarks');
      this._socketMap.get(player.id)?.off('addComputerPlayer');

      const replacement = this.players.find(p => p.connected && !p.isComputer);
      if (replacement) {
        this.owner = replacement;
        io.in('game').emit('gameOwnerUpdated', replacement.id);
        this._socketMap.get(replacement.id)?.on('searchCards', (playerId, searchTerm) => {
          this._socketMap.get(playerId)?.emit('searchCardResponse', this.onSearchCards(searchTerm));
        });
        // Relay event search results to the requesting client.
        this._socketMap.get(replacement.id)?.on('searchEvents', (playerId, searchTerm) => {
          this._socketMap.get(playerId)?.emit('searchEventResponse', this.onSearchEvents(searchTerm));
        });
        // Relay landmark search results to the requesting client.
        this._socketMap.get(replacement.id)?.on('searchLandmarks', (playerId, searchTerm) => {
          this._socketMap.get(playerId)?.emit('searchLandmarkResponse', this.onSearchLandmarks(searchTerm));
        });
        this._socketMap.get(replacement.id)?.on('matchConfigurationUpdated', this.onMatchConfigurationUpdated);
        this._socketMap.get(replacement.id)?.on('addComputerPlayer', (count?: number) => this.onAddComputerPlayer(replacement.id, count));
      }
    }

    if (this.matchStarted) {
      this._matchController?.playerDisconnected(player.id);
      // Begin removal vote flow for disconnected humans.
      if (!player.isComputer) {
        this.addPendingRemovalPlayer(player.id);
      }
    }
    io.in('game').emit('playerDisconnected', player);
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
  }

  private onMatchConfigurationUpdated = async (newConfig: MatchConfiguration) => {
    console.info(`[game] received expansionSelected socket event`);
    console.debug(newConfig);

    const currentConfig = structuredClone(this._matchConfiguration ?? {}) as MatchConfiguration;

    const newExpansions = newConfig.expansions.filter(
      (e) => currentConfig?.expansions?.findIndex(curr => curr.name === e.name) === -1,
    );

    const expansionsToRemove: string[] = [];

    // go through the new expansions to add, if any are mutually exclusive with some we still have
    // selected, then remove those selected ones as well
    for (const expansion of newExpansions) {
      let configModule = undefined;

      try {
        configModule =
          (await import(`../expansions/${expansion.name}/configuration-${expansion.name}.json`, {
            with: { type: 'json' },
          }))?.default;
      } catch (e) {
        // nothing
      }

      if (!configModule) {
        console.warn(`[game] could not find config module for expansion '${expansion.name}'`,);
        continue;
      }

      if (!configModule.mutuallyExclusiveExpansions) {
        console.debug(`[game] module for expansion '${expansion.name}' contains no mutually exclusive expansions`,);
        continue;
      }

      console.info(`[game] '${expansion.name}' is mutually exclusive with ${configModule.mutuallyExclusiveExpansions}`,);

      for (const exclusiveExpansion of configModule.mutuallyExclusiveExpansions) {
        // Compare by name because mutuallyExclusiveExpansions are string keys.
        const hasExclusiveExpansion = currentConfig.expansions
          .some(currentExpansion => currentExpansion.name === exclusiveExpansion);
        if (hasExclusiveExpansion && !expansionsToRemove.includes(exclusiveExpansion)) {
          console.info(`[game] removing expansion ${exclusiveExpansion} as it is not allowed with ${expansion}`,);
          expansionsToRemove.push(exclusiveExpansion);
        }
      }
    }

    if (expansionsToRemove.length) {
      // Enforce mutual exclusivity by filtering out disallowed expansion names.
      newConfig.expansions = newConfig.expansions
        .filter(expansion => !expansionsToRemove.includes(expansion.name));
    }

    const kingdomPatch = compare(currentConfig.kingdomSupply, newConfig.kingdomSupply);
    if (kingdomPatch.length) {
      Deno.writeTextFileSync('./preselected-kingdoms.json', JSON.stringify(newConfig.kingdomSupply));
      defaultMatchConfiguration.kingdomSupply = structuredClone(newConfig.kingdomSupply);
    }

    const bannedKingdomsPatch = compare(currentConfig.bannedKingdoms, newConfig.bannedKingdoms);
    if (bannedKingdomsPatch.length) {
      Deno.writeTextFileSync('./banned-kingdoms.json', JSON.stringify(newConfig.bannedKingdoms));
      defaultMatchConfiguration.bannedKingdoms = structuredClone(newConfig.bannedKingdoms);
    }

    const eventsPatch = compare(currentConfig.events, newConfig.events);
    if (eventsPatch.length) {
      // Persist selected events between sessions.
      Deno.writeTextFileSync('./preselected-events.json', JSON.stringify(newConfig.events));
      defaultMatchConfiguration.events = structuredClone(newConfig.events);
    }

    const landmarksPatch = compare(currentConfig.landmarks, newConfig.landmarks);
    if (landmarksPatch.length) {
      // Persist selected landmarks between sessions.
      Deno.writeTextFileSync('./preselected-landmarks.json', JSON.stringify(newConfig.landmarks));
      defaultMatchConfiguration.landmarks = structuredClone(newConfig.landmarks);
    }

    const patch = compare(currentConfig, newConfig);

    if (patch.length) {
      applyPatch(this._matchConfiguration, patch)
      defaultMatchConfiguration.preselectedKingdoms = newConfig.kingdomSupply.map(supply => supply.cards[0]);
      this._matchConfiguration!.preselectedKingdoms = newConfig.kingdomSupply.map(supply => supply.cards[0])
      // lobby phase – raw object still useful for the config screen
      io.in('game').emit('matchConfigurationUpdated', this._matchConfiguration!);
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
    }
    else {
      console.info(`[game] player ${playerId} not found`);
    }

    io.in('game').emit('playerNameUpdated', playerId, name);
  };

  private onPlayerReady = (playerId: number) => {
    const player = this.players.find((player) => player.id === playerId);

    if (!player) {
      console.warn(`[game] received player ready event from ${playerId} but could not find Player object`,);
      return;
    }

    console.info(`[game] received ready event from ${player}`);

    player.ready = !player.ready;
    console.info(`[game] marking ${player} as ${player.ready}`);
    io.in('game').except(player.socketId).emit('playerReady', playerId, player.ready);

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
      io.in('game').emit('playerConnected', bot);
    }
  };

  private startMatch() {
    console.log(`[game] all connected players ready, proceeding to start match`);

    this.matchStarted = true;

    this._socketMap.forEach((socket) => {
      socket.off('updatePlayerName');
      socket.off('playerReady');
      socket.off('matchConfigurationUpdated');
      socket.off('searchCards');
      socket.off('searchEvents');
    });

    const colors = ['#10FF19', '#3c69ff', '#FF0BF2', '#FFF114', '#FF1F11', '#FF9900'];
    const players = fisherYatesShuffle(
      this.players
        .filter(p => p.connected)
        .map((p, idx) => {
          // Keep computer players ready to avoid blocking match start.
          p.ready = p.isComputer;
          p.color = colors[idx]
          return p;
        })
    );

    // Lock in turn order for the active match.
    this.players = players;

    io.in('game').emit('setPlayerList', players);

    this._matchController?.on('gameOver', this.clearMatch);

    void this._matchController?.initialize(
      {
        ...structuredClone(defaultMatchConfiguration),
        ...this._matchConfiguration,
        players,
      } as MatchConfiguration
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

    const voter = this.players.find(p => p.id === voterId);
    const target = this.players.find(p => p.id === targetPlayerId);
    if (!voter || !target) return;
    if (voter.isComputer || !voter.connected) return;
    if (target.isComputer || target.connected) return;

    const connectedHumans = this.players.filter(p => p.connected && !p.isComputer && p.id !== targetPlayerId);
    if (!connectedHumans.length) return;

    const votes = this._removalVotes.get(targetPlayerId) ?? new Set<PlayerId>();
    votes.add(voterId);
    this._removalVotes.set(targetPlayerId, votes);

    const allVoted = connectedHumans.every(p => votes.has(p.id));
    if (!allVoted) return;

    // Remove the player from the match and resume play.
    this.players = this.players.filter(p => p.id !== targetPlayerId);
    this._socketMap.delete(targetPlayerId);
    this._matchController?.removePlayerFromMatch(targetPlayerId);
    io.in('game').emit('setPlayerList', this.players);

    if (this.owner?.id === targetPlayerId) {
      const replacement = this.players.find(p => p.connected && !p.isComputer);
      if (replacement) {
        this.owner = replacement;
        io.in('game').emit('gameOwnerUpdated', replacement.id);
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
    this._pendingRemovalQueue = this._pendingRemovalQueue.filter(id => id !== playerId);
    this._removalVotes.delete(playerId);
    this.sortPendingRemovalQueue();
  }

  // Keeps the queue ordered by current player list while filtering out reconnected/computer players.
  private sortPendingRemovalQueue() {
    const disconnectedHumans = new Set(
      this.players
        .filter(p => !p.connected && !p.isComputer)
        .map(p => p.id)
    );
    this._pendingRemovalQueue = this._pendingRemovalQueue.filter(id => disconnectedHumans.has(id));
    const order = new Map(this.players.map((p, idx) => [p.id, idx]));
    this._pendingRemovalQueue.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  }
}
