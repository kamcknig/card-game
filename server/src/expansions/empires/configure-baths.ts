import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { GameEventRegistrar } from '@server-types/index.ts';
import { prosperityTokenIds } from '../prosperity/token-prosperity-ids.ts';
import { placeVictoryTokensPerPlayer } from './landmark-utils.ts';

export const configureBaths = (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => {
  // Only register Baths handlers when the landmark is present.
  const hasBaths = (config.landmarks ?? []).some(
    (landmark) => landmark.cardKey === 'baths',
  );
  if (!hasBaths) return;

  console.info(`[empires configurator] setting up baths landmark handlers`);

  registrar('onGameStart', async (args) => {
    // Baths setup: put 6 VP tokens per player on the landmark using the shared helper.
    await placeVictoryTokensPerPlayer(args, {
      landmarkKey: 'baths',
      logKey: 'baths',
      landmarkName: 'Baths',
    });

    // Find the Baths landmark instance for reaction registration.
    const bathsLandmark = args.match.landmarks.find(
      (landmark) => landmark.cardKey === 'baths',
    );
    if (!bathsLandmark) {
      console.warn(
        `[baths onGameStart] Baths landmark instance missing, skipping reaction registration`,
      );
      return;
    }

    // Register the end-of-turn reaction for each player.
    for (const player of args.match.players) {
      args.reactionManager.registerReactionTemplate(
        bathsLandmark,
        'endTurn',
        {
          playerId: player.id,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          condition: async (conditionArgs) => {
            // Only check for the player whose turn just ended.
            if (conditionArgs.trigger.args.playerId !== player.id) return false;

            const currentTurnHistoryIndex = conditionArgs.match.stats.turns.length - 1;
            const turnStatsIndex = currentTurnHistoryIndex;
            const cardIdsGainedThisTurn = conditionArgs.match.stats.cardsGainedByTurn?.[turnStatsIndex] ?? [];
            const selfGainedCardIds = cardIdsGainedThisTurn.filter((cardId) =>
              conditionArgs.match.stats.cardsGained[cardId]?.playerId ===
                player.id
            );

            if (selfGainedCardIds.length) {
              console.debug(
                `[baths endTurn] player ${player.id} gained ${selfGainedCardIds.length} card(s), skipping`,
              );
              return false;
            }

            return true;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            console.info(
              `[baths endTurn] player ${player.id} gained no cards, taking 2 VP`,
            );

            // Resolve the Victory token id for token filtering.
            const victoryTokenId = prosperityTokenIds.victory;
            const tokensOnBaths = Object.values(
              triggeredArgs.match.tokens ?? {},
            ).filter((token) =>
              token.tokenId === victoryTokenId &&
              token.location.type === 'supplyPile' &&
              token.location.cardKey === 'baths'
            ).sort((a, b) => a.id.localeCompare(b.id));

            if (!tokensOnBaths.length) {
              console.debug(`[baths endTurn] no VP tokens remaining on Baths`);
              return;
            }

            const tokensToMove = tokensOnBaths.slice(0, 2);
            console.info(
              `[baths endTurn] moving ${tokensToMove.length} VP token(s) to player ${player.id}`,
            );

            for (const token of tokensToMove) {
              await triggeredArgs.actionService.run('moveToken', {
                tokenInstanceId: token.id,
                location: { type: 'player', playerId: player.id },
                ownerId: player.id,
              });
            }
          },
        },
        // Ensure each player's reaction has a unique id suffix.
        { idSuffix: player.id.toString() },
      );
    }
  });
};
