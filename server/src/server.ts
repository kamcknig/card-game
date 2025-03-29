import { Server } from 'socket.io';
import { ServerEmitEvents, ServerListenEvents, } from 'shared/shared-types.ts';
import { MatchController } from './match-controller.ts';
import { sendToSockets } from './utils/send-to-sockets.ts';
import process from 'node:process';
import { sessionPlayerMap } from './session-player-map.ts';
import { sessionSocketMap } from './session-socket-map.ts';
import { playerSocketMap } from './player-socket-map.ts';
import { createGame, getGameState } from './utils/get-game-state.ts';
import { toNumber } from 'es-toolkit/compat';
import * as log from '@timepp/enhanced-deno-log/auto-init';
import { getPlayerBySessionId } from './utils/get-player-by-session-id.ts';
import { Game } from './game.ts';

if (Deno.env.get('LOG_TO_FILE')?.toLowerCase() === 'false') {
  log.setConfig({
    enabledLevels: [],
  }, 'file');
}

log.init();

const PORT = toNumber(process.env.PORT) || 3000;

let game: Game;

export const io = new Server<ServerListenEvents, ServerEmitEvents>({
  pingTimeout: 1000 * 60 * 10,
});

// When a socket client connects
io.on('connection', async (socket) => {
  console.log('[SERVER] new client connected');
  
  const sessionId = socket.handshake.query.get('sessionId');
  
  console.debug(`[SERVER] connection from ${socket.handshake.address} - session ID ${sessionId}`);
  
  if (!sessionId) {
    console.error('[SERVER] no session ID, rejecting');
    socket.disconnect();
    return;
  }

  if (!game) {
    console.log('[SERVER] no game available, creating new Game');
    game = new Game();
    await game.getExpansionList();
  }
  
  game.addPlayer(sessionId, socket);
});

Deno.serve({
  handler: io.handler(),
  port: PORT,
});
