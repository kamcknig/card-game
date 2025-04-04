import { Server } from 'socket.io';
import { ServerEmitEvents, ServerListenEvents } from 'shared/shared-types.ts';
import process from 'node:process';
import { toNumber } from 'es-toolkit/compat';
import * as log from '@timepp/enhanced-deno-log/auto-init';
import { Game } from './game.ts';
import { loadExpansion } from './utils/load-expansion.ts';

if (Deno.env.get("LOG_TO_FILE")?.toLowerCase() === "false") {
  log.setConfig({
    enabledLevels: [],
  }, "file");
}

log.init();

const PORT = toNumber(process.env.PORT) || 3000;

let game: Game;

export const io = new Server<ServerListenEvents, ServerEmitEvents>({
  pingTimeout: 1000 * 60 * 10,
});

io.on("connection", async (socket) => {
  console.log("[SERVER] new client connected");

  const sessionId = socket.handshake.query.get("sessionId");

  console.debug(
    `[SERVER] connection from ${socket.handshake.address} - session ID ${sessionId}`,
  );

  if (!sessionId) {
    console.error("[SERVER] no session ID, rejecting");
    socket.disconnect();
    return;
  }

  if (!game) {
    console.log("[SERVER] no game available, creating new Game");
    game = new Game();
    await game.getExpansionList();
  }

  game.addPlayer(sessionId, socket);
});

Deno.serve({
  handler: io.handler(),
  port: PORT,
});

(async () => {
  const expansionList = (await import(`./expansions/expansion-list.json`, {
    with: { type: "json" },
  })).default;

  for (const expansion of expansionList) {
    console.log(`[SERVER] loading expansion card data for ${expansion.title}`);
    loadExpansion(expansion.expansionName);
  }
})();
