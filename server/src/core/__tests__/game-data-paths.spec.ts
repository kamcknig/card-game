import { assertEquals, assertStringIncludes } from '@std/assert';
import {
  getGameDataDirectory,
  getGameLogDirectory,
  getMatchConfigDirectory,
  getMatchDataDirectory,
  getMatchLogDirectory,
  getMatchScopeLabel,
  getSavedMatchConfigurationDirectory,
  getServerLogDirectory,
} from '../game-data-paths.ts';

Deno.test('game-data path helpers sanitize game ids and compose expected suffixes', () => {
  const gameId = 'my game/id?x';
  const sanitized = 'my_game_id_x';

  const gameDataDirectory = getGameDataDirectory(gameId);
  const gameLogDirectory = getGameLogDirectory(gameId);
  const matchDataDirectory = getMatchDataDirectory(gameId, 7);
  const matchLogDirectory = getMatchLogDirectory(gameId, 7);
  const matchConfigDirectory = getMatchConfigDirectory(gameId, 7);

  assertStringIncludes(gameDataDirectory, `/games/${sanitized}`);
  assertStringIncludes(gameLogDirectory, `/games/${sanitized}/logs`);
  assertStringIncludes(matchDataDirectory, `/games/${sanitized}/matches/match-0007`);
  assertStringIncludes(matchLogDirectory, `/games/${sanitized}/matches/match-0007/logs`);
  assertStringIncludes(matchConfigDirectory, `/games/${sanitized}/matches/match-0007/config`);
});

Deno.test('game-data path helpers return stable shared directories and labels', () => {
  assertEquals(getMatchScopeLabel(3), 'match-0003');
  assertEquals(getMatchScopeLabel(12345), 'match-12345');
  assertStringIncludes(getServerLogDirectory(), '/logs/server');
  assertStringIncludes(getSavedMatchConfigurationDirectory(), '/saves/match-configurations');
});
