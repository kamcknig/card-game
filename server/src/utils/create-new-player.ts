import { Player } from 'shared/shared-types.ts';
import { AppSocket } from '../types.ts';

let PLAYER_ID: number = 0;

const colors = ['#10FF19', '#053EFF', '#FF0BF2', '#FFF114', '#FF1F11', '#FF9900'];

export const createNewPlayer = (sessionId: string, socket: AppSocket) => {
  const newId = ++PLAYER_ID;
  const p = new Player({
    name: `Player ${newId}`,
    id: newId,
    sessionId,
    connected: false,
    ready: false,
    socketId: socket.id,
    color: colors[newId - 1],
  });
  console.log(`[createNewPlayer] new player created ${p}`);
  return p;
}