import { AppSocket, PlayerID } from './types.ts';
import { MatchConfiguration, Player } from 'shared/shared-types.ts';
import { createNewPlayer } from './utils/create-new-player.ts';
import { io } from './server.ts';
import { MatchController } from './match-controller.ts';

const defaultMatchConfiguration = {
  expansions: ['base-v2'],
  players: [],
  supplyCardKeys: [],
  kingdomCardKeys: [],
};

export class Game {
  public players: Player[] = [];
  public owner: Player | undefined;
  public started: boolean = false;

  private _socketMap: Map<PlayerID, AppSocket> = new Map();
  private _expansionList: { title: string; expansionName: string }[] = [];
  private _match: MatchController | undefined;
  private _matchConfiguration: MatchConfiguration = defaultMatchConfiguration;

  constructor() {}

  public async getExpansionList() {
    console.log(`[GAME] retrieving expansion list`);

    try {
      this._expansionList =
        (await import(`./expansions/expansion-list.json`, {
          with: { type: 'json' },
        })).default;
      console.debug(`[GAME] retrieved expansion list ${this._expansionList}`);
    } catch (error) {
      console.log(`[GAME] could not retrieve expansion list`);
      console.error(error);
      this._expansionList = [];
    }
  }

  public addPlayer(sessionId: string, socket: AppSocket) {
    if (this.players.length >= 6) {
      console.log(`[GAME] game has 6 players, rejecting`);
      socket.disconnect(true);
      return;
    }

    let player = this.players.find((p) => p.sessionId === sessionId);

    if (this.started && !player) {
      console.log(
        `[GAME] game has already started, and player not found in game, rejecting`,
      );
      socket.disconnect();
    }

    if (player) {
      console.debug(`[GAME] player already exists ${player}`);
      player.socketId = socket.id;
    } else {
      console.debug(`[GAME] creating new player`);
      player = createNewPlayer(sessionId, socket);
      this.players.push(player);
    }

    socket.join('game');
    player.connected = true;
    this._socketMap.set(player.id, socket);

    io.in('game').emit('playerConnected', player, this.players);
    socket.emit('setPlayer', player);

    if (!this.owner) {
      console.log(`[GAME] game owner does not exist, setting to ${player}`);
      this.owner = player;
      socket.on('matchConfigurationUpdated', this.onMatchConfigurationUpdated);
      io.in('game').emit('gameOwnerUpdated', player.id);
    }

    console.log(`[GAME] ${player} added to game`);

    if (this.started) {
      console.log('[GAME] game already started');
      this._match?.playerReconnected(player.id, socket);
    } else {
      console.log(
        `[GAME] not yet started, sending player to match configuration`,
      );
      socket.emit('expansionList', this._expansionList);
      socket.emit('displayMatchConfiguration', this._matchConfiguration);
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

    const player = this.players.find(player => player.id === playerId);
    if (!player) {
      this._socketMap.delete(playerId);
      console.warn(`[GAME] player disconnected, but cannot find player object`);
      return;
    }
    
    player.connected = false;
    player.ready = false;

    if (!this.players.some((p) => p.connected)) {
      console.log(
        '[GAME] no players left in game, clearing game state completely',
      );
      this._socketMap.forEach((socket) => {
        socket.off('updatePlayerName');
        socket.off('playerReady');
        socket.off('disconnect');
        socket.leave('room');
      });
      this._socketMap.clear();
      this.players = [];
      this.owner = undefined;
      this.started = false;
      // todo stop match controller
      this._match = undefined;
      this._matchConfiguration = defaultMatchConfiguration;
      return;
    }
    
    this._match?.playerDisconnected(player.id, this._socketMap.get(playerId));
    
    io.in('game').emit('playerDisconnected', player, this.players);
    
    if (player.id === this.owner?.id) {
      for (
        const checkPlayer of this.players.filter((p) => p.id !== player.id)
      ) {
        if (checkPlayer.connected) {
          this.owner = checkPlayer;
          io.in('game').emit('gameOwnerUpdated', checkPlayer.id);
          break;
        }
      }
    }
  };

  private onMatchConfigurationUpdated = async (config: MatchConfiguration) => {
    console.log(`[GAME] received match configuration update`);
    console.debug(config);

    const newExpansions = config.expansions.filter(
      (e) => !this._matchConfiguration.expansions.includes(e),
    );

    const expansionsToRemove: string[] = [];
    for (const expansion of newExpansions) {
      const configModule =
        (await import(`./expansions/${expansion}/configuration.json`, {
          with: { type: 'json' },
        }))?.default;

      if (!configModule) {
        console.warn(
          `[GAME] could not find config module for expansion ${expansion}`,
        );
        continue;
      }

      if (!configModule.mutuallyExclusiveExpansions) {
        console.debug(
          `[GAME] module for expansion ${expansion} contains no mutually exclusive expansions`,
        );
        continue;
      }

      console.debug(
        `[GAME] ${expansion} is mutually exclusive with ${configModule.mutuallyExclusiveExpansions}`,
      );

      for (
        const exclusiveExpansion of configModule.mutuallyExclusiveExpansions
      ) {
        if (
          config.expansions.includes(exclusiveExpansion) &&
          !expansionsToRemove.includes(exclusiveExpansion)
        ) {
          console.debug(
            `[GAME] removing expansion ${exclusiveExpansion} as it is not allowed with ${expansion}`,
          );
          expansionsToRemove.push(exclusiveExpansion);
        }
      }
    }

    this._matchConfiguration = {
      ...this._matchConfiguration,
      expansions: config.expansions.filter((e) =>
        !expansionsToRemove.includes(e)
      ),
    };

    console.log('[GAME] match configuration has been updated');
    console.debug(this._matchConfiguration);

    io.in('game').emit('matchConfigurationUpdated', this._matchConfiguration);
  };

  private onUpdatePlayerName = (playerId: number, name: string) => {
    console.log(
      `[GAME] player ${playerId} request to update name to '${name}'`,
    );

    const player = this.players.find((player) => player.id === playerId);

    if (player) {
      player.name = name;
      console.debug(`[GAME] ${player} name updated to '${name}'`);
    } else {
      console.debug(`[GAME] player ${playerId} not found`);
    }

    io.in('game').emit('playerNameUpdated', playerId, name);
  };

  private onPlayerReady = (playerId: number) => {
    const player = this.players.find((player) => player.id === playerId);

    if (!player) {
      console.debug(
        `[GAME] received player ready event from ${playerId} but could not find Player object`,
      );
      return;
    }

    console.log(`[GAME] received ready event from ${player}`);

    const ready = !player?.ready;
    player.ready = ready;

    console.debug(`[GAME] marking ${player} as ${ready}`);

    io.in('game').except(player.socketId).emit('playerReady', playerId, ready);

    if (this.players.some((p) => !p.ready)) {
      console.log(`[GAME] not all players ready yet`);
      return;
    }

    console.log(`[GAME] all players ready, proceeding to start match`);

    this.started = true;

    this._match = new MatchController(this._socketMap);

    this._socketMap.forEach((socket) => {
      socket.off('updatePlayerName');
      socket.off('playerReady');
    });

    void this._match.initialize({
      ...this._matchConfiguration,
      players: this.players.map((player) => ({
        ...player,
        ready: false,
      })),
    });
  };
}
