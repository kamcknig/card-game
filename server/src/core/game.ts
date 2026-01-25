import { AppSocket, MatchBaseConfiguration } from '../types.ts';
import { Card, CardId, CardNoId, EventNoId, ExpansionListElement, Match, MatchConfiguration, Player, PlayerId, } from 'shared/shared-types.ts';
import { createComputerPlayer, createNewPlayer } from '../utils/create-new-player.ts';
import { io } from '../server.ts';
import { MatchController } from './match-controller.ts';
import { expansionLibrary, rawCardLibrary } from '@expansions/expansion-library.ts';
import { applyPatch, compare } from 'https://esm.sh/v123/fast-json-patch@3.1.1/index.js';
import Fuse, { IFuseOptions } from 'fuse.js';
import { fisherYatesShuffle } from '../utils/fisher-yates-shuffler.ts';

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
  playerStartingHand: { ...MatchBaseConfiguration.playerStartingHand }
};

export class Game {
  public players: Player[] = [];
  public owner: Player | undefined;
  public matchStarted: boolean = false;
  
  private _socketMap: Map<PlayerId, AppSocket> = new Map();
  private _matchController: MatchController | undefined;
  private _matchConfiguration: MatchConfiguration | undefined;
  private _availableExpansion: ExpansionListElement[] = [];
  private _fuse: Fuse<CardNoId> | undefined;
  // Event search uses a separate index from kingdom cards.
  private _eventFuse: Fuse<EventNoId> | undefined;
  
  constructor() {
    console.log(`[game] created`);
    try {
      const bannedKingdoms = JSON.parse(Deno.readTextFileSync('./banned-kingdoms.json')) as CardNoId[];
      defaultMatchConfiguration.bannedKingdoms = bannedKingdoms;
    } catch (e) {
      console.warn(`Couldn't read banned-kingdoms.json`);
      console.error(e);
    }
    
    // Load preselected events from disk when available.
    try {
      const preselectedKingdoms = JSON.parse(Deno.readTextFileSync('./preselected-kingdoms.json')) as {
        name: string;
        cards: CardNoId[]
      }[];
      console.log(preselectedKingdoms);
      defaultMatchConfiguration.preselectedKingdoms = preselectedKingdoms.map(supply => supply.cards[0]);
      console.log(defaultMatchConfiguration.preselectedKingdoms)
    } catch (e) {
      console.warn(`Couldn't read preselected-kingdoms.json`);
      console.error(e);
    }
    
    try {
      const preselectedEvents = JSON.parse(Deno.readTextFileSync('./preselected-events.json')) as EventNoId[];
      defaultMatchConfiguration.events = preselectedEvents;
    } catch (e) {
      console.warn(`Couldn't read preselected-events.json`);
      console.error(e);
    }
    
    this.initializeFuseSearch();
    this.initializeEventFuse();
    
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
    console.log(`[game] initializing fuse search`);
    
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
    console.log(`[game] initializing event fuse search`);
    
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
  
  private onSearchCards = (searchStr: string) => {
    const results = this._fuse?.search(searchStr);
    return results?.map(r => r.item) ?? [];
  };
  
  // Returns event search results for the given query.
  private onSearchEvents = (searchStr: string) => {
    const results = this._eventFuse?.search(searchStr);
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
  }

  // Exports the current match state and card library for local debug tooling.
  public exportMatchState(): { match: Match; cardLibrary: Record<CardId, Card> } | null {
    if (!this._matchController) return null;
    return this._matchController.exportMatchState();
  }
  
  public addPlayer(sessionId: string, socket: AppSocket) {
    if (this.players.length >= 6) {
      console.log(`[game] game has 6 players, rejecting`);
      socket.disconnect(true);
      return;
    }
    
    let player = this.players.find((p) => p.sessionId === sessionId);
    
    if (this.matchStarted && !player) {
      console.log(`[game] match has already started, and player not found in game, rejecting`,);
      socket.disconnect();
      return;
    }
    
    if (player) {
      console.log(`[game] ${player} already in match - assigning socket ID`);
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
    
    if (!this.owner) {
      console.log(`[game] game owner does not exist, setting to ${player}`);
      this.owner = player;
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
    }
    
    io.in('game').emit('gameOwnerUpdated', this.owner.id);
    
    console.log(`[game] ${player} added to game`);
    
    if (this.matchStarted) {
      console.log('[game] game already started');
      this._matchController?.playerReconnected(player.id, socket);
    }
    else {
      console.log(`[game] not yet started, sending player to match configuration`,);
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
    console.log(`[game] ${playerId} disconnected - ${reason}`);
    
    const player = this.players.find((player) => player.id === playerId);
    if (!player) {
      this._socketMap.delete(playerId);
      console.warn(`[game] player disconnected, but cannot find player object`);
      return;
    }
    
    player.connected = false;
    player.ready = false;
    
    const hasConnectedHuman = this.players.some((p) => p.connected && !p.isComputer);
    if (!hasConnectedHuman) {
      console.log('[game] no human players left in game, clearing game state completely',);
      this.clearMatch()
      return;
    }
    
    if (player.id === this.owner?.id) {
      this._socketMap.get(player.id)?.off('matchConfigurationUpdated');
      this._socketMap.get(player.id)?.off('searchCards');
      this._socketMap.get(player.id)?.off('searchEvents');
      this._socketMap.get(player.id)?.off('addComputerPlayer');
      
      const replacement = this.players.find(p => p.connected);
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
        this._socketMap.get(replacement.id)?.on('matchConfigurationUpdated', this.onMatchConfigurationUpdated);
        this._socketMap.get(replacement.id)?.on('addComputerPlayer', (count?: number) => this.onAddComputerPlayer(replacement.id, count));
      }
    }
    
    if (this.matchStarted) {
      this._matchController?.playerDisconnected(player.id);
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
    console.log(`[game] received expansionSelected socket event`);
    console.log(newConfig);
    
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
        console.log(`[game] module for expansion '${expansion.name}' contains no mutually exclusive expansions`,);
        continue;
      }
      
      console.log(`[game] '${expansion.name}' is mutually exclusive with ${configModule.mutuallyExclusiveExpansions}`,);
      
      for (const exclusiveExpansion of configModule.mutuallyExclusiveExpansions) {
        // Compare by name because mutuallyExclusiveExpansions are string keys.
        const hasExclusiveExpansion = currentConfig.expansions
          .some(currentExpansion => currentExpansion.name === exclusiveExpansion);
        if (hasExclusiveExpansion && !expansionsToRemove.includes(exclusiveExpansion)) {
          console.log(`[game] removing expansion ${exclusiveExpansion} as it is not allowed with ${expansion}`,);
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
    console.log(
      `[game] player ${playerId} request to update name to '${name}'`,
    );
    
    const player = this.players.find((player) => player.id === playerId);
    
    if (player) {
      player.name = name;
      console.log(`[game] ${player} name updated to '${name}'`);
    }
    else {
      console.log(`[game] player ${playerId} not found`);
    }
    
    io.in('game').emit('playerNameUpdated', playerId, name);
  };
  
  private onPlayerReady = (playerId: number) => {
    const player = this.players.find((player) => player.id === playerId);
    
    if (!player) {
      console.log(`[game] received player ready event from ${playerId} but could not find Player object`,);
      return;
    }
    
    console.log(`[game] received ready event from ${player}`);
    
    player.ready = !player.ready;
    console.log(`[game] marking ${player} as ${player.ready}`);
    io.in('game').except(player.socketId).emit('playerReady', playerId, player.ready);
    
    if (this.players.some((p) => !p.ready && p.connected)) {
      console.log(`[game] not all players ready yet`);
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
          p.ready = p.isComputer ? true : false;
          p.color = colors[idx]
          return p;
        })
    );
    
    io.in('game').emit('setPlayerList', players);
    
    this._matchController?.on('gameOver', this.clearMatch);
    
    void this._matchController?.initialize(
      {
        ...structuredClone(defaultMatchConfiguration),
        ...this._matchConfiguration,
        players,
      } as MatchConfiguration
    );
  }
}
