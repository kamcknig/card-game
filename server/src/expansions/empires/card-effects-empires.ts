import { CardExpansionModule, CardEffectFunctionContext } from '../../types.ts';
import { CardId } from 'shared/shared-types.ts';

type ArchiveEffectContext = Pick<CardEffectFunctionContext, 'runGameActionDelegate' | 'cardLibrary' | 'cardSourceController'>;

const expansion: CardExpansionModule = {
  'archive': {
    registerEffects: () => async (args) => {
      const { playerId, cardId } = args;

      console.debug(`[archive effect] gaining 1 action...`);
      await args.runGameActionDelegate('gainAction', { count: 1 });

      const setAsideCardIds: CardId[] = [];
      console.info(`[archive effect] preparing to set aside up to 3 cards for player ${playerId}`);

      // Set aside up to 3 cards from the top of the deck, shuffling as needed.
      for (let i = 0; i < 3; i += 1) {
        const deck = args.cardSourceController.getSource('playerDeck', playerId);
        if (deck.length < 1) {
          await args.runGameActionDelegate('shuffleDeck', { playerId });
        }

        if (deck.length < 1) {
          console.debug(`[archive effect] no cards left to set aside`);
          break;
        }

        const topCardId = deck.slice(-1)[0];
        await args.runGameActionDelegate('moveCard', {
          cardId: topCardId,
          toPlayerId: playerId,
          to: { location: 'set-aside' },
          facing: 'back',
        });
        console.debug(`[archive effect] set aside card ${topCardId}`);
        setAsideCardIds.push(topCardId);
      }

      console.info(`[archive effect] set aside cards: ${setAsideCardIds.join(', ') || 'none'}`);

      const moveSetAsideCardToHand = async (effectArgs: ArchiveEffectContext) => {
        if (!setAsideCardIds.length) return;

        let chosenCardId: CardId | undefined = setAsideCardIds[0];
        if (setAsideCardIds.length > 1) {
          console.debug(`[archive effect] prompting selection from set-aside cards`);
          const selectionResult = await effectArgs.runGameActionDelegate('userPrompt', {
            playerId,
            prompt: 'Choose a set aside card',
            content: {
              type: 'select',
              cardIds: setAsideCardIds,
              selectableCardIds: setAsideCardIds,
              selectCount: 1,
            }
          }) as { result?: CardId[] };
          chosenCardId = selectionResult?.result?.[0] ?? chosenCardId;
        }

        if (!chosenCardId) return;

        console.info(`[archive effect] moving chosen set-aside card ${chosenCardId} to hand`);
        await effectArgs.runGameActionDelegate('moveCard', {
          cardId: chosenCardId,
          toPlayerId: playerId,
          to: { location: 'playerHand' },
          facing: 'front',
        });

        const idx = setAsideCardIds.indexOf(chosenCardId);
        if (idx >= 0) {
          setAsideCardIds.splice(idx, 1);
        }
        console.info(`[archive effect] remaining set-aside cards: ${setAsideCardIds.join(', ') || 'none'}`);
      };

      // Gain one of the set-aside cards immediately.
      await moveSetAsideCardToHand(args);

      if (!setAsideCardIds.length) {
        return;
      }

      const archiveCard = args.cardLibrary.getCard(cardId);

      // Keep Archive active for each remaining set-aside card.
      args.registerDurationEffect(archiveCard, {
        id: `archive:${cardId}:startTurn`,
        listeningFor: 'startTurn',
        playerId,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === playerId && setAsideCardIds.length > 0,
        triggeredEffectFn: async (triggeredArgs) => {
          console.info(`[archive trigger] startTurn for player ${playerId}, remaining: ${setAsideCardIds.length}`);
          console.debug(`[archive triggered effect] moving Archive back to play area...`);
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId,
            to: { location: 'playArea' },
          });

          await moveSetAsideCardToHand(triggeredArgs);

          // When the last card is taken, remove lingering duration triggers.
          if (setAsideCardIds.length <= 0) {
            console.info(`[archive trigger] set-aside cards exhausted; cleaning up duration triggers`);
            triggeredArgs.reactionManager.cleanupDurationTriggers(cardId);
          }
        },
      }, {
        // Keep Archive in play through the next cleanup even after the last card is taken.
        cleanupCount: setAsideCardIds.length + 1,
      });
    },
  },
};

export default expansion;
