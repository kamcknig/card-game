import { Server } from 'socket.io';
import { ServerEmitEvents, ServerListenEvents } from 'shared/types/index.ts';
import { LobbyDirectoryService } from './lobby-directory-service.ts';
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
    private readonly lobbyDirectoryService: LobbyDirectoryService,
    private readonly serverConfigService: ServerConfigService,
  ) {
    this.ioHandler = this.io.handler();
  }

  // Routes incoming HTTP requests to debug endpoints or the socket transport.
  public handleRequest(req: Request, info: Deno.ServeHandlerInfo): Response | Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/debug')) {
      return this.ioHandler(req, info);
    }

    if (!this.serverConfigService.isMatchStateExportEnabled()) {
      return new Response('debug API disabled', { status: 403 });
    }

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0] !== 'debug' || parts[1] !== 'games') {
      return new Response('debug resource not found', { status: 404 });
    }

    // GET /debug/games
    if (parts.length === 2 && req.method === 'GET') {
      return this.jsonResponse({
        games: this.lobbyDirectoryService.getDebugGames(),
      });
    }

    const gameId = parts[2];
    if (!gameId) {
      return new Response('gameId is required', { status: 400 });
    }

    // GET /debug/games/:gameId
    if (parts.length === 3 && req.method === 'GET') {
      const game = this.lobbyDirectoryService.getDebugGame(gameId);
      if (!game) {
        return new Response(`game '${gameId}' not found`, { status: 404 });
      }

      return this.jsonResponse({ game });
    }

    // GET /debug/games/:gameId/matches
    if (parts.length === 4 && parts[3] === 'matches' && req.method === 'GET') {
      const matches = this.lobbyDirectoryService.getDebugMatches(gameId);
      if (!matches) {
        return new Response(`game '${gameId}' not found`, { status: 404 });
      }

      return this.jsonResponse({ gameId, matches });
    }

    const matchResourceRoot = parts.length >= 5 && parts[3] === 'matches';
    if (!matchResourceRoot) {
      return new Response('debug resource not found', { status: 404 });
    }

    const parsedMatchScopeId = this.parsePositiveInt(parts[4]);
    if (!parsedMatchScopeId.ok) {
      return new Response(parsedMatchScopeId.error, { status: 400 });
    }
    const matchScopeId = parsedMatchScopeId.value;

    // GET /debug/games/:gameId/matches/:matchScopeId
    if (parts.length === 5 && req.method === 'GET') {
      const match = this.lobbyDirectoryService.getDebugMatch(gameId, matchScopeId);
      if (!match) {
        return new Response(`match '${matchScopeId}' not found for game '${gameId}'`, { status: 404 });
      }
      return this.jsonResponse({ match });
    }

    // GET|PATCH /debug/games/:gameId/matches/:matchScopeId/state
    if (parts.length === 6 && parts[5] === 'state') {
      if (req.method === 'GET') {
        const exportState = this.lobbyDirectoryService.exportMatchStateForMatch(gameId, matchScopeId);
        if (!exportState) {
          return new Response(`match '${matchScopeId}' not initialized for game '${gameId}'`, { status: 400 });
        }
        if ('error' in exportState) {
          return new Response(exportState.error, { status: 404 });
        }
        return this.jsonResponse(exportState);
      }

      if (req.method === 'PATCH') {
        if (!this.serverConfigService.isMatchStateMergeEnabled()) {
          return new Response('match state merge disabled', { status: 403 });
        }

        return req.json()
          .then((body) => {
            // Require a JSON object as the partial match payload.
            if (!body || typeof body !== 'object' || Array.isArray(body)) {
              return new Response('invalid match payload', { status: 400 });
            }

            const result = this.lobbyDirectoryService.mergeMatchStateForMatch(gameId, matchScopeId, body);
            if (!result.ok) {
              return this.jsonResponse({ error: 'invalid match update', errors: result.errors }, 400);
            }
            return this.jsonResponse({ ok: true });
          })
          .catch(() => {
            return new Response('invalid json', { status: 400 });
          });
      }

      return new Response('method not allowed', { status: 405 });
    }

    // GET /debug/games/:gameId/matches/:matchScopeId/search
    if (parts.length === 6 && parts[5] === 'search' && req.method === 'GET') {
      const type = (url.searchParams.get('type') ?? 'ways') as
        | 'cards'
        | 'events'
        | 'landmarks'
        | 'artifacts'
        | 'projects'
        | 'ways';
      const allowedTypes = new Set(['cards', 'events', 'landmarks', 'artifacts', 'projects', 'ways']);
      if (!allowedTypes.has(type)) {
        return new Response('unsupported search type', { status: 400 });
      }

      const query = url.searchParams.get('q') ?? '';
      const result = this.lobbyDirectoryService.debugSearchForMatch(gameId, matchScopeId, type, query);
      if (!result.ok) {
        return this.jsonResponse(result, 400);
      }

      return this.jsonResponse({
        ...result,
        count: result.results.length,
      });
    }

    return new Response('debug resource not found', { status: 404 });
  }

  // Creates a consistent JSON HTTP response payload.
  private jsonResponse(payload: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Parses a positive integer route segment for ids such as matchScopeId.
  private parsePositiveInt(rawValue: string): { ok: true; value: number } | { ok: false; error: string } {
    const numericValue = Number(rawValue);
    if (!Number.isInteger(numericValue) || numericValue < 1) {
      return { ok: false, error: 'matchScopeId must be a positive integer' };
    }
    return { ok: true, value: numericValue };
  }
}
