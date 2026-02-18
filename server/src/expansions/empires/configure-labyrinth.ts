import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { GameEventRegistrar } from '@server-types/index.ts';
import { prosperityTokenIds } from '../prosperity/token-prosperity-ids.ts';
import { placeVictoryTokensPerPlayer } from './landmark-utils.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';

export const configureLabyrinth = (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => {
  // Only register Labyrinth handlers when the landmark is present.
  const hasLabyrinth = (config.landmarks ?? []).some(
    (landmark) => landmark.cardKey === 'labyrinth',
  );
  if (!hasLabyrinth) return;


  registrar('onGameStart', async (args) => {
          // Labyrinth setup: put 6 VP tokens per player on the landmark using the shared helper.
    await placeVictoryTokensPerPlayer(args, {
      landmarkKey: 'labyrinth',
      logKey: 'labyrinth',
      landmarkName: 'Labyrinth',
    });
  });

  registrar('onCardGained', async (args, eventArgs) => {
    // Labyrinth only triggers on the current player's own turn (Possession turns excluded by design).
    const currentPlayer = getCurrentPlayer(args.match);
    if (currentPlayer.id !== eventArgs.playerId) {
      return;
    }

    // Count cards gained by the player this turn to find their 2nd gain.
    const currentTurnHistoryIndex = args.match.stats.turns.length - 1;
    const turnStatsIndex = currentTurnHistoryIndex;
    const cardIdsGainedThisTurn = args.match.stats.cardsGainedByTurn?.[turnStatsIndex] ?? [];
    let selfGainedCount = 0;
    for (const cardId of cardIdsGainedThisTurn) {
      const gainStats = args.match.stats.cardsGained[cardId];
      if (!gainStats) continue;
      if (gainStats.playerId !== eventArgs.playerId) continue;

      selfGainedCount++;
      if (selfGainedCount > 2) break;
    }

    if (selfGainedCount !== 2) {
      return;
    }

    const victoryTokenId = prosperityTokenIds.victory;
    const tokensOnLabyrinth = Object.values(args.match.tokens ?? {}).filter(
      (token) =>
        token.tokenId === victoryTokenId &&
        token.location.type === 'supplyPile' &&
        token.location.cardKey === 'labyrinth',
    ).sort((a, b) => a.id.localeCompare(b.id));

    if (!tokensOnLabyrinth.length) {
      return;
    }

    const tokensToMove = tokensOnLabyrinth.slice(0, 2);

    for (const token of tokensToMove) {
      await args.actionService.run('moveToken', {
        tokenInstanceId: token.id,
        location: { type: 'player', playerId: eventArgs.playerId },
        ownerId: eventArgs.playerId,
      });
    }
  });
};
