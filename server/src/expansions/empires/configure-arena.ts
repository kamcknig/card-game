import { GameEventRegistrar } from '@server-types/index.ts';
import { CardId, ComputedMatchConfiguration } from 'shared/types/index.ts';
import { prosperityTokenIds } from '../prosperity/token-prosperity-ids.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { placeVictoryTokensPerPlayer } from './landmark-utils.ts';

export const configureArena = (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => {
  const hasArena = (config.landmarks ?? []).some(
    (landmark) => landmark.cardKey === 'arena',
  );

  registrar('onGameStart', async (args) => {
    // Arena setup: put 6 VP tokens per player on the landmark using the shared helper.
    await placeVictoryTokensPerPlayer(args, {
      landmarkKey: 'arena',
      logKey: 'arena',
      landmarkName: 'Arena',
    });

    // Find the Arena landmark instance for reaction registration.
    const arenaLandmark = args.match.landmarks.find(
      (landmark) => landmark.cardKey === 'arena',
    );
    if (!arenaLandmark) {
      return;
    }

    // Register the start-of-buy-phase reaction for each player.
    for (const player of args.match.players) {
      args.reactionManager.registerReactionTemplate(
        arenaLandmark,
        'startTurnPhase',
        {
          playerId: player.id,
          once: false,
          allowMultipleInstances: true,
          compulsory: false,
          condition: async (conditionArgs) => {
            // Only react at the start of the current player's buy phase.
            if (
              getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy'
            ) {
              return false;
            }
            if (getCurrentPlayer(conditionArgs.match).id !== player.id) {
              return false;
            }
            // Only offer the reaction if the player has an Action to discard.
            const actionCards = conditionArgs.findCardService.findCards([
              { location: 'playerHand', playerId: player.id },
              { cardType: 'ACTION' },
            ]);
            return actionCards.length > 0;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            // Find Action cards in hand for the discard choice.
            const actionCards = triggeredArgs.findCardService.findCards([
              { location: 'playerHand', playerId: player.id },
              { cardType: 'ACTION' },
            ]);
            if (!actionCards.length) {
              return;
            }

            const selectedCardIds = await triggeredArgs.actionService.run(
              'selectCard',
              {
                playerId: player.id,
                prompt: 'Discard an Action card for Arena?',
                restrict: actionCards.map((card) => card.id),
                count: 1,
                optional: true,
                cancelPrompt: 'NO',
              },
            );

            if (!selectedCardIds.length) {
              return;
            }

            // Discard the selected Action card.
            const selectedCard = triggeredArgs.cardLibrary.getCard(
              selectedCardIds[0],
            );
            await triggeredArgs.actionService.run('discardCard', {
              playerId: player.id,
              cardId: selectedCard.id,
            });

            // Move up to 2 VP tokens from the Arena pile to the player.
            // Resolve the Victory token id for token filtering.
            const victoryTokenId = prosperityTokenIds.victory;
            const tokensOnArena = Object.values(
              triggeredArgs.match.tokens ?? {},
            ).filter((token) =>
              token.tokenId === victoryTokenId &&
              token.location.type === 'supplyPile' &&
              token.location.cardKey === 'arena'
            ).sort((a, b) => a.id.localeCompare(b.id));

            if (!tokensOnArena.length) {
              return;
            }

            const tokensToMove = tokensOnArena.slice(0, 2);
            for (const token of tokensToMove) {
              await triggeredArgs.actionService.run('moveToken', {
                tokenInstanceId: token.id,
                location: { type: 'player', playerId: player.id },
                ownerId: player.id,
              });
            }
          },
        },
      );
    }
  });
};
