import { BoonEffectRegistrar } from '../../types.ts';
import { CardId } from 'shared/shared-types';

// Registers all Nocturne boon effects for the current match.
export const registerNocturneBoonEffects = (registerBoonEffect: BoonEffectRegistrar) => {
  // Register The Earth's Gift boon effect.
  registerEarthsGift(registerBoonEffect);
  // Register The Field's Gift boon effect.
  registerFieldsGift(registerBoonEffect);
  // Register The Flame's Gift boon effect.
  registerFlamesGift(registerBoonEffect);
  // Register The Forest's Gift boon effect.
  registerForestsGift(registerBoonEffect);
  // Register The Moon's Gift boon effect.
  registerMoonsGift(registerBoonEffect);
  // Register The Mountain's Gift boon effect.
  registerMountainsGift(registerBoonEffect);
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

// Registers The Flame's Gift boon effect logic.
const registerFlamesGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-flames-gift', async ({
    playerId,
    runGameActionDelegate,
    cardLibrary,
    findCards,
  }) => {
    console.info(`[the-flames-gift boon] resolving for player ${playerId}`);

    const handCards = findCards({ location: 'playerHand', playerId });
    if (handCards.length < 1) {
      console.info('[the-flames-gift boon] no cards in hand, skipping');
      return;
    }

    const selectedCardIds = await runGameActionDelegate('selectCard', {
      prompt: 'You may trash a card from your hand',
      playerId: playerId,
      count: 1,
      optional: true,
      restrict: [
        { location: 'playerHand', playerId },
      ],
    }) as CardId[];

    const selectedCardId = selectedCardIds[0];
    if (!selectedCardId) {
      console.debug('[the-flames-gift boon] player declined to trash a card');
      return;
    }

    console.debug(`[the-flames-gift boon] trashing ${cardLibrary.getCard(selectedCardId)}`);
    await runGameActionDelegate('trashCard', {
      playerId: playerId,
      cardId: selectedCardId,
    });
  });
};

// Registers The Forest's Gift boon effect logic.
const registerForestsGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-forests-gift', async ({
    playerId,
    runGameActionDelegate,
    match,
    reactionManager,
    cardId,
  }) => {
    console.info(`[the-forests-gift boon] resolving for player ${playerId}`);

    // Apply the immediate +1 Buy and +1 Treasure.
    await runGameActionDelegate('gainBuy', { count: 1 });
    await runGameActionDelegate('gainTreasure', { count: 1 });

    // Resolve the boon instance for set-aside tracking.
    const boon = match.boons.cards.find(candidate => candidate.id === cardId);
    if (!boon) {
      console.warn(`[the-forests-gift boon] could not find boon instance ${cardId}`);
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

        console.debug(`[the-forests-gift boon] returned ${boon} to boon discard`);
      },
    });
  });
};

// Registers The Moon's Gift boon effect logic.
const registerMoonsGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-moons-gift', async ({
    playerId,
    runGameActionDelegate,
    findCards,
  }) => {
    console.info(`[the-moons-gift boon] resolving for player ${playerId}`);

    const discardCards = findCards({ location: 'playerDiscard', playerId });
    if (discardCards.length < 1) {
      console.info('[the-moons-gift boon] no cards in discard, skipping');
      return;
    }

    const discardIds = discardCards.map(card => card.id);
    const selectionResult = await runGameActionDelegate('userPrompt', {
      prompt: 'You may put a card from your discard onto your deck',
      playerId: playerId,
      actionButtons: [{ label: 'DONE', action: 1 }],
      content: {
        type: 'select',
        cardIds: discardIds,
        selectCount: { kind: 'upTo', count: 1 },
      },
    }) as { action: number; result?: CardId[] };

    const selectedCardId = selectionResult?.result?.[0];
    if (!selectedCardId) {
      console.debug('[the-moons-gift boon] player declined to topdeck a card');
      return;
    }

    console.debug(`[the-moons-gift boon] topdecking card ${selectedCardId}`);
    await runGameActionDelegate('moveCard', {
      cardId: selectedCardId,
      toPlayerId: playerId,
      to: { location: 'playerDeck' },
    });
  });
};

// Registers The Mountain's Gift boon effect logic.
const registerMountainsGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-mountains-gift', async ({
    playerId,
    runGameActionDelegate,
    findCards,
  }) => {
    console.info(`[the-mountains-gift boon] resolving for player ${playerId}`);

    const silverCards = findCards([
      { location: 'basicSupply' },
      { cardKeys: 'silver' },
    ]);

    if (silverCards.length < 1) {
      console.info('[the-mountains-gift boon] no silver cards in supply');
      return;
    }

    const silverCardId = silverCards.slice(-1)[0].id;

    console.debug(`[the-mountains-gift boon] gaining silver ${silverCardId}`);
    await runGameActionDelegate('gainCard', {
      playerId: playerId,
      cardId: silverCardId,
      to: { location: 'playerDiscard' },
    });
  });
};
