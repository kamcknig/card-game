import { asClass, asValue, AwilixContainer } from 'awilix';
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
import { ExpansionLoaderService } from '../core/expansion-loader-service.ts';
import { GameScopeFactory } from '../core/game-scope-factory.ts';
import { LobbyDirectoryService } from '../core/lobby-directory-service.ts';

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
export const registerRootServices = (
  container: AwilixContainer,
  args: RegisterRootServicesArgs,
): void => {
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
    expansionCompatibilityService: asClass(ExpansionCompatibilityService).singleton(),
    expansionCatalogService: asClass(ExpansionCatalogService).singleton(),
    rngService: asClass(RngService).singleton(),
    expansionEffectRegistryService: asClass(ExpansionEffectRegistryService).singleton(),
    expansionCardMetadataRegistryService: asClass(ExpansionCardMetadataRegistryService).singleton(),
    tokenRegistryService: asClass(TokenRegistryService).singleton(),
    eventLoaderService: asClass(EventLoaderService).singleton(),
    landmarkLoaderService: asClass(LandmarkLoaderService).singleton(),
    projectLoaderService: asClass(ProjectLoaderService).singleton(),
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
  });
};
