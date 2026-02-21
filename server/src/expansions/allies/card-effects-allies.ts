import { CardId, CardKey, PlayerId } from 'shared/types/index.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { isPlayerImmune } from '../../utils/reaction-immunity.ts';

const AUGURS_PILE_KEY: CardKey = 'augurs';

// Gains the current top card of a supply pile to discard.
const gainTopSupplyCardToDiscard = async (args: {
  playerId: PlayerId;
  pileKey: CardKey;
  logTag: string;
  supplyGainService: {
    gainTopSupplyCardForPileKey: (gainArgs: {
      playerId: PlayerId;
      pileKey: CardKey;
      to: { location: 'playerDiscard' };
      logTag?: string;
    }) => Promise<CardId | undefined>;
  };
}) => {
  await args.supplyGainService.gainTopSupplyCardForPileKey({
    playerId: args.playerId,
    pileKey: args.pileKey,
    to: { location: 'playerDiscard' },
    logTag: args.logTag,
  });
};

const cardEffects: CardExpansionModule = {
  'herb-gatherer': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;

      loggerService.debug('[herb-gatherer effect] gaining 1 buy');
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      // Move the full deck to discard in current top-to-bottom order.
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', playerId);
      if (deck.length > 0) {
        loggerService.debug(`[herb-gatherer effect] moving ${deck.length} card(s) from deck to discard`);
        for (const deckCardId of [...deck]) {
          await cardEffectArgs.actionService.run('moveCard', {
            cardId: deckCardId,
            toPlayerId: playerId,
            to: { location: 'playerDiscard' },
          });
        }
      }

      // Optional Treasure play from discard.
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', playerId);
      const discardTreasureIds = discard.filter((cardId) =>
        cardEffectArgs.cardLibrary.getCard(cardId).type.includes('TREASURE')
      );
      if (discardTreasureIds.length > 0) {
        const selectedTreasureId = await cardEffectArgs.promptService.selectSingleCardFromPrompt({
          playerId,
          prompt: 'You may play a Treasure from your discard',
          content: {
            type: 'select',
            cardIds: discardTreasureIds,
          },
          actionButtons: [
            { label: 'CANCEL', action: 0 },
            { label: 'PLAY TREASURE', action: 1 },
          ],
          validationAction: 1,
        });

        if (selectedTreasureId) {
          loggerService.debug(`[herb-gatherer effect] playing discard treasure ${selectedTreasureId}`);
          await cardEffectArgs.actionService.run('playCard', {
            playerId,
            cardId: selectedTreasureId,
            overrides: { actionCost: 0 },
          });
        } else {
          loggerService.debug('[herb-gatherer effect] no Treasure selected from discard');
        }
      } else {
        loggerService.debug('[herb-gatherer effect] no Treasure cards in discard to play');
      }

      // Optional split-pile rotation for the Augurs pile.
      const rotatePrompt = await cardEffectArgs.actionService.run('userPrompt', {
        playerId,
        prompt: 'Rotate the Augurs?',
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'ROTATE', action: 2 },
        ],
      }) as { action: number; result: number[] } | null;

      if (rotatePrompt?.action === 2) {
        loggerService.debug('[herb-gatherer effect] rotating Augurs split pile');
        await cardEffectArgs.actionService.run('rotateSplitPile', {
          pileKey: AUGURS_PILE_KEY,
        });
      }
    },
  },
  'acolyte': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;

      // Optional trash of an Action/Victory card from hand to gain a Gold.
      const trashableActionOrVictory = cardEffectArgs.findCardService.findCards([
        { location: 'playerHand', playerId },
        { cardType: ['ACTION', 'VICTORY'] },
      ]);
      if (trashableActionOrVictory.length > 0) {
        const selectedTrashId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId,
          prompt: 'You may trash an Action or Victory card to gain a Gold',
          restrict: trashableActionOrVictory.map((card) => card.id),
          count: { kind: 'upTo', count: 1 },
          optional: true,
        });

        if (selectedTrashId) {
          loggerService.debug(`[acolyte effect] trashing ${selectedTrashId} to gain Gold`);
          await cardEffectArgs.actionService.run('trashCard', {
            playerId,
            cardId: selectedTrashId,
          });
          await gainTopSupplyCardToDiscard({
            playerId,
            pileKey: 'gold',
            logTag: 'acolyte gain gold',
            supplyGainService: cardEffectArgs.supplyGainService,
          });
        }
      } else {
        loggerService.debug('[acolyte effect] no Action/Victory card in hand to trash for Gold');
      }

      // Optional self-trash to gain the current top Augur.
      const trashSelfPrompt = await cardEffectArgs.actionService.run('userPrompt', {
        playerId,
        prompt: 'Trash this to gain an Augur?',
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'TRASH THIS', action: 2 },
        ],
      }) as { action: number; result: number[] } | null;

      if (trashSelfPrompt?.action !== 2) {
        return;
      }

      loggerService.debug('[acolyte effect] trashing self to gain top Augur');
      await cardEffectArgs.actionService.run('trashCard', {
        playerId,
        cardId: cardEffectArgs.cardId,
      });
      await gainTopSupplyCardToDiscard({
        playerId,
        pileKey: AUGURS_PILE_KEY,
        logTag: 'acolyte gain augur',
        supplyGainService: cardEffectArgs.supplyGainService,
      });
    },
  },
  'sorceress': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;

      loggerService.debug('[sorceress effect] gaining 1 action');
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const namedCardPrompt = await cardEffectArgs.actionService.run('userPrompt', {
        playerId,
        prompt: 'Name a card',
        content: { type: 'name-card' },
      }) as { action: number; result: CardKey } | null;
      const namedCardKey = namedCardPrompt?.result;

      loggerService.debug(`[sorceress effect] named card '${namedCardKey ?? '<none>'}'`);

      // Reveal top card of deck (with shuffle fallback) and move it to hand.
      const revealedCardId = await cardEffectArgs.actionService.run('revealCard', {
        playerId,
        source: 'playerDeck',
      });
      if (!revealedCardId) {
        loggerService.debug('[sorceress effect] no card revealed from deck');
        return;
      }

      const revealedCard = cardEffectArgs.cardLibrary.getCard(revealedCardId);
      await cardEffectArgs.actionService.run('moveCard', {
        cardId: revealedCardId,
        toPlayerId: playerId,
        to: { location: 'playerHand' },
      });

      if (!namedCardKey || revealedCard.cardKey !== namedCardKey) {
        loggerService.debug('[sorceress effect] revealed card did not match named card; no curses gained');
        return;
      }

      // Matching guess: each other non-immune player gains a Curse.
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: playerId,
      }).filter((targetPlayerId) => !isPlayerImmune(cardEffectArgs.reactionContext, targetPlayerId));

      for (const targetPlayerId of targetPlayerIds) {
        await gainTopSupplyCardToDiscard({
          playerId: targetPlayerId,
          pileKey: 'curse',
          logTag: 'sorceress attack',
          supplyGainService: cardEffectArgs.supplyGainService,
        });
      }
    },
  },
  'sibyl': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;

      loggerService.debug('[sibyl effect] drawing 4 cards and gaining 1 action');
      await cardEffectArgs.actionService.run('drawCard', { playerId, count: 4 });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const handAfterDraw = cardEffectArgs.cardSourceController.getSource('playerHand', playerId);
      if (handAfterDraw.length < 1) {
        loggerService.debug('[sibyl effect] no cards in hand to place on deck');
        return;
      }

      const topDeckCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId,
        prompt: 'Put a card from your hand on top of your deck',
        restrict: handAfterDraw,
        count: 1,
      });
      if (!topDeckCardId) {
        loggerService.warn('[sibyl effect] no card selected for top-deck placement');
        return;
      }

      await cardEffectArgs.actionService.run('moveCard', {
        cardId: topDeckCardId,
        toPlayerId: playerId,
        to: { location: 'playerDeck' },
      });

      const handAfterTopDeck = cardEffectArgs.cardSourceController.getSource('playerHand', playerId);
      if (handAfterTopDeck.length < 1) {
        loggerService.debug('[sibyl effect] no second card available for bottom-deck placement');
        return;
      }

      const bottomDeckCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId,
        prompt: 'Put another card from your hand on the bottom of your deck',
        restrict: handAfterTopDeck,
        count: 1,
      });
      if (!bottomDeckCardId) {
        loggerService.warn('[sibyl effect] no card selected for bottom-deck placement');
        return;
      }

      await cardEffectArgs.actionService.run('moveCard', {
        cardId: bottomDeckCardId,
        toPlayerId: playerId,
        to: { location: 'playerDeck', index: 0 },
      });
    },
  },
  'battle-plan': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;

      loggerService.debug('[battle-plan effect] gaining 1 card and 1 action');
      await cardEffectArgs.actionService.run('drawCard', { playerId, count: 1 });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // Optional reveal of an Attack card from hand for +1 Card.
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', playerId);
      const attackCardIds = hand.filter((cardId) => cardEffectArgs.cardLibrary.getCard(cardId).type.includes('ATTACK'));
      if (attackCardIds.length > 0) {
        const revealedAttackCardId = await cardEffectArgs.promptService.selectSingleCardFromPrompt({
          playerId,
          prompt: 'You may reveal an Attack card from your hand for +1 Card',
          content: {
            type: 'select',
            cardIds: attackCardIds,
          },
          actionButtons: [
            { label: 'CANCEL', action: 0 },
            { label: 'REVEAL', action: 1 },
          ],
          validationAction: 1,
        });

        if (revealedAttackCardId) {
          loggerService.debug(`[battle-plan effect] revealing Attack card ${revealedAttackCardId} for +1 Card`);
          await cardEffectArgs.actionService.run('revealCard', {
            playerId,
            cardId: revealedAttackCardId,
          });
          await cardEffectArgs.actionService.run('drawCard', { playerId, count: 1 });
        } else {
          loggerService.debug('[battle-plan effect] no Attack card revealed');
        }
      } else {
        loggerService.debug('[battle-plan effect] no Attack cards in hand to reveal');
      }

      // Optional rotation of any pile currently in Supply.
      const supplyPileKeys = [...new Set(
        cardEffectArgs.findCardService.findCards({ location: ['basicSupply', 'kingdomSupply'] })
          .map((card) => getCardPileKey(card))
          .filter((pileKey) => pileKey.length > 0),
      )].sort((left, right) => left.localeCompare(right));

      if (supplyPileKeys.length < 1) {
        loggerService.debug('[battle-plan effect] no Supply piles available to rotate');
        return;
      }

      const selectedPileKeys = await cardEffectArgs.promptService.request<CardKey[]>({
        playerId,
        prompt: 'You may rotate a Supply pile',
        content: {
          type: 'select-pile',
          pileNames: supplyPileKeys,
          selectCount: { kind: 'upTo', count: 1 },
          optional: true,
        },
      }) ?? [];

      const selectedPileKey = selectedPileKeys[0];
      if (!selectedPileKey) {
        loggerService.debug('[battle-plan effect] no pile selected to rotate');
        return;
      }

      loggerService.debug(`[battle-plan effect] rotating pile ${selectedPileKey}`);
      await cardEffectArgs.actionService.run('rotateSplitPile', {
        pileKey: selectedPileKey,
      });
    },
  },
  'archer': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;

      loggerService.debug('[archer effect] gaining 2 treasure');
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: playerId,
      }).filter((targetPlayerId) => !isPlayerImmune(cardEffectArgs.reactionContext, targetPlayerId));

      for (const targetPlayerId of targetPlayerIds) {
        const targetHand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
        if (targetHand.length < 5) {
          loggerService.debug(`[archer effect] player ${targetPlayerId} has fewer than 5 cards, skipping`);
          continue;
        }

        // Target chooses one card to keep secret.
        const keptCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: targetPlayerId,
          prompt: 'Choose a card to keep hidden',
          restrict: targetHand,
          count: 1,
        }) ?? targetHand[0];

        // Reveal all remaining cards.
        const revealedCardIds = targetHand.filter((cardId) => cardId !== keptCardId);
        for (const revealedCardId of revealedCardIds) {
          await cardEffectArgs.actionService.run('revealCard', {
            playerId: targetPlayerId,
            cardId: revealedCardId,
          });
        }

        if (revealedCardIds.length < 1) {
          loggerService.debug(`[archer effect] player ${targetPlayerId} revealed no cards to discard`);
          continue;
        }

        // Attacker chooses one revealed card for the target to discard.
        const selectedDiscardId = revealedCardIds.length === 1
          ? revealedCardIds[0]
          : await cardEffectArgs.promptService.selectSingleCardFromPrompt({
            playerId,
            prompt: `Choose a revealed card for player ${targetPlayerId} to discard`,
            content: {
              type: 'select',
              cardIds: revealedCardIds,
            },
          }) ?? revealedCardIds[0];

        loggerService.debug(`[archer effect] player ${targetPlayerId} discarding card ${selectedDiscardId}`);
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: targetPlayerId,
          cardId: selectedDiscardId,
        });
      }
    },
  },
  'warlord': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;
      const warlordCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      loggerService.debug('[warlord effect] gaining 1 action');
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // At the start of your next turn, draw 2 cards.
      cardEffectArgs.registerDurationEffect(warlordCard, {
        id: `warlord:${cardEffectArgs.cardId}:startTurn`,
        playerId,
        listeningFor: 'startTurn',
        once: true,
        compulsory: true,
        system: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: warlordCard.id,
            to: { location: 'playArea' },
          });
          await triggeredArgs.actionService.run('drawCard', { playerId, count: 2 });
        },
      });
    },
  },
  'territory': {
    registerScoringFunction: () => (cardEffectArgs) => {
      const victoryCardKeys = new Set(
        cardEffectArgs.findCardService.findCards([
          { owner: cardEffectArgs.ownerId },
          { cardType: ['VICTORY'] },
        ]).map((card) => card.cardKey),
      );
      cardEffectArgs.loggerService.debug(
        `[territory scoring] player ${cardEffectArgs.ownerId} has ${victoryCardKeys.size} differently named Victory cards`,
      );
      return victoryCardKeys.size;
    },
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        const totalSupplyPiles = cardEffectArgs.match.config.basicSupply.length + cardEffectArgs.match.config.kingdomSupply.length;
        const emptySupplyPileCount = Math.max(0, totalSupplyPiles - cardEffectArgs.findCardService.getRemainingSupplyCount());
        loggerService.debug(
          `[territory onGained effect] ${emptySupplyPileCount} empty Supply pile(s); gaining that many Golds`,
        );

        for (let i = 0; i < emptySupplyPileCount; i++) {
          await gainTopSupplyCardToDiscard({
            playerId: eventArgs.playerId,
            pileKey: 'gold',
            logTag: 'territory onGained gain gold',
            supplyGainService: cardEffectArgs.supplyGainService,
          });
        }
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      cardEffectArgs.loggerService.debug('[territory effect] no on-play effect');
    },
  },
};

export default cardEffects;
