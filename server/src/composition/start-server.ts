import type { AwilixContainer } from 'awilix';
import type { ServerBootstrapService } from '../core/server-bootstrap-service.ts';

/**
 * Resolves and starts the server bootstrap service from the root container.
 *
 * This keeps container resolution at a single composition entrypoint and gives
 * callers a typed bootstrap helper instead of ad hoc `container.resolve(...)`.
 */
export const startServer = (container: AwilixContainer): void => {
  const serverBootstrapService = container.resolve<ServerBootstrapService>('serverBootstrapService');
  serverBootstrapService.start();
};
