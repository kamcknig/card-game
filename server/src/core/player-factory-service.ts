import { AppSocket } from '@server-types/index.ts';
import { Player } from 'shared/types/index.ts';
import { LoggerService } from './logger-service.ts';

// Creates player entities with stable incrementing ids for this server process.
export class PlayerFactoryService {
  private _playerId = 0;

  constructor(private readonly loggerService: LoggerService) {}

  // Creates a human player bound to a live socket session.
  // The optional username sets the display name; falls back to 'Player N' when not provided.
  public createPlayer(sessionId: string, socket: AppSocket, username?: string): Player {
    const newId = ++this._playerId;
    const player = new Player({
      name: username || `Player ${newId}`,
      id: newId,
      sessionId,
      connected: false,
      ready: false,
      socketId: socket.id,
      isComputer: false,
    } as Player);
    this.loggerService.info(`[player factory] new player created ${player}`);
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
    this.loggerService.info(`[player factory] new computer player created ${player}`);
    return player;
  }
}
