import { AppSocket } from '../types.ts';
import { CardData, CardKey, ExpansionListElement, MatchConfiguration, Player, PlayerId, } from 'shared/shared-types.ts';
import { createNewPlayer } from '../utils/create-new-player.ts';
import { io } from '../server.ts';
import { MatchController } from './match-controller.ts';
import { ExpansionCardData, expansionData } from '../state/expansion-data.ts';
import { applyPatch, compare } from 'https://esm.sh/v123/fast-json-patch@3.1.1/index.js';
import Fuse, { IFuseOptions } from 'fuse.js';

const defaultMatchConfiguration = {
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
  players: [],
  supplyCards: [],
  kingdomCards: [],
};

export class Game {
  public players: Player[] = [];
  public owner: Player | undefined;
  public matchStarted: boolean = false;
  
  private _socketMap: Map<PlayerId, AppSocket> = new Map();
  private _matchController: MatchController;
  private _matchConfiguration: MatchConfiguration = defaultMatchConfiguration;
  private _availableExpansion: ExpansionListElement[] = [];
  private _fuse: Fuse<CardData & { cardKey: CardKey }> | undefined;
  
  constructor() {
    console.log(`[GAME] created`);
    this._matchController = new MatchController(
      this._socketMap,
      (searchTerm: string) => this.onSearchCards(searchTerm)
    );
    this.initializeFuseSearch();
  }
  
  private initializeFuseSearch() {
    console.log(`[game] initializing fuse search`);
    const find = (key: CardKey, arr: (CardData & { cardKey: CardKey })[]) =>
      arr.findIndex(e => e.cardKey === key) > -1;
    
    const allExpansionCards = Object.keys(expansionData).reduce(
      (prev, expansionName) => {
        const expansion = expansionData[expansionName];
        const supply = expansion.cardData.supply;
        const kingdom = expansion.cardData.kingdom;
        
        prev = prev
          .concat(Object.keys(supply).filter(k => !find(k, prev)).map((k) => ({ ...supply[k], cardKey: k })))
          .concat(Object.keys(kingdom).filter(k => !find(k, prev)).map((k) => ({ ...kingdom[k], cardKey: k })));
        
        return prev;
      },
      [] as (CardData & { cardKey: CardKey })[],
    );
    
    console.log(`[game] list of expansion cards: ${allExpansionCards.length}`);
    console.log(allExpansionCards.map(e => `${e.expansionName} - ${e.cardKey}`).join('\n'));
    
    if (this._fuse) {
      this._fuse.setCollection(allExpansionCards);
    }
    else {
      const index = Fuse.createIndex(['cardName'], allExpansionCards);
      
      const fuseOptions: IFuseOptions<CardData> = {
        ignoreDiacritics: true,
        minMatchCharLength: 1,
        distance: 2,
        keys: ['cardName']
      };
      this._fuse = new Fuse(allExpansionCards, fuseOptions, index);
      console.log(this._fuse.getIndex());
    }
  }
  
  private onSearchCards = (searchStr: string) => {
    const results = this._fuse?.search(searchStr);
    return results?.map(r => r.item) ?? [];
  };
  
  public expansionLoaded(expansion: ExpansionListElement) {
    console.log(`[GAME] expansion '${expansion.name}' loaded`);
    this._availableExpansion.push(expansion);
    io.in('game').emit(
      'expansionList',
      this._availableExpansion.sort((a, b) => b.order - a.order),
    );
    
    this.initializeFuseSearch();
  }
  
  public addPlayer(sessionId: string, socket: AppSocket) {
    if (this.players.length >= 6) {
      console.log(`[GAME] game has 6 players, rejecting`);
      socket.disconnect(true);
      return;
    }
    
    let player = this.players.find((p) => p.sessionId === sessionId);
    
    if (this.matchStarted && !player) {
      console.log(`[GAME] game has already started, and player not found in game, rejecting`,);
      socket.disconnect();
    }
    
    if (player) {
      console.log(`[GAME] ${player} already in game assigning socket ID`);
      player.socketId = socket.id;
      player.sessionId = sessionId;
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
      console.log(`[GAME] game owner does not exist, setting to ${player}`);
      this.owner = player;
      socket.on('matchConfigurationUpdated', this.onMatchConfigurationUpdated);
      socket.on('searchCards', (playerId, searchTerm) => {
        this._socketMap.get(playerId)?.emit('searchCardResponse', this.onSearchCards(searchTerm));
      });
      io.in('game').emit('gameOwnerUpdated', player.id);
    }
    
    console.log(`[GAME] ${player} added to game`);
    
    if (this.matchStarted) {
      console.log('[GAME] game already started');
      this._matchController?.playerReconnected(player.id, socket);
      socket.emit('matchReady', this._matchController?.getMatchSnapshot()!);
    }
    else {
      console.log(
        `[GAME] not yet started, sending player to match configuration`,
      );
      socket.emit(
        'expansionList',
        this._availableExpansion.sort((a, b) => a.order - b.order),
      );
      
      socket.emit('matchConfigurationUpdated', this._matchConfiguration ?? {});
      socket.on('updatePlayerName', this.onUpdatePlayerName);
      socket.on('playerReady', this.onPlayerReady);
    }
    
    socket.on(
      'disconnect',
      (arg) => this.onPlayerDisconnected(player.id, arg.toString()),
    );
  }
  
  private onPlayerDisconnected = (playerId: number, reason: string) => {
    console.log(`[GAME] ${playerId} disconnected - ${reason}`);
    
    const player = this.players.find((player) => player.id === playerId);
    if (!player) {
      this._socketMap.delete(playerId);
      console.warn(`[GAME] player disconnected, but cannot find player object`);
      return;
    }
    
    player.connected = false;
    player.ready = false;
    
    if (!this.players.some((p) => p.connected)) {
      console.log('[GAME] no players left in game, clearing game state completely',);
      this.clearMatch()
      return;
    }
    
    if (player.id === this.owner?.id) {
      this._socketMap.get(player.id)?.off('matchConfigurationUpdated');
      this._socketMap.get(player.id)?.off('searchCards');
      
      const replacement = this.players.find(p => p.connected);
      if (replacement) {
        this.owner = replacement;
        io.in('game').emit('gameOwnerUpdated', replacement.id);
        this._socketMap.get(replacement.id)?.on('searchCards', (playerId, searchTerm) => {
          this._socketMap.get(playerId)?.emit('searchCardResponse', this.onSearchCards(searchTerm));
        });
        this._socketMap.get(replacement.id)?.on('matchConfigurationUpdated', this.onMatchConfigurationUpdated);
      }
    }
    
    if (this.matchStarted) {
      this._matchController?.playerDisconnected(player.id);
    }
    io.in('game').emit('playerDisconnected', player);
  };
  
  private clearMatch = () => {
    console.log(`[GAME] clearing match`);
    
    this._socketMap.forEach((socket) => {
      socket.off('updatePlayerName');
      socket.off('playerReady');
      socket.off('disconnect');
      socket.leave('game');
    });
    
    this._socketMap.clear();
    this.players = [];
    this.owner = undefined;
    this.matchStarted = false;
  }
  
  private onMatchConfigurationUpdated = async (newConfig: MatchConfiguration) => {
    console.log(`[GAME] received expansionSelected socket event`);
    console.log(newConfig);
    
    const currentConfig = structuredClone(this._matchConfiguration ?? {}) as MatchConfiguration;
    
    const newExpansions = newConfig.expansions.filter(
      (e) => !currentConfig?.expansions.includes(e),
    );
    
    const expansionsToRemove: ExpansionListElement[] = [];
    
    // go through the new expansions to add, if any are mutually exclusive with some we still have
    // selected, then remove those selected ones as well
    for (const expansion of newExpansions) {
      const configModule =
        (await import(`../expansions/${expansion.name}/configuration-${expansion.name}.json`, {
          with: { type: 'json' },
        }))?.default;
      
      if (!configModule) {
        console.warn(`[GAME] could not find config module for expansion '${expansion.name}'`,);
        continue;
      }
      
      if (!configModule.mutuallyExclusiveExpansions) {
        console.log(`[GAME] module for expansion '${expansion.name}' contains no mutually exclusive expansions`,);
        continue;
      }
      
      console.log(`[GAME] '${expansion.name}' is mutually exclusive with ${configModule.mutuallyExclusiveExpansions}`,);
      
      for (const exclusiveExpansion of configModule.mutuallyExclusiveExpansions) {
        if (
          currentConfig.expansions.includes(exclusiveExpansion) &&
          !expansionsToRemove.includes(exclusiveExpansion)
        ) {
          console.log(`[GAME] removing expansion ${exclusiveExpansion} as it is not allowed with ${expansion}`,);
          expansionsToRemove.push(exclusiveExpansion);
        }
      }
    }
    
    const patch = compare(currentConfig, newConfig);
    
    
    if (patch.length) {
      applyPatch(this._matchConfiguration, patch)
      // lobby phase – raw object still useful for the config screen
      io.in('game').emit('matchConfigurationUpdated', this._matchConfiguration);
    }
  };
  
  private onUpdatePlayerName = (playerId: number, name: string) => {
    console.log(
      `[GAME] player ${playerId} request to update name to '${name}'`,
    );
    
    const player = this.players.find((player) => player.id === playerId);
    
    if (player) {
      player.name = name;
      console.log(`[GAME] ${player} name updated to '${name}'`);
    }
    else {
      console.log(`[GAME] player ${playerId} not found`);
    }
    
    io.in('game').emit('playerNameUpdated', playerId, name);
  };
  
  private onPlayerReady = (playerId: number) => {
    const player = this.players.find((player) => player.id === playerId);
    
    if (!player) {
      console.log(`[GAME] received player ready event from ${playerId} but could not find Player object`,);
      return;
    }
    
    console.log(`[GAME] received ready event from ${player}`);
    
    player.ready = !player.ready;
    console.log(`[GAME] marking ${player} as ${player.ready}`);
    io.in('game').except(player.socketId).emit('playerReady', playerId, player.ready);
    
    if (this.players.some((p) => !p.ready && p.connected)) {
      console.log(`[GAME] not all players ready yet`);
      return;
    }
    
    this.startMatch();
  };
  
  private startMatch() {
    console.log(`[GAME] all connected players ready, proceeding to start match`);
    
    this.matchStarted = true;
    
    this._socketMap.forEach((socket) => {
      socket.off('updatePlayerName');
      socket.off('playerReady');
      socket.off('matchConfigurationUpdated');
      socket.off('searchCards');
    });
    
    const cardData = this._matchConfiguration?.expansions.reduce((prev, key) => {
      prev = {
        supply: {
          ...prev.supply,
          ...expansionData[key.name].cardData.supply
        },
        kingdom: {
          ...prev.kingdom,
          ...expansionData[key.name].cardData.kingdom
        }
      }
      return prev;
    }, {} as ExpansionCardData);
    
    const colors = ['#10FF19', '#3c69ff', '#FF0BF2', '#FFF114', '#FF1F11', '#FF9900'];
    /*const players = fisherYatesShuffle(this.players
     .filter(p => p.connected)
     .map((p, idx) => {
     p.ready = false;
     p.color = colors[idx]
     return p;
     }));*/
    const players = this.players.map((p, idx) => {
      p.ready = false;
      p.color = colors[idx]
      return p;
    });
    io.in('game').emit('setPlayerList', players);
    
    this._matchController?.on('gameOver', this.clearMatch);
    
    void this._matchController?.initialize(
      {
        ...defaultMatchConfiguration,
        ...this._matchConfiguration,
        players: this.players,
      } as MatchConfiguration,
      cardData as ExpansionCardData
    );
  }
}
