import { Server } from 'socket.io';
import { ServerEmitEvents, ServerListenEvents } from 'shared/types/index.ts';
import { ServerBootstrapService } from './core/server-bootstrap-service.ts';
import { createContainer, InjectionMode } from 'awilix';
import { registerRootServices } from './composition/register-root-services.ts';

export const io = new Server<ServerListenEvents, ServerEmitEvents>({
  pingTimeout: 1000 * 60 * 10,
});

// Build a single composition root so server dependencies are wired explicitly.
const container = createContainer({
  injectionMode: InjectionMode.CLASSIC,
});

registerRootServices(container, { io });

const serverBootstrapService = container.resolve<ServerBootstrapService>('serverBootstrapService');
serverBootstrapService.start();
