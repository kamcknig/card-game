import { AppSocket } from '@server-types/index.ts';
import { Player } from 'shared/types/index.ts';

// Creates player entities with stable incrementing ids for this server process.
export class PlayerFactoryService {
  private _playerId = 0;

  // Creates a human player bound to a live socket session.
  public createPlayer(sessionId: string, socket: AppSocket): Player {
    const newId = ++this._playerId;
    const player = new Player({
      name: `Player ${newId}`,
      id: newId,
      sessionId,
      connected: false,
      ready: false,
      socketId: socket.id,
      isComputer: false,
    } as Player);
    console.info(`[player factory] new player created ${player}`);
    return player;
  }

  // Creates a computer-controlled player without an attached socket.
  public createComputerPlayer(): Player {
    const newId = ++this._playerId;
    const player = new Player({
      name: `Computer ${newId}`,
      id: newId,
      sessionId: `computer:${newId}`,
      connected: true,
      ready: true,
      socketId: '',
      isComputer: true,
    } as Player);
    console.info(`[player factory] new computer player created ${player}`);
    return player;
  }
}
