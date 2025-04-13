import { Player } from 'shared/shared-types.ts';
import { AppSocket } from '../types.ts';

let PLAYER_ID: number = 0;

export const createNewPlayer = (sessionId: string, socket: AppSocket) => {
  const newId = ++PLAYER_ID;
  const p = new Player({
    name: `Player ${newId}`,
    id: newId,
    sessionId,
    connected: false,
    ready: false,
    socketId: socket.id,
  } as Player);
  console.log(`[createNewPlayer] new player created ${p}`);
  return p;
}