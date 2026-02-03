import { BoonEffectRegistrar } from '../../types.ts';
import { CardId } from 'shared/shared-types';

// Registers all Nocturne boon effects for the current match.
export const registerNocturneBoonEffects = (registerBoonEffect: BoonEffectRegistrar) => {
  // Register The Earth's Gift boon effect.
  registerEarthsGift(registerBoonEffect);
  // Register The Field's Gift boon effect.
  registerFieldsGift(registerBoonEffect);
};

// Registers The Earth's Gift boon effect logic.
const registerEarthsGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-earths-gift', async ({ playerId, runGameActionDelegate, cardLibrary, findCards }) => {
    console.info(`[the-earths-gift boon] resolving for player ${playerId}`);

    // Determine if the player has any Treasures to discard.
    const treasuresInHand = findCards([
      { location: 'playerHand', playerId },
      { cardType: ['TREASURE'] },
    ]);

    if (treasuresInHand.length < 1) {
      console.info('[the-earths-gift boon] no Treasures in hand, skipping discard');
      return;
    }

    // Prompt the player to optionally discard a Treasure.
    const discardedTreasureIds = await runGameActionDelegate('selectCard', {
      prompt: 'Discard a Treasure to gain a card costing up to $4',
      playerId: playerId,
      count: 1,
      optional: true,
      restrict: [
        { location: 'playerHand', playerId },
        { cardType: ['TREASURE'] },
      ],
    }) as CardId[];

    const discardedTreasureId = discardedTreasureIds[0];
    if (!discardedTreasureId) {
      console.debug('[the-earths-gift boon] player declined to discard a Treasure');
      return;
    }

    console.debug(`[the-earths-gift boon] discarding Treasure ${cardLibrary.getCard(discardedTreasureId)}`);
    await runGameActionDelegate('moveCard', {
      cardId: discardedTreasureId,
      toPlayerId: playerId,
      to: { location: 'playerDiscard' },
    });

    console.debug('[the-earths-gift boon] selecting card to gain costing up to $4');
    const gainCardIds = await runGameActionDelegate('selectCard', {
      prompt: 'Gain a card costing up to $4',
      playerId: playerId,
      count: 1,
      restrict: [
        { location: ['basicSupply', 'kingdomSupply'] },
        { playerId, kind: 'upTo', amount: { treasure: 4 } },
      ],
    }) as CardId[];

    const gainCardId = gainCardIds[0];
    if (!gainCardId) {
      console.info('[the-earths-gift boon] no eligible cards to gain');
      return;
    }

    console.debug(`[the-earths-gift boon] gaining card ${cardLibrary.getCard(gainCardId)}`);
    await runGameActionDelegate('gainCard', {
      playerId: playerId,
      cardId: gainCardId,
      to: { location: 'playerDiscard' },
    });
  });
};

// Registers The Field's Gift boon effect logic.
const registerFieldsGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-fields-gift', async ({
    playerId,
    runGameActionDelegate,
    match,
    reactionManager,
    cardId,
  }) => {
    console.info(`[the-fields-gift boon] resolving for player ${playerId}`);

    // Apply the immediate +1 Action and +1 Treasure.
    await runGameActionDelegate('gainAction', { count: 1 });
    await runGameActionDelegate('gainTreasure', { count: 1 });

    // Resolve the boon instance for set-aside tracking.
    const boon = match.boons.cards.find(candidate => candidate.id === cardId);
    if (!boon) {
      console.warn(`[the-fields-gift boon] could not find boon instance ${cardId}`);
      return;
    }

    // Move the boon into the player's set-aside zone until cleanup.
    await runGameActionDelegate('moveCardLike', {
      cardLikeId: boon.id,
      toPlayerId: playerId,
      to: { location: 'set-aside' },
    });

    // Register cleanup to return the boon to the discard pile at end of turn.
    reactionManager.registerSystemTemplate(boon, 'endTurn', {
      playerId: playerId,
      once: true,
      compulsory: true,
      allowMultipleInstances: true,
      triggeredEffectFn: async ({ runGameActionDelegate: runTriggerAction }) => {
        // Return the boon to the boon discard pile at cleanup.
        await runTriggerAction('moveCardLike', {
          cardLikeId: boon.id,
          to: { location: 'boonDiscard' },
        });

        console.debug(`[the-fields-gift boon] returned ${boon} to boon discard`);
      },
    });
  });
};
