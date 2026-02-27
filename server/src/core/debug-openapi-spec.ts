/**
 * OpenAPI 3.1 contract for the debug HTTP surface.
 *
 * This is intentionally spec-first (manually maintained) so we can document
 * and browse the existing debug routes without refactoring route handlers.
 */
export const debugOpenApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Card Game Debug API',
    version: '1.0.0',
    description:
      'Debug endpoints for game/match inspection, state export/merge, expansion data, and saved configurations.',
  },
  servers: [
    {
      url: '/',
      description: 'Current origin (recommended for Swagger/Scalar UI usage)',
    },
    {
      url: 'http://localhost:{port}',
      description: 'Local development server',
      variables: {
        port: {
          default: '3001',
        },
      },
    },
  ],
  tags: [
    { name: 'debug-games', description: 'Game and match runtime debug resources.' },
    { name: 'debug-state', description: 'Match state export and partial merge operations.' },
    { name: 'debug-expansions', description: 'Expansion catalog and search-index debug resources.' },
    { name: 'debug-saved-configurations', description: 'Saved match configuration CRUD resources.' },
  ],
  paths: {
    '/debug/openapi.json': {
      get: {
        operationId: 'getDebugOpenApiSpec',
        summary: 'Returns the OpenAPI document for debug endpoints.',
        responses: {
          '200': {
            description: 'OpenAPI document',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
          '403': {
            $ref: '#/components/responses/DebugApiDisabled',
          },
        },
      },
    },
    '/debug/games': {
      get: {
        tags: ['debug-games'],
        operationId: 'listDebugGames',
        summary: 'Lists all currently tracked debug game runtimes.',
        responses: {
          '200': {
            description: 'Debug game summaries',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    games: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/GenericObject',
                      },
                    },
                  },
                  required: ['games'],
                },
              },
            },
          },
          '403': {
            $ref: '#/components/responses/DebugApiDisabled',
          },
        },
      },
    },
    '/debug/games/{gameId}': {
      get: {
        tags: ['debug-games'],
        operationId: 'getDebugGame',
        summary: 'Gets one debug game summary.',
        parameters: [{ $ref: '#/components/parameters/GameId' }],
        responses: {
          '200': {
            description: 'Debug game summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    game: {
                      $ref: '#/components/schemas/GenericObject',
                    },
                  },
                  required: ['game'],
                },
              },
            },
          },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
          '404': { $ref: '#/components/responses/NotFoundText' },
        },
      },
    },
    '/debug/games/{gameId}/matches': {
      get: {
        tags: ['debug-games'],
        operationId: 'listDebugMatchesForGame',
        summary: 'Lists match scopes for a game.',
        parameters: [{ $ref: '#/components/parameters/GameId' }],
        responses: {
          '200': {
            description: 'Debug match summaries',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    gameId: { type: 'string' },
                    matches: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/GenericObject',
                      },
                    },
                  },
                  required: ['gameId', 'matches'],
                },
              },
            },
          },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
          '404': { $ref: '#/components/responses/NotFoundText' },
        },
      },
    },
    '/debug/games/{gameId}/matches/{matchScopeId}': {
      get: {
        tags: ['debug-games'],
        operationId: 'getDebugMatchForGame',
        summary: 'Gets one debug match summary.',
        parameters: [{ $ref: '#/components/parameters/GameId' }, { $ref: '#/components/parameters/MatchScopeId' }],
        responses: {
          '200': {
            description: 'Debug match summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    match: {
                      $ref: '#/components/schemas/GenericObject',
                    },
                  },
                  required: ['match'],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequestText' },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
          '404': { $ref: '#/components/responses/NotFoundText' },
        },
      },
    },
    '/debug/games/{gameId}/matches/{matchScopeId}/state': {
      get: {
        tags: ['debug-state'],
        operationId: 'exportDebugMatchState',
        summary: 'Exports full match state for one match scope.',
        parameters: [{ $ref: '#/components/parameters/GameId' }, { $ref: '#/components/parameters/MatchScopeId' }],
        responses: {
          '200': {
            description: 'Exported match state payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequestText' },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
          '404': { $ref: '#/components/responses/NotFoundText' },
        },
      },
      patch: {
        tags: ['debug-state'],
        operationId: 'mergeDebugMatchState',
        summary: 'Applies a top-level partial merge into one match state.',
        parameters: [{ $ref: '#/components/parameters/GameId' }, { $ref: '#/components/parameters/MatchScopeId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GenericObject' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Merge accepted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: {
                      type: 'boolean',
                    },
                  },
                  required: ['ok'],
                },
              },
            },
          },
          '400': {
            description: 'Invalid payload or merge validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
              'text/plain': {
                schema: { type: 'string' },
              },
            },
          },
          '403': {
            description: 'Debug API disabled or match state merge disabled',
            content: {
              'text/plain': {
                schema: { type: 'string' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFoundText' },
          '405': { $ref: '#/components/responses/MethodNotAllowedText' },
        },
      },
    },
    '/debug/games/{gameId}/matches/{matchScopeId}/card-library': {
      get: {
        tags: ['debug-games'],
        operationId: 'getDebugMatchCardLibrary',
        summary: 'Returns card library data for one initialized match scope.',
        parameters: [{ $ref: '#/components/parameters/GameId' }, { $ref: '#/components/parameters/MatchScopeId' }],
        responses: {
          '200': {
            description: 'Card library and metadata',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    gameId: { type: 'string' },
                    matchScopeId: { type: 'integer' },
                    cardLibrary: { $ref: '#/components/schemas/GenericObject' },
                    count: { type: 'integer' },
                  },
                  required: ['gameId', 'matchScopeId', 'cardLibrary', 'count'],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequestText' },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
          '404': { $ref: '#/components/responses/NotFoundText' },
        },
      },
    },
    '/debug/games/{gameId}/matches/{matchScopeId}/search': {
      get: {
        tags: ['debug-games'],
        operationId: 'searchDebugMatchExpansionData',
        summary: 'Runs expansion search against one match context.',
        parameters: [
          { $ref: '#/components/parameters/GameId' },
          { $ref: '#/components/parameters/MatchScopeId' },
          { $ref: '#/components/parameters/SearchType' },
          { $ref: '#/components/parameters/SearchQuery' },
        ],
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    type: { type: 'string' },
                    query: { type: 'string' },
                    results: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/GenericObject' },
                    },
                    count: { type: 'integer' },
                  },
                  required: ['ok', 'type', 'query', 'results', 'count'],
                },
              },
            },
          },
          '400': {
            description: 'Unsupported search type or invalid match context',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
              'text/plain': {
                schema: { type: 'string' },
              },
            },
          },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
          '404': { $ref: '#/components/responses/NotFoundText' },
        },
      },
    },
    '/debug/saved-match-configurations': {
      get: {
        tags: ['debug-saved-configurations'],
        operationId: 'listSavedMatchConfigurations',
        summary: 'Lists all saved match configurations.',
        responses: {
          '200': {
            description: 'Saved configuration entries',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    count: { type: 'integer' },
                    entries: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/GenericObject' },
                    },
                  },
                  required: ['count', 'entries'],
                },
              },
            },
          },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
        },
      },
      delete: {
        tags: ['debug-saved-configurations'],
        operationId: 'deleteAllSavedMatchConfigurations',
        summary: 'Deletes all saved match configurations.',
        responses: {
          '200': {
            description: 'Delete-all result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
          '500': {
            description: 'Delete-all failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
        },
      },
      post: {
        tags: ['debug-saved-configurations'],
        operationId: 'createSavedMatchConfiguration',
        summary: 'Creates a saved match configuration.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  configuration: { $ref: '#/components/schemas/GenericObject' },
                },
                required: ['configuration'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Save result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequestText' },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
        },
      },
    },
    '/debug/saved-match-configurations/{key}': {
      get: {
        tags: ['debug-saved-configurations'],
        operationId: 'getSavedMatchConfiguration',
        summary: 'Gets one saved match configuration by key.',
        parameters: [{ $ref: '#/components/parameters/SavedConfigurationKey' }],
        responses: {
          '200': {
            description: 'Saved configuration details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
          '400': {
            description: 'Invalid key request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
          '404': {
            description: 'Saved configuration not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
          '500': {
            description: 'Saved configuration access failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['debug-saved-configurations'],
        operationId: 'deleteSavedMatchConfiguration',
        summary: 'Deletes one saved match configuration by key.',
        parameters: [{ $ref: '#/components/parameters/SavedConfigurationKey' }],
        responses: {
          '200': {
            description: 'Delete result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
          '400': {
            description: 'Invalid key request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
          '404': {
            description: 'Saved configuration not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
          '500': {
            description: 'Delete failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
        },
      },
      patch: {
        tags: ['debug-saved-configurations'],
        operationId: 'patchSavedMatchConfiguration',
        summary: 'Applies top-level patch updates to one saved match configuration.',
        parameters: [{ $ref: '#/components/parameters/SavedConfigurationKey' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GenericObject' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Patch result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
          '400': {
            description: 'Invalid patch payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
              'text/plain': {
                schema: { type: 'string' },
              },
            },
          },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
          '404': {
            description: 'Saved configuration not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
          '500': {
            description: 'Patch failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
        },
      },
    },
    '/debug/expansions': {
      get: {
        tags: ['debug-expansions'],
        operationId: 'listExpansionDebugResources',
        summary: 'Lists all expansion debug resources.',
        responses: {
          '200': {
            description: 'Expansion debug resource list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    count: { type: 'integer' },
                    expansions: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/GenericObject' },
                    },
                  },
                  required: ['count', 'expansions'],
                },
              },
            },
          },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
        },
      },
    },
    '/debug/expansions/card-data': {
      get: {
        tags: ['debug-expansions'],
        operationId: 'listExpansionCardData',
        summary: 'Lists all expansion card-data resources.',
        responses: {
          '200': {
            description: 'Expansion card-data list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    count: { type: 'integer' },
                    expansions: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/GenericObject' },
                    },
                  },
                  required: ['count', 'expansions'],
                },
              },
            },
          },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
        },
      },
    },
    '/debug/expansions/search-index/rebuild': {
      post: {
        tags: ['debug-expansions'],
        operationId: 'rebuildExpansionSearchIndex',
        summary: 'Rebuilds expansion search indexes.',
        responses: {
          '200': {
            description: 'Rebuild completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    rebuilt: { type: 'boolean' },
                    indexSizes: { $ref: '#/components/schemas/GenericObject' },
                  },
                  required: ['ok', 'rebuilt', 'indexSizes'],
                },
              },
            },
          },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
        },
      },
    },
    '/debug/expansions/{expansionName}': {
      get: {
        tags: ['debug-expansions'],
        operationId: 'getExpansionDebugResource',
        summary: 'Gets one expansion debug resource.',
        parameters: [{ $ref: '#/components/parameters/ExpansionName' }],
        responses: {
          '200': {
            description: 'Expansion debug resource',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericObject' },
              },
            },
          },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
          '404': { $ref: '#/components/responses/NotFoundText' },
        },
      },
    },
    '/debug/expansions/{expansionName}/card-data': {
      get: {
        tags: ['debug-expansions'],
        operationId: 'getExpansionCardData',
        summary: 'Gets one expansion card-data resource.',
        parameters: [{ $ref: '#/components/parameters/ExpansionName' }],
        responses: {
          '200': {
            description: 'Expansion card-data resource',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    expansion: {
                      $ref: '#/components/schemas/GenericObject',
                    },
                  },
                  required: ['expansion'],
                },
              },
            },
          },
          '403': { $ref: '#/components/responses/DebugApiDisabled' },
          '404': { $ref: '#/components/responses/NotFoundText' },
        },
      },
    },
  },
  components: {
    parameters: {
      GameId: {
        name: 'gameId',
        in: 'path',
        required: true,
        schema: { type: 'string', minLength: 1 },
        description: 'Stable game identifier.',
      },
      MatchScopeId: {
        name: 'matchScopeId',
        in: 'path',
        required: true,
        schema: { type: 'integer', minimum: 1 },
        description: 'Positive integer match scope identifier.',
      },
      SavedConfigurationKey: {
        name: 'key',
        in: 'path',
        required: true,
        schema: { type: 'string', minLength: 1 },
        description: 'URL-encoded saved configuration key.',
      },
      ExpansionName: {
        name: 'expansionName',
        in: 'path',
        required: true,
        schema: { type: 'string', minLength: 1 },
        description: 'Expansion key name.',
      },
      SearchType: {
        name: 'type',
        in: 'query',
        required: false,
        schema: {
          type: 'string',
          enum: ['cards', 'events', 'landmarks', 'artifacts', 'projects', 'ways', 'traits', 'allies'],
          default: 'ways',
        },
        description: 'Expansion resource type to query.',
      },
      SearchQuery: {
        name: 'q',
        in: 'query',
        required: false,
        schema: {
          type: 'string',
          default: '',
        },
        description: 'Search query text.',
      },
    },
    schemas: {
      GenericObject: {
        type: 'object',
        additionalProperties: true,
      },
    },
    responses: {
      DebugApiDisabled: {
        description: 'Debug API disabled by server configuration.',
        content: {
          'text/plain': {
            schema: { type: 'string' },
            examples: {
              disabled: {
                value: 'debug API disabled',
              },
            },
          },
        },
      },
      BadRequestText: {
        description: 'Bad request.',
        content: {
          'text/plain': {
            schema: { type: 'string' },
          },
        },
      },
      NotFoundText: {
        description: 'Resource not found.',
        content: {
          'text/plain': {
            schema: { type: 'string' },
          },
        },
      },
      MethodNotAllowedText: {
        description: 'HTTP method is not allowed.',
        content: {
          'text/plain': {
            schema: { type: 'string' },
          },
        },
      },
    },
  },
} as const;
