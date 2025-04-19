import { AppSocket } from '../types.ts';
import { Match, MatchConfiguration, Player, PlayerId, } from 'shared/shared-types.ts';
import { createNewPlayer } from '../utils/create-new-player.ts';
import { io } from '../server.ts';
import { MatchController } from './match-controller.ts';
import { ExpansionCardData, expansionData } from '../state/expansion-data.ts';
import { compare } from 'fast-json-patch';
import { fisherYatesShuffle } from '../utils/fisher-yates-shuffler.ts';

const defaultMatchConfiguration = {
  expansions: ['base-v2', 'intrigue'],
  players: [],
  supplyCardKeys: [],
  kingdomCardKeys: [],
};

export class Game {
  public players: Player[] = [];
  public owner: Player | undefined;
  public matchStarted: boolean = false;
  
  private _match: Match | undefined;
  private _socketMap: Map<PlayerId, AppSocket> = new Map();
  private _matchController: MatchController | undefined;
  private _matchConfiguration: MatchConfiguration | undefined;
  private _availableExpansion: {
    title: string;
    name: string;
    order: number;
  }[] = [];
  
  constructor() {
    console.log(`[GAME] created`);
    
    this.initializeMatch();
  }
  
  private initializeMatch = () => {
    this._matchConfiguration = defaultMatchConfiguration;
    this._match = { config: this._matchConfiguration } as Match;
    this._matchController = new MatchController(this._match, this._socketMap);
    this._matchController.on('gameOver', this.clearMatch);
  }
  
  public expansionLoaded(
    expansion: { name: string; title: string; order: number },
  ) {
    console.log(`[GAME] expansion '${expansion.name}' loaded`);
    this._availableExpansion.push(expansion);
    io.in('game').emit(
      'expansionList',
      this._availableExpansion.sort((a, b) => b.order - a.order),
    );
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
    } else {
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
      socket.on('expansionSelected', this.onMatchConfigurationUpdated);
      io.in('game').emit('gameOwnerUpdated', player.id);
    }
    
    console.log(`[GAME] ${player} added to game`);
    
    if (this.matchStarted) {
      console.log('[GAME] game already started');
      this._matchController?.playerReconnected(player.id, socket);
      socket.emit('matchReady', this._matchController?.getMatchSnapshot()!);
    } else {
      console.log(
        `[GAME] not yet started, sending player to match configuration`,
      );
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
    
    this._matchController?.playerDisconnected(player.id);
    io.in('game').emit('playerDisconnected', player);
    
    if (player.id === this.owner?.id) {
      const replacement = this.players.find(p => p.connected);
      if (replacement) {
        this.owner = replacement;
        io.in('game').emit('gameOwnerUpdated', replacement.id);
        this._socketMap.get(replacement.id)?.on('expansionSelected', this.onMatchConfigurationUpdated);
      }
    }
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
    this.initializeMatch();
  }
  
  private onMatchConfigurationUpdated = async (expansions: string[]) => {
    console.log(`[GAME] received expansionSelected socket event`);
    console.log(expansions);
    
    const newExpansions = expansions.filter(
      (e) => !this._matchConfiguration?.expansions.includes(e),
    );
    
    const expansionsToRemove: string[] = [];
    for (const expansion of newExpansions) {
      const configModule =
        (await import(`../expansions/${expansion}/configuration-${expansion}.json`, {
          with: { type: 'json' },
        }))?.default;
      
      if (!configModule) {
        console.warn(`[GAME] could not find config module for expansion ${expansion}`,);
        continue;
      }
      
      if (!configModule.mutuallyExclusiveExpansions) {
        console.log(`[GAME] module for expansion ${expansion} contains no mutually exclusive expansions`,);
        continue;
      }
      
      console.log(`[GAME] ${expansion} is mutually exclusive with ${configModule.mutuallyExclusiveExpansions}`,);
      
      for (const exclusiveExpansion of configModule.mutuallyExclusiveExpansions) {
        if (
          expansions.includes(exclusiveExpansion) &&
          !expansionsToRemove.includes(exclusiveExpansion)
        ) {
          console.log(`[GAME] removing expansion ${exclusiveExpansion} as it is not allowed with ${expansion}`,);
          expansionsToRemove.push(exclusiveExpansion);
        }
      }
    }
    
    const previousSnapshot = this._matchController?.getMatchSnapshot() ?? {};
    this._matchConfiguration = {
      ...this._matchConfiguration,
      expansions,
    } as MatchConfiguration;
    
    if (this.matchStarted && this._match) {
      this._match.config = this._matchConfiguration;
      const patch = compare(previousSnapshot, this._matchController?.getMatchSnapshot() ?? {});
      if (patch.length) this._socketMap.forEach(s => s.emit('patchMatch', patch));
    } else {
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
    } else {
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
    });
    
    const cardData = this._matchConfiguration?.expansions.reduce((prev, key) => {
      prev = {
        supply: {
          ...prev.supply,
          ...expansionData[key].cardData.supply
        },
        kingdom: {
          ...prev.kingdom,
          ...expansionData[key].cardData.kingdom
        }
      }
      return prev;
    }, {} as ExpansionCardData);
    
    const colors = ['#10FF19', '#3c69ff', '#FF0BF2', '#FFF114', '#FF1F11', '#FF9900'];
    const players = fisherYatesShuffle(this.players
      .filter(p => p.connected)
      .map((p, idx) => {
        p.ready = false;
        p.color = colors[idx]
        return p;
      }));
    io.in('game').emit('setPlayerList', players);
    void this._matchController?.initialize(
      {
        ...this._matchConfiguration,
        players,
      } as MatchConfiguration,
      cardData as ExpansionCardData
    );
  }
}
