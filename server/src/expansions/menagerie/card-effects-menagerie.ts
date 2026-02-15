import { CardExpansionModule } from '@server-types/index.ts';
import { CardId } from 'shared/types/index.ts';
import { getRemainingSupplyCount, getStartingSupplyCount } from '../../utils/get-starting-supply-count.ts';

const expansion: CardExpansionModule = {
  'animal-fair': {
    // Register Animal Fair's alternate buy method: trash an Action from hand instead of paying treasure.
    registerAlternateBuyOptions: () => [{
      id: 'trash-action',
      label: 'Trash an Action from your hand',
      canBuy: ({ cardSourceController, cardLibrary, playerId }) => {
        // The alternate payment is legal only if the player currently has an Action in hand.
        return cardSourceController.getSource('playerHand', playerId)
          .some((cardId) => cardLibrary.getCard(cardId).type.includes('ACTION'));
      },
      apply: async ({ playerId, runGameActionDelegate }) => {
        // Prompt for the Action to trash as payment.
        const selectedCardIds = await runGameActionDelegate('selectCard', {
          playerId,
          prompt: 'Choose an Action card from your hand to trash for Animal Fair',
          restrict: [
            { location: 'playerHand', playerId },
            { cardType: 'ACTION' },
          ],
          count: 1,
        }) as CardId[];

        if (selectedCardIds.length === 0) {
          // Abort the buy if payment could not be completed.
          return { successful: false, paidTreasure: 0 };
        }

        // Trashing resolves before gain effects because this happens during payment.
        await runGameActionDelegate('trashCard', {
          playerId,
          cardId: selectedCardIds[0],
        });

        return { successful: true, paidTreasure: 0 };
      },
    }],
    registerEffects: () => async (effectArgs) => {
      // Count only supply piles, matching Dominion's Animal Fair FAQ.
      const emptySupplyPiles = getStartingSupplyCount(effectArgs.match) - getRemainingSupplyCount(effectArgs.findCards);

      console.debug(
        `[animal-fair effect] gaining 4 treasure and ${emptySupplyPiles} buy(s) based on empty supply piles`,
      );

      await effectArgs.runGameActionDelegate('gainTreasure', {
        count: 4,
      });

      if (emptySupplyPiles > 0) {
        // Only grant buys when there are empty supply piles to count.
        await effectArgs.runGameActionDelegate('gainBuy', {
          count: emptySupplyPiles,
        });
      }
    },
  },
};

export default expansion;
