import { Server } from 'socket.io';
import { ServerEmitEvents, ServerListenEvents } from 'shared/types/index.ts';
import { LobbyDirectoryService } from './lobby-directory-service.ts';
import { ServerConfigService } from './server-config-service.ts';
import { ExpansionCatalogService } from './expansion-catalog-service.ts';
import { ExpansionSearchService } from './expansion-search-service.ts';
import { MatchConfigurationSaveService } from './match-configuration-save-service.ts';
import { debugOpenApiSpec } from './debug-openapi-spec.ts';
import {
  AllyNoId,
  ArtifactNoId,
  BoonNoId,
  CardNoId,
  EventNoId,
  HexNoId,
  LandmarkNoId,
  ProjectNoId,
  MatchConfiguration,
  StateNoId,
  TraitNoId,
  WayNoId,
} from 'shared/types/index.ts';
import { ExpansionData } from '@expansions/expansion-library.ts';

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
    private readonly expansionCatalogService: ExpansionCatalogService,
    private readonly expansionSearchService: ExpansionSearchService,
    private readonly matchConfigurationSaveService: MatchConfigurationSaveService,
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
    if (parts.length < 2 || parts[0] !== 'debug') {
      return new Response('debug resource not found', { status: 404 });
    }

    // GET /debug/openapi.json
    if (parts.length === 2 && parts[1] === 'openapi.json') {
      if (req.method !== 'GET') {
        return new Response('method not allowed', { status: 405 });
      }
      return this.jsonResponse(debugOpenApiSpec);
    }

    // GET /debug/docs
    if (parts.length === 2 && parts[1] === 'docs') {
      if (req.method !== 'GET') {
        return new Response('method not allowed', { status: 405 });
      }
      return this.swaggerUiHtmlResponse();
    }

    // GET /debug/reference
    if (parts.length === 2 && parts[1] === 'reference') {
      if (req.method !== 'GET') {
        return new Response('method not allowed', { status: 405 });
      }
      return this.scalarHtmlResponse();
    }

    if (parts[1] === 'expansions') {
      return this.handleExpansionDebugRoutes(req, parts);
    }

    if (parts[1] === 'saved-match-configurations') {
      return this.handleSavedMatchConfigurationDebugRoutes(req, parts);
    }

    if (parts[1] !== 'games') {
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

        return req
          .json()
          .then(body => {
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

    // GET /debug/games/:gameId/matches/:matchScopeId/card-library
    if (parts.length === 6 && parts[5] === 'card-library' && req.method === 'GET') {
      const exportState = this.lobbyDirectoryService.exportMatchStateForMatch(gameId, matchScopeId);
      if (!exportState) {
        return new Response(`match '${matchScopeId}' not initialized for game '${gameId}'`, { status: 400 });
      }
      if ('error' in exportState) {
        return new Response(exportState.error, { status: 404 });
      }

      return this.jsonResponse({
        gameId,
        matchScopeId,
        cardLibrary: exportState.cardLibrary,
        count: Object.keys(exportState.cardLibrary).length,
      });
    }

    // GET /debug/games/:gameId/matches/:matchScopeId/search
    if (parts.length === 6 && parts[5] === 'search' && req.method === 'GET') {
      const type = (url.searchParams.get('type') ?? 'ways') as
        | 'cards'
        | 'events'
        | 'landmarks'
        | 'artifacts'
        | 'projects'
        | 'ways'
        | 'traits'
        | 'allies';
      const allowedTypes = new Set([
        'cards',
        'events',
        'landmarks',
        'artifacts',
        'projects',
        'ways',
        'traits',
        'allies',
      ]);
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

  // Routes /debug/saved-match-configurations resources for save-file CRUD operations.
  private handleSavedMatchConfigurationDebugRoutes(req: Request, parts: string[]): Response | Promise<Response> {
    // GET /debug/saved-match-configurations
    if (parts.length === 2 && req.method === 'GET') {
      const entries = this.matchConfigurationSaveService.listSavedConfigurations();
      return this.jsonResponse({
        count: entries.length,
        entries,
      });
    }

    // DELETE /debug/saved-match-configurations
    if (parts.length === 2 && req.method === 'DELETE') {
      const deleteAllResult = this.matchConfigurationSaveService.deleteAllConfigurations();
      if (!deleteAllResult.ok) {
        return this.jsonResponse(deleteAllResult, 500);
      }
      return this.jsonResponse(deleteAllResult);
    }

    // POST /debug/saved-match-configurations
    if (parts.length === 2 && req.method === 'POST') {
      return req
        .json()
        .then(body => {
          if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return new Response('invalid save payload', { status: 400 });
          }

          const saveName = typeof body.name === 'string' ? body.name : '';
          const configuration = body.configuration;
          if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
            return new Response('configuration payload is required', { status: 400 });
          }

          const saveResult = this.matchConfigurationSaveService.saveConfiguration(
            saveName,
            configuration as MatchConfiguration,
          );
          return this.jsonResponse(saveResult, saveResult.ok ? 200 : 400);
        })
        .catch(() => new Response('invalid json', { status: 400 }));
    }

    const key = parts[2];
    if (!key) {
      return new Response('saved configuration key is required', { status: 400 });
    }

    const decodedKey = decodeURIComponent(key);

    // GET /debug/saved-match-configurations/:key
    if (parts.length === 3 && req.method === 'GET') {
      const getResult = this.matchConfigurationSaveService.getSavedConfiguration(decodedKey);
      if (!getResult.ok) {
        return this.jsonResponse(getResult, this.getSavedConfigurationErrorStatus(getResult.message));
      }
      return this.jsonResponse(getResult);
    }

    // DELETE /debug/saved-match-configurations/:key
    if (parts.length === 3 && req.method === 'DELETE') {
      const deleteResult = this.matchConfigurationSaveService.deleteConfiguration(decodedKey);
      if (!deleteResult.ok) {
        return this.jsonResponse(deleteResult, this.getSavedConfigurationErrorStatus(deleteResult.message));
      }
      return this.jsonResponse(deleteResult);
    }

    // PATCH /debug/saved-match-configurations/:key
    if (parts.length === 3 && req.method === 'PATCH') {
      return req
        .json()
        .then(body => {
          if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return new Response('invalid patch payload', { status: 400 });
          }

          const existing = this.matchConfigurationSaveService.getSavedConfiguration(decodedKey);
          if (!existing.ok) {
            return this.jsonResponse(existing, this.getSavedConfigurationErrorStatus(existing.message));
          }

          const patchSource =
            'configuration' in body &&
            body.configuration &&
            typeof body.configuration === 'object' &&
            !Array.isArray(body.configuration)
              ? body.configuration
              : body;
          const requestedName = typeof body.name === 'string' ? body.name : undefined;
          const { name: _ignoredName, ...configurationPatch } = patchSource as Record<string, unknown>;
          if (Object.keys(configurationPatch).length < 1 && !requestedName) {
            return new Response('patch payload did not include any configuration fields', { status: 400 });
          }

          // PATCH applies top-level partial updates and leaves unspecified fields unchanged.
          const mergedConfiguration: MatchConfiguration = {
            ...existing.configuration,
            ...(configurationPatch as Partial<MatchConfiguration>),
          };
          const updateResult = this.matchConfigurationSaveService.updateConfiguration(
            existing.entry.key,
            mergedConfiguration,
            requestedName,
          );
          if (!updateResult.ok) {
            return this.jsonResponse(updateResult, this.getSavedConfigurationErrorStatus(updateResult.message));
          }

          const refreshedSave = this.matchConfigurationSaveService.getSavedConfiguration(existing.entry.key);
          if (!refreshedSave.ok) {
            return this.jsonResponse(refreshedSave, this.getSavedConfigurationErrorStatus(refreshedSave.message));
          }

          return this.jsonResponse({
            ok: true,
            save: refreshedSave,
          });
        })
        .catch(() => new Response('invalid json', { status: 400 }));
    }

    return new Response('debug resource not found', { status: 404 });
  }

  // Routes /debug/expansions resources for expansion card/landscape inspection.
  private handleExpansionDebugRoutes(req: Request, parts: string[]): Response {
    // GET /debug/expansions/card-data
    if (parts.length === 3 && parts[2] === 'card-data' && req.method === 'GET') {
      const expansions = this.getAllExpansionDebugResources();
      return this.jsonResponse({
        count: expansions.length,
        expansions,
      });
    }

    // GET /debug/expansions
    if (parts.length === 2 && req.method === 'GET') {
      const expansions = this.getAllExpansionDebugResources();
      return this.jsonResponse({
        count: expansions.length,
        expansions,
      });
    }

    // POST /debug/expansions/search-index/rebuild
    if (parts.length === 4 && parts[2] === 'search-index' && parts[3] === 'rebuild' && req.method === 'POST') {
      this.expansionSearchService.rebuildIndexes();
      const indexSizes = this.getExpansionIndexSizes();
      return this.jsonResponse({
        ok: true,
        rebuilt: true,
        indexSizes,
      });
    }

    const expansionName = parts[2];
    if (!expansionName) {
      return new Response('expansion name is required', { status: 400 });
    }

    // GET /debug/expansions/:expansionName
    if (parts.length === 3 && req.method === 'GET') {
      const expansion = this.expansionCatalogService.getExpansion(expansionName);
      if (!expansion) {
        return new Response(`expansion '${expansionName}' not found`, { status: 404 });
      }
      return this.jsonResponse(this.toExpansionDebugResource(expansionName));
    }

    // GET /debug/expansions/:expansionName/card-data
    if (parts.length === 4 && parts[3] === 'card-data' && req.method === 'GET') {
      const expansion = this.expansionCatalogService.getExpansion(expansionName);
      if (!expansion) {
        return new Response(`expansion '${expansionName}' not found`, { status: 404 });
      }
      return this.jsonResponse({
        expansion: this.toExpansionDebugResource(expansionName),
      });
    }

    return new Response('debug resource not found', { status: 404 });
  }

  // Returns all loaded expansions as stable, cardKey-sorted debug resources.
  private getAllExpansionDebugResources(): ReturnType<ServerDebugRouteHandlerService['toExpansionDebugResource']>[] {
    const expansionLibrary = this.expansionCatalogService.getExpansionLibrary();
    const expansionNames = Object.keys(expansionLibrary).sort((a, b) => a.localeCompare(b));
    return expansionNames.map(name => this.toExpansionDebugResource(name));
  }

  // Builds one expansion resource with supply cards and all supported landscape categories.
  private toExpansionDebugResource(expansionName: string): {
    expansionName: string;
    title: string;
    mutuallyExclusive: string[];
    cards: {
      basicSupply: CardNoId[];
      kingdomSupply: CardNoId[];
      allSupply: CardNoId[];
    };
    cardLikes: {
      events: EventNoId[];
      allies: AllyNoId[];
      landmarks: LandmarkNoId[];
      artifacts: ArtifactNoId[];
      projects: ProjectNoId[];
      ways: WayNoId[];
      traits: TraitNoId[];
      boons: BoonNoId[];
      hexes: HexNoId[];
      states: StateNoId[];
    };
    counts: Record<string, number>;
  } {
    const expansion = this.expansionCatalogService.getRequiredExpansion(expansionName);
    const basicSupply = this.sortCardLikeValues<CardNoId>(expansion.cardData.basicSupply);
    const kingdomSupply = this.sortCardLikeValues<CardNoId>(expansion.cardData.kingdomSupply);
    const events = this.sortCardLikeValues<EventNoId>(expansion.events);
    const allies = this.sortCardLikeValues<AllyNoId>(expansion.allies);
    const landmarks = this.sortCardLikeValues<LandmarkNoId>(expansion.landmarks);
    const artifacts = this.sortCardLikeValues<ArtifactNoId>(expansion.artifacts);
    const projects = this.sortCardLikeValues<ProjectNoId>(expansion.projects);
    const ways = this.sortCardLikeValues<WayNoId>(expansion.ways);
    const traits = this.sortCardLikeValues<TraitNoId>(expansion.traits);
    const boons = this.sortCardLikeValues<BoonNoId>(expansion.boons);
    const hexes = this.sortCardLikeValues<HexNoId>(expansion.hexes);
    const states = this.sortCardLikeValues<StateNoId>(expansion.states);

    return {
      expansionName,
      title: expansion.title,
      mutuallyExclusive: expansion.mutuallyExclusive ?? [],
      cards: {
        basicSupply,
        kingdomSupply,
        allSupply: [...basicSupply, ...kingdomSupply],
      },
      cardLikes: {
        events,
        allies,
        landmarks,
        artifacts,
        projects,
        ways,
        traits,
        boons,
        hexes,
        states,
      },
      counts: {
        basicSupply: basicSupply.length,
        kingdomSupply: kingdomSupply.length,
        allSupply: basicSupply.length + kingdomSupply.length,
        events: events.length,
        allies: allies.length,
        landmarks: landmarks.length,
        artifacts: artifacts.length,
        projects: projects.length,
        ways: ways.length,
        traits: traits.length,
        boons: boons.length,
        hexes: hexes.length,
        states: states.length,
      },
    };
  }

  // Returns card/landscape catalog counts for search-index rebuild responses.
  private getExpansionIndexSizes(): Record<string, number> {
    const expansionLibrary = this.expansionCatalogService.getExpansionLibrary();
    const allExpansions = Object.values(expansionLibrary) as ExpansionData[];
    const rawCardLibrary = this.expansionCatalogService.getRawCardLibrary();
    return {
      expansions: allExpansions.length,
      rawCards: Object.keys(rawCardLibrary).length,
      events: allExpansions.reduce((sum, expansion) => sum + Object.keys(expansion.events).length, 0),
      allies: allExpansions.reduce((sum, expansion) => sum + Object.keys(expansion.allies).length, 0),
      landmarks: allExpansions.reduce((sum, expansion) => sum + Object.keys(expansion.landmarks).length, 0),
      artifacts: allExpansions.reduce((sum, expansion) => sum + Object.keys(expansion.artifacts).length, 0),
      projects: allExpansions.reduce((sum, expansion) => sum + Object.keys(expansion.projects).length, 0),
      ways: allExpansions.reduce((sum, expansion) => sum + Object.keys(expansion.ways).length, 0),
      traits: allExpansions.reduce((sum, expansion) => sum + Object.keys(expansion.traits).length, 0),
      boons: allExpansions.reduce((sum, expansion) => sum + Object.keys(expansion.boons).length, 0),
      hexes: allExpansions.reduce((sum, expansion) => sum + Object.keys(expansion.hexes).length, 0),
      states: allExpansions.reduce((sum, expansion) => sum + Object.keys(expansion.states).length, 0),
    };
  }

  // Creates a stable, cardKey-sorted list from a card/landscape keyed record.
  private sortCardLikeValues<T extends { cardKey: string }>(records: Record<string, T>): T[] {
    return Object.values(records).sort((a, b) => a.cardKey.localeCompare(b.cardKey));
  }

  // Creates a consistent JSON HTTP response payload.
  private jsonResponse(payload: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Serves a Swagger UI page that reads the debug OpenAPI JSON document.
  private swaggerUiHtmlResponse(): Response {
    return this.htmlResponse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Debug API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    html, body { margin: 0; padding: 0; background: #f7f8fa; }
    #swagger-ui { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/debug/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      persistAuthorization: false,
    });
  </script>
</body>
</html>`);
  }

  // Serves a Scalar API reference page that reads the debug OpenAPI JSON document.
  private scalarHtmlResponse(): Response {
    return this.htmlResponse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Debug API Reference</title>
  <style>
    html, body { margin: 0; padding: 0; background: #f7f8fa; min-height: 100%; }
  </style>
</head>
<body>
  <script id="api-reference" data-url="/debug/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
  }

  // Creates a consistent HTML HTTP response payload.
  private htmlResponse(html: string, status: number = 200): Response {
    return new Response(html, {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  // Maps saved-configuration service error messages to stable HTTP status codes.
  private getSavedConfigurationErrorStatus(message: string): number {
    if (message.toLowerCase().includes('invalid')) {
      return 400;
    }
    if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('unreadable')) {
      return 404;
    }
    return 500;
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
