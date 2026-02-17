import {AppSocket} from '@server-types/index.ts';
import {Player, PlayerId} from 'shared/types/index.ts';
import {createNewPlayer} from '../utils/create-new-player.ts';

export type RegisterPlayerJoinResult =
  | {status: 'rejected_capacity';}
  | {status: 'rejected_started';}
  | {status: 'accepted'; player: Player; created: boolean;};

// Owns player-record lifecycle updates for join/reconnect/disconnect operations.
export class PlayerRegistryService {
  private readonly _maxPlayers: number;

  constructor({maxPlayers = 6}: {maxPlayers?: number} = {}) {
    // Keep player-cap policy configurable via DI while preserving the existing default.
    this._maxPlayers = maxPlayers;
  }

  // Registers a player join attempt, creating a new player or reconnecting an existing one.
  public registerPlayerJoin(args: {
    players: Player[];
    sessionId: string;
    socket: AppSocket;
    matchStarted: boolean;
  }): RegisterPlayerJoinResult {
    const {players, sessionId, socket, matchStarted} = args;

    // Preserve existing behavior: reject once lobby has reached hard player cap.
    if (players.length >= this._maxPlayers) {
      return {status: 'rejected_capacity'};
    }

    const existingPlayer = players.find((player) => player.sessionId === sessionId);

    // Preserve existing behavior: unknown players cannot join once match has started.
    if (matchStarted && !existingPlayer) {
      return {status: 'rejected_started'};
    }

    if (existingPlayer) {
      existingPlayer.socketId = socket.id;
      existingPlayer.sessionId = sessionId;
      existingPlayer.connected = true;
      return {status: 'accepted', player: existingPlayer, created: false};
    }

    const newPlayer = createNewPlayer(sessionId, socket);
    players.push(newPlayer);
    return {status: 'accepted', player: newPlayer, created: true};
  }

  // Marks a player disconnected and returns the player when found.
  public markPlayerDisconnected(players: Player[], playerId: PlayerId): Player | undefined {
    const player = players.find((candidate) => candidate.id === playerId);
    if (!player) {
      return undefined;
    }

    player.connected = false;
    player.ready = false;
    return player;
  }

  // Updates a player's display name when present.
  public setPlayerName(players: Player[], playerId: PlayerId, name: string): Player | undefined {
    const player = players.find((candidate) => candidate.id === playerId);
    if (!player) {
      return undefined;
    }

    player.name = name;
    return player;
  }
}
