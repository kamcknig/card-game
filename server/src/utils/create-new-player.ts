import { Player } from 'shared/shared-types.ts';

let PLAYER_ID: number = 0;

export const createNewPlayer = (sessionId: string, socketId: string) => {
  console.log('creating new player with session', sessionId);
  const newId = ++PLAYER_ID;
  console.log('assigning id', newId);
  const p = new Player({
    name: `Player ${newId}`,
    id: newId,
    sessionId,
    connected: false,
    ready: false,
    socketId
  });
  return p;
}