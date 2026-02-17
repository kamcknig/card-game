import { BoonEffectRegistrar } from '@server-types/index.ts';
import { CardId } from 'shared/types/index.ts';
import { findBoonInMatch } from '@shared/find-card-like-in-match.ts';

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
  // Register The River's Gift boon effect.
  registerRiversGift(registerBoonEffect);
  // Register The Sea's Gift boon effect.
  registerSeasGift(registerBoonEffect);
  // Register The Sky's Gift boon effect.
  registerSkysGift(registerBoonEffect);
  // Register The Sun's Gift boon effect.
  registerSunsGift(registerBoonEffect);
  // Register The Swamp's Gift boon effect.
  registerSwampsGift(registerBoonEffect);
  // Register The Wind's Gift boon effect.
  registerWindsGift(registerBoonEffect);
};

// Registers The Earth's Gift boon effect logic.
const registerEarthsGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-earths-gift', async ({ playerId, actionService, cardLibrary, findCardService }) => {
    // Determine if the player has any Treasures to discard.
    const treasuresInHand = findCardService.findCards([
      { location: 'playerHand', playerId },
      { cardType: ['TREASURE'] },
    ]);

    if (treasuresInHand.length < 1) {
      console.info('[the-earths-gift boon] no Treasures in hand, skipping discard');
      return;
    }

    // Prompt the player to optionally discard a Treasure.
    const discardedTreasureIds = await actionService.run('selectCard', {
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
    await actionService.run('moveCard', {
      cardId: discardedTreasureId,
      toPlayerId: playerId,
      to: { location: 'playerDiscard' },
    });

    console.debug('[the-earths-gift boon] selecting card to gain costing up to $4');
    const gainCardIds = await actionService.run('selectCard', {
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
    await actionService.run('gainCard', {
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
    actionService,
    match,
    reactionManager,
    cardId,
  }) => {
    // Apply the immediate +1 Action and +1 Treasure.
    await actionService.run('gainAction', { count: 1 });
    await actionService.run('gainTreasure', { count: 1 });

    // Resolve the boon instance for set-aside tracking.
    const boon = findBoonInMatch(match, cardId);
    if (!boon) {
      console.warn(`[the-fields-gift boon] could not find boon instance ${cardId}`);
      return;
    }

    // Move the boon into the player's set-aside zone until cleanup.
    await actionService.run('moveCardLike', {
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
      triggeredEffectFn: async ({ actionService }) => {
        // Return the boon to the boon discard pile at cleanup.
        await actionService.run('moveCardLike', {
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
    actionService,
    cardLibrary,
    findCardService,
  }) => {
    const handCards = findCardService.findCards({ location: 'playerHand', playerId });
    if (handCards.length < 1) {
      console.info('[the-flames-gift boon] no cards in hand, skipping');
      return;
    }

    const selectedCardIds = await actionService.run('selectCard', {
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
    await actionService.run('trashCard', {
      playerId: playerId,
      cardId: selectedCardId,
    });
  });
};

// Registers The Forest's Gift boon effect logic.
const registerForestsGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-forests-gift', async ({
    playerId,
    actionService,
    match,
    reactionManager,
    cardId,
  }) => {
    // Apply the immediate +1 Buy and +1 Treasure.
    await actionService.run('gainBuy', { count: 1 });
    await actionService.run('gainTreasure', { count: 1 });

    // Resolve the boon instance for set-aside tracking.
    const boon = findBoonInMatch(match, cardId);
    if (!boon) {
      console.warn(`[the-forests-gift boon] could not find boon instance ${cardId}`);
      return;
    }

    // Move the boon into the player's set-aside zone until cleanup.
    await actionService.run('moveCardLike', {
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
      triggeredEffectFn: async ({ actionService }) => {
        // Return the boon to the boon discard pile at cleanup.
        await actionService.run('moveCardLike', {
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
    actionService,
    findCardService,
  }) => {
    const discardCards = findCardService.findCards({ location: 'playerDiscard', playerId });
    if (discardCards.length < 1) {
      console.info('[the-moons-gift boon] no cards in discard, skipping');
      return;
    }

    const discardIds = discardCards.map((card) => card.id);
    const selectionResult = await actionService.run('userPrompt', {
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
    await actionService.run('moveCard', {
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
    supplyGainService,
  }) => {
    const gainedSilverId = await supplyGainService.gainTopSupplyCardForPileKey({
      playerId: playerId,
      pileKey: 'silver',
      from: 'basicSupply',
      to: { location: 'playerDiscard' },
      logTag: 'the-mountains-gift boon',
    });
    if (!gainedSilverId) {
      console.info('[the-mountains-gift boon] no silver cards in supply');
      return;
    }
    console.debug(`[the-mountains-gift boon] gaining silver ${gainedSilverId}`);
  });
};

// Registers The River's Gift boon effect logic.
const registerRiversGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-rivers-gift', async ({
    playerId,
    actionService,
    match,
    reactionManager,
    cardId,
  }) => {
    // Resolve the boon instance for set-aside tracking.
    const boon = findBoonInMatch(match, cardId);
    if (!boon) {
      console.warn(`[the-rivers-gift boon] could not find boon instance ${cardId}`);
      return;
    }

    // Move the boon into the player's set-aside zone until cleanup.
    await actionService.run('moveCardLike', {
      cardLikeId: boon.id,
      toPlayerId: playerId,
      to: { location: 'set-aside' },
    });

    // Register cleanup to grant +1 card at end of turn, then return the boon.
    reactionManager.registerSystemTemplate(boon, 'endTurn', {
      playerId: playerId,
      once: true,
      compulsory: true,
      allowMultipleInstances: true,
      triggeredEffectFn: async ({ actionService }) => {
        // Draw the extra card at end of turn.
        await actionService.run('drawCard', { playerId, count: 1 });
        // Return the boon to the boon discard pile at cleanup.
        await actionService.run('moveCardLike', {
          cardLikeId: boon.id,
          to: { location: 'boonDiscard' },
        });

        console.debug(`[the-rivers-gift boon] resolved and returned ${boon} to boon discard`);
      },
    });
  });
};

// Registers The Sea's Gift boon effect logic.
const registerSeasGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-seas-gift', async ({
    playerId,
    actionService,
  }) => {
    await actionService.run('drawCard', { playerId, count: 1 });
  });
};

// Registers The Sky's Gift boon effect logic.
const registerSkysGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-skys-gift', async ({
    playerId,
    actionService,
    cardLibrary,
    supplyGainService,
    cardSourceController,
  }) => {
    const confirm = await actionService.run('userPrompt', {
      playerId,
      prompt: 'Discard 3 cards to gain a Gold?',
      actionButtons: [
        { label: `DON'T DISCARD`, action: 1 },
        { label: 'DISCARD', action: 2 },
      ],
    }) as { action: number };

    if (confirm.action !== 2) {
      console.debug('[the-skys-gift boon] player declined to discard 3 cards');
      return;
    }

    const hand = cardSourceController.getSource('playerHand', playerId);
    const selectedCardIds = await actionService.run('selectCard', {
      prompt: 'Discard 3 cards',
      playerId: playerId,
      count: 3,
      restrict: hand,
    }) as CardId[];

    for (const cardId of selectedCardIds) {
      console.debug(`[the-skys-gift boon] discarding ${cardLibrary.getCard(cardId)}`);
      await actionService.run('discardCard', {
        cardId: cardId,
        playerId: playerId,
      });
    }

    if (selectedCardIds.length < 3) {
      console.info('[the-skys-gift boon] discarded fewer than 3 cards, skipping Gold gain');
      return;
    }

    const gainedGoldId = await supplyGainService.gainTopSupplyCardForPileKey({
      playerId: playerId,
      pileKey: 'gold',
      from: 'basicSupply',
      to: { location: 'playerDiscard' },
      logTag: 'the-skys-gift boon',
    });
    if (!gainedGoldId) {
      console.info('[the-skys-gift boon] no gold cards in supply');
      return;
    }

    console.debug(`[the-skys-gift boon] gaining gold ${gainedGoldId}`);
  });
};

// Registers The Sun's Gift boon effect logic.
const registerSunsGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-suns-gift', async ({
    playerId,
    actionService,
    cardSourceController,
  }) => {
    const deck = cardSourceController.getSource('playerDeck', playerId);
    const discard = cardSourceController.getSource('playerDiscard', playerId);

    const numToLookAt = Math.min(4, deck.length + discard.length);
    if (numToLookAt < 1) {
      console.info('[the-suns-gift boon] no cards available to look at');
      return;
    }

    if (deck.length < numToLookAt) {
      console.debug('[the-suns-gift boon] shuffling discard into deck');
      await actionService.run('shuffleDeck', { playerId });
    }

    const cardsToLookAt = deck.slice(-numToLookAt);

    let result = await actionService.run('userPrompt', {
      prompt: `Discard any number of the ${cardsToLookAt.length} cards`,
      playerId: playerId,
      actionButtons: [{ label: 'DONE', action: 1 }],
      content: {
        type: 'select',
        cardIds: cardsToLookAt,
        selectCount: { kind: 'upTo', count: cardsToLookAt.length },
      },
    }) as { action: number; result: CardId[] };

    const cardsToDiscard = result?.result ?? [];
    if (cardsToDiscard.length > 0) {
      console.debug(`[the-suns-gift boon] discarding ${cardsToDiscard.length} cards`);
      for (const cardId of cardsToDiscard) {
        await actionService.run('discardCard', {
          cardId: cardId,
          playerId: playerId,
        });
      }
    }

    const cardsToRearrange = cardsToLookAt.filter((id) => !cardsToDiscard.includes(id));
    if (cardsToRearrange.length < 2) {
      if (cardsToRearrange.length === 1) {
        await actionService.run('moveCard', {
          cardId: cardsToRearrange[0],
          toPlayerId: playerId,
          to: { location: 'playerDeck' },
        });
      }
      console.debug('[the-suns-gift boon] not enough cards to rearrange');
      return;
    }

    result = await actionService.run('userPrompt', {
      prompt: 'Put the rest back on top of your deck in any order',
      playerId: playerId,
      actionButtons: [{ label: 'DONE', action: 1 }],
      content: {
        type: 'rearrange',
        cardIds: cardsToRearrange,
      },
    }) as { action: number; result: CardId[] };

    for (const cardId of result.result) {
      await actionService.run('moveCard', {
        cardId: cardId,
        toPlayerId: playerId,
        to: { location: 'playerDeck' },
      });
    }
  });
};

// Registers The Swamp's Gift boon effect logic.
const registerSwampsGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-swamps-gift', async ({
    playerId,
    actionService,
    findCardService,
  }) => {
    const willOWispCards = findCardService.findCards([
      { location: 'nonSupplyCards' },
      { cardKeys: 'will-o-wisp' },
    ]);

    if (willOWispCards.length < 1) {
      console.info("[the-swamps-gift boon] no Will-o'-Wisps available to gain");
      return;
    }

    const willOWispId = willOWispCards.slice(-1)[0].id;
    console.debug(`[the-swamps-gift boon] gaining Will-o\'-Wisp ${willOWispId}`);
    await actionService.run('gainCard', {
      playerId: playerId,
      cardId: willOWispId,
      to: { location: 'playerDiscard' },
    });
  });
};

// Registers The Wind's Gift boon effect logic.
const registerWindsGift = (registerBoonEffect: BoonEffectRegistrar) => {
  registerBoonEffect('the-winds-gift', async ({
    playerId,
    actionService,
    cardLibrary,
    cardSourceController,
  }) => {
    // Draw two cards before discarding.
    await actionService.run('drawCard', { playerId, count: 2 });

    const hand = cardSourceController.getSource('playerHand', playerId);
    if (hand.length < 1) {
      console.info('[the-winds-gift boon] no cards in hand to discard');
      return;
    }

    const cardIds = hand.length < 2 ? hand : await actionService.run('selectCard', {
      prompt: 'Discard 2 cards',
      playerId: playerId,
      restrict: hand,
      count: 2,
    }) as CardId[];

    for (const cardId of cardIds) {
      console.debug(`[the-winds-gift boon] discarding ${cardLibrary.getCard(cardId)}`);
      await actionService.run('discardCard', {
        cardId: cardId,
        playerId: playerId,
      });
    }
  });
};
