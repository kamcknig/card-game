import { Server } from 'socket.io';
import { ServerEmitEvents, ServerListenEvents } from 'shared/types/index.ts';
import { toNumber } from 'es-toolkit/compat';
import * as log from '@timepp/enhanced-deno-log';
import { Game } from './core/game.ts';
import { ExpansionSearchService } from './core/expansion-search-service.ts';
import { ExpansionCompatibilityService } from './core/expansion-compatibility-service.ts';
import { FileGameConfigurationStore } from './core/game-configuration-store.ts';
import { LobbySocketBindings } from './core/lobby-socket-bindings.ts';
import { DisconnectedPlayerVoteService } from './core/disconnected-player-vote-service.ts';
import { PlayerSessionService } from './core/player-session-service.ts';
import { PlayerRegistryService } from './core/player-registry-service.ts';
import { MatchStartOrchestrator } from './core/match-start-orchestrator.ts';
import { MatchScopeFactory } from './core/match-scope-factory.ts';
import { MatchConfiguratorFactory } from './core/match-configurator-factory.ts';
import { MatchRuntimeFactory } from './core/match-runtime-factory.ts';
import { MatchSocketBindings } from './core/match-socket-bindings.ts';
import { loadExpansion } from './utils/load-expansion.ts';
import { asClass, asValue, createContainer, InjectionMode } from 'awilix';

// Default to disabling file logs unless explicitly enabled.
const logToFileEnabled = Deno.env.get('LOG_TO_FILE')?.trim().toLowerCase() === 'true';
if (!logToFileEnabled) {
  log.setConfig({
    enabledLevels: [],
  }, 'file');
}

// Configure console colors to match desired log level styling.
log.setConfig({
  colors: {
    log: 'white',
    info: 'blue',
    debug: 'cyan',
    warn: 'yellow',
    error: 'red',
    func: '#f5f5f5',
    timer: 'green',
  },
}, 'console');

log.init();

const PORT = toNumber(Deno.env.get('PORT')) || 3001;

export const io = new Server<ServerListenEvents, ServerEmitEvents>({
  pingTimeout: 1000 * 60 * 10,
});

// Build a single composition root so server dependencies are wired explicitly.
const container = createContainer({
  injectionMode: InjectionMode.CLASSIC,
});

// Register long-lived singleton dependencies used by the server runtime.
container.register({
  io: asValue(io),
  maxPlayers: asValue(6),
  matchScopeFactory: asClass(MatchScopeFactory).singleton(),
  matchConfiguratorFactory: asClass(MatchConfiguratorFactory).singleton(),
  expansionSearchService: asClass(ExpansionSearchService).singleton(),
  expansionCompatibilityService: asClass(ExpansionCompatibilityService).singleton(),
  matchRuntimeFactory: asClass(MatchRuntimeFactory).singleton(),
  matchSocketBindings: asClass(MatchSocketBindings).singleton(),
  configStore: asClass(FileGameConfigurationStore).singleton(),
  lobbySocketBindings: asClass(LobbySocketBindings).singleton(),
  disconnectedPlayerVoteService: asClass(DisconnectedPlayerVoteService).singleton(),
  playerSessionService: asClass(PlayerSessionService).singleton(),
  playerRegistryService: asClass(PlayerRegistryService).singleton(),
  matchStartOrchestrator: asClass(MatchStartOrchestrator).singleton(),
  game: asClass(Game).singleton(),
});

// Resolve the game singleton after all dependencies are registered.
const game = container.resolve<Game>('game');

io.on('connection', (socket) => {
  console.log('[SERVER] new client connected');

  const sessionId = socket.handshake.query.get('sessionId');

  console.info(
    `[SERVER] connection from ${socket.handshake.address} - session ID ${sessionId}`,
  );

  if (!sessionId) {
    console.error('[SERVER] no session ID, rejecting');
    socket.disconnect();
    return;
  }

  game.addPlayer(sessionId, socket);
});

const ioHandler = io.handler();

Deno.serve({
  handler: (req, info) => {
    const url = new URL(req.url);
    // Debug-only endpoint to export a full match state snapshot.
    if (url.pathname === '/debug/match-state') {
      if (Deno.env.get('MATCH_STATE_EXPORT_ENABLED') !== 'true') {
        return new Response('match state export disabled', { status: 403 });
      }
      const exportState = game.exportMatchState();
      if (!exportState) {
        return new Response('match not initialized', { status: 400 });
      }
      return new Response(JSON.stringify(exportState), {
        headers: { 'content-type': 'application/json' },
      });
    }
    // Debug-only endpoint to merge a partial match state into the live match.
    if (url.pathname === '/debug/match-state/merge') {
      if (Deno.env.get('MATCH_STATE_MERGE_ENABLED') !== 'true') {
        return new Response('match state merge disabled', { status: 403 });
      }
      if (req.method !== 'POST') {
        return new Response('method not allowed', { status: 405 });
      }
      return req.json()
        .then((body) => {
          // Require a JSON object as the partial match payload.
          if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return new Response('invalid match payload', { status: 400 });
          }

          const result = game.mergeMatchState(body);
          if (!result.ok) {
            return new Response(JSON.stringify({ error: 'invalid match update', errors: result.errors }), {
              status: 400,
              headers: { 'content-type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({ ok: true }), {
            headers: { 'content-type': 'application/json' },
          });
        })
        .catch(() => {
          return new Response('invalid json', { status: 400 });
        });
    }
    return ioHandler(req, info);
  },
  port: PORT,
});

const controller = new AbortController();

addEventListener('SIGINT', () => {
  console.log('Shutting down cleanly...');
  game.dispose();
  controller.abort();
  Deno.exit();
});

(async () => {
  try {
    const expansionList = (await import('@expansions/expansion-list.json', {
      with: { type: 'json' },
    })).default;

    for (const expansion of expansionList) {
      console.info(`[SERVER] loading expansion card data for ${expansion.title}`);
      await loadExpansion(expansion).then(() => game.expansionLoaded(expansion));
    }
  } catch (error) {
    console.error('[SERVER] failed while loading expansions');
    console.error(error);
    game.dispose();
    throw error;
  }
})();
