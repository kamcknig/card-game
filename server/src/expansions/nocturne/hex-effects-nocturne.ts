import { HexEffectRegistrar } from '@server-types/index.ts';
import { CardId } from 'shared/types/index.ts';
import { compareCardCosts } from '@shared/compare-card-cost.ts';
import { discardDownTo } from '../../utils/discard-down-to.ts';
import { getPlayerStateByKey, playerHasState } from '../../utils/player-state-utils.ts';

// Registers all Nocturne hex effects for the current match.
export const registerNocturneHexEffects = (registerHexEffect: HexEffectRegistrar) => {
  // Register Bad Omens hex effect.
  registerBadOmens(registerHexEffect);
  // Register Delusion hex effect.
  registerDelusion(registerHexEffect);
  // Register Envy hex effect.
  registerEnvy(registerHexEffect);
  // Register Famine hex effect.
  registerFamine(registerHexEffect);
  // Register Fear hex effect.
  registerFear(registerHexEffect);
  // Register Greed hex effect.
  registerGreed(registerHexEffect);
  // Register Haunting hex effect.
  registerHaunting(registerHexEffect);
  // Register Locusts hex effect.
  registerLocusts(registerHexEffect);
  // Register Misery hex effect.
  registerMisery(registerHexEffect);
  // Register Plague hex effect.
  registerPlague(registerHexEffect);
  // Register Poverty hex effect.
  registerPoverty(registerHexEffect);
  // Register War hex effect.
  registerWar(registerHexEffect);
};

// Registers Bad Omens hex effect logic.
const registerBadOmens = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('bad-omens', async ({ playerId, cardSourceController, runGameActionDelegate, cardLibrary }) => {
    const deck = cardSourceController.getSource('playerDeck', playerId);
    if (deck.length < 1) {
      console.debug('[bad-omens hex] no cards in deck to move');
      return;
    }

    console.debug(`[bad-omens hex] moving ${deck.length} cards from deck to discard`);
    while (deck.length > 0) {
      const cardId = deck[deck.length - 1];
      await runGameActionDelegate('moveCard', {
        cardId,
        toPlayerId: playerId,
        to: { location: 'playerDiscard' },
      });
    }

    const discard = cardSourceController.getSource('playerDiscard', playerId);
    const copperIds = discard.filter((cardId) => cardLibrary.getCard(cardId).cardKey === 'copper');

    if (copperIds.length < 1) {
      console.debug('[bad-omens hex] no Copper cards available, revealing discard');
      for (const cardId of discard) {
        await runGameActionDelegate('revealCard', {
          playerId,
          cardId,
        });
      }
      return;
    }

    const coppersToTopdeck = copperIds.slice(-2);
    console.debug(`[bad-omens hex] topdecking ${coppersToTopdeck.length} Copper card(s)`);
    for (const cardId of coppersToTopdeck) {
      await runGameActionDelegate('moveCard', {
        cardId,
        toPlayerId: playerId,
        to: { location: 'playerDeck' },
      });
    }
  });
};

// Registers Delusion hex effect logic.
const registerDelusion = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('delusion', async ({ playerId, match, runGameActionDelegate }) => {
    if (playerHasState(match, playerId, 'deluded') || playerHasState(match, playerId, 'envious')) {
      console.debug('[delusion hex] player already has Deluded or Envious');
      return;
    }

    console.debug('[delusion hex] gaining Deluded state');
    await runGameActionDelegate('gainState', {
      playerId,
      stateKey: 'deluded',
    });
  });
};

// Registers Envy hex effect logic.
const registerEnvy = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('envy', async ({ playerId, match, runGameActionDelegate }) => {
    if (playerHasState(match, playerId, 'deluded') || playerHasState(match, playerId, 'envious')) {
      console.debug('[envy hex] player already has Deluded or Envious');
      return;
    }

    console.debug('[envy hex] gaining Envious state');
    await runGameActionDelegate('gainState', {
      playerId,
      stateKey: 'envious',
    });
  });
};

// Registers Famine hex effect logic.
const registerFamine = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('famine', async ({ playerId, cardSourceController, cardLibrary, runGameActionDelegate }) => {
    let deck = cardSourceController.getSource('playerDeck', playerId);
    const discard = cardSourceController.getSource('playerDiscard', playerId);
    if (deck.length < 3 && discard.length > 0) {
      console.debug('[famine hex] deck has fewer than 3 cards, shuffling deck only');
      await runGameActionDelegate('shuffleDeck', { playerId });
      deck = cardSourceController.getSource('playerDeck', playerId);
    }

    const revealCount = Math.min(3, deck.length);
    if (revealCount < 1) {
      console.debug('[famine hex] no cards in deck to reveal');
      return;
    }

    const revealedIds = deck.slice(-revealCount);
    console.debug(`[famine hex] revealing ${revealedIds.length} card(s)`);

    for (const revealId of revealedIds) {
      await runGameActionDelegate('revealCard', {
        playerId,
        cardId: revealId,
      });
    }

    const actionIds = revealedIds.filter((cardId) => cardLibrary.getCard(cardId).type.includes('ACTION'));
    console.debug(`[famine hex] discarding ${actionIds.length} Action card(s)`);

    for (const cardId of actionIds) {
      await runGameActionDelegate('discardCard', {
        playerId,
        cardId,
      });
    }

    // Shuffle the deck using the game action to mix in the remaining cards.
    await runGameActionDelegate('shuffleDeck', { playerId, includeDiscard: false });
  });
};

// Registers Fear hex effect logic.
const registerFear = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('fear', async ({ playerId, cardSourceController, cardLibrary, runGameActionDelegate }) => {
    const hand = cardSourceController.getSource('playerHand', playerId);
    if (hand.length < 5) {
      console.debug('[fear hex] fewer than 5 cards in hand, no discard required');
      return;
    }

    const eligibleIds = hand.filter((cardId) => {
      const card = cardLibrary.getCard(cardId);
      return card.type.includes('ACTION') || card.type.includes('TREASURE');
    });

    if (!eligibleIds.length) {
      console.debug('[fear hex] no Action or Treasure cards to discard, revealing hand');
      for (const cardId of hand) {
        await runGameActionDelegate('revealCard', {
          playerId,
          cardId,
        });
      }
      return;
    }

    const selectedIds = await runGameActionDelegate('selectCard', {
      playerId,
      prompt: 'Discard an Action or Treasure',
      count: 1,
      restrict: eligibleIds,
    }) as CardId[];

    const selectedId = selectedIds[0];
    if (!selectedId) {
      console.debug('[fear hex] no card selected to discard');
      return;
    }

    console.debug(`[fear hex] discarding ${cardLibrary.getCard(selectedId)}`);
    await runGameActionDelegate('discardCard', {
      playerId,
      cardId: selectedId,
    });
  });
};

// Registers Greed hex effect logic.
const registerGreed = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('greed', async ({ playerId, supplyGainService, cardLibrary }) => {
    const gainedCopperId = await supplyGainService.gainTopSupplyCardForPileKey({
      playerId,
      pileKey: 'copper',
      from: 'basicSupply',
      to: { location: 'playerDeck' },
      logTag: 'greed hex',
    });
    if (!gainedCopperId) {
      console.debug('[greed hex] no Copper cards available to gain');
      return;
    }
    console.debug(`[greed hex] gaining ${cardLibrary.getCard(gainedCopperId)} to deck`);
  });
};

// Registers Haunting hex effect logic.
const registerHaunting = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('haunting', async ({ playerId, cardSourceController, runGameActionDelegate, cardLibrary }) => {
    const hand = cardSourceController.getSource('playerHand', playerId);
    if (hand.length < 4) {
      console.debug('[haunting hex] fewer than 4 cards in hand, skipping');
      return;
    }

    const selectedIds = await runGameActionDelegate('selectCard', {
      playerId,
      prompt: 'Put a card from your hand onto your deck',
      count: 1,
      restrict: hand,
    }) as CardId[];

    const selectedId = selectedIds[0];
    if (!selectedId) {
      console.debug('[haunting hex] no card selected to topdeck');
      return;
    }

    console.debug(`[haunting hex] topdecking ${cardLibrary.getCard(selectedId)}`);
    await runGameActionDelegate('moveCard', {
      cardId: selectedId,
      toPlayerId: playerId,
      to: { location: 'playerDeck' },
    });
  });
};

// Registers Locusts hex effect logic.
const registerLocusts = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('locusts', async ({
    playerId,
    cardSourceController,
    cardLibrary,
    cardPriceController,
    findCardService,
    runGameActionDelegate,
    supplyGainService
  }) => {
    let deck = cardSourceController.getSource('playerDeck', playerId);
    const discard = cardSourceController.getSource('playerDiscard', playerId);

    if (!deck.length && discard.length) {
      console.debug('[locusts hex] deck empty, shuffling discard');
      await runGameActionDelegate('shuffleDeck', { playerId });
      deck = cardSourceController.getSource('playerDeck', playerId);
    }

    if (!deck.length) {
      console.debug('[locusts hex] no cards in deck to trash');
      return;
    }

    const topCardId = deck[deck.length - 1];
    const trashedCard = cardLibrary.getCard(topCardId);
    console.debug(`[locusts hex] trashing top card ${trashedCard}`);

    await runGameActionDelegate('trashCard', {
      playerId,
      cardId: topCardId,
    });

    if (trashedCard.cardKey === 'copper' || trashedCard.cardKey === 'estate') {
      const gainedCurseId = await supplyGainService.gainTopSupplyCardForPileKey({
        playerId,
        pileKey: 'curse',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'locusts hex',
      });
      if (!gainedCurseId) {
        console.debug('[locusts hex] no Curse cards available to gain');
        return;
      }
      console.debug(`[locusts hex] gaining ${cardLibrary.getCard(gainedCurseId)}`);
      return;
    }

    const trashedCost = cardPriceController.applyRules(trashedCard, { playerId }).cost;
    const eligibleCards = findCardService.findCards([
      { location: ['basicSupply', 'kingdomSupply'] },
    ]).filter((card) => {
      if (!card.type.some((type) => trashedCard.type.includes(type))) {
        return false;
      }
      const candidateCost = cardPriceController.applyRules(card, { playerId }).cost;
      return compareCardCosts(candidateCost, trashedCost) === -1;
    });

    if (!eligibleCards.length) {
      console.debug('[locusts hex] no eligible cards to gain');
      return;
    }

    const selectedIds = await runGameActionDelegate('selectCard', {
      playerId,
      prompt: 'Gain a cheaper card sharing a type',
      count: 1,
      restrict: eligibleCards.map((card) => card.id),
    }) as CardId[];

    const selectedId = selectedIds[0];
    if (!selectedId) {
      console.debug('[locusts hex] no card selected to gain');
      return;
    }

    console.debug(`[locusts hex] gaining ${cardLibrary.getCard(selectedId)}`);
    await runGameActionDelegate('gainCard', {
      playerId,
      cardId: selectedId,
      to: { location: 'playerDiscard' },
    });
  });
};

// Registers Misery hex effect logic.
const registerMisery = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('misery', async ({ playerId, match, runGameActionDelegate }) => {
    const twiceMiserable = getPlayerStateByKey(match, playerId, 'twice-miserable');
    if (twiceMiserable) {
      console.debug('[misery hex] player already twice miserable');
      return;
    }

    const miserable = getPlayerStateByKey(match, playerId, 'miserable');
    if (!miserable) {
      console.debug('[misery hex] gaining Miserable state');
      await runGameActionDelegate('gainState', {
        playerId,
        stateKey: 'miserable',
      });
      return;
    }

    console.debug('[misery hex] flipping to Twice Miserable');
    await runGameActionDelegate('removeState', {
      playerId,
      stateId: miserable.id,
    });

    await runGameActionDelegate('gainState', {
      playerId,
      stateKey: 'twice-miserable',
    });
  });
};

// Registers Plague hex effect logic.
const registerPlague = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('plague', async ({ playerId, supplyGainService, cardLibrary }) => {
    const gainedCurseId = await supplyGainService.gainTopSupplyCardForPileKey({
      playerId,
      pileKey: 'curse',
      from: 'basicSupply',
      to: { location: 'playerHand' },
      logTag: 'plague hex',
    });
    if (!gainedCurseId) {
      console.debug('[plague hex] no Curse cards available to gain');
      return;
    }
    console.debug(`[plague hex] gaining ${cardLibrary.getCard(gainedCurseId)} to hand`);
  });
};

// Registers Poverty hex effect logic.
const registerPoverty = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('poverty', async (cardEffectArgs) => {
    // Discard down to 3 cards in hand.
    await discardDownTo(cardEffectArgs, {
      playerId: cardEffectArgs.playerId,
      targetHandSize: 3,
      prompt: 'Discard down to 3 cards',
      logTag: 'poverty hex',
    });
  });
};

// Registers War hex effect logic.
const registerWar = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect(
    'war',
    async ({ playerId, cardSourceController, cardLibrary, cardPriceController, runGameActionDelegate }) => {
      const deck = cardSourceController.getSource('playerDeck', playerId);
      if (!deck.length) {
        console.debug('[war hex] no cards in deck to reveal');
        return;
      }

      while (deck.length > 0) {
        const topCardId = deck[deck.length - 1];
        const card = cardLibrary.getCard(topCardId);
        const cost = cardPriceController.applyRules(card, { playerId }).cost;
        const matchesCost = (cost.treasure === 3 || cost.treasure === 4) &&
          (cost.potion ?? 0) === 0 &&
          (cost.debt ?? 0) === 0;

        if (matchesCost) {
          console.debug(`[war hex] trashing ${card}`);
          await runGameActionDelegate('trashCard', {
            playerId,
            cardId: topCardId,
          });
          return;
        }

        console.debug(`[war hex] discarding ${card}`);
        await runGameActionDelegate('discardCard', {
          playerId,
          cardId: topCardId,
        });
      }

      console.debug('[war hex] no eligible card found, discarded entire deck');
    },
  );
};
