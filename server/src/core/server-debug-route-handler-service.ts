import { Server } from 'socket.io';
import { ServerEmitEvents, ServerListenEvents } from 'shared/types/index.ts';
import { Game } from './game.ts';
import { ServerConfigService } from './server-config-service.ts';

/**
 * Handles HTTP debug endpoints and delegates all other requests to socket.io.
 *
 * Keeping this separate from bootstrap makes route behavior easy to test and
 * avoids mixing host startup with per-request logic.
 */
export class ServerDebugRouteHandlerService {
  private readonly ioHandler: ReturnType<Server<ServerListenEvents, ServerEmitEvents>['handler']>;

  constructor(
    private readonly io: Server<ServerListenEvents, ServerEmitEvents>,
    private readonly game: Game,
    private readonly serverConfigService: ServerConfigService,
  ) {
    this.ioHandler = this.io.handler();
  }

  // Routes incoming HTTP requests to debug endpoints or the socket transport.
  public handleRequest(req: Request, info: Deno.ServeHandlerInfo): Response | Promise<Response> {
    const url = new URL(req.url);

    // Debug-only endpoint to export a full match state snapshot.
    if (url.pathname === '/debug/match-state') {
      if (!this.serverConfigService.isMatchStateExportEnabled()) {
        return new Response('match state export disabled', { status: 403 });
      }
      const exportState = this.game.exportMatchState();
      if (!exportState) {
        return new Response('match not initialized', { status: 400 });
      }
      return new Response(JSON.stringify(exportState), {
        headers: { 'content-type': 'application/json' },
      });
    }

    // Debug-only endpoint to merge a partial match state into the live match.
    if (url.pathname === '/debug/match-state/merge') {
      if (!this.serverConfigService.isMatchStateMergeEnabled()) {
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

          const result = this.game.mergeMatchState(body);
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

    return this.ioHandler(req, info);
  }
}
