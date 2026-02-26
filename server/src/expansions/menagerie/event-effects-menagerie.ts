import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getPileDefinitionCard } from '../../utils/get-pile-definition-card.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { getCurrentTurnHistoryIndex } from '../../utils/get-current-turn-history-index.ts';
import { getPlayerSourceSafe } from '../../utils/get-player-source-safe.ts';
import { AppContext, CardEffectFunctionContext, CardExpansionModule } from '@server-types/index.ts';
import { Card, CardCost, CardId, CardKey, PlayerId } from 'shared/types/index.ts';
import { findEventInMatch } from '@shared/find-card-like-in-match.ts';

// Runtime metadata attached to cards Exiled by Invest.
type InvestCardMetadata = {
  menagerie?: {
    investOwnerPlayerId?: PlayerId;
  };
};

// Runtime metadata attached to the Seize the Day event instance.
type SeizeTheDayEventMetadata = {
  menagerie?: {
    usedByPlayerId?: Partial<Record<PlayerId, boolean>>;
  };
};

// Gains one Horse from the non-supply Horse pile when available.
const gainHorse = async (
  args: CardEffectFunctionContext,
  playerId: PlayerId,
  to: { location: 'playerDiscard' | 'playerDeck' },
) => {
  const horseCards = args.findCardService.findCards({ all: [
    { location: 'nonSupplyCards' },
    { cardKeys: 'horse' },
  ] });

  if (!horseCards.length) {
    args.loggerService.debug('[menagerie event helper] no Horse cards remain to gain');
    return false;
  }

  const horseCard = horseCards.slice(-1)[0];
  await args.actionService.run('gainCard', {
    playerId,
    cardId: horseCard.id,
    to,
  });
  return true;
};

// Returns Action Supply pile keys based on pile randomizer/type metadata.
const getActionSupplyPileKeys = (
  args: CardEffectFunctionContext,
): string[] => {
  const supplyDefinitions = [...args.match.config.basicSupply, ...args.match.config.kingdomSupply];
  return supplyDefinitions
    .map((supply) => {
      const pileDefinitionCard = getPileDefinitionCard(supply.cards, supply.name);
      if (!pileDefinitionCard?.type?.includes('ACTION')) {
        return null;
      }
      return getCardPileKey(pileDefinitionCard);
    })
    .filter((pileKey): pileKey is string => !!pileKey);
};

// Returns true when an Invest-marked card is still in the owning player's Exile.
const isInvestedCardStillInOwnerExile = (
  args: AppContext,
  cardId: CardId,
  ownerPlayerId: PlayerId,
): boolean => {
  const exileSource = getPlayerSourceSafe(args, 'exile', ownerPlayerId);
  if (!exileSource.includes(cardId)) {
    return false;
  }
  const card = args.cardLibrary.getCard<InvestCardMetadata>(cardId);
  return card.metadata.menagerie?.investOwnerPlayerId === ownerPlayerId;
};

const effectMap: CardExpansionModule = {
  'alliance': {
    registerEffects: () => async (cardEffectArgs) => {
      // Alliance gains fixed basic cards in printed order when present.
      const gainOrder: CardKey[] = ['province', 'duchy', 'estate', 'gold', 'silver', 'copper'];

      for (const gainPileKey of gainOrder) {
        await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: cardEffectArgs.playerId,
          pileKey: gainPileKey,
          to: { location: 'playerDiscard' },
          logTag: 'alliance effect',
        });
      }
    },
  },
  'banish': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Banish chooses a duplicated name in hand, then Exiles any number of that name.
      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        loggerService.debug('[banish effect] no cards in hand to Exile');
        return;
      }

      // Offer one representative per duplicated card name.
      const cardIdsByKey = hand.reduce((prev, cardId) => {
        const cardKey = cardEffectArgs.cardLibrary.getCard(cardId).cardKey;
        prev[cardKey] ??= [];
        prev[cardKey].push(cardId);
        return prev;
      }, {} as Record<CardKey, CardId[]>);

      const selectableNameCardIds = Object.values(cardIdsByKey)
        .filter((cardIds) => cardIds.length > 1)
        .map((cardIds) => cardIds[0]);

      if (!selectableNameCardIds.length) {
        loggerService.debug('[banish effect] no duplicated card names in hand');
        return;
      }

      const selectedNameCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a duplicated card name to Exile',
        restrict: selectableNameCardIds,
        count: 1,
        optional: true,
      });

      if (!selectedNameCardId) {
        loggerService.debug('[banish effect] player declined to choose a card name');
        return;
      }

      const selectedNameCard = cardEffectArgs.cardLibrary.getCard(selectedNameCardId);
      const matchingCards = cardIdsByKey[selectedNameCard.cardKey] ?? [];

      const cardsToExile = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Exile any number of ${selectedNameCard.cardName}`,
        restrict: matchingCards,
        count: { kind: 'upTo', count: matchingCards.length },
        optional: true,
      });

      if (!cardsToExile.length) {
        loggerService.debug('[banish effect] no cards selected to Exile');
        return;
      }

      for (const cardId of cardsToExile) {
        await cardEffectArgs.actionService.run('exileCard', {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
      }
    },
  },
  'bargain': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Bargain gains a non-Victory card up to $5.
      const gainableCards = cardEffectArgs.findCardService.findCards({ all: [
        { location: ['basicSupply', 'kingdomSupply'] },
        { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: 5 } },
      ] }).filter((card) => !card.type.includes('VICTORY'));

      if (gainableCards.length) {
        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Gain a non-Victory card costing up to $5',
          restrict: gainableCards.map((card) => card.id),
          count: 1,
        });

        if (selectedCardId) {
          await cardEffectArgs.actionService.run('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId,
            to: { location: 'playerDiscard' },
          });
        } else {
          loggerService.warn('[bargain effect] no gain card selected');
        }
      } else {
        loggerService.debug('[bargain effect] no non-Victory card costing up to $5 to gain');
      }

      // Bargain then gives each other player a Horse in turn order.
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId,
      });

      for (const targetPlayerId of targetPlayerIds) {
        await gainHorse(cardEffectArgs, targetPlayerId, { location: 'playerDiscard' });
      }
    },
  },
  'commerce': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Commerce counts differently named cards this player gained this turn.
      const turnHistoryIndex = getCurrentTurnHistoryIndex(
        { match: cardEffectArgs.match },
        { fallbackToZero: false },
      );
      if (turnHistoryIndex === undefined) {
        loggerService.warn('[commerce effect] no active turn history index');
        return;
      }

      const gainedThisTurn = cardEffectArgs.match.stats.cardsGainedByTurn[turnHistoryIndex] ?? [];
      const uniqueCardKeys = new Set<CardKey>();

      for (const gainedCardId of gainedThisTurn) {
        const gainStats = cardEffectArgs.match.stats.cardsGained[gainedCardId];
        if (
          !gainStats || gainStats.playerId !== cardEffectArgs.playerId ||
          gainStats.turnHistoryIndex !== turnHistoryIndex
        ) {
          continue;
        }
        uniqueCardKeys.add(cardEffectArgs.cardLibrary.getCard(gainedCardId).cardKey);
      }

      if (uniqueCardKeys.size === 0) {
        loggerService.debug('[commerce effect] no differently named gained cards this turn');
        return;
      }

      const goldCards = cardEffectArgs.findCardService.findCards({ all: [
        { location: 'basicSupply' },
        { cardKeys: 'gold' },
      ] });
      const goldGainCount = Math.min(uniqueCardKeys.size, goldCards.length);

      if (goldGainCount === 0) {
        loggerService.debug('[commerce effect] no Gold cards remain in Supply');
        return;
      }

      for (let gainIndex = 0; gainIndex < goldGainCount; gainIndex++) {
        const goldCard = goldCards.slice(-gainIndex - 1)[0];
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: goldCard.id,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'delay': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn('[delay effect] event not found');
        return;
      }

      // Delay optionally sets aside an Action card from hand.
      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      const actionCardsInHand = hand
        .map((cardId) => cardEffectArgs.cardLibrary.getCard(cardId))
        .filter((card) => card.type.includes('ACTION'));

      if (!actionCardsInHand.length) {
        loggerService.debug('[delay effect] no Action cards in hand to set aside');
        return;
      }

      const selectedActionCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Set aside an Action card to play next turn?',
        restrict: actionCardsInHand.map((card) => card.id),
        count: 1,
        optional: true,
      });

      if (!selectedActionCardId) {
        loggerService.debug('[delay effect] player declined to set aside an Action');
        return;
      }

      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: selectedActionCardId,
        to: { location: 'set-aside' },
      });

      // Delay plays that set-aside Action at the start of the owner's next turn.
      cardEffectArgs.reactionManager.registerReactionTemplate(
        event,
        'startTurn',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: async (conditionArgs) =>
            conditionArgs.trigger.args.playerId === cardEffectArgs.playerId &&
            getPlayerSourceSafe(conditionArgs, 'set-aside', cardEffectArgs.playerId)
              .includes(selectedActionCardId),
          triggeredEffectFn: async (triggeredArgs) => {
            await triggeredArgs.actionService.run('playCard', {
              playerId: cardEffectArgs.playerId,
              cardId: selectedActionCardId,
              overrides: { actionCost: 0 },
            });
          },
        },
        { idSuffix: `delay:${selectedActionCardId}:startTurn` },
      );
    },
  },
  'demand': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Demand gains a Horse onto deck before choosing the second gain.
      await gainHorse(cardEffectArgs, cardEffectArgs.playerId, { location: 'playerDeck' });

      const gainableCards = cardEffectArgs.findCardService.findCards({ all: [
        { location: ['basicSupply', 'kingdomSupply'] },
        { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: 4 } },
      ] });

      if (!gainableCards.length) {
        loggerService.debug('[demand effect] no card costing up to $4 to gain');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a card costing up to $4 onto your deck',
        restrict: gainableCards.map((card) => card.id),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn('[demand effect] no card selected to gain');
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerDeck' },
      });
    },
  },
  'desperation': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn('[desperation effect] event not found');
        return;
      }

      // Desperation is once per turn for the buying player.
      const desperationRestriction: CardPriceRule = (_card, context) => {
        if (context.playerId !== cardEffectArgs.playerId) {
          return { restricted: false, cost: { treasure: 0 } };
        }
        return { restricted: true, cost: { treasure: 0 } };
      };
      const unrestrict = cardEffectArgs.cardPriceController.registerRule(event, desperationRestriction);

      cardEffectArgs.reactionManager.registerSystemTemplate(
        event,
        'endTurn',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: async (conditionArgs) => conditionArgs.trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async () => {
            unrestrict();
          },
        },
      );

      const promptResult = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a Curse for +1 Buy and +$2?',
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'YES', action: 2 },
        ],
      }) as { action?: number } | null;

      if (promptResult?.action !== 2) {
        loggerService.debug('[desperation effect] player declined to gain a Curse');
        return;
      }

      const curseCards = cardEffectArgs.findCardService.findCards({ all: [
        { location: 'basicSupply' },
        { cardKeys: 'curse' },
      ] });

      if (!curseCards.length) {
        loggerService.debug('[desperation effect] no Curse in Supply; no bonus granted');
        return;
      }

      const curseCard = curseCards.slice(-1)[0];
      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: curseCard.id,
        to: { location: 'playerDiscard' },
      });

      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });
    },
  },
  'enclave': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Enclave gains a Gold and Exiles a Duchy from the Supply.
      await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'gold',
        to: { location: 'playerDiscard' },
        logTag: 'enclave effect',
      });

      const duchyCards = cardEffectArgs.findCardService.findCards({ all: [
        { location: 'basicSupply' },
        { cardKeys: 'duchy' },
      ] });

      if (!duchyCards.length) {
        loggerService.debug('[enclave effect] no Duchy in Supply to Exile');
        return;
      }

      await cardEffectArgs.actionService.run('exileCard', {
        playerId: cardEffectArgs.playerId,
        cardId: duchyCards.slice(-1)[0].id,
      });
    },
  },
  'enhance': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Enhance optionally trashes a non-Victory card to gain up to $2 more.
      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      const nonVictoryCards = hand
        .map((cardId) => cardEffectArgs.cardLibrary.getCard(cardId))
        .filter((card) => !card.type.includes('VICTORY'));

      if (!nonVictoryCards.length) {
        loggerService.debug('[enhance effect] no non-Victory cards in hand');
        return;
      }

      const cardsToTrash = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a non-Victory card from your hand?',
        restrict: nonVictoryCards.map((card) => card.id),
        count: 1,
        optional: true,
      });

      if (!cardsToTrash) {
        loggerService.debug('[enhance effect] player declined to trash a card');
        return;
      }

      const trashedCard = cardEffectArgs.cardLibrary.getCard(cardsToTrash);
      const { cost: trashedCardCost } = cardEffectArgs.cardPriceController.applyRules(trashedCard, {
        playerId: cardEffectArgs.playerId,
      });

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: trashedCard.id,
      });

      const maxGainCost: CardCost = {
        treasure: (trashedCardCost.treasure ?? 0) + 2,
        potion: trashedCardCost.potion ?? 0,
        debt: trashedCardCost.debt ?? 0,
      };

      const gainableCards = cardEffectArgs.findCardService.findCards({ all: [
        { location: ['basicSupply', 'kingdomSupply'] },
        { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: maxGainCost },
      ] });

      if (!gainableCards.length) {
        loggerService.debug('[enhance effect] no card available to gain after trashing');
        return;
      }

      const selectedGainId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a card costing up to $2 more than the trashed card',
        restrict: gainableCards.map((card) => card.id),
        count: 1,
      });

      if (!selectedGainId) {
        loggerService.warn('[enhance effect] no gain card selected');
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedGainId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'gamble': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Gamble grants +1 Buy, then discards and optionally plays the discarded top card.
      loggerService.debug('[gamble effect] resolving +1 Buy');
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      // If the deck is empty, shuffle first to find a top card to discard.
      let deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      if (!deck.length) {
        loggerService.debug('[gamble effect] deck empty, shuffling discard into deck');
        await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });
        deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      }

      const discardedCardId = deck.slice(-1)[0];
      if (discardedCardId === undefined) {
        loggerService.debug('[gamble effect] no card to discard from deck');
        return;
      }

      const discardedCard = cardEffectArgs.cardLibrary.getCard(discardedCardId);
      loggerService.debug(`[gamble effect] top card to discard is ${discardedCard}`);

      // Discard first, matching the printed order of operations.
      await cardEffectArgs.actionService.run('discardCard', {
        playerId: cardEffectArgs.playerId,
        cardId: discardedCardId,
      });

      // Only Actions and Treasures are eligible for the optional play.
      const canPlayRevealed = discardedCard.type.includes('ACTION') || discardedCard.type.includes('TREASURE');
      if (!canPlayRevealed) {
        loggerService.debug('[gamble effect] discarded card is not an Action or Treasure');
        return;
      }

      loggerService.debug(`[gamble effect] discarded card ${discardedCard} is playable; prompting player`);
      const promptResult = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play ${discardedCard.cardName}?`,
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'YES', action: 2 },
        ],
      }) as { action?: number } | null;

      if (promptResult?.action !== 2) {
        loggerService.debug('[gamble effect] player declined to play discarded card');
        return;
      }

      loggerService.debug(`[gamble effect] player chose to play discarded card ${discardedCard}`);
      await cardEffectArgs.actionService.run('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: discardedCardId,
        overrides: { actionCost: 0 },
      });
    },
  },
  'invest': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn('[invest effect] event not found');
        return;
      }

      // Invest Exiles an Action card from the Supply.
      const actionCards = cardEffectArgs.findCardService.findCards({ all: [
        { location: ['basicSupply', 'kingdomSupply'] },
        { cardType: ['ACTION'] },
      ] });

      if (!actionCards.length) {
        loggerService.debug('[invest effect] no Action card in Supply to Exile');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Exile an Action card from the Supply',
        restrict: actionCards.map((card) => card.id),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn('[invest effect] no card selected');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      await cardEffectArgs.actionService.run('exileCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      // Mark the specific Exiled card as an Invested card for this owner.
      const investedCard = cardEffectArgs.cardLibrary.getCard<InvestCardMetadata>(selectedCardId);
      investedCard.metadata.menagerie ??= {};
      investedCard.metadata.menagerie.investOwnerPlayerId = cardEffectArgs.playerId;

      // While this specific Invested card stays in Exile, another player's gain of a copy draws +2.
      cardEffectArgs.reactionManager.registerReactionTemplate(
        event,
        'cardGained',
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          allowMultipleInstances: false,
          compulsory: true,
          condition: async (conditionArgs) => {
            if (conditionArgs.trigger.args.playerId === cardEffectArgs.playerId) {
              return false;
            }
            const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (gainedCard.cardKey !== selectedCard.cardKey) {
              return false;
            }
            return isInvestedCardStillInOwnerExile(conditionArgs, selectedCardId, cardEffectArgs.playerId);
          },
          triggeredEffectFn: async (triggeredArgs) => {
            await triggeredArgs.actionService.run('drawCard', {
              playerId: cardEffectArgs.playerId,
              count: 2,
            });
          },
        },
        { idSuffix: `invest:${selectedCardId}:cardGained` },
      );

      // Investing in a copy also triggers other players' Invested copies of this card key.
      for (const player of cardEffectArgs.match.players) {
        if (player.id === cardEffectArgs.playerId) {
          continue;
        }

        const exileSource = getPlayerSourceSafe(cardEffectArgs, 'exile', player.id);
        for (const exileCardId of exileSource) {
          const exileCard = cardEffectArgs.cardLibrary.getCard<InvestCardMetadata>(exileCardId);
          if (exileCard.cardKey !== selectedCard.cardKey) {
            continue;
          }
          if (exileCard.metadata.menagerie?.investOwnerPlayerId !== player.id) {
            continue;
          }

          loggerService.debug(
            `[invest effect] player ${player.id} drawing 2 for other player's Invest of ${selectedCard.cardKey}`,
          );
          await cardEffectArgs.actionService.run('drawCard', {
            playerId: player.id,
            count: 2,
          });
        }
      }
    },
  },
  'march': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // March may play an Action card from discard without using an Action.
      const discard = getPlayerSourceSafe(cardEffectArgs, 'playerDiscard', cardEffectArgs.playerId);
      const actionCardsInDiscard = discard
        .map((cardId) => cardEffectArgs.cardLibrary.getCard(cardId))
        .filter((card) => card.type.includes('ACTION'));

      if (!actionCardsInDiscard.length) {
        loggerService.debug('[march effect] no Action cards in discard');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Play an Action card from your discard?',
        restrict: actionCardsInDiscard.map((card) => card.id),
        selectionIntent: { kind: 'play-card', cardTypes: ['ACTION'] },
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug('[march effect] player declined to play from discard');
        return;
      }

      await cardEffectArgs.actionService.run('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        overrides: { actionCost: 0 },
      });
    },
  },
  'populate': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Populate gains one top card from each Action Supply pile.
      const actionSupplyPiles = getActionSupplyPileKeys(cardEffectArgs);
      if (!actionSupplyPiles.length) {
        loggerService.debug('[populate effect] no Action Supply piles available');
        return;
      }

      // Repeatedly choose one currently top Action pile card and remove that pile from future choices.
      let remainingPileKeys = [...actionSupplyPiles];
      while (remainingPileKeys.length) {
        const selectableTopCards = remainingPileKeys
          .map((pileKey) => ({
            pileKey,
            card: cardEffectArgs.findCardService.findTopSupplyCardForPileKey({ pileKey }),
          }))
          .filter((entry): entry is { pileKey: string; card: Card } => !!entry.card);

        if (!selectableTopCards.length) {
          loggerService.debug('[populate effect] no remaining top cards found to gain');
          return;
        }

        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Choose the next card to gain (Populate)',
          restrict: selectableTopCards.map((entry) => entry.card.id),
          count: 1,
        });

        // If selection unexpectedly fails, fall back to the first available option.
        const resolvedCardId = selectedCardId ?? selectableTopCards[0].card.id;
        const selectedTopCard = selectableTopCards.find((entry) => entry.card.id === resolvedCardId) ??
          selectableTopCards[0];

        loggerService.debug(
          `[populate effect] selected ${selectedTopCard.card} from pile ${selectedTopCard.pileKey}; ${
            remainingPileKeys.length - 1
          } pile(s) remain`,
        );

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedTopCard.card.id,
          to: { location: 'playerDiscard' },
        });

        remainingPileKeys = remainingPileKeys.filter((pileKey) => pileKey !== selectedTopCard.pileKey);
      }
    },
  },
  'pursue': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Pursue grants +1 Buy before naming a card.
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const nameResult = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Name a card',
        content: { type: 'name-card' },
      }) as { action?: number; result?: CardKey } | null;

      const namedCardKey = nameResult?.result;
      if (!namedCardKey) {
        loggerService.warn('[pursue effect] no card named');
        return;
      }

      // Reveal up to 4 cards to set-aside so we can split and resolve them.
      const revealedCardIds: CardId[] = [];
      for (let revealIndex = 0; revealIndex < 4; revealIndex++) {
        const revealedCardId = await cardEffectArgs.actionService.run('revealCard', {
          playerId: cardEffectArgs.playerId,
          source: 'playerDeck',
          moveToSetAside: true,
        });
        if (revealedCardId === undefined) {
          break;
        }
        revealedCardIds.push(revealedCardId);
      }

      if (!revealedCardIds.length) {
        loggerService.debug('[pursue effect] no cards revealed');
        return;
      }

      const matchingCardIds: CardId[] = [];
      const nonMatchingCardIds: CardId[] = [];
      for (const revealedCardId of revealedCardIds) {
        const revealedCard = cardEffectArgs.cardLibrary.getCard(revealedCardId);
        if (revealedCard.cardKey === namedCardKey) {
          matchingCardIds.push(revealedCardId);
        } else {
          nonMatchingCardIds.push(revealedCardId);
        }
      }

      for (const cardId of nonMatchingCardIds) {
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
      }

      // Put matching cards back on top, preserving original reveal order.
      for (let matchingIndex = matchingCardIds.length - 1; matchingIndex >= 0; matchingIndex--) {
        const matchingCardId = matchingCardIds[matchingIndex];
        await cardEffectArgs.actionService.run('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: matchingCardId,
          to: { location: 'playerDeck' },
        });
      }
    },
  },
  'reap': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn('[reap effect] event not found');
        return;
      }

      // Reap gains a Gold and sets it aside to auto-play at next turn start.
      const goldCards = cardEffectArgs.findCardService.findCards({ all: [
        { location: 'basicSupply' },
        { cardKeys: 'gold' },
      ] });

      if (!goldCards.length) {
        loggerService.debug('[reap effect] no Gold in Supply to gain');
        return;
      }

      const goldCard = goldCards.slice(-1)[0];
      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: goldCard.id,
        to: { location: 'set-aside' },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate(
        event,
        'startTurn',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: async (conditionArgs) =>
            conditionArgs.trigger.args.playerId === cardEffectArgs.playerId &&
            getPlayerSourceSafe(conditionArgs, 'set-aside', cardEffectArgs.playerId)
              .includes(goldCard.id),
          triggeredEffectFn: async (triggeredArgs) => {
            await triggeredArgs.actionService.run('playCard', {
              playerId: cardEffectArgs.playerId,
              cardId: goldCard.id,
              overrides: { actionCost: 0 },
            });
          },
        },
        { idSuffix: `reap:${goldCard.id}:startTurn` },
      );
    },
  },
  'ride': {
    registerEffects: () => async (cardEffectArgs) => {
      // Ride gains a Horse.
      await gainHorse(cardEffectArgs, cardEffectArgs.playerId, { location: 'playerDiscard' });
    },
  },
  'seize-the-day': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch<SeizeTheDayEventMetadata>(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn('[seize-the-day effect] event not found');
        return;
      }

      // Seize the Day is once per player per game.
      event.metadata.menagerie ??= {};
      event.metadata.menagerie.usedByPlayerId ??= {};
      if (event.metadata.menagerie.usedByPlayerId[cardEffectArgs.playerId]) {
        loggerService.debug(`[seize-the-day effect] player ${cardEffectArgs.playerId} already used Seize the Day`);
        return;
      }

      event.metadata.menagerie.usedByPlayerId[cardEffectArgs.playerId] = true;
      loggerService.debug(`[seize-the-day effect] marking usage for player ${cardEffectArgs.playerId}`);

      const lockRule: CardPriceRule = () => ({ restricted: true, cost: { treasure: 0 } });
      cardEffectArgs.cardPriceController.registerRule(event, lockRule);

      await cardEffectArgs.actionService.run('queueExtraTurn', {
        turn: {
          playerId: cardEffectArgs.playerId,
          sourceId: event.id,
        },
      });
    },
  },
  'stampede': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Stampede checks cards currently in play and gains up to 5 Horses onto deck.
      const cardsInPlay = cardEffectArgs.findCardService.getCardsInPlay()
        .filter((card) => card.owner === cardEffectArgs.playerId);

      if (cardsInPlay.length > 5) {
        loggerService.debug('[stampede effect] player has more than 5 cards in play, no Horses gained');
        return;
      }

      const horseCards = cardEffectArgs.findCardService.findCards({ all: [
        { location: 'nonSupplyCards' },
        { cardKeys: 'horse' },
      ] });
      const horseGainCount = Math.min(5, horseCards.length);

      if (horseGainCount === 0) {
        loggerService.debug('[stampede effect] no Horses remain to gain');
        return;
      }

      for (let gainIndex = 0; gainIndex < horseGainCount; gainIndex++) {
        const horseCard = horseCards.slice(-gainIndex - 1)[0];
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: horseCard.id,
          to: { location: 'playerDeck' },
        });
      }
    },
  },
  'toil': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Toil grants +1 Buy and may play an Action card from hand.
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Play an Action card from your hand?',
        restrict: {
          all: [
            { location: 'playerHand', playerId: cardEffectArgs.playerId },
            { cardType: ['ACTION'] },
          ],
        },
        selectionIntent: { kind: 'play-card', cardTypes: ['ACTION'] },
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug('[toil effect] player declined to play an Action');
        return;
      }

      await cardEffectArgs.actionService.run('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        overrides: { actionCost: 0 },
      });
    },
  },
  'transport': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Transport can either Exile an Action from Supply or topdeck an Action from Exile.
      const supplyActionCards = cardEffectArgs.findCardService.findCards({ all: [
        { location: ['basicSupply', 'kingdomSupply'] },
        { cardType: ['ACTION'] },
      ] });
      const exileActionCards = getPlayerSourceSafe(cardEffectArgs, 'exile', cardEffectArgs.playerId)
        .map((cardId) => cardEffectArgs.cardLibrary.getCard(cardId))
        .filter((card) => card.type.includes('ACTION'));

      const canExileFromSupply = supplyActionCards.length > 0;
      const canTopdeckFromExile = exileActionCards.length > 0;

      if (!canExileFromSupply && !canTopdeckFromExile) {
        loggerService.debug('[transport effect] no valid options available');
        return;
      }

      let selectedMode: 'supply' | 'exile';
      if (canExileFromSupply && canTopdeckFromExile) {
        const promptResult = await cardEffectArgs.actionService.run('userPrompt', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Choose one',
          actionButtons: [
            { label: 'EXILE SUPPLY ACTION', action: 1 },
            { label: 'TOPDECK EXILED ACTION', action: 2 },
          ],
        }) as { action?: number } | null;
        selectedMode = promptResult?.action === 2 ? 'exile' : 'supply';
      } else {
        selectedMode = canExileFromSupply ? 'supply' : 'exile';
      }

      if (selectedMode === 'supply') {
        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Exile an Action card from the Supply',
          restrict: supplyActionCards.map((card) => card.id),
          count: 1,
        });

        if (!selectedCardId) {
          loggerService.warn('[transport effect] no Supply Action selected to Exile');
          return;
        }

        await cardEffectArgs.actionService.run('exileCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
        });
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Put an Action card from Exile onto your deck',
        restrict: exileActionCards.map((card) => card.id),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn('[transport effect] no Exiled Action selected to topdeck');
        return;
      }

      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerDeck' },
      });
    },
  },
};

export default effectMap;
