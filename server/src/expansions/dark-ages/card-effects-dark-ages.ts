import { Card, CardId, CardKey, CardType } from 'shared/types/index.ts';
import { CardEffectFunctionContext, CardExpansionModule } from '@server-types/index.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getAttackTargets } from '../../utils/get-attack-targets.ts';
import { revealTopDeckCards } from '../../utils/reveal-top-deck-cards.ts';

// Shared Knight attack body, adopted by all 10 Dame/Sir Knights and by Rogue
// (which shares the attack text but is not itself a Knight). Each other
// player reveals the top 2 cards of their DECK (shuffling discard-in if
// short), trashes one revealed card costing $3-$6 (their own choice when
// both qualify — trashing is mandatory when a qualifying card exists), and
// discards the rest. Everything is attributed to the TARGET player, never
// the attacker. `logTag` keeps per-card log forensics accurate for whichever
// Knight/Rogue instance is calling this.
const resolveKnightAttack = async (
  cardEffectArgs: CardEffectFunctionContext,
  opts: { logTag: string },
): Promise<void> => {
  const { loggerService } = cardEffectArgs;
  // getAttackTargets = ordered ALL_OTHER minus anyone marked immune (Moat).
  const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

  for (const targetPlayerId of targetPlayerIds) {
    // Reveal the top 2 cards of the target's DECK, set aside — shuffling the
    // discard back in automatically if the deck runs dry mid-reveal.
    const revealed = await revealTopDeckCards(cardEffectArgs, targetPlayerId, 2, { setAside: true });

    const trashCandidates = revealed.filter(card => {
      const { cost } = cardEffectArgs.cardPriceController.applyRules(card, { playerId: targetPlayerId });
      return cost.treasure >= 3 && cost.treasure <= 6 && !cost.potion && !cost.debt;
    });

    let cardToTrash: Card | undefined;
    if (trashCandidates.length === 1) {
      cardToTrash = trashCandidates[0];
    } else if (trashCandidates.length > 1) {
      // Target chooses which qualifying card to trash.
      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Trash card',
        playerId: targetPlayerId,
        content: { type: 'select', cardIds: trashCandidates.map(card => card.id), selectCount: 1 },
      })) as { action: number; result: number[] };
      cardToTrash = result.result.length
        ? cardEffectArgs.cardLibrary.getCard(result.result[0])
        : trashCandidates[0]; // trashing is mandatory; default rather than skip
    }

    if (cardToTrash) {
      loggerService.debug(`[${opts.logTag}] trashing ${cardToTrash}`);
      await cardEffectArgs.actionService.run('trashCard', { playerId: targetPlayerId, cardId: cardToTrash.id });
    }

    // Everything revealed and not trashed is discarded — by the TARGET.
    const toDiscard = revealed.filter(card => card.id !== cardToTrash?.id);
    loggerService.debug(`[${opts.logTag}] discarding ${toDiscard.length} cards`);
    for (const card of toDiscard) {
      await cardEffectArgs.actionService.run('discardCard', { cardId: card.id, playerId: targetPlayerId });
    }

    if (cardToTrash?.type.includes('KNIGHT')) {
      // The "if a Knight is trashed by this, trash this" clause only appears
      // on Knight-type cards (Dames/Sirs). Rogue shares this attack body but
      // has no such text, so it must never self-trash here.
      const attacker = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      if (attacker.type.includes('KNIGHT')) {
        loggerService.debug(`[${opts.logTag}] a Knight was trashed — trashing ${attacker}`);
        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: attacker.id,
        });
      }
      // Per the Knights rules the attack continues for remaining players.
    }
  }
};

const cardEffects: CardExpansionModule = {
  'abandoned-mine': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[abandoned mine effect] gaining 1 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
    },
  },
  altar: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      let selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: { location: 'playerHand', playerId: cardEffectArgs.playerId },
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[altar effect] no card selected`);
        return;
      }

      const cardToTrash = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardToTrash.id,
      });

      selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: {
          all: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { kind: 'upTo', amount: { treasure: 5 }, playerId: cardEffectArgs.playerId },
          ],
        },
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.debug(`[altar effect] no card selected`);
        return;
      }

      const cardToGain = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[altar effect] gaining card ${cardToGain}`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardToGain.id,
        to: { location: 'playerDiscard' },
      });
    },
  },
  armory: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: {
          all: [
            { location: ['basicSupply', 'kingdomSupply'] },
            {
              kind: 'upTo',
              playerId: cardEffectArgs.playerId,
              amount: { treasure: 4 },
            },
          ],
        },
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.debug(`[armory effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[armory effect] gaining card ${selectedCard}`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDeck' },
      });
    },
  },
  'band-of-misfits': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const { cost: thisCost } = cardEffectArgs.cardPriceController.applyRules(thisCard, {
        playerId: cardEffectArgs.playerId,
      });

      const cardIds = cardEffectArgs.findCardService
        .findCards({
          all: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: thisCost.treasure - 1 } },
          ],
        })
        .filter(card => card.type.includes('ACTION') && !card.type.some(t => ['DURATION', 'COMMAND'].includes(t)));

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play card`,
        restrict: cardIds.map(card => card.id),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.debug(`[band of misfits effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[band of misfits effect] playing card ${selectedCard}`);

      await cardEffectArgs.actionService.run('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        overrides: {
          actionCost: 0,
          moveCard: false,
        },
      });
    },
  },
  'bandit-camp': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[bandit camp effect] drawing 1 card and gaining 2 actions`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      const spoilsCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'nonSupplyCards' }, { kingdom: 'spoils' }],
      });

      if (!spoilsCards.length) {
        loggerService.debug(`[bandit camp effect] no spoils cards in non-supply`);
        return;
      }

      loggerService.debug(`[bandit camp effect] gaining ${spoilsCards.slice(-1)[0]}`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: spoilsCards.slice(-1)[0].id,
        to: { location: 'playerDiscard' },
      });
    },
  },
  beggar: {
    registerLifeCycleMethods: () => ({
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`beggar:${eventArgs.cardId}:cardPlayed`);
      },
      onEnterHand: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        args.reactionManager.registerReactionTemplate({
          id: `beggar:${eventArgs.cardId}:cardPlayed`,
          playerId: eventArgs.playerId,
          listeningFor: 'cardPlayed',
          once: false,
          allowMultipleInstances: true,
          compulsory: false,
          condition: conditionArgs => {
            if (conditionArgs.trigger.args.playerId === eventArgs.playerId) return false;
            const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (!card.type.includes('ATTACK')) return false;
            return true;
          },
          triggeredEffectFn: async triggeredArgs => {
            const thisCard = triggeredArgs.cardLibrary.getCard(eventArgs.cardId);

            loggerService.debug(`[beggar triggered effect] discarding ${thisCard}`);
            await triggeredArgs.actionService.run('discardCard', {
              cardId: thisCard.id,
              playerId: eventArgs.playerId,
            });

            const silverCards = triggeredArgs.findCardService.findCards({
              all: [{ location: 'basicSupply' }, { cardKeys: 'silver' }],
            });

            const numToGain = Math.min(2, silverCards.length);

            if (numToGain < 1) {
              loggerService.debug(`[beggar triggered effect] not enough silver in supply`);
              return;
            }

            loggerService.debug(
              `[beggar triggered effect] number of silvers to gain ${numToGain}, one of them to deck`,
            );

            for (let i = 0; i < numToGain; i++) {
              await triggeredArgs.actionService.run('gainCard', {
                playerId: eventArgs.playerId,
                cardId: silverCards.slice(-i - 1)[0],
                to: { location: i === 0 ? 'playerDeck' : 'playerDiscard' },
              });
            }
          },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const copperCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'basicSupply' }, { cardKeys: 'copper' }],
      });

      const numToGain = Math.min(3, copperCards.length);

      loggerService.debug(`[beggar effect] gaining ${numToGain} coppers`);

      for (let i = 0; i < numToGain; i++) {
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: copperCards.slice(-i - 1)[0],
          to: { location: 'playerHand' },
        });
      }
    },
  },
  catacombs: {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        const { cost } = args.cardPriceController.applyRules(card, { playerId: eventArgs.playerId });
        const cheaperCards = args.findCardService.findCards({
          all: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { kind: 'upTo', playerId: eventArgs.playerId, amount: { treasure: cost.treasure - 1 } },
          ],
        });

        if (!cheaperCards.length) {
          loggerService.debug(`[catacombs onTrashed effect] no cards costing less than ${cost.treasure - 1}`);
          return;
        }

        const selectedCardId = await args.actionService.run('selectSingleCard', {
          playerId: eventArgs.playerId,
          prompt: `Gain card`,
          restrict: cheaperCards.map(card => card.id),
          count: 1,
        });

        if (!selectedCardId) {
          loggerService.warn(`[catacombs onTrashed effect] no card selected`);
          return;
        }

        const selectedCard = args.cardLibrary.getCard(selectedCardId);

        loggerService.debug(`[catacombs onTrashed effect] gaining card ${selectedCard}`);

        await args.actionService.run('gainCard', {
          cardId: selectedCard.id,
          playerId: eventArgs.playerId,
          to: { location: 'playerDiscard' },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);

      let numToLookAt = 3;

      if (deck.length < 3) {
        await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });

        numToLookAt = Math.min(3, deck.length);
      }

      if (numToLookAt < 1) {
        loggerService.debug(`[catacombs effect] no cards in deck`);
        return;
      }

      const cardsToLookAt = deck.slice(-numToLookAt);

      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Choose one',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'PUT IN HAND', action: 1 },
          { label: 'DISCARD AND DRAW', action: 2 },
        ],
        content: {
          type: 'display-cards',
          cardIds: cardsToLookAt,
        },
      })) as { action: number; result: number[] };

      if (result.action === 1) {
        loggerService.debug(`[catacombs effect] moving ${cardsToLookAt.length} cards to hand`);
        for (let i = 0; i < cardsToLookAt.length; i++) {
          await cardEffectArgs.actionService.run('moveCard', {
            cardId: cardsToLookAt[i],
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' },
          });
        }
      } else {
        loggerService.debug(`[catacombs effect] discarding ${cardsToLookAt.length} cards`);
        for (let i = 0; i < cardsToLookAt.length; i++) {
          await cardEffectArgs.actionService.run('discardCard', {
            cardId: cardsToLookAt[i],
            playerId: cardEffectArgs.playerId,
          });
        }

        loggerService.debug(`[catacombs effect] drawing 3 cards`);
        await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 3 });
      }
    },
  },
  count: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      let result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Choose one',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'DISCARD 2 CARDS', action: 1 },
          { label: 'TOP-DECK CARD', action: 2 },
          { label: 'GAIN 1 COPPER', action: 3 },
        ],
      })) as { action: number; result: number[] };

      switch (result.action) {
        case 1: {
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Discard Cards`,
            restrict: hand,
            count: Math.min(2, hand.length),
          });

          if (!selectedCardIds.length) {
            loggerService.warn(`[count effect] no card selected`);
            break;
          }

          for (let i = 0; i < selectedCardIds.length; i++) {
            const id = selectedCardIds[i];

            await cardEffectArgs.actionService.run('discardCard', {
              cardId: id,
              playerId: cardEffectArgs.playerId,
            });
          }
          break;
        }
        case 2: {
          const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Top-deck card`,
            restrict: { location: 'playerHand', playerId: cardEffectArgs.playerId },
            count: 1,
          });

          if (!selectedCardId) {
            loggerService.warn(`[count effect] no card selected`);
            break;
          }

          const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

          loggerService.debug(`[count effect] moving ${selectedCard} to deck`);

          await cardEffectArgs.actionService.run('moveCard', {
            cardId: selectedCard.id,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck' },
          });
          break;
        }
        case 3: {
          loggerService.debug(`[count effect] gaining 1 copper`);
          const gainedCopperId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: cardEffectArgs.playerId,
            pileKey: 'copper',
            from: 'basicSupply',
            to: { location: 'playerDiscard' },
            logTag: 'count effect',
            // supplyGainService's own actionService bypasses the effect's auto-injected source.
            source: cardEffectArgs.cardId,
          });
          if (!gainedCopperId) {
            loggerService.debug(`[count effect] no coppers in supply`);
          }
          break;
        }
      }

      result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Choose one',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: '+3 TREASURE', action: 1 },
          { label: 'TRASH HAND', action: 2 },
          { label: 'GAIN DUCHY', action: 3 },
        ],
      })) as { action: number; result: number[] };

      switch (result.action) {
        case 1: {
          loggerService.debug(`[count effect] gaining 3 treasure`);
          await cardEffectArgs.actionService.run('gainTreasure', { count: 3 });
          break;
        }
        case 2: {
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

          loggerService.debug(`[count effect] trashing ${hand.length} cards`);

          for (const cardId of [...hand]) {
            await cardEffectArgs.actionService.run('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId,
            });
          }
          break;
        }
        case 3: {
          loggerService.debug(`[count effect] gaining 1 duchy`);
          const gainedDuchyId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: cardEffectArgs.playerId,
            pileKey: 'duchy',
            from: 'basicSupply',
            to: { location: 'playerDiscard' },
            logTag: 'count effect',
            // supplyGainService's own actionService bypasses the effect's auto-injected source.
            source: cardEffectArgs.cardId,
          });
          if (!gainedDuchyId) {
            loggerService.debug(`[count effect] no duchies in supply`);
          }
          break;
        }
      }
    },
  },
  counterfeit: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[counterfeit effect] gaining 1 treasure, and 1 buy`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const nonDurationTreasureCards = cardEffectArgs.findCardService
        .findCards({ all: [{ location: 'playerHand', playerId: cardEffectArgs.playerId }, { cardType: 'TREASURE' }] })
        .filter(card => !card.type.includes('DURATION'));

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play treasure`,
        restrict: nonDurationTreasureCards.map(card => card.id),
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug(`[counterfeit effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[counterfeit effect] playing card ${selectedCard} twice`);

      for (let i = 0; i < 2; i++) {
        await cardEffectArgs.actionService.run('playCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          overrides: {
            actionCost: 0,
          },
        });
      }

      loggerService.debug(`[counterfeit effect] trashing ${selectedCard}`);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        expectedFrom: { location: 'playArea', playerId: cardEffectArgs.playerId },
      });
    },
  },
  cultist: {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        loggerService.debug(`[cultist onTrashed effect] drawing 3 cards`);
        await args.actionService.run('drawCard', { playerId: eventArgs.playerId, count: 3 });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[cultist effect] drawing 2 cards`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        loggerService.debug(`[cultist effect] player ${targetPlayerId} gaining a ruins card`);

        const gainedRuinsId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: targetPlayerId,
          pileKey: 'ruins',
          from: 'kingdomSupply',
          to: { location: 'playerDiscard' },
          logTag: 'cultist effect',
          // supplyGainService's own actionService bypasses the effect's auto-injected source.
          source: cardEffectArgs.cardId,
        });

        if (!gainedRuinsId) {
          loggerService.debug(`[cultist effect] no ruins cards in non-supply`);
          break;
        }
      }

      const cultistsInHand = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'playerHand', playerId: cardEffectArgs.playerId }, { cardKeys: 'cultist' }],
      });

      if (!cultistsInHand.length) {
        loggerService.debug(`[cultist effect] no cultists in hand`);
        return;
      }

      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Play Cultist?',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'CANCEL', action: 1 },
          { label: 'PLAY', action: 2 },
        ],
      })) as { action: number; result: number[] };

      if (result.action === 1) {
        loggerService.debug(`[cultist effect] cancelling play of cultist`);
        return;
      }

      loggerService.debug(`[cultist effect] playing cultist`);

      await cardEffectArgs.actionService.run('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cultistsInHand.slice(-1)[0].id,
        overrides: {
          actionCost: 0,
        },
      });
    },
  },
  'dame-anna': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash cards`,
        restrict: hand,
        count: { kind: 'upTo', count: 2 },
        optional: true,
      });

      if (!selectedCardIds.length) {
        loggerService.debug(`[dame-anna effect] no card selected`);
      }

      loggerService.debug(`[dame-anna effect] trashing ${selectedCardIds.length} cards`);

      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
        });
      }

      await resolveKnightAttack(cardEffectArgs, { logTag: 'dame-anna effect' });
    },
  },
  'dame-josephine': {
    registerEffects: () => async cardEffectArgs => {
      // Dame Josephine has no unique + bonus — just the shared Knight attack.
      await resolveKnightAttack(cardEffectArgs, { logTag: 'dame-josephine effect' });
    },
  },
  'dame-molly': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[dame-molly effect] gaining 2 actions`);
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      await resolveKnightAttack(cardEffectArgs, { logTag: 'dame-molly effect' });
    },
  },
  'dame-natalie': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const cards = cardEffectArgs.findCardService.findCards({
        all: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: 3 } },
        ],
      });

      if (!cards.length) {
        loggerService.debug(`[dame-natalie effect] no cards in supply`);
      } else {
        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cards.map(card => card.id),
          count: 1,
          optional: true,
        });

        if (!selectedCardId) {
          loggerService.debug(`[dame-natalie effect] no card selected`);
        } else {
          const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

          loggerService.debug(`[dame-natalie effect] gaining ${selectedCard}`);

          await cardEffectArgs.actionService.run('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCard.id,
            to: { location: 'playerDiscard' },
          });
        }
      }

      await resolveKnightAttack(cardEffectArgs, { logTag: 'dame-natalie effect' });
    },
  },
  'dame-sylvia': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[dame-sylvia effect] gaining 2 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      await resolveKnightAttack(cardEffectArgs, { logTag: 'dame-sylvia effect' });
    },
  },
  'death-cart': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const ruinCards = args.findCardService.findCards({
          all: [{ location: 'kingdomSupply' }, { kingdom: 'ruins' }],
        });

        const numToGain = Math.min(2, ruinCards.length);

        loggerService.debug(`[death cart onGained effect] gaining ${numToGain} ruins`);

        for (let i = 0; i < numToGain; i++) {
          await args.actionService.run('gainCard', {
            playerId: eventArgs.playerId,
            cardId: ruinCards.slice(-i - 1)[0],
            to: { location: 'playerDiscard' },
          });
        }
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const actionCardsInHand = hand
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.type.includes('ACTION'));

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card?`,
        restrict: [...actionCardsInHand.map(card => card.id), cardEffectArgs.cardId],
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug(`[death cart effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[death cart effect] trashing card ${selectedCard}`);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
      });

      loggerService.debug(`[death cart effect] gaining 5 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 5 });
    },
  },
  feodum: {
    registerScoringFunction: () => args => {
      const ownedSilvers = args.findCardService.findCards({ all: [{ owner: args.ownerId }, { cardKeys: 'silver' }] });

      const amount = Math.floor(ownedSilvers.length / 3);
      return amount;
    },
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArg) => {
        const loggerService = args.loggerService;
        const silverCards = args.findCardService.findCards({
          all: [{ location: 'basicSupply' }, { cardKeys: 'silver' }],
        });

        const numToGain = Math.min(3, silverCards.length);

        loggerService.debug(`[feodum onTrashed effect] gaining ${numToGain} silvers`);

        for (let i = 0; i < numToGain; i++) {
          await args.actionService.run('gainCard', {
            playerId: eventArg.playerId,
            cardId: silverCards.slice(-i - 1)[0],
            to: { location: 'playerDiscard' },
          });
        }
      },
    }),
  },
  forager: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[forager effect] gaining 1 action, and 1 buy`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: hand,
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.debug(`[forager effect] no card selected, skipping trash`);
      } else {
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

        loggerService.debug(`[forager effect] trashing card ${selectedCard}`);

        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
        });
      }

      const trash = cardEffectArgs.cardSourceController.getSource('trash');
      const uniqueTreasuresInTrash = new Set(
        trash
          .map(cardEffectArgs.cardLibrary.getCard)
          .filter(card => card.type.includes('TREASURE'))
          .map(card => card.cardKey),
      ).size;

      loggerService.debug(`[forager effect] gaining ${uniqueTreasuresInTrash} treasure`);

      if (uniqueTreasuresInTrash > 0) {
        await cardEffectArgs.actionService.run('gainTreasure', { count: uniqueTreasuresInTrash });
      }
    },
  },
  fortress: {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        loggerService.debug(`[fortress onTrashed effect] putting fortress back in hand`);

        // Lose Track guard: cardTrashed reactions run before onTrashed, so a
        // reaction may have already moved Fortress out of the trash. No
        // playerId (shared zone) and no requireTop (covering does not apply
        // to the trash).
        await args.actionService.run('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: { location: 'playerHand' },
          updateOwner: true,
          expectedFrom: { location: 'trash' },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[fortress effect] drawing 1 card, and gaining 2 actions`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });
    },
  },
  graverobber: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Choose one',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'GAIN CARD', action: 1 },
          { label: 'TRASH CARD', action: 2 },
        ],
      })) as { action: number; result: number[] };

      if (result.action === 1) {
        const trashCards = cardEffectArgs.findCardService.findCards({ all: [{ location: 'trash' }] }).filter(card => {
          const cost = cardEffectArgs.cardPriceController.applyRules(card, { playerId: cardEffectArgs.playerId });
          return cost.cost.treasure >= 3 && cost.cost.treasure <= 6 && !cost.cost.potion && !cost.cost.debt;
        });

        if (!trashCards.length) {
          loggerService.debug(`[graverobber effect] no cards in trash`);
          return;
        }

        const result = (await cardEffectArgs.actionService.run('userPrompt', {
          prompt: 'Gain card',
          playerId: cardEffectArgs.playerId,
          content: {
            type: 'select',
            cardIds: trashCards.map(card => card.id),
            selectCount: 1,
          },
        })) as { action: number; cardIds: number[] };

        if (!result.cardIds) {
          loggerService.warn(`[graverobber effect] no card selected`);
          return;
        }

        const card = cardEffectArgs.cardLibrary.getCard(result.cardIds[0]);

        loggerService.debug(`[graverobber effect] gaining card ${card}`);

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: card.id,
          to: { location: 'playerDeck' },
        });
      } else {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const actionsInHand = hand.map(cardEffectArgs.cardLibrary.getCard).filter(card => card.type.includes('ACTION'));

        if (!actionsInHand.length) {
          loggerService.debug(`[graverobber effect] no actions in hand`);
          return;
        }

        let selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash action`,
          restrict: actionsInHand.map(card => card.id),
          count: 1,
        });

        if (!selectedCardId) {
          loggerService.warn(`[graverobber effect] no card selected`);
          return;
        }

        let selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

        loggerService.debug(`[graverobber effect] trashing card ${selectedCard}`);

        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
        });

        const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
          playerId: cardEffectArgs.playerId,
        });

        const cards = cardEffectArgs.findCardService.findCards({
          all: [
            { location: ['kingdomSupply', 'basicSupply'] },
            {
              kind: 'upTo',
              playerId: cardEffectArgs.playerId,
              amount: { treasure: cost.treasure + 3, potion: cost.potion },
            },
          ],
        });

        if (!cards) {
          loggerService.debug(`[graverobber effect] no cards in supply that cost <= ${cost.treasure + 3}`);
          return;
        }

        selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cards.map(card => card.id),
          count: 1,
        });

        if (!selectedCardId) {
          loggerService.warn(`[graverobber effect] no card selected`);
          return;
        }

        selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

        loggerService.debug(`[graverobber effect] gaining ${selectedCard}`);

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  hermit: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
      let nonTreasureCards = discard
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => !card.type.includes('TREASURE'));

      let selectedCard: Card | undefined = undefined;

      if (discard.length > 0) {
        const result = (await cardEffectArgs.actionService.run('userPrompt', {
          prompt: 'Trash from discard?',
          playerId: cardEffectArgs.playerId,
          content: {
            type: 'select',
            cardIds: discard,
            selectableCardIds: nonTreasureCards.map(card => card.id),
            selectCount: 1,
          },
          actionButtons: [{ label: 'GO TO HAND', action: 1 }],
        })) as { action: number; result: number[] };

        if (result.action === 1) {
          loggerService.warn(`[hermit effect] no card selected from discard`);
        } else if (result.result.length > 0) {
          selectedCard = cardEffectArgs.cardLibrary.getCard(result.result[0]);
          loggerService.debug(`[hermit effect] selected ${selectedCard} from discard`);
        }
      } else {
        loggerService.debug(`[hermit effect] no cards in discard`);
      }

      if (!selectedCard) {
        loggerService.debug(`[hermit effect] selecting card from hand`);

        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        nonTreasureCards = hand.map(cardEffectArgs.cardLibrary.getCard).filter(card => !card.type.includes('TREASURE'));

        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card`,
          restrict: nonTreasureCards.map(card => card.id),
          count: 1,
          optional: true,
        });

        if (!selectedCardId) {
          loggerService.debug(`[hermit effect] not trashing from hand`);
        } else {
          selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
        }
      }

      if (!selectedCard) {
        loggerService.debug(`[hermit effect] no card selected to trash`);
      } else {
        loggerService.debug(`[hermit effect] trashing card ${selectedCard}`);

        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
        });
      }

      const cards = cardEffectArgs.findCardService.findCards({
        all: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: 3 } },
        ],
      });

      if (!cards.length) {
        loggerService.debug(`[hermit effect] no cards in supply that cost <= 3`);
      } else {
        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cards.map(card => card.id),
          count: 1,
        });

        if (!selectedCardId) {
          loggerService.warn(`[hermit effect] no card selected`);
        } else {
          const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
          loggerService.debug(`[hermit effect] gaining ${selectedCard}`);

          await cardEffectArgs.actionService.run('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCard.id,
            to: { location: 'playerDiscard' },
          });
        }
      }

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `hermit:${cardEffectArgs.cardId}:endTurnPhase`,
        listeningFor: 'endTurnPhase',
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: conditionArgs => {
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') return false;
          if (getCurrentPlayer(conditionArgs.match).id !== cardEffectArgs.playerId) return false;

          const turnHistoryIndex = conditionArgs.match.stats.turns.length - 1;
          const turnStatsIndex = turnHistoryIndex;

          // The exchange is blocked only by an actual purchase this turn —
          // gaining a card any other way (e.g. another card's on-play gain
          // effect firing during the Buy phase) does not stop it. See the
          // ruling at wiki.dominionstrategy.com/index.php/Hermit: "It does
          // not matter whether or not you gained cards other ways, only
          // whether or not you bought a card."
          const cardIdsBought = conditionArgs.match.stats.cardsBoughtByTurn[turnStatsIndex] ?? [];
          const boughtByThisPlayer = cardIdsBought.some(cardId => {
            const stats = conditionArgs.match.stats.cardsBought[cardId];
            return stats.playerId === cardEffectArgs.playerId;
          });

          if (boughtByThisPlayer) return false;

          return true;
        },
        triggeredEffectFn: async triggeredArgs => {
          const madmanCards = triggeredArgs.findCardService.findCards({
            all: [{ location: 'nonSupplyCards' }, { kingdom: 'madman' }],
          });

          if (!madmanCards.length) {
            loggerService.debug(`[hermit endTurnPhase effect] no madman in supply`);
            return;
          }

          const hermitCard = triggeredArgs.cardLibrary.getCard(cardEffectArgs.cardId);

          loggerService.debug(`[hermit endTurnPhase effect] moving ${hermitCard} to supply`);

          // Lose Track guard: this is an exchange (return Hermit, gain
          // Madman) triggered at end of Buy phase, not tied to Hermit's own
          // play resolution — something else may have moved Hermit out of
          // play in the meantime (e.g. Procession trashing it). If Hermit is
          // no longer in play, the exchange does not happen at all: no
          // return, no Madman.
          const returned = await cardEffectArgs.actionService.run('moveCard', {
            cardId: hermitCard.id,
            to: { location: 'kingdomSupply' },
            expectedFrom: { location: 'playArea' },
          });

          if (!returned) {
            loggerService.debug(`[hermit endTurnPhase effect] lost track of Hermit (not in play); no Madman`);
            return;
          }

          const card = madmanCards.slice(-1)[0];

          loggerService.debug(`[hermit endTurnPhase effect] gaining ${card}`);

          await cardEffectArgs.actionService.run('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: card.id,
            to: { location: 'playerDiscard' },
          });
        },
      });

      // "This turn" scoping: if the buy-phase-end condition never fires (the
      // player gained something in Buy phase), the once:true trigger above
      // would otherwise stay registered forever and could fire on a future
      // turn's empty Buy phase. Force it gone at the true end of this turn
      // regardless of whether it already fired (a harmless no-op unregister
      // if it did).
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `hermit:${cardEffectArgs.cardId}:endTurn`,
        listeningFor: 'endTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        condition: () => true,
        triggeredEffectFn: async triggeredArgs => {
          triggeredArgs.reactionManager.unregisterTrigger(`hermit:${cardEffectArgs.cardId}:endTurnPhase`);
        },
      });
    },
  },
  hovel: {
    registerLifeCycleMethods: () => ({
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`hovel:${eventArgs.cardId}:cardGained`);
      },
      onEnterHand: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        args.reactionManager.registerReactionTemplate({
          id: `hovel:${eventArgs.cardId}:cardGained`,
          playerId: eventArgs.playerId,
          listeningFor: 'cardGained',
          once: true,
          compulsory: false,
          allowMultipleInstances: true,
          condition: conditionArgs => {
            if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) return false;
            const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (!card.type.includes('VICTORY')) return false;
            return true;
          },
          triggeredEffectFn: async triggeredArgs => {
            const hovelCard = triggeredArgs.cardLibrary.getCard(eventArgs.cardId);

            loggerService.debug(`[hovel gainCard effect] trashing ${hovelCard}`);

            await triggeredArgs.actionService.run('trashCard', {
              playerId: eventArgs.playerId,
              cardId: hovelCard.id,
            });
          },
        });
      },
    }),
  },
  'hunting-grounds': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const result = (await args.actionService.run('userPrompt', {
          prompt: 'Choose to gain',
          playerId: eventArgs.playerId,
          actionButtons: [
            { label: '1 Duchy', action: 1 },
            { label: '3 Estates', action: 2 },
          ],
        })) as { action: number; result: number[] };

        const pileKey = result.action === 1 ? 'duchy' : 'estate';
        const cards = args.findCardService.findCards({ all: [{ location: 'basicSupply' }, { cardKeys: pileKey }] });
        const numToGain = result.action === 1 ? Math.min(1, cards.length) : Math.min(3, cards.length);

        if (!numToGain) {
          loggerService.debug(`[hunting-grounds onTrashed effect] no cards to gain`);
        }

        loggerService.debug(`[hunting-grounds onTrashed effect] gaining ${numToGain} ${pileKey}`);

        for (let i = 0; i < numToGain; i++) {
          await args.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: eventArgs.playerId,
            pileKey,
            from: 'basicSupply',
            to: { location: 'playerDiscard' },
            logTag: 'hunting-grounds onTrashed effect',
            // supplyGainService's own actionService bypasses the effect's auto-injected source.
            source: eventArgs.cardId,
          });
        }
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[hunting-grounds effect] drawing 4 cards`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 4 });
    },
  },
  ironmonger: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[ironmonger effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // Reveal the top card of the deck, set aside — shuffling the discard
      // back in automatically if the deck is empty.
      const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 1, { setAside: true });
      const card = revealed[0];

      if (!card) {
        loggerService.debug(`[ironmonger effect] still no cards in deck`);
        return;
      }

      loggerService.debug(`[ironmonger effect] revealing ${card}`);

      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: `Discard ${card.cardName}?`,
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'CANCEL', action: 1 },
          { label: 'DISCARD', action: 2 },
        ],
      })) as { action: number; result: number[] };

      if (result.action === 1) {
        loggerService.debug(`[ironmonger effect] not discarding, moving ${card} back to deck`);

        await cardEffectArgs.actionService.run('moveCard', {
          cardId: card.id,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerDeck' },
        });
      } else {
        loggerService.debug(`[ironmonger effect] discarding ${card}`);
        await cardEffectArgs.actionService.run('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId,
        });
      }

      if (card.type.includes('ACTION')) {
        loggerService.debug(`[ironmonger effect] card is action type, gaining 1 action`);
        await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      }

      if (card.type.includes('TREASURE')) {
        loggerService.debug(`[ironmonger effect] card is treasure type, gaining 1 treasure`);
        await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
      }

      if (card.type.includes('VICTORY')) {
        loggerService.debug(`[ironmonger effect] card is a victory card, gaining 1 victory point`);
        await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      }
    },
  },
  'junk-dealer': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[junk-dealer effect] drawing 1 card, and gaining 1 action and 1 treasure`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.debug(`[junk-dealer effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[junk-dealer effect] trashing card ${selectedCard}`);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
      });
    },
  },
  madman: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      loggerService.debug(`[madman effect] moving ${thisCard} back to non supply`);

      // Lose Track guard: without expectedFrom, moveCard returns truthy
      // whenever the card is found in ANY zone, making the `if (result)`
      // draw gate below inert — a Throne-Room'd Madman would "return" from
      // nonSupplyCards on its second resolution and draw again. Requiring
      // playArea activates the guard: the second resolution finds Madman
      // already moved and skips the draw.
      const result = await cardEffectArgs.actionService.run('moveCard', {
        cardId: thisCard.id,
        to: { location: 'nonSupplyCards' },
        expectedFrom: { location: 'playArea' },
      });

      if (result) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        loggerService.debug(`[madman effect] drawing ${hand.length} cards`);
        await cardEffectArgs.actionService.run('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: hand.length,
        });
      }
    },
  },
  marauder: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const spoilCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'nonSupplyCards' }, { kingdom: 'spoils' }],
      });

      if (!spoilCards.length) {
        loggerService.debug(`[marauder effect] no spoils in supply`);
      } else {
        loggerService.debug(`[marauder effect] gaining ${spoilCards.slice(-1)[0]}`);

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: spoilCards.slice(-1)[0].id,
          to: { location: 'playerDiscard' },
        });
      }

      const ruinCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'kingdomSupply' }, { kingdom: 'ruins' }],
      });

      if (!ruinCards.length) {
        loggerService.debug(`[marauder effect] no ruins in supply`);
        return;
      }

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      if (targetPlayerIds.length > ruinCards.length) {
        targetPlayerIds.length = ruinCards.length;
      }

      loggerService.debug(`[marauder effect] targeting ${targetPlayerIds.length} players to gain ruins`);

      for (const targetPlayerId of targetPlayerIds) {
        await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: targetPlayerId,
          pileKey: 'ruins',
          from: 'kingdomSupply',
          to: { location: 'playerDiscard' },
          logTag: 'marauder effect',
          // supplyGainService's own actionService bypasses the effect's auto-injected source.
          source: cardEffectArgs.cardId,
        });
      }
    },
  },
  'market-square': {
    registerLifeCycleMethods: () => ({
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`market-square:${eventArgs.cardId}:cardTrashed`);
      },
      onEnterHand: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        args.reactionManager.registerReactionTemplate({
          id: `market-square:${eventArgs.cardId}:cardTrashed`,
          listeningFor: 'cardTrashed',
          playerId: eventArgs.playerId,
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          condition: conditionArgs => {
            const trashedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            return trashedCard.owner === eventArgs.playerId;
          },
          triggeredEffectFn: async triggeredArgs => {
            const marketSquareCard = triggeredArgs.cardLibrary.getCard(eventArgs.cardId);
            loggerService.debug(`[market-square cardTrashed effect] discarding ${marketSquareCard}`);
            await triggeredArgs.actionService.run('discardCard', {
              cardId: marketSquareCard.id,
              playerId: eventArgs.playerId,
            });

            loggerService.debug(`[market-square cardTrashed effect] gaining gold`);

            const gainedGoldId = await triggeredArgs.supplyGainService.gainTopSupplyCardForPileKey({
              playerId: eventArgs.playerId,
              pileKey: 'gold',
              from: 'basicSupply',
              to: { location: 'playerDiscard' },
              logTag: 'market-square cardTrashed effect',
              // supplyGainService's own actionService bypasses the effect's auto-injected source.
              source: eventArgs.cardId,
            });

            if (!gainedGoldId) {
              loggerService.debug(`[market-square cardTrashed effect] no gold cards in supply`);
            }
          },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[market-square effect] drawing 1 card, gaining 1 action, and 1 buy`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
    },
  },
  mercenary: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash cards?`,
        restrict: hand,
        // "Trash 2 cards" is an atomic choice, not "up to 2" — with 2+ cards
        // in hand the player must decline or trash exactly 2; only with
        // exactly 1 card in hand is the smaller "trash the 1 available card"
        // choice legal.
        count: hand.length >= 2 ? { kind: 'exact', count: 2 } : { kind: 'upTo', count: 1 },
        optional: true,
      });

      if (!selectedCardIds.length) {
        loggerService.debug(`[mercenary effect] no cards selected`);
        return;
      }

      loggerService.debug(`[mercenary effect] trashing ${selectedCardIds.length} cards`);

      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
        });
      }

      if (selectedCardIds.length === 1) {
        loggerService.debug(`[mercenary effect] only one card trashed`);
        return;
      }

      loggerService.debug(`[mercenary effect] drawing 2 cards, and gaining 2 treasure`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);

        if (hand.length <= 3) {
          loggerService.debug(`[mercenary effect] ${targetPlayerId} has 3 or fewer cards in hand, skipping`);
          continue;
        }

        const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
          playerId: targetPlayerId,
          prompt: `Discard to 3`,
          restrict: hand,
          count: hand.length - 3,
        });

        if (selectedCardIds.length === 0) {
          loggerService.warn(`[mercenary effect] no cards selected`);
          continue;
        }

        loggerService.debug(`[mercenary effect] player ${targetPlayerId} discarding ${selectedCardIds.length} cards`);

        for (const selectedCardId of selectedCardIds) {
          await cardEffectArgs.actionService.run('discardCard', {
            playerId: targetPlayerId,
            cardId: selectedCardId,
          });
        }
      }
    },
  },
  mystic: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[mystic effect] gaining 1 action, and 1 treasure`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Name a card',
        playerId: cardEffectArgs.playerId,
        content: { type: 'name-card' },
      })) as { action: number; result: CardKey };

      const namedCardKey = result.result;

      // Reveal the top card of the deck, shuffling the discard in
      // automatically if the deck is empty.
      const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 1);
      const revealedCard = revealed[0];

      if (!revealedCard) {
        loggerService.debug(`[mystic effect] still no cards in deck`);
        return;
      }

      loggerService.debug(`[mystic effect] revealing ${revealedCard}`);

      if (revealedCard.cardKey === namedCardKey) {
        loggerService.debug(`[mystic effect] moving revealed card to hand`);

        await cardEffectArgs.actionService.run('moveCard', {
          cardId: revealedCard.id,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerHand' },
        });
      } else {
        loggerService.debug(`[mystic effect] not moving card to hand`);
      }
    },
  },
  necropolis: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[necropolis effect] gaining 2 actions`);
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });
    },
  },
  'overgrown-estate': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        if (card.owner !== eventArgs.playerId) return;

        loggerService.debug(`[overgrown-estate onTrashed effect] drawing 1 card`);

        await args.actionService.run('drawCard', { playerId: eventArgs.playerId });
      },
    }),
  },
  pillage: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[pillage effect] trashing pillage`);

      const trashed = await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
        expectedFrom: { location: 'playArea', playerId: cardEffectArgs.playerId },
      });

      if (!trashed) {
        loggerService.debug(`[pillage effect] trash failed (lose track), skipping Spoils gain and attack`);
        return;
      }

      const spoilsCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'nonSupplyCards' }, { kingdom: 'spoils' }],
      });

      if (!spoilsCards.length) {
        loggerService.debug(`[pillage effect] no spoils in supply`);
        return;
      }

      const numToGain = Math.min(2, spoilsCards.length);

      loggerService.debug(`[pillage effect] gaining ${numToGain} spoils`);

      for (let i = 0; i < numToGain; i++) {
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: spoilsCards.slice(-i - 1)[0].id,
          to: { location: 'playerDiscard' },
        });
      }

      const targetPlayerIds = getAttackTargets(
        cardEffectArgs.match,
        cardEffectArgs.playerId,
        cardEffectArgs.reactionContext,
      ).filter(playerId => cardEffectArgs.cardSourceController.getSource('playerHand', playerId).length >= 5);

      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);

        loggerService.debug(`[pillage effect] revealing player ${targetPlayerId} hand`);
        for (const cardId of [...hand]) {
          await cardEffectArgs.actionService.run('revealCard', {
            cardId,
            playerId: targetPlayerId,
          });
        }

        const result = (await cardEffectArgs.actionService.run('userPrompt', {
          prompt: `Discard card for ${getPlayerById(cardEffectArgs.match, targetPlayerId)?.name}`,
          playerId: cardEffectArgs.playerId,
          content: {
            type: 'select',
            cardIds: hand,
            selectCount: 1,
          },
        })) as { action: number; result: number[] };

        if (!result.result.length) {
          loggerService.warn(`[pillage effect] no card selected`);
          continue;
        }

        const selectedCard = cardEffectArgs.cardLibrary.getCard(result.result[0]);

        loggerService.debug(`[pillage effect] player ${targetPlayerId} discarding ${selectedCard}`);

        await cardEffectArgs.actionService.run('discardCard', {
          cardId: selectedCard.id,
          playerId: targetPlayerId,
        });
      }
    },
  },
  'poor-house': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[poor-house effect] gaining 4 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 4 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      loggerService.debug(`[poor-house effect] revealing player ${cardEffectArgs.playerId} hand`);

      for (const cardId of [...hand]) {
        await cardEffectArgs.actionService.run('revealCard', {
          cardId,
          playerId: cardEffectArgs.playerId,
        });
      }

      const treasureCardsInHand = hand
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.type.includes('TREASURE'));

      // "-$1 per Treasure card in your hand. (You can't go below $0.)" —
      // an adjustment, not a pay: set the pool to the floored target so the
      // clamp lives here, where the rules text says it.
      const target = Math.max(0, cardEffectArgs.match.playerTreasure - treasureCardsInHand.length);
      loggerService.debug(
        `[poor-house effect] ${treasureCardsInHand.length} treasure(s) in hand; setting treasure to ${target}`,
      );
      await cardEffectArgs.actionService.run('setTreasure', { count: target });
    },
  },
  procession: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const nonDurationActionCardsInHand = cardEffectArgs.findCardService
        .findCards({ all: [{ location: 'playerHand', playerId: cardEffectArgs.playerId }] })
        .filter(card => !card.type.includes('DURATION') && card.type.includes('ACTION'));

      if (!nonDurationActionCardsInHand.length) {
        loggerService.debug(`[procession effect] no non-duration action cards in hand`);
        return;
      }

      let selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play card`,
        restrict: nonDurationActionCardsInHand.map(card => card.id),
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug(`[procession effect] no card selected`);
        return;
      }

      let selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[procession effect] playing card ${selectedCard} twice`);

      for (let i = 0; i < 2; i++) {
        await cardEffectArgs.actionService.run('playCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
        });
      }

      loggerService.debug(`[procession effect] trashing ${selectedCard}`);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        expectedFrom: { location: 'playArea', playerId: cardEffectArgs.playerId },
      });

      const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
        playerId: cardEffectArgs.playerId,
      });

      const cards = cardEffectArgs.findCardService.findCards({
        all: [
          { location: 'kingdomSupply' },
          { cardType: 'ACTION' },
          {
            kind: 'exact',
            playerId: cardEffectArgs.playerId,
            amount: { treasure: cost.treasure + 1, potion: cost.potion },
          },
        ],
      });

      selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: cards.map(card => card.id),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[procession effect] no card selected`);
        return;
      }

      selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[procession effect] gaining card ${selectedCard}`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDiscard' },
      });
    },
  },
  rats: {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const trashedCard = args.cardLibrary.getCard(eventArgs.cardId);
        if (eventArgs.playerId !== trashedCard.owner) {
          return;
        }

        loggerService.debug(`[rats onTrashed effect] drawing 1 card`);
        await args.actionService.run('drawCard', { playerId: eventArgs.playerId });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[rats effect] drawing 1 card, gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      loggerService.debug(`[rats effect] gaining a rats card`);

      const gainedRatId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'rats',
        from: 'kingdomSupply',
        to: { location: 'playerDiscard' },
        logTag: 'rats effect',
        // supplyGainService's own actionService bypasses the effect's auto-injected source.
        source: cardEffectArgs.cardId,
      });

      if (!gainedRatId) {
        loggerService.debug(`[rats effect] no rats in supply to gain, still trashing a card from hand`);
      }

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      const nonRatCardsInHand = hand.map(cardEffectArgs.cardLibrary.getCard).filter(card => card.cardKey !== 'rats');

      if (!nonRatCardsInHand.length) {
        loggerService.debug(`[rats effect] no non-rat cards in hand to trash, revealing`);

        for (const cardId of [...hand]) {
          await cardEffectArgs.actionService.run('revealCard', {
            cardId,
            playerId: cardEffectArgs.playerId,
          });
        }

        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash card',
        restrict: nonRatCardsInHand.map(card => card.id),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[rats effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[rats effect] trashing card ${selectedCard}`);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
      });
    },
  },
  rebuild: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[rebuild effect] gaining 1 action`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Name a card',
        playerId: cardEffectArgs.playerId,
        content: { type: 'name-card' },
      })) as { action: number; result: CardKey };

      let cardFound: Card | undefined = undefined;
      const cardsToDiscard: Card[] = [];

      // Reveal cards one at a time, set aside, until a non-named Victory
      // card is found or the player runs out of cards; revealTopDeckCards
      // shuffles the discard in automatically whenever the deck runs dry
      // mid-reveal.
      while (true) {
        const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 1, { setAside: true });
        const card = revealed[0];

        if (!card) {
          loggerService.debug(`[rebuild effect] still no cards in deck`);
          break;
        }

        loggerService.debug(`[rebuild effect] revealing ${card}`);

        if (card.type.includes('VICTORY') && card.cardKey !== result.result) {
          cardFound = card;
          break;
        } else {
          cardsToDiscard.push(card);
        }
      }

      loggerService.debug(`[rebuild effect] discarding ${cardsToDiscard.length} cards`);

      for (const card of cardsToDiscard) {
        await cardEffectArgs.actionService.run('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId,
        });
      }

      if (cardFound) {
        loggerService.debug(`[rebuild effect] trashing ${cardFound}`);

        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: cardFound.id,
        });

        const { cost } = cardEffectArgs.cardPriceController.applyRules(cardFound, {
          playerId: cardEffectArgs.playerId,
        });

        const cards = cardEffectArgs.findCardService.findCards({
          all: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { cardType: 'VICTORY' },
            {
              kind: 'upTo',
              playerId: cardEffectArgs.playerId,
              amount: { treasure: cost.treasure + 3, potion: cost.potion },
            },
          ],
        });

        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cards.map(card => card.id),
          count: 1,
        });

        if (!selectedCardId) {
          loggerService.warn(`[rebuild effect] no card selected`);
          return;
        }

        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

        loggerService.debug(`[rebuild effect] gaining card ${selectedCard}`);

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  rogue: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[rogue effect] gaining 2 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const cards = cardEffectArgs.findCardService.findCards({ location: 'trash' }).filter(card => {
        const { cost } = cardEffectArgs.cardPriceController.applyRules(card, { playerId: cardEffectArgs.playerId });
        return cost.treasure >= 3 && cost.treasure <= 6 && !cost.potion;
      });

      if (cards.length) {
        loggerService.debug(`[rogue effect] there are cards in trash costing 3 to 6`);

        const result = (await cardEffectArgs.actionService.run('userPrompt', {
          prompt: 'Gain card',
          playerId: cardEffectArgs.playerId,
          content: {
            type: 'select',
            cardIds: cards.map(card => card.id),
            selectCount: 1,
          },
        })) as { action: number; result: number[] };

        if (!result.result.length) {
          loggerService.warn(`[rogue effect] no card selected`);
          return;
        }

        const selectedCard = cardEffectArgs.cardLibrary.getCard(result.result[0]);

        loggerService.debug(`[rogue effect] gaining card ${selectedCard}`);

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: { location: 'playerDiscard' },
        });
      } else {
        loggerService.debug(`[rogue effect] no cards in trash costing 3 to 6`);

        // Rogue shares the Knights' reveal/trash/discard attack, but (per its
        // card text) has no "trash this" self-destruct clause — resolveKnightAttack
        // only self-trashes when the attacking card is itself a Knight.
        await resolveKnightAttack(cardEffectArgs, { logTag: 'rogue effect' });
      }
    },
  },
  sage: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[sage effect] gaining 1 action`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const cardsToDiscard: Card[] = [];

      // Reveal cards one at a time, set aside, until one costing $3 or more
      // is found or the player runs out of cards; revealTopDeckCards
      // shuffles the discard in automatically whenever the deck runs dry
      // mid-reveal.
      while (true) {
        const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 1, { setAside: true });
        const card = revealed[0];
        if (!card) {
          break;
        }

        loggerService.debug(`[sage effect] revealing ${card}`);

        const { cost } = cardEffectArgs.cardPriceController.applyRules(card, { playerId: cardEffectArgs.playerId });
        if (cost.treasure >= 3) {
          loggerService.debug(`[sage effect] ${card} costs at least 3 treasure, putting in hand`);

          await cardEffectArgs.actionService.run('moveCard', {
            cardId: card.id,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' },
          });

          break;
        } else {
          cardsToDiscard.push(card);
        }
      }

      loggerService.debug(`[sage effect] discarding ${cardsToDiscard.length} cards`);

      for (const card of cardsToDiscard) {
        await cardEffectArgs.actionService.run('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId,
        });
      }
    },
  },
  scavenger: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[scavenger effect] gaining 2 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      let result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Put deck onto discard?',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'CANCEL', action: 1 },
          { label: 'CONFIRM', action: 2 },
        ],
      })) as { action: number; result: number[] };

      if (result.action === 2) {
        loggerService.debug(`[scavenger effect] putting deck onto discard`);

        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);

        for (const cardId of [...deck]) {
          await cardEffectArgs.actionService.run('moveCard', {
            cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDiscard' },
          });
        }
      }

      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);

      if (discard.length) {
        result = (await cardEffectArgs.actionService.run('userPrompt', {
          prompt: 'Put card on top of deck',
          playerId: cardEffectArgs.playerId,
          content: {
            type: 'select',
            cardIds: discard,
            selectCount: 1,
          },
        })) as { action: number; result: number[] };

        if (!result.result.length) {
          loggerService.warn(`[scavenger effect] no card selected`);
          return;
        }

        const selectedCard = cardEffectArgs.cardLibrary.getCard(result.result[0]);

        loggerService.debug(`[scavenger effect] putting ${selectedCard} on top of deck`);

        await cardEffectArgs.actionService.run('moveCard', {
          cardId: selectedCard.id,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerDeck' },
        });
      } else {
        loggerService.debug(`[scavenger effect] no cards in discard`);
      }
    },
  },
  'sir-bailey': {
    registerEffects: () => async cardEffectArgs => {
      // +1 Card, +1 Action.
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      await resolveKnightAttack(cardEffectArgs, { logTag: 'sir-bailey effect' });
    },
  },
  'sir-destry': {
    registerEffects: () => async cardEffectArgs => {
      // +2 Cards.
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });

      await resolveKnightAttack(cardEffectArgs, { logTag: 'sir-destry effect' });
    },
  },
  'sir-martin': {
    registerEffects: () => async cardEffectArgs => {
      // +2 Buys.
      await cardEffectArgs.actionService.run('gainBuy', { count: 2 });

      await resolveKnightAttack(cardEffectArgs, { logTag: 'sir-martin effect' });
    },
  },
  'sir-michael': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      // Sir Michael's unique clause: each other player discards down to 3
      // cards in hand BEFORE the shared reveal/trash/discard attack runs.
      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);

        let numToDiscard = 0;

        if (hand.length > 3) {
          numToDiscard = hand.length - 3;
        }

        loggerService.debug(`[sir-michael effect] player ${targetPlayerId} discarding ${numToDiscard} cards`);

        const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
          playerId: targetPlayerId,
          prompt: `Discard to 3`,
          restrict: hand,
          count: numToDiscard,
        });

        if (!selectedCardIds.length) {
          loggerService.warn(`[sir-michael effect] no cards selected`);
          continue;
        }

        loggerService.debug(`[sir-michael effect] player ${targetPlayerId} discarding ${selectedCardIds.length} cards`);

        for (const selectedCardId of selectedCardIds) {
          await cardEffectArgs.actionService.run('discardCard', {
            playerId: targetPlayerId,
            cardId: selectedCardId,
          });
        }
      }

      await resolveKnightAttack(cardEffectArgs, { logTag: 'sir-michael effect' });
    },
  },
  'sir-vander': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        if (card.owner !== eventArgs.playerId) {
          return;
        }

        loggerService.debug(`[sir-vander onTrashed effect] gaining gold`);

        const gainedGoldId = await args.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: eventArgs.playerId,
          pileKey: 'gold',
          from: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'sir-vander onTrashed effect',
          // supplyGainService's own actionService bypasses the effect's auto-injected source.
          source: eventArgs.cardId,
        });

        if (!gainedGoldId) {
          loggerService.debug(`[sir-vander onTrashed effect] no gold cards in supply to gain`);
        }
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      // Sir Vander has no unique + bonus — just the shared Knight attack
      // (its onTrashed lifecycle hook above handles gaining a Gold).
      await resolveKnightAttack(cardEffectArgs, { logTag: 'sir-vander effect' });
    },
  },
  squire: {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        if (eventArgs.playerId != card.owner) {
          return;
        }

        const attackCards = args.findCardService.findCards({
          all: [{ location: 'kingdomSupply' }, { cardType: 'ATTACK' }],
        });

        if (!attackCards.length) {
          loggerService.debug(`[squire onTrashed effect] no attack cards in supply`);
          return;
        }

        const selectedCardId = await args.actionService.run('selectSingleCard', {
          playerId: eventArgs.playerId,
          prompt: `Gain card`,
          restrict: attackCards.map(card => card.id),
          count: 1,
        });

        if (!selectedCardId) {
          loggerService.warn(`[squire onTrashed effect] no card selected`);
          return;
        }

        const selectedCard = args.cardLibrary.getCard(selectedCardId);

        loggerService.debug(`[squire onTrashed effect] gaining ${selectedCard}`);

        await args.actionService.run('gainCard', {
          playerId: eventArgs.playerId,
          cardId: selectedCard.id,
          to: { location: 'playerDiscard' },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[squire effect] gaining 1 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Choose one',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: '+2 ACTIONS', action: 1 },
          { label: '+2 BUYS', action: 2 },
          { label: 'GAIN 1 SILVER', action: 3 },
        ],
      })) as { action: number; result: number[] };

      if (result.action === 1) {
        loggerService.debug(`[squire effect] gaining 2 actions`);
        await cardEffectArgs.actionService.run('gainAction', { count: 2 });
      } else if (result.action === 2) {
        loggerService.debug(`[squire effect] gaining 2 buys`);
        await cardEffectArgs.actionService.run('gainBuy', { count: 2 });
      } else {
        loggerService.debug(`[squire effect] gaining 1 silver`);

        const gainedSilverId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: cardEffectArgs.playerId,
          pileKey: 'silver',
          from: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'squire effect',
          // supplyGainService's own actionService bypasses the effect's auto-injected source.
          source: cardEffectArgs.cardId,
        });

        if (!gainedSilverId) {
          loggerService.debug(`[squire effect] no silver cards in supply`);
        }
      }
    },
  },
  storeroom: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[storeroom effect] gaining 1 buy`);
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      if (!hand.length) {
        loggerService.debug(`[storeroom effect] no cards in hand`);
        return;
      }

      let selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard card/s`,
        restrict: hand,
        count: {
          kind: 'upTo',
          count: hand.length,
        },
      });

      if (!selectedCardIds.length) {
        loggerService.debug(`[storeroom effect] no card/s selected`);
        return;
      }

      loggerService.debug(`[storeroom effect] discarding ${selectedCardIds.length} cards`);

      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.actionService.run('discardCard', {
          cardId: selectedCardId,
          playerId: cardEffectArgs.playerId,
        });
      }

      loggerService.debug(`[storeroom effect] drawing ${selectedCardIds.length} cards`);

      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: selectedCardIds.length,
      });

      selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard card/s`,
        restrict: hand,
        count: {
          kind: 'upTo',
          count: hand.length,
        },
        optional: true,
      });

      if (!selectedCardIds.length) {
        loggerService.debug(`[storeroom effect] no card/s selected`);
        return;
      }

      loggerService.debug(`[storeroom effect] gaining ${selectedCardIds.length} treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: selectedCardIds.length });
    },
  },
  urchin: {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`urchin:${eventArgs.cardId}:cardPlayed`);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[urchin effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const targetPlayerIds = getAttackTargets(
        cardEffectArgs.match,
        cardEffectArgs.playerId,
        cardEffectArgs.reactionContext,
      ).filter(playerId => cardEffectArgs.cardSourceController.getSource('playerHand', playerId).length > 4);

      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);

        const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
          playerId: targetPlayerId,
          prompt: `Discard card/s`,
          restrict: hand,
          count: hand.length - 4,
        });

        if (!selectedCardIds.length) {
          loggerService.warn(`[urchin effect] no card/s selected for player ${targetPlayerId}`);
          continue;
        }

        loggerService.debug(`[urchin effect] discarding ${selectedCardIds.length} cards for player ${targetPlayerId}`);

        for (const selectedCardId of selectedCardIds) {
          await cardEffectArgs.actionService.run('discardCard', {
            cardId: selectedCardId,
            playerId: targetPlayerId,
          });
        }
      }

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `urchin:${cardEffectArgs.cardId}:cardPlayed`,
        listeningFor: 'cardPlayed',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        condition: conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          if (conditionArgs.trigger.args.cardId === cardEffectArgs.cardId) return false;
          const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          if (!card.type.includes('ATTACK')) return false;
          return true;
        },
        triggeredEffectFn: async triggeredArgs => {
          const urchinCard = triggeredArgs.cardLibrary.getCard(cardEffectArgs.cardId);

          loggerService.debug(`[urchin cardGained effect] trashing urchin ${urchinCard}`);

          await triggeredArgs.actionService.run('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: urchinCard.id,
          });

          const mercenaryCards = triggeredArgs.findCardService.findCards({
            all: [{ location: 'nonSupplyCards' }, { kingdom: 'mercenary' }],
          });

          if (!mercenaryCards.length) {
            loggerService.debug(`[urchin cardGained effect] no mercenary cards in supply`);
            return;
          }

          loggerService.debug(`[urchin cardGained effect] gaining ${mercenaryCards.slice(-1)[0]}`);

          await triggeredArgs.actionService.run('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: mercenaryCards.slice(-1)[0].id,
            to: { location: 'playerDiscard' },
          });
        },
      });
    },
  },
  vagrant: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[vagrant effect] drawing 1 card and gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // Reveal the top card of the deck, shuffling the discard in
      // automatically if the deck is empty.
      const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 1);
      const card = revealed[0];

      if (!card) {
        loggerService.debug(`[vagrant effect] still no cards in deck`);
        return;
      }

      loggerService.debug(`[vagrant effect] revealing ${card}`);

      if (['CURSE', 'RUINS', 'SHELTER', 'VICTORY'].some(t => card.type.includes(t as CardType))) {
        loggerService.debug(`[vagrant effect] ${card} is a curse, ruins, shelter, or victory; moving to hand`);
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: card.id,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerHand' },
        });
      }
    },
  },
  'wandering-minstrel': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      const cardsToDiscard: Card[] = [];
      const actionCards: Card[] = [];

      // Reveal the top 3 cards, set aside — shuffling the discard back in
      // automatically if the deck runs dry mid-reveal.
      const revealedCards = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 3, { setAside: true });

      for (const card of revealedCards) {
        if (card.type.includes('ACTION')) {
          actionCards.push(card);
        } else {
          cardsToDiscard.push(card);
        }
      }

      let sorted: CardId[] = [];
      if (actionCards.length > 1) {
        const result = (await cardEffectArgs.actionService.run('userPrompt', {
          prompt: 'Put in any order',
          playerId: cardEffectArgs.playerId,
          content: {
            type: 'rearrange',
            cardIds: actionCards.map(card => card.id),
          },
          actionButtons: [{ label: 'DONE', action: 1 }],
        })) as { action: number; result: number[] };

        sorted = [...(result.result ?? [])];
      } else {
        sorted = [...actionCards.map(card => card.id)];
      }

      loggerService.debug(`[wandering-minstrel effect] putting cards ${cardsToDiscard} on deck`);

      for (const cardId of sorted) {
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: cardId,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerDeck' },
        });
      }

      loggerService.debug(`[wandering-minstrel effect] discarding ${cardsToDiscard.length} cards`);

      for (const card of cardsToDiscard) {
        await cardEffectArgs.actionService.run('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId,
        });
      }
    },
  },
  'ruined-library': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[ruined library effect] drawing 1 card`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
    },
  },
  'ruined-market': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[ruined market effect] gaining 1 buy`);
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
    },
  },
  'ruined-village': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[ruined village effect] gaining 1 action`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
    },
  },
  spoils: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[spoils effect] gaining 1 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 });

      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      loggerService.debug(`[spoils effect] moving ${thisCard} back to supply`);

      await cardEffectArgs.actionService.run('moveCard', {
        cardId: cardEffectArgs.cardId,
        to: { location: 'nonSupplyCards' },
      });
    },
  },
  survivors: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);

      if (deck.length < 2) {
        loggerService.debug(`[survivors effect] deck is empty, shuffling`);
        await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });
      }

      const numToLookAt = Math.min(2, deck.length);
      // Snapshot the looked-at card IDs once: `deck` mutates as we
      // discard/move cards below, so re-slicing it inside the loop would
      // pick up the wrong cards (mirrors the Catacombs implementation).
      const cardsToLookAt = deck.slice(-numToLookAt);

      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Discard or put back on deck?',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'DISCARD', action: 1 },
          { label: 'PUT BACK', action: 2 },
        ],
        content: {
          type: 'display-cards',
          cardIds: cardsToLookAt,
        },
      })) as { action: number; result: number[] };

      if (result.action === 1) {
        loggerService.debug(`[survivors effect] discarding ${cardsToLookAt.length} cards`);
        for (const cardId of cardsToLookAt) {
          await cardEffectArgs.actionService.run('discardCard', {
            cardId,
            playerId: cardEffectArgs.playerId,
          });
        }
      } else {
        loggerService.debug(`[survivors effect] putting back ${cardsToLookAt.length} cards`);

        if (cardsToLookAt.length > 1) {
          loggerService.debug(`[survivors effect] rearranging cards`);

          const result = (await cardEffectArgs.actionService.run('userPrompt', {
            prompt: 'Rearrange',
            playerId: cardEffectArgs.playerId,
            content: {
              type: 'rearrange',
              cardIds: cardsToLookAt,
            },
          })) as { action: number; result: number[] };

          for (const cardId of result.result) {
            await cardEffectArgs.actionService.run('moveCard', {
              cardId: cardId,
              toPlayerId: cardEffectArgs.playerId,
              to: { location: 'playerDeck' },
            });
          }
        } else {
          loggerService.debug(`[survivors effect] only one card to look at, it's already on top of deck`);
        }
      }
    },
  },
};

export default cardEffects;
