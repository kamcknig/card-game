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
  registerHexEffect(
    'bad-omens',
    async ({ loggerService, playerId, cardSourceController, actionService, cardLibrary }) => {
      const deck = cardSourceController.getSource('playerDeck', playerId);
      if (deck.length < 1) {
        loggerService.debug('[bad-omens hex] no cards in deck to move');
        return;
      }

      loggerService.debug(`[bad-omens hex] moving ${deck.length} cards from deck to discard`);
      while (deck.length > 0) {
        const cardId = deck[deck.length - 1];
        await actionService.run('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'playerDiscard' },
        });
      }

      const discard = cardSourceController.getSource('playerDiscard', playerId);
      const copperIds = discard.filter(cardId => cardLibrary.getCard(cardId).cardKey === 'copper');

      if (copperIds.length < 1) {
        loggerService.debug('[bad-omens hex] no Copper cards available, revealing discard');
        for (const cardId of discard) {
          await actionService.run('revealCard', {
            playerId,
            cardId,
          });
        }
        return;
      }

      const coppersToTopdeck = copperIds.slice(-2);
      loggerService.debug(`[bad-omens hex] topdecking ${coppersToTopdeck.length} Copper card(s)`);
      for (const cardId of coppersToTopdeck) {
        await actionService.run('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'playerDeck' },
        });
      }
    },
  );
};

// Registers Delusion hex effect logic.
const registerDelusion = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('delusion', async ({ loggerService, playerId, match, actionService }) => {
    if (playerHasState(match, playerId, 'deluded') || playerHasState(match, playerId, 'envious')) {
      loggerService.debug('[delusion hex] player already has Deluded or Envious');
      return;
    }

    loggerService.debug('[delusion hex] gaining Deluded state');
    await actionService.run('gainState', {
      playerId,
      stateKey: 'deluded',
    });
  });
};

// Registers Envy hex effect logic.
const registerEnvy = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('envy', async ({ loggerService, playerId, match, actionService }) => {
    if (playerHasState(match, playerId, 'deluded') || playerHasState(match, playerId, 'envious')) {
      loggerService.debug('[envy hex] player already has Deluded or Envious');
      return;
    }

    loggerService.debug('[envy hex] gaining Envious state');
    await actionService.run('gainState', {
      playerId,
      stateKey: 'envious',
    });
  });
};

// Registers Famine hex effect logic.
const registerFamine = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('famine', async ({ loggerService, playerId, cardSourceController, cardLibrary, actionService }) => {
    let deck = cardSourceController.getSource('playerDeck', playerId);
    const discard = cardSourceController.getSource('playerDiscard', playerId);
    if (deck.length < 3 && discard.length > 0) {
      loggerService.debug('[famine hex] deck has fewer than 3 cards, shuffling deck only');
      await actionService.run('shuffleDeck', { playerId });
      deck = cardSourceController.getSource('playerDeck', playerId);
    }

    const revealCount = Math.min(3, deck.length);
    if (revealCount < 1) {
      loggerService.debug('[famine hex] no cards in deck to reveal');
      return;
    }

    const revealedIds = deck.slice(-revealCount);
    loggerService.debug(`[famine hex] revealing ${revealedIds.length} card(s)`);

    for (const revealId of revealedIds) {
      await actionService.run('revealCard', {
        playerId,
        cardId: revealId,
      });
    }

    const actionIds = revealedIds.filter(cardId => cardLibrary.getCard(cardId).type.includes('ACTION'));
    loggerService.debug(`[famine hex] discarding ${actionIds.length} Action card(s)`);

    for (const cardId of actionIds) {
      await actionService.run('discardCard', {
        playerId,
        cardId,
      });
    }

    // Shuffle the deck using the game action to mix in the remaining cards.
    await actionService.run('shuffleDeck', { playerId, includeDiscard: false });
  });
};

// Registers Fear hex effect logic.
const registerFear = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('fear', async ({ loggerService, playerId, cardSourceController, cardLibrary, actionService }) => {
    const hand = cardSourceController.getSource('playerHand', playerId);
    if (hand.length < 5) {
      loggerService.debug('[fear hex] fewer than 5 cards in hand, no discard required');
      return;
    }

    const eligibleIds = hand.filter(cardId => {
      const card = cardLibrary.getCard(cardId);
      return card.type.includes('ACTION') || card.type.includes('TREASURE');
    });

    if (!eligibleIds.length) {
      loggerService.debug('[fear hex] no Action or Treasure cards to discard, revealing hand');
      for (const cardId of hand) {
        await actionService.run('revealCard', {
          playerId,
          cardId,
        });
      }
      return;
    }

    const selectedId = (await actionService.run('selectSingleCard', {
      playerId,
      prompt: 'Discard an Action or Treasure',
      count: 1,
      restrict: eligibleIds,
    })) as CardId | null;
    if (!selectedId) {
      loggerService.debug('[fear hex] no card selected to discard');
      return;
    }

    loggerService.debug(`[fear hex] discarding ${cardLibrary.getCard(selectedId)}`);
    await actionService.run('discardCard', {
      playerId,
      cardId: selectedId,
    });
  });
};

// Registers Greed hex effect logic.
const registerGreed = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('greed', async ({ loggerService, playerId, supplyGainService, cardLibrary }) => {
    const gainedCopperId = await supplyGainService.gainTopSupplyCardForPileKey({
      playerId,
      pileKey: 'copper',
      from: 'basicSupply',
      to: { location: 'playerDeck' },
      logTag: 'greed hex',
    });
    if (!gainedCopperId) {
      loggerService.debug('[greed hex] no Copper cards available to gain');
      return;
    }
    loggerService.debug(`[greed hex] gaining ${cardLibrary.getCard(gainedCopperId)} to deck`);
  });
};

// Registers Haunting hex effect logic.
const registerHaunting = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect(
    'haunting',
    async ({ loggerService, playerId, cardSourceController, actionService, cardLibrary }) => {
      const hand = cardSourceController.getSource('playerHand', playerId);
      if (hand.length < 4) {
        loggerService.debug('[haunting hex] fewer than 4 cards in hand, skipping');
        return;
      }

      const selectedId = (await actionService.run('selectSingleCard', {
        playerId,
        prompt: 'Put a card from your hand onto your deck',
        count: 1,
        restrict: hand,
      })) as CardId | null;
      if (!selectedId) {
        loggerService.debug('[haunting hex] no card selected to topdeck');
        return;
      }

      loggerService.debug(`[haunting hex] topdecking ${cardLibrary.getCard(selectedId)}`);
      await actionService.run('moveCard', {
        cardId: selectedId,
        toPlayerId: playerId,
        to: { location: 'playerDeck' },
      });
    },
  );
};

// Registers Locusts hex effect logic.
const registerLocusts = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect(
    'locusts',
    async ({
      loggerService,
      playerId,
      cardSourceController,
      cardLibrary,
      cardPriceController,
      findCardService,
      actionService,
      supplyGainService,
    }) => {
      let deck = cardSourceController.getSource('playerDeck', playerId);
      const discard = cardSourceController.getSource('playerDiscard', playerId);

      if (!deck.length && discard.length) {
        loggerService.debug('[locusts hex] deck empty, shuffling discard');
        await actionService.run('shuffleDeck', { playerId });
        deck = cardSourceController.getSource('playerDeck', playerId);
      }

      if (!deck.length) {
        loggerService.debug('[locusts hex] no cards in deck to trash');
        return;
      }

      const topCardId = deck[deck.length - 1];
      const trashedCard = cardLibrary.getCard(topCardId);
      loggerService.debug(`[locusts hex] trashing top card ${trashedCard}`);

      await actionService.run('trashCard', {
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
          loggerService.debug('[locusts hex] no Curse cards available to gain');
          return;
        }
        loggerService.debug(`[locusts hex] gaining ${cardLibrary.getCard(gainedCurseId)}`);
        return;
      }

      const trashedCost = cardPriceController.applyRules(trashedCard, { playerId }).cost;
      const eligibleCards = findCardService
        .findCards({ all: [{ location: ['basicSupply', 'kingdomSupply'] }] })
        .filter(card => {
          if (!card.type.some(type => trashedCard.type.includes(type))) {
            return false;
          }
          const candidateCost = cardPriceController.applyRules(card, { playerId }).cost;
          return compareCardCosts(candidateCost, trashedCost) === -1;
        });

      if (!eligibleCards.length) {
        loggerService.debug('[locusts hex] no eligible cards to gain');
        return;
      }

      const selectedId = (await actionService.run('selectSingleCard', {
        playerId,
        prompt: 'Gain a cheaper card sharing a type',
        count: 1,
        restrict: eligibleCards.map(card => card.id),
      })) as CardId | null;
      if (!selectedId) {
        loggerService.debug('[locusts hex] no card selected to gain');
        return;
      }

      loggerService.debug(`[locusts hex] gaining ${cardLibrary.getCard(selectedId)}`);
      await actionService.run('gainCard', {
        playerId,
        cardId: selectedId,
        to: { location: 'playerDiscard' },
      });
    },
  );
};

// Registers Misery hex effect logic.
const registerMisery = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('misery', async ({ loggerService, playerId, match, actionService }) => {
    const twiceMiserable = getPlayerStateByKey(match, playerId, 'twice-miserable');
    if (twiceMiserable) {
      loggerService.debug('[misery hex] player already twice miserable');
      return;
    }

    const miserable = getPlayerStateByKey(match, playerId, 'miserable');
    if (!miserable) {
      loggerService.debug('[misery hex] gaining Miserable state');
      await actionService.run('gainState', {
        playerId,
        stateKey: 'miserable',
      });
      return;
    }

    loggerService.debug('[misery hex] flipping to Twice Miserable');
    await actionService.run('removeState', {
      playerId,
      stateId: miserable.id,
    });

    await actionService.run('gainState', {
      playerId,
      stateKey: 'twice-miserable',
    });
  });
};

// Registers Plague hex effect logic.
const registerPlague = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('plague', async ({ loggerService, playerId, supplyGainService, cardLibrary }) => {
    const gainedCurseId = await supplyGainService.gainTopSupplyCardForPileKey({
      playerId,
      pileKey: 'curse',
      from: 'basicSupply',
      to: { location: 'playerHand' },
      logTag: 'plague hex',
    });
    if (!gainedCurseId) {
      loggerService.debug('[plague hex] no Curse cards available to gain');
      return;
    }
    loggerService.debug(`[plague hex] gaining ${cardLibrary.getCard(gainedCurseId)} to hand`);
  });
};

// Registers Poverty hex effect logic.
const registerPoverty = (registerHexEffect: HexEffectRegistrar) => {
  registerHexEffect('poverty', async cardEffectArgs => {
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
    async ({ loggerService, playerId, cardSourceController, cardLibrary, cardPriceController, actionService }) => {
      const deck = cardSourceController.getSource('playerDeck', playerId);
      if (!deck.length) {
        loggerService.debug('[war hex] no cards in deck to reveal');
        return;
      }

      while (deck.length > 0) {
        const topCardId = deck[deck.length - 1];
        const card = cardLibrary.getCard(topCardId);
        const cost = cardPriceController.applyRules(card, { playerId }).cost;
        const matchesCost =
          (cost.treasure === 3 || cost.treasure === 4) && (cost.potion ?? 0) === 0 && (cost.debt ?? 0) === 0;

        if (matchesCost) {
          loggerService.debug(`[war hex] trashing ${card}`);
          await actionService.run('trashCard', {
            playerId,
            cardId: topCardId,
          });
          return;
        }

        loggerService.debug(`[war hex] discarding ${card}`);
        await actionService.run('discardCard', {
          playerId,
          cardId: topCardId,
        });
      }

      loggerService.debug('[war hex] no eligible card found, discarded entire deck');
    },
  );
};
