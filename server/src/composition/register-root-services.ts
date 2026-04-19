import { asClass, asFunction, asValue, AwilixContainer } from 'awilix';
import { Server } from 'socket.io';
import { ServerEmitEvents, ServerListenEvents } from 'shared/types/index.ts';
import { ExpansionSearchService } from '../core/expansion-search-service.ts';
import { ExpansionCompatibilityService } from '../core/expansion-compatibility-service.ts';
import { LobbySocketBindings } from '../core/lobby-socket-bindings.ts';
import { DisconnectedPlayerVoteService } from '../core/disconnected-player-vote-service.ts';
import { PlayerSessionService } from '../core/player-session-service.ts';
import { PlayerRegistryService } from '../core/player-registry-service.ts';
import { PlayerFactoryService } from '../core/player-factory-service.ts';
import { MatchStartOrchestrator } from '../core/match-start-orchestrator.ts';
import { MatchScopeFactory } from '../core/match-scope-factory.ts';
import { MatchConfiguratorFactory } from '../core/match-configurator-factory.ts';
import { MatchSocketBindings } from '../core/match-socket-bindings.ts';
import { ServerStartupService } from '../core/server-startup-service.ts';
import { ServerBootstrapService } from '../core/server-bootstrap-service.ts';
import { ServerSocketGatewayService } from '../core/server-socket-gateway-service.ts';
import { ServerDebugRouteHandlerService } from '../core/server-debug-route-handler-service.ts';
import { ServerShutdownHandlerService } from '../core/server-shutdown-handler-service.ts';
import { ExpansionEffectRegistryService } from '../core/expansion-effect-registry-service.ts';
import { ExpansionCardMetadataRegistryService } from '../core/expansion-card-metadata-registry-service.ts';
import { ExpansionCatalogService } from '../core/expansion-catalog-service.ts';
import { RngService } from '../core/rng-service.ts';
import { TokenRegistryService } from '../core/tokens/token-registry-service.ts';
import { ServerConfigService } from '../core/server-config-service.ts';
import { LoggerBackendProvider, LoggerService } from '../core/logger-service.ts';
import { EventLoaderService } from '../core/events/load-events.ts';
import { LandmarkLoaderService } from '../core/landmarks/load-landmarks.ts';
import { ProjectLoaderService } from '../core/projects/load-projects.ts';
import { WayLoaderService } from '../core/ways/load-ways.ts';
import { AllyLoaderService } from '../core/allies/load-allies.ts';
import { TraitLoaderService } from '../core/traits/load-traits.ts';
import { ProphecyLoaderService } from '../core/prophecies/load-prophecies.ts';
import { ExpansionLoaderService } from '../core/expansion-loader-service.ts';
import { GameScopeFactory } from '../core/game-scope-factory.ts';
import { LobbyDirectoryService } from '../core/lobby-directory-service.ts';
import { MatchConfigurationSaveService } from '../core/match-configuration-save-service.ts';
import { AuthSessionService } from '../core/auth/auth-session-service.ts';
import { ServerAuthRouteHandlerService } from '../core/auth/server-auth-route-handler-service.ts';
import { AuthRateLimiterService } from '../core/auth/auth-rate-limiter-service.ts';
import { AuthSessionCleanupService } from '../core/auth/auth-session-cleanup-service.ts';
import { InMemorySessionStore } from '../core/auth/in-memory-session-store.ts';
import { DenoKvSessionStore } from '../core/auth/deno-kv-session-store.ts';
import type { SessionStore } from '../core/auth/session-store.ts';
import { AuthKvProvider } from '../core/auth/auth-kv-provider.ts';
import { Argon2idHasher, BcryptHasher } from '../core/auth/password-hasher.ts';
import { InMemoryUserStore } from '../core/auth/in-memory-user-store.ts';
import { DenoKvUserStore } from '../core/auth/deno-kv-user-store.ts';
import type { UserStore } from '../core/auth/user-store.ts';
import { InMemoryRegistrationCodeStore } from '../core/auth/in-memory-registration-code-store.ts';
import { DenoKvRegistrationCodeStore } from '../core/auth/deno-kv-registration-code-store.ts';
import type { RegistrationCodeStore } from '../core/auth/registration-code-store.ts';
import { UserAccountAuthProvider } from '../core/auth/user-account-auth-provider.ts';

export interface RegisterRootServicesArgs {
  io: Server<ServerListenEvents, ServerEmitEvents>;
}

/**
 * Registers all application-lifetime services in the root container.
 *
 * Composition rule:
 * - Only long-lived singletons belong here.
 * - Match-lifetime dependencies are created by `MatchScopeFactory`.
 *
 * @param container Root Awilix container created in `server.ts`.
 * @param args Runtime host values that must be injected as constants.
 */
export const registerRootServices = (container: AwilixContainer, args: RegisterRootServicesArgs): void => {
  container.register({
    rootContainer: asValue(container),
    io: asValue(args.io),
    serverConfigService: asClass(ServerConfigService).singleton(),
    loggerBackendProvider: asClass(LoggerBackendProvider).singleton(),
    // Root/server logger context for non-game-specific startup/runtime services.
    loggerContext: asValue({ scope: 'server' }),
    loggerService: asClass(LoggerService).singleton(),
    maxPlayers: asValue(6),
    matchScopeFactory: asClass(MatchScopeFactory).singleton(),
    matchConfiguratorFactory: asClass(MatchConfiguratorFactory).singleton(),
    expansionSearchService: asClass(ExpansionSearchService).singleton(),
    matchConfigurationSaveService: asClass(MatchConfigurationSaveService).singleton(),
    expansionCompatibilityService: asClass(ExpansionCompatibilityService).singleton(),
    expansionCatalogService: asClass(ExpansionCatalogService).singleton(),
    rngService: asClass(RngService).singleton(),
    expansionEffectRegistryService: asClass(ExpansionEffectRegistryService).singleton(),
    expansionCardMetadataRegistryService: asClass(ExpansionCardMetadataRegistryService).singleton(),
    tokenRegistryService: asClass(TokenRegistryService).singleton(),
    eventLoaderService: asClass(EventLoaderService).singleton(),
    landmarkLoaderService: asClass(LandmarkLoaderService).singleton(),
    projectLoaderService: asClass(ProjectLoaderService).singleton(),
    wayLoaderService: asClass(WayLoaderService).singleton(),
    traitLoaderService: asClass(TraitLoaderService).singleton(),
    prophecyLoaderService: asClass(ProphecyLoaderService).singleton(),
    allyLoaderService: asClass(AllyLoaderService).singleton(),
    expansionLoaderService: asClass(ExpansionLoaderService).singleton(),
    matchSocketBindings: asClass(MatchSocketBindings).singleton(),
    lobbySocketBindings: asClass(LobbySocketBindings).singleton(),
    disconnectedPlayerVoteService: asClass(DisconnectedPlayerVoteService).singleton(),
    playerSessionService: asClass(PlayerSessionService).singleton(),
    playerFactoryService: asClass(PlayerFactoryService).singleton(),
    playerRegistryService: asClass(PlayerRegistryService).singleton(),
    matchStartOrchestrator: asClass(MatchStartOrchestrator).singleton(),
    gameScopeFactory: asClass(GameScopeFactory).singleton(),
    lobbyDirectoryService: asClass(LobbyDirectoryService).singleton(),
    serverStartupService: asClass(ServerStartupService).singleton(),
    serverSocketGatewayService: asClass(ServerSocketGatewayService).singleton(),
    serverDebugRouteHandlerService: asClass(ServerDebugRouteHandlerService).singleton(),
    serverShutdownHandlerService: asClass(ServerShutdownHandlerService).singleton(),
    serverBootstrapService: asClass(ServerBootstrapService).singleton(),
    // Selects the session store backend based on AUTH_SESSION_STORE env var.
    // 'memory' (default) uses an in-process Map — sessions are lost on restart.
    // 'kv' uses Deno KV with a write-through cache — call DenoKvSessionStore.open()
    //   in ServerStartupService before the HTTP server accepts connections.
    sessionStore: asFunction(
      (serverConfigService: ServerConfigService, loggerService: LoggerService): SessionStore => {
        const kind = serverConfigService.getSessionStoreKind();
        if (kind === 'kv') {
          loggerService.log('[auth] session store: deno kv (persistent across restarts)');
          // open() is called asynchronously during ServerStartupService.start()
          // before the HTTP server begins accepting connections.
          return new DenoKvSessionStore(loggerService);
        }
        loggerService.log('[auth] session store: in-memory (sessions lost on restart)');
        return new InMemorySessionStore();
      },
    ).singleton(),
    authSessionService: asClass(AuthSessionService).singleton(),
    authRateLimiterService: asClass(AuthRateLimiterService).singleton(),
    authSessionCleanupService: asClass(AuthSessionCleanupService).singleton(),
    // Shared KV handle provider; opened once from ServerStartupService so
    // DenoKvSessionStore, DenoKvUserStore, and DenoKvRegistrationCodeStore
    // all share a single Deno KV database file.
    authKvProvider: asClass(AuthKvProvider).singleton(),
    // Password hashing primitives. Argon2id for all new hashes,
    // Bcrypt retained for verification of legacy rows.
    argon2idHasher: asClass(Argon2idHasher).singleton(),
    bcryptHasher: asClass(BcryptHasher).singleton(),
    // User account store. Picks the KV-backed implementation when
    // AUTH_SESSION_STORE=kv so both session and user data share a file.
    userStore: asFunction(
      (serverConfigService: ServerConfigService, loggerService: LoggerService): UserStore => {
        const kind = serverConfigService.getSessionStoreKind();
        if (kind === 'kv') {
          loggerService.log('[auth] user store: deno kv (persistent)');
          return new DenoKvUserStore(loggerService);
        }
        loggerService.log('[auth] user store: in-memory');
        return new InMemoryUserStore();
      },
    ).singleton(),
    // Registration code store. Mirrors the selection logic for session/user
    // stores so the same backend is used throughout auth.
    registrationCodeStore: asFunction(
      (serverConfigService: ServerConfigService, loggerService: LoggerService): RegistrationCodeStore => {
        const kind = serverConfigService.getSessionStoreKind();
        if (kind === 'kv') {
          loggerService.log('[auth] registration code store: deno kv (persistent)');
          return new DenoKvRegistrationCodeStore(loggerService);
        }
        loggerService.log('[auth] registration code store: in-memory');
        return new InMemoryRegistrationCodeStore();
      },
    ).singleton(),
    // Multi-user account provider. Sole auth provider registered with
    // AuthSessionService; the earlier preset-password provider was removed
    // in the auth-hardening work.
    userAccountAuthProvider: asClass(UserAccountAuthProvider).singleton(),
    serverAuthRouteHandlerService: asClass(ServerAuthRouteHandlerService).singleton(),
  });
};
