import { ComputedMatchConfiguration } from 'shared/shared-types.ts';
import { GameEventRegistrar } from '../../types.ts';
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

  console.info(
    `[empires configurator] setting up labyrinth landmark handlers`,
  );

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
      console.debug(
        `[labyrinth onCardGained] card gained by non-current player ${eventArgs.playerId}, skipping`,
      );
      return;
    }

    // Count cards gained by the player this turn to find their 2nd gain.
    const cardIdsGainedThisTurn = args.match.stats.cardsGainedByTurn?.[args.match.turnNumber] ?? [];
    let selfGainedCount = 0;
    for (const cardId of cardIdsGainedThisTurn) {
      const gainStats = args.match.stats.cardsGained[cardId];
      if (!gainStats) continue;
      if (gainStats.playerId !== eventArgs.playerId) continue;

      selfGainedCount++;
      if (selfGainedCount > 2) break;
    }

    if (selfGainedCount !== 2) {
      console.debug(
        `[labyrinth onCardGained] player ${eventArgs.playerId} has gained ${selfGainedCount} card(s) this turn, skipping`,
      );
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
      console.debug(
        `[labyrinth onCardGained] no VP tokens remaining on Labyrinth`,
      );
      return;
    }

    const tokensToMove = tokensOnLabyrinth.slice(0, 2);
    console.info(
      `[labyrinth onCardGained] player ${eventArgs.playerId} gained their 2nd card, moving ${tokensToMove.length} VP token(s)`,
    );

    for (const token of tokensToMove) {
      await args.runGameActionDelegate('moveToken', {
        tokenInstanceId: token.id,
        location: { type: 'player', playerId: eventArgs.playerId },
        ownerId: eventArgs.playerId,
      });
    }
  });
};
