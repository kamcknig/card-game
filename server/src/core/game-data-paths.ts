// Centralizes game/match filesystem layout so logs and persisted config stay co-located.
// Unified root folder for all persisted runtime data.
const DATA_ROOT = Deno.env.get('GAME_DATA_ROOT')?.trim() || './game-data';
// Root folder for all game-scoped and match-scoped persisted runtime data.
const GAME_DATA_ROOT = `${DATA_ROOT}/games`;

// Sanitizes externally-derived values before using them in filesystem paths.
const sanitizePathSegment = (value: string): string => value.replace(/[^A-Za-z0-9_-]/g, '_');

// Returns the stable per-game data folder path.
export const getGameDataDirectory = (gameId: string): string => {
  return `${GAME_DATA_ROOT}/${sanitizePathSegment(gameId.trim())}`;
};

// Returns the game-scope log directory (outside a specific match scope).
export const getGameLogDirectory = (gameId: string): string => {
  return `${getGameDataDirectory(gameId)}/logs`;
};

// Returns the server-scope log directory inside the unified runtime data root.
export const getServerLogDirectory = (): string => {
  return `${DATA_ROOT}/logs/server`;
};

// Returns the stable match scope label used in paths.
export const getMatchScopeLabel = (matchScopeId: number): string => {
  return `match-${String(matchScopeId).padStart(4, '0')}`;
};

// Returns the per-match folder path nested under one game.
export const getMatchDataDirectory = (gameId: string, matchScopeId: number): string => {
  return `${getGameDataDirectory(gameId)}/matches/${getMatchScopeLabel(matchScopeId)}`;
};

// Returns the per-match log directory.
export const getMatchLogDirectory = (gameId: string, matchScopeId: number): string => {
  return `${getMatchDataDirectory(gameId, matchScopeId)}/logs`;
};

// Returns the per-match persisted configuration directory.
export const getMatchConfigDirectory = (gameId: string, matchScopeId: number): string => {
  return `${getMatchDataDirectory(gameId, matchScopeId)}/config`;
};

// Returns the per-user saved match-configuration directory when username is provided,
// or the root saves directory when omitted (for listing all users, admin use).
export const getSavedMatchConfigurationDirectory = (username?: string): string => {
  const root = `${DATA_ROOT}/saves/match-configurations`;
  return username ? `${root}/${username.toLowerCase()}` : root;
};
