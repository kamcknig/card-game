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
import { ServerStatusRouteHandlerService } from '../core/server-status-route-handler-service.ts';
import { ServerHealthService } from '../core/server-health-service.ts';
import { ExpansionEffectRegistryService } from '../core/expansion-effect-registry-service.ts';
import { ExpansionCardMetadataRegistryService } from '../core/expansion-card-metadata-registry-service.ts';
import { ExpansionCatalogService } from '../core/expansion-catalog-service.ts';
import { RngService } from '../core/rng-service.ts';
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
import { InMemoryMatchConfigurationSaveService } from '../core/in-memory-match-configuration-save-service.ts';
import { SupabaseMatchConfigurationSaveService } from '../core/supabase-match-configuration-save-service.ts';
import type { MatchConfigurationSaveStore } from '../core/match-configuration-save-store.ts';
import { AuthSessionService } from '../core/auth/auth-session-service.ts';
import { ServerAuthRouteHandlerService } from '../core/auth/server-auth-route-handler-service.ts';
import { AuthRateLimiterService } from '../core/auth/auth-rate-limiter-service.ts';
import { AuthSessionCleanupService } from '../core/auth/auth-session-cleanup-service.ts';
import { InMemorySessionStore } from '../core/auth/in-memory-session-store.ts';
import { SupabaseSessionStore } from '../core/auth/supabase-session-store.ts';
import type { SessionStore } from '../core/auth/session-store.ts';
import { SupabaseClientProvider } from '../core/storage/supabase-client-provider.ts';
import { Argon2idHasher, BcryptHasher } from '../core/auth/password-hasher.ts';
import { InMemoryUserStore } from '../core/auth/in-memory-user-store.ts';
import { SupabaseUserStore } from '../core/auth/supabase-user-store.ts';
import { DevBypassUserStore } from '../core/auth/dev-bypass-user-store.ts';
import type { UserStore } from '../core/auth/user-store.ts';
import { UserAccountAuthProvider } from '../core/auth/user-account-auth-provider.ts';
import { SERVER_VERSION } from '../version.ts';

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
    // Process-wide server version. Read once at module load from deno.json
    // and exposed via DI so feature services receive it as a constructor
    // parameter rather than reaching for a global.
    serverVersion: asValue(SERVER_VERSION),
    serverConfigService: asClass(ServerConfigService).singleton(),
    loggerBackendProvider: asClass(LoggerBackendProvider).singleton(),
    // Root/server logger context for non-game-specific startup/runtime services.
    loggerContext: asValue({ scope: 'server' }),
    loggerService: asClass(LoggerService).singleton(),
    maxPlayers: asValue(6),
    matchScopeFactory: asClass(MatchScopeFactory).singleton(),
    matchConfiguratorFactory: asClass(MatchConfiguratorFactory).singleton(),
    expansionSearchService: asClass(ExpansionSearchService).singleton(),
    // Selects the match-configuration save store backend based on STORAGE_BACKEND env var.
    // 'supabase' uses the Supabase-backed implementation — open() called from ServerStartupService.
    // 'in-memory' or undefined (env unset/invalid) uses a plain in-memory Map (non-persistent);
    // ServerStartupService records the configuration error against the health service so /status surfaces it.
    matchConfigurationSaveService: asFunction(
      (serverConfigService: ServerConfigService, loggerService: LoggerService): MatchConfigurationSaveStore => {
        const backend = serverConfigService.getStorageBackend();
        if (backend === 'supabase') {
          loggerService.log('[game data] match config save store: supabase (persistent)');
          // open() is called asynchronously during ServerStartupService.start()
          // before the HTTP server begins accepting connections.
          return new SupabaseMatchConfigurationSaveService(loggerService);
        }
        // 'in-memory' or undefined (error state — health service will surface the issue).
        loggerService.log('[game data] match config save store: in-memory (non-persistent)');
        return new InMemoryMatchConfigurationSaveService(loggerService);
      },
    ).singleton(),
    expansionCompatibilityService: asClass(ExpansionCompatibilityService).singleton(),
    expansionCatalogService: asClass(ExpansionCatalogService).singleton(),
    rngService: asClass(RngService).singleton(),
    expansionEffectRegistryService: asClass(ExpansionEffectRegistryService).singleton(),
    expansionCardMetadataRegistryService: asClass(ExpansionCardMetadataRegistryService).singleton(),
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
    // Selects the session store backend based on STORAGE_BACKEND env var.
    // 'supabase' uses the Supabase-backed store — open() is called from ServerStartupService.
    // 'in-memory' or undefined (env unset/invalid) uses an in-memory store so DI resolves cleanly;
    // ServerStartupService records the configuration error against the health service so /status surfaces it.
    sessionStore: asFunction(
      (serverConfigService: ServerConfigService, loggerService: LoggerService): SessionStore => {
        const backend = serverConfigService.getStorageBackend();
        if (backend === 'supabase') {
          loggerService.log('[auth] session store: supabase (persistent)');
          // open() is called asynchronously during ServerStartupService.start()
          // before the HTTP server begins accepting connections.
          return new SupabaseSessionStore(loggerService);
        }
        // 'in-memory' or undefined (error state — health service will surface the issue).
        loggerService.log('[auth] session store: in-memory (non-persistent)');
        return new InMemorySessionStore();
      },
    ).singleton(),
    authSessionService: asClass(AuthSessionService).singleton(),
    authRateLimiterService: asClass(AuthRateLimiterService).singleton(),
    authSessionCleanupService: asClass(AuthSessionCleanupService).singleton(),
    // Shared Supabase client provider; opened once from ServerStartupService when
    // STORAGE_BACKEND=supabase. All Supabase stores receive the client via open().
    supabaseClientProvider: asClass(SupabaseClientProvider).singleton(),
    // Tracks runtime health issues; populated by ServerStartupService after store opens.
    serverHealthService: asClass(ServerHealthService).singleton(),
    // Handles GET/OPTIONS /status — wired ahead of all other route handlers.
    serverStatusRouteHandlerService: asClass(ServerStatusRouteHandlerService).singleton(),
    // Password hashing primitives. Argon2id for all new hashes,
    // Bcrypt retained for verification of legacy rows.
    argon2idHasher: asClass(Argon2idHasher).singleton(),
    bcryptHasher: asClass(BcryptHasher).singleton(),
    // User account store. Picks the backend driven by STORAGE_BACKEND.
    // 'in-memory' or undefined (env unset/invalid) uses an in-memory store so DI resolves cleanly;
    // ServerStartupService records the configuration error against the health service so /status surfaces it.
    userStore: asFunction(
      (serverConfigService: ServerConfigService, loggerService: LoggerService): UserStore => {
        const backend = serverConfigService.getStorageBackend();
        let store: UserStore;
        if (backend === 'supabase') {
          loggerService.log('[auth] user store: supabase (persistent)');
          store = new SupabaseUserStore(loggerService);
        } else {
          // 'in-memory' or undefined (error state — health service will surface the issue).
          loggerService.log('[auth] user store: in-memory (non-persistent)');
          store = new InMemoryUserStore();
        }

        // DANGER: local-dev auth bypass. When AUTH_DEV_BYPASS=true, wrap the
        // real store so unknown usernames resolve to a synthetic admin identity,
        // which (together with the provider's password bypass) lets any
        // username/password combination sign in. Never enable outside local dev.
        if (serverConfigService.isAuthDevBypassEnabled()) {
          loggerService.warn(
            '[auth] *** AUTH_DEV_BYPASS ENABLED *** any username/password will sign in as an admin — do NOT use in production',
          );
          store = new DevBypassUserStore(store, loggerService);
        }

        return store;
      },
    ).singleton(),
    // Multi-user account provider. Sole auth provider registered with
    // AuthSessionService; the earlier preset-password provider was removed
    // in the auth-hardening work.
    userAccountAuthProvider: asClass(UserAccountAuthProvider).singleton(),
    serverAuthRouteHandlerService: asClass(ServerAuthRouteHandlerService).singleton(),
  });
};
