import { Server } from 'socket.io';
import { ServerEmitEvents, ServerListenEvents } from 'shared/types/index.ts';
import * as log from '@timepp/enhanced-deno-log';
import { Game } from './core/game.ts';
import { ExpansionSearchService } from './core/expansion-search-service.ts';
import { ExpansionCompatibilityService } from './core/expansion-compatibility-service.ts';
import { FileGameConfigurationStore } from './core/game-configuration-store.ts';
import { LobbySocketBindings } from './core/lobby-socket-bindings.ts';
import { DisconnectedPlayerVoteService } from './core/disconnected-player-vote-service.ts';
import { PlayerSessionService } from './core/player-session-service.ts';
import { PlayerRegistryService } from './core/player-registry-service.ts';
import { PlayerFactoryService } from './core/player-factory-service.ts';
import { MatchStartOrchestrator } from './core/match-start-orchestrator.ts';
import { MatchScopeFactory } from './core/match-scope-factory.ts';
import { MatchConfigurator } from './core/match-configurator.ts';
import { MatchConfiguratorFactory } from './core/match-configurator-factory.ts';
import { MatchRuntimeFactory } from './core/match-runtime-factory.ts';
import { MatchSocketBindings } from './core/match-socket-bindings.ts';
import { ServerStartupService } from './core/server-startup-service.ts';
import { ExpansionEffectRegistryService } from './core/expansion-effect-registry-service.ts';
import { ExpansionCardMetadataRegistryService } from './core/expansion-card-metadata-registry-service.ts';
import { ExpansionCatalogService } from './core/expansion-catalog-service.ts';
import { RngService } from './core/rng-service.ts';
import { TokenRegistryService } from './core/tokens/token-registry-service.ts';
import { ServerConfigService } from './core/server-config-service.ts';
import { LoggerService } from './core/logger-service.ts';
import { asClass, asValue, createContainer, InjectionMode } from 'awilix';

const serverConfigService = new ServerConfigService();

// Default to disabling file logs unless explicitly enabled.
const logToFileEnabled = serverConfigService.isFileLoggingEnabled();
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

const PORT = serverConfigService.getPort();

export const io = new Server<ServerListenEvents, ServerEmitEvents>({
  pingTimeout: 1000 * 60 * 10,
});

// Build a single composition root so server dependencies are wired explicitly.
const container = createContainer({
  injectionMode: InjectionMode.CLASSIC,
});

// Register long-lived singleton dependencies used by the server runtime.
container.register({
  rootContainer: asValue(container),
  io: asValue(io),
  serverConfigService: asValue(serverConfigService),
  loggerService: asClass(LoggerService).singleton(),
  maxPlayers: asValue(6),
  matchScopeFactory: asClass(MatchScopeFactory).singleton(),
  matchConfigurator: asClass(MatchConfigurator).scoped(),
  matchConfiguratorFactory: asClass(MatchConfiguratorFactory).singleton(),
  expansionSearchService: asClass(ExpansionSearchService).singleton(),
  expansionCompatibilityService: asClass(ExpansionCompatibilityService).singleton(),
  expansionCatalogService: asClass(ExpansionCatalogService).singleton(),
  rngService: asClass(RngService).singleton(),
  expansionEffectRegistryService: asClass(ExpansionEffectRegistryService).singleton(),
  expansionCardMetadataRegistryService: asClass(ExpansionCardMetadataRegistryService).singleton(),
  tokenRegistryService: asClass(TokenRegistryService).singleton(),
  matchRuntimeFactory: asClass(MatchRuntimeFactory).singleton(),
  matchSocketBindings: asClass(MatchSocketBindings).singleton(),
  configStore: asClass(FileGameConfigurationStore).singleton(),
  lobbySocketBindings: asClass(LobbySocketBindings).singleton(),
  disconnectedPlayerVoteService: asClass(DisconnectedPlayerVoteService).singleton(),
  playerSessionService: asClass(PlayerSessionService).singleton(),
  playerFactoryService: asClass(PlayerFactoryService).singleton(),
  playerRegistryService: asClass(PlayerRegistryService).singleton(),
  matchStartOrchestrator: asClass(MatchStartOrchestrator).singleton(),
  serverStartupService: asClass(ServerStartupService).singleton(),
  game: asClass(Game).singleton(),
});

// Resolve the game singleton after all dependencies are registered.
const game = container.resolve<Game>('game');
const serverStartupService = container.resolve<ServerStartupService>('serverStartupService');

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
      if (!serverConfigService.isMatchStateExportEnabled()) {
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
      if (!serverConfigService.isMatchStateMergeEnabled()) {
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

void serverStartupService.start().catch((error) => {
  // Surface startup failures and stop the process so the host can restart.
  console.error('[SERVER] startup failed');
  console.error(error);
  Deno.exit(1);
});
