import { Player } from 'shared/types/index.ts';
import { AppSocket } from '@server-types/index.ts';

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
    isComputer: false,
  } as Player);
  console.info(`[createNewPlayer] new player created ${p}`);
  return p;
};

// Creates a computer-controlled player without a socket connection.
export const createComputerPlayer = () => {
  const newId = ++PLAYER_ID;
  const p = new Player({
    name: `Computer ${newId}`,
    id: newId,
    sessionId: `computer:${newId}`,
    connected: true,
    ready: true,
    socketId: '',
    isComputer: true,
  } as Player);
  console.info(`[createNewPlayer] new computer player created ${p}`);
  return p;
};
