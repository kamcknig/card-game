import { findOrderedEffectTargets } from '../../utils/find-ordered-effect-targets.ts';
import { isUndefined } from 'es-toolkit';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { DiscardCardEffect } from '../../core/effects/discard-card.ts';
import { DrawCardEffect } from '../../core/effects/draw-card.ts';
import { GainActionEffect } from '../../core/effects/gain-action.ts';
import { GainBuyEffect } from '../../core/effects/gain-buy.ts';
import { GainCardEffect } from '../../core/effects/gain-card.ts';
import { GainTreasureEffect } from '../../core/effects/gain-treasure.ts';
import { MoveCardEffect } from '../../core/effects/move-card.ts';
import { PlayCardEffect } from '../../core/effects/play-card.ts';
import { RevealCardEffect } from '../../core/effects/reveal-card.ts';
import { SelectCardEffect } from '../../core/effects/select-card.ts';
import { ShuffleDeckEffect } from '../../core/effects/shuffle-card.ts';
import { TrashCardEffect } from '../../core/effects/trash-card.ts';
import { UserPromptEffect } from '../../core/effects/user-prompt.ts';
import { CardExpansionModule } from '../card-expansion-module.ts';

const expansionModule: CardExpansionModule = {
  registerCardLifeCycles: () => {
    return {
      'moat': {
        onEnterHand: ({ playerId, cardId }) => {
          return {
            registerTriggers: [{
              id: `moat-${cardId}`,
              multipleUse: false,
              playerId,
              listeningFor: 'cardPlayed',
              condition: ({ cardLibrary, trigger }) => {
                return cardLibrary
                  .getCard(trigger.cardId).type.includes('ATTACK') && trigger.playerId !== playerId;
              },
              generatorFn: function* ({ trigger, reaction }) {
                const sourceId = reaction.getSourceId();
                yield new RevealCardEffect({
                  sourceCardId: trigger.cardId,
                  sourcePlayerId: trigger.playerId,
                  cardId: sourceId,
                  playerId: reaction.playerId,
                });
                
                return 'immunity';
              },
            }],
          };
        },
        onLeaveHand: ({ cardId }) => {
          return {
            unregisterTriggers: [`moat-${cardId}`],
          };
        },
      },
    };
  },
  registerScoringFunctions: () => ({
    'gardens': function ({ match, ownerId }) {
      const cards = match
        .playerHands[ownerId]
        .concat(match.playerDecks[ownerId])
        .concat(match.playerDiscards[ownerId])
        .concat(match.playArea);
      
      return Math.floor(cards.length / 10);
    },
  }),
  registerEffects: () => ({
    'adventurer': function* ({
      match,
      cardLibrary,
      triggerPlayerId,
    }) {
      let treasuresRevealed = 0;
      
      let deck = match.playerDecks[triggerPlayerId];
      
      while (treasuresRevealed < 2 && deck.length > 0) {
        const cardId = deck.slice(-1)![0];
        yield new RevealCardEffect({
          playerId: triggerPlayerId,
          cardId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: cardId,
        });
        const card = cardLibrary.getCard(cardId);
        if (card.type.includes('TREASURE')) {
          console.log(`[ADVENTURER EFFECT] card revealed is a treasure, drawing`);
          yield new DrawCardEffect({
            playerId: triggerPlayerId,
            sourcePlayerId: triggerPlayerId,
            sourceCardId: cardId,
          });
          ++treasuresRevealed;
        } else {
          console.log('[ADVENTURER EFFECT] card revealed is not a treasure, discarding');
          yield new DiscardCardEffect({
            playerId: triggerPlayerId,
            cardId,
            sourcePlayerId: triggerPlayerId,
            sourceCardId: cardId,
          });
        }
        
        if (deck.length === 0) {
          yield new ShuffleDeckEffect({
            playerId: triggerPlayerId
          });
          deck = match.playerDecks[triggerPlayerId];
        }
      }
    },
    'bureaucrat': function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    }) {
      const supply = match.supply;
      const l = match.supply.length;
      
      for (let i = l - 1; i >= 0; i--) {
        const card = cardLibrary.getCard(supply[i]);
        if (card.cardKey === 'silver') {
          yield new GainCardEffect({
            playerId: triggerPlayerId,
            cardId: supply[i],
            to: { location: 'playerDecks' },
            sourceCardId: triggerCardId,
            sourcePlayerId: triggerPlayerId,
          });
          break;
        }
        
        console.log('[BUREAUCRAT EFFECT] no silver in supply');
      }
      
      const playerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext[id] !== 'immunity');
      
      console.log(`[BUREAUCRAT EFFECT] targeting ${playerIds.map((id) => getPlayerById(match, id))}`);
      
      for (const playerId of playerIds) {
        let cardsToReveal = match.playerHands[playerId].filter((c) =>
          cardLibrary.getCard(c).type.includes('VICTORY')
        );
        
        if (cardsToReveal.length === 0) {
          console.log(`[BUREAUCRAT EFFECT]  ${getPlayerById(match, playerId)} has no victory cards, revealing all`);
          cardsToReveal = match.playerHands[playerId];
          for (const cardId of cardsToReveal) {
            yield new RevealCardEffect({
              playerId,
              cardId,
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId,
            });
          }
        } else {
          const cardIds = (yield new SelectCardEffect({
            prompt: 'Reveal victory card',
            playerId,
            count: 1,
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            restrict: {
              from: {
                location: 'playerHands',
              },
              card: {
                type: 'VICTORY',
              },
            },
          })) as number[];
          
          yield new RevealCardEffect({
            playerId,
            cardId: cardIds[0],
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
          });
          
          yield new MoveCardEffect({
            toPlayerId: playerId,
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            cardId: cardIds[0],
            to: {
              location: 'playerDecks',
            },
          });
        }
      }
    },
    'cellar': function* ({
      match,
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new GainActionEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
      
      const hasCards = match.playerHands[triggerPlayerId].length > 0;
      if (!hasCards) {
        console.log(`[CELLAR EFFECT] player has no cards to choose from`);
        return;
      }
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel discard',
        validPrompt: 'Confirm discard',
        playerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        count: { kind: 'upTo', count: match.playerHands[triggerPlayerId].length },
        restrict: { from: { location: 'playerHands' } },
      })) as number[];
      
      for (const cardId of cardIds) {
        yield new DiscardCardEffect({
          cardId,
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
      
      if (!cardIds.length) {
        console.log(`[CELLAR EFFECT] no cards discarded, so no cards drawn`);
        return;
      }
      
      for (let i = 0; i < (cardIds as number[]).length; i++) {
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
    },
    'chancellor': function* ({
      match,
      triggerPlayerId,
      triggerCardId
    }) {
      yield new GainTreasureEffect({ count: 2, sourceCardId: triggerCardId, sourcePlayerId: triggerPlayerId });
      
      const deck = match.playerDecks[triggerPlayerId];
      if (deck.length === 0) {
        console.log(`[CHANCELLOR EFFECT] ${getPlayerById(match, triggerPlayerId)} has no cards in deck to discard`);
        return;
      }
      
      const result = (yield new UserPromptEffect({
        prompt: 'Discard deck?',
        actionButtons: [{ label: 'NO', action: 1 }, { label: 'YES', action: 2 }],
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
      })) as { action: number };
      
      if (result.action !== 2) {
        console.log(`[CHANCELLOR EFFECT] ${getPlayerById(match, triggerPlayerId)} selected no`);
        return;
      }
      
      while (deck.length > 0) {
        const cardId = deck.slice(-1)![0];
        yield new MoveCardEffect({
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          toPlayerId: triggerPlayerId,
          cardId,
          to: { location: 'playerDiscards' },
        });
      }
    },
    'chapel': function* ({
      match,
      triggerPlayerId,
      triggerCardId,
    }) {
      const hand = match.playerHands[triggerPlayerId];
      
      if (!hand.length) {
        console.log(`[CHAPEL EFFECT] player has no cards in hand`);
        return;
      }
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel trash',
        validPrompt: 'Confirm trash',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: { kind: 'upTo', count: 4 },
        restrict: { from: { location: 'playerHands' } },
      })) as number[];
      
      if (cardIds?.length > 0) {
        for (const cardId of (cardIds as number[])) {
          yield new TrashCardEffect({
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            playerId: triggerPlayerId,
            cardId,
          });
        }
      } else {
        console.log('[CHAPEL EFFECT] no cards selected');
      }
    },
    'copper': function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new GainTreasureEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
    },
    'council-room': function* ({
      match,
      triggerPlayerId,
      triggerCardId,
    }) {
      for (let i = 0; i < 4; i++) {
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
      
      yield new GainBuyEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
      
      const playerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      );
      
      console.log(
        `[COUNCIL ROOM EFFECT] targets ${playerIds.map((id) => getPlayerById(match, id))}`,
      );
      
      for (const playerId of playerIds) {
        yield new DrawCardEffect({ playerId, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
      }
    },
    'feast': function* ({ match, cardLibrary, triggerPlayerId, triggerCardId }) {
      yield new TrashCardEffect({
        playerId: triggerPlayerId,
        cardId: triggerCardId!,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });
      
      const cardIds = (yield new SelectCardEffect({
        prompt: '',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost: { kind: 'upTo', amount: 5 },
        },
        count: 1,
      })) as number[];
      
      const cardId = cardIds?.[0];
      
      if (!isUndefined(cardId)) {
        console.log(`[FEAST EFFECT] ${getPlayerById(match, triggerPlayerId)} chose ${cardLibrary.getCard(cardId)}`);
        yield new GainCardEffect({
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          playerId: triggerPlayerId,
          cardId,
          to: {
            location: 'playerDiscards',
          },
        });
      }
    },
    'festival': function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new GainActionEffect({ count: 2, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
      yield new GainBuyEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
      yield new GainTreasureEffect({ count: 2, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
    },
    'gardens': function* () {
      // has no effects, calculates score as game plays
    },
    'gold': function* ({ triggerPlayerId, triggerCardId }) {
      yield new GainTreasureEffect({ count: 3, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
    },
    'laboratory': function* ({
      triggerPlayerId,
      triggerCardId
    }) {
      for (let i = 0; i < 2; i++) {
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
      yield new GainActionEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
    },
    'library': function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
    }) {
      // TODO: do the set aside stuff
      // 'Draw until you have 7 cards in hand, skipping any Action cards you choose to; set those aside, discarding
      // them afterward.'
      const setAside: number[] = [];
      
      const hand = match.playerHands[triggerPlayerId];
      const deck = match.playerDecks[triggerPlayerId];
      
      let newHandSize = 7;
      
      if (hand.length + deck.length < newHandSize) {
        console.log(`[LIBRARY EFFECT] total size of hand + deck is less than ${newHandSize}`);
        newHandSize = Math.min(7, hand.length + deck.length);
        console.log(`[LIBRARY EFFECT] new hand size to draw to ${newHandSize}`);
      }
      
      console.log(`[LIBRARY EFFECT] current hand size ${hand.length}`);
      console.log(`[LIBRARY EFFECT] number of set aside cards ${setAside.length}`);
      console.log(`[LIBRARY EFFECT] deck size ${deck.length}`);
      
      while (hand.length < newHandSize + setAside.length && deck.length > 0) {
        const drawnCardId = (yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        })) as number;
        
        console.log(`[LIBRARY EFFECT] drew card, new hand size ${hand.length}`);
        
        const drawnCard = cardLibrary.getCard(drawnCardId);
        
        // If it's an Action card, allow the user to decide whether to set it aside.
        if (drawnCard.type.includes('ACTION')) {
          console.log(`[LIBRARY EFFECT] card is an action card ${drawnCard}`);
          
          const shouldSetAside = (yield new UserPromptEffect({
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            playerId: triggerPlayerId,
            prompt: `You drew ${drawnCard.cardName}. Set it aside (skip putting it in your hand)?`,
            actionButtons: [{ label: 'KEEP', action: 1 }, { label: 'SET ASIDE', action: 2 }],
          })) as { action: number };
          
          if (shouldSetAside.action === 2) {
            console.log(`[LIBRARY EFFECT] setting card aside`);
          } else {
            console.log('[LIBRARY EFFECT] keeping card in hand');
          }
          
          // If user picked yes, move the card to a temporary 'aside' location, then continue.
          if (shouldSetAside.action === 2) {
            setAside.push(drawnCardId);
            console.log(`[LIBRARY EFFECT] new set aside length ${setAside.length}`);
          }
        }
      }
      
      // Finally, discard all set-aside cards.
      if (setAside.length > 0) {
        console.log(
          `[LIBRARY EFFECT] discarding set aside cards ${
            setAside.map((id) => cardLibrary.getCard(id))
          }`,
        );
        for (const cardId of setAside) {
          yield new DiscardCardEffect({
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            cardId,
            playerId: triggerPlayerId,
          });
        }
      }
    },
    'market': function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new GainActionEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });
      yield new GainBuyEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
      yield new GainTreasureEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
    },
    'militia': function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    }) {
      yield new GainTreasureEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 2 });
      
      const playerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext[id] !== 'immunity');
      
      console.log(
        `[MILITIA EFFECT] targets ${playerIds.map((id) => getPlayerById(match, id))}`,
      );
      
      for (const playerId of playerIds) {
        const handCount = match.playerHands[playerId].length;
        if (handCount > 3) {
          const cardIds = (yield new SelectCardEffect({
            prompt: 'Confirm discard',
            playerId,
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            count: handCount - 3,
            restrict: {
              from: {
                location: 'playerHands',
              },
            },
          })) as number[];
          
          console.log(
            `[MILITIA EFFECT] ${getPlayerById(match, playerId)} chose ${
              cardIds.map((id) => cardLibrary.getCard(id))
            } to discard`,
          );
          
          for (const cardId of cardIds) {
            yield new DiscardCardEffect({
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId,
              cardId,
              playerId,
            });
          }
        } else {
          console.log(`[MILITIA EFFECT] already at 3 or fewer cards`);
        }
      }
    },
    'mine': function* ({ match, cardLibrary, triggerPlayerId, triggerCardId }) {
      const hand = match.playerHands[triggerPlayerId];
      
      const hasTreasureCards = hand.some((c) =>
        cardLibrary.getCard(c).type.includes('TREASURE')
      );
      
      if (!hasTreasureCards) {
        console.log(`[MINE EFFECT] player has no treasure cards in hand`);
        return;
      }
      
      let cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel trash',
        validPrompt: 'Confirm trash',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: {
          kind: 'upTo',
          count: 1,
        },
        restrict: {
          from: { location: 'playerHands' },
          card: { type: ['TREASURE'] },
        },
      })) as number[];
      
      let cardId = cardIds[0];
      
      if (!cardId) {
        console.log(`[MINE EFFECT] player selected no card`);
        return;
      }
      
      console.log(`[MINE EFFECT] player selected ${cardLibrary.getCard(cardId)}`);
      
      yield new TrashCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        cardId,
      });
      
      const card = cardLibrary.getCard(cardId);
      
      cardIds = (yield new SelectCardEffect({
        prompt: 'Confirm gain card',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          card: { type: ['TREASURE'] },
          cost: { kind: 'upTo', amount: card.cost.treasure + 3 },
        },
      })) as number[];
      
      cardId = cardIds[0];
      
      console.log(`[MINE EFFECT] player selected ${card}`);
      
      yield new GainCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        cardId,
        to: { location: 'playerHands' },
      });
    },
    'moat': function* ({ triggerPlayerId, triggerCardId }) {
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });
    },
    'moneylender': function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
    }) {
      const hand = match.playerHands[triggerPlayerId];
      const hasCopper = hand.some((c) =>
        cardLibrary.getCard(c).cardKey === 'copper'
      );
      
      if (!hasCopper) {
        console.log(`[MONEYLENDER EFFECT] player has no copper in hand`);
        return;
      }
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel trash',
        validPrompt: 'Confirm trash',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        count: { kind: 'upTo', count: 1 },
        restrict: {
          from: { location: 'playerHands' },
          card: { cardKeys: ['copper'] },
        },
      })) as number[];
      
      if (cardIds?.length === 0) {
        console.log(`[MONEYLENDER EFFECT] player didn't choose copper`);
        return;
      }
      
      yield new TrashCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        cardId: cardIds[0],
      });
      
      yield new GainTreasureEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 3,
      });
    },
    'remodel': function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
    }) {
      if (match.playerHands[triggerPlayerId].length === 0) {
        console.log(`[REMODEL EFFECT] player has no cards in hand`);
        return;
      }
      
      let cardIds = (yield new SelectCardEffect({
        prompt: 'Confirm trash',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        count: 1,
        restrict: { from: { location: 'playerHands' } },
      })) as number[];
      
      let cardId = cardIds[0];
      const card = cardLibrary.getCard(cardId);
      
      console.log(`[REMODEL EFFECT] player chose card ${card} to trash`);
      
      yield new TrashCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        cardId: cardIds[0],
      });
      
      cardIds = (yield new SelectCardEffect({
        prompt: 'Gain card',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        count: 1,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost: { kind: 'upTo', amount: card.cost.treasure + 2 },
        },
      })) as number[];
      
      cardId = cardIds[0];
      
      console.log(
        `[REMODEL EFFECT] player chose card ${cardLibrary.getCard(cardId)} to gain`,
      );
      
      yield new GainCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        cardId,
        to: { location: 'playerDiscards' },
      });
    },
    'silver': function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new GainTreasureEffect({ count: 2, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
    },
    'smithy': function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      for (let i = 0; i < 3; i++) {
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
    },
    'spy': function* ({ match, triggerPlayerId, triggerCardId, reactionContext }) {
      yield new GainActionEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
      yield new DrawCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
      });
      
      const playerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL',
        match,
      ).filter((id) => reactionContext[id] !== 'immunity');
      
      console.log(
        `[SPY EFFECT] targets ${playerIds.map((id) => getPlayerById(match, id))}`,
      );
      
      for (const playerId of playerIds) { // loop all players
        const player = getPlayerById(match, playerId);
        let deck = match.playerDecks[playerId];
        if (deck.length === 0) {
          yield new ShuffleDeckEffect({ playerId });
          deck = match.playerDecks[playerId];
        }
        const cardId = deck.slice(-1)[0];
        
        yield new RevealCardEffect({
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          cardId,
          playerId,
        });
        
        const discard = (yield new UserPromptEffect({
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          playerId: triggerPlayerId,
          prompt: `Discard or put on ${player?.name}'s deck?`,
          actionButtons: [{ label: 'DECK', action: 1 }, { label: 'DISCARD', action: 2 }],
          content: {
            cards: {
              cardIds: [cardId],
            },
          },
        })) as { action: number; cardIds: number[] };
        
        if (discard.action === 2) {
          console.log(`[SPY EFFECT] ${getPlayerById(match, triggerPlayerId)} chose to discard`);
          yield new DiscardCardEffect({
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            cardId,
            playerId,
          });
        }
      }
    },
    'thief': function* ({ match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext }) {
      // 'Each other player reveals the top 2 cards of his deck.
      // If they revealed any Treasure cards, they trash one of them that you choose.
      // You may gain any or all of these trashed cards.
      // They discard the other revealed cards.'
      
      const targetPlayerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext[id] !== 'immunity');
      
      const cardsToGain: number[] = [];
      
      for (const playerId of targetPlayerIds) {
        let deck = match.playerDecks[playerId];
        let discard = match.playerDiscards[playerId];
        
        // num to reveal is 2 or the number of cards we have to choose from (including a reshuffle if need be)
        const numToReveal = Math.min(2, deck.length + discard.length);
        
        if (numToReveal === 0) {
          console.log(`[THIEF EFFECT] ${getPlayerById(match, playerId)} has not cards to reveal`);
          continue;
        }
        
        // shuffle discard back into deck (make sure deck is on top)
        if (deck.length < numToReveal) {
          yield new ShuffleDeckEffect({ playerId })
          deck = match.playerDecks[playerId];
          discard = match.playerDiscards[playerId];
        }
        
        const cardsToReveal = deck.slice(-numToReveal);
        
        const treasureCardIds = cardsToReveal.filter((id) =>
          cardLibrary.getCard(id).type.includes('TREASURE')
        );
        
        const cardsToDiscard = cardsToReveal.filter((id) =>
          !cardLibrary.getCard(id).type.includes('TREASURE')
        );
        
        for (const e of cardsToReveal) {
          yield new RevealCardEffect({
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            cardId: e,
            playerId,
          });
        }
        
        if (treasureCardIds.length > 0) {
          console.log(`[THIEF EFFECT] Revealed ${treasureCardIds.length} treasure cards`);
          // if more than one, choose, otherwise auto-choose the only one
          let result: number[] | { action: number; cardIds: number[] };
          if (treasureCardIds.length === 1) {
            result = [treasureCardIds[0]];
          } else {
            if (cardLibrary.getCard(treasureCardIds[0]).cardKey === cardLibrary.getCard(treasureCardIds[1]).cardKey) {
              result = [treasureCardIds[0]];
            } else {
              result = (yield new UserPromptEffect({
                content: {
                  cards: {
                    cardIds: treasureCardIds,
                    selectCount: 1,
                  },
                },
                playerId: triggerPlayerId,
                sourcePlayerId: triggerPlayerId,
                sourceCardId: triggerCardId,
                prompt: `${
                  getPlayerById(match, playerId)?.name
                } revealed these cards. Choose one to trash.`
              })) as { action: number; cardIds: number[] };
            }
          }
          
          const cardId = Array.isArray(result) ? result[0] : result.cardIds[0];
          
          console.log(
            `[THIEF EFFECT] ${getPlayerById(match, triggerPlayerId)} chose card ${cardLibrary.getCard(cardId)} to trash`,
          );
          
          yield new TrashCardEffect({
            playerId,
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            cardId,
          });
          
          cardsToGain.push(cardId);
          
          console.log(`[THIEF EFFECT] adding card ${cardLibrary.getCard(cardId)} to list to possibly gain`);
        } else {
          console.log(`[THIEF EFFECT] ${name} no treasure cards in player's hand`);
        }
        
        for (const cardId of cardsToDiscard) {
          yield new DiscardCardEffect({
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            cardId,
            playerId,
          });
        }
      }
      
      if (cardsToGain.length > 0) {
        const result = (yield new UserPromptEffect({
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          playerId: triggerPlayerId,
          prompt: 'Select which cards to keep.',
          actionButtons: [{ label: 'DONE', action: 1 }],
          content: {
            cards: {
              cardIds: cardsToGain,
              selectCount: {
                kind: 'upTo',
                count: cardsToGain.length
              },
            },
          },
        })) as { action: number; cardIds: number[] };
        
        const cardIds = result.cardIds;
        
        for (const cardId of cardIds) {
          yield new GainCardEffect({
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            playerId: triggerPlayerId,
            cardId,
            to: { location: 'playerDiscards' },
          });
        }
      }
    },
    'throne-room': function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Confirm action',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        count: { kind: 'upTo', count: 1 },
        restrict: {
          from: { location: 'playerHands' },
          card: { type: ['ACTION'] },
        },
      })) as number[];
      
      const cardId = cardIds?.[0];
      
      if (isUndefined(cardId)) {
        console.log(`[THRONE ROOM EFFECT] player chose no cards`);
        return;
      }
      
      yield new PlayCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        cardId: cardIds[0],
        playerId: triggerPlayerId,
      });
      
      yield new PlayCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        cardId: cardIds[0],
        playerId: triggerPlayerId,
      });
    },
    'village': function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new GainActionEffect({ count: 2, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });
    },
    'witch': function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    }) {
      for (let i = 0; i < 2; i++) {
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
      
      // get list of potential players
      const playerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext[id] !== 'immunity');
      
      console.log(
        `[WITCH EFFECT] targets ${playerIds.map((id) => getPlayerById(match, id))}`,
      );
      
      for (const playerId of playerIds) {
        const supply = match.supply;
        const l = supply.length;
        for (let i = l - 1; i >= 0; i--) {
          if (cardLibrary.getCard(supply[i]).cardKey === 'curse') {
            yield new GainCardEffect({
              playerId,
              cardId: supply[i],
              to: { location: 'playerDiscards' },
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId,
            });
            break;
          }
          
          console.debug('[WITCH EFFECT] no curses found in supply');
        }
      }
    },
    'woodcutter': function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new GainBuyEffect({ count: 1, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
      yield new GainTreasureEffect({ count: 2, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
    },
    'workshop': function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Gain card',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        count: 1,
        restrict: {
          cost: { kind: 'upTo', amount: 4 },
          from: { location: ['supply', 'kingdom'] },
        },
      })) as number[];
      
      const cardId = cardIds[0];
      
      yield new GainCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        cardId,
        to: { location: 'playerDiscards' },
      });
    },
  }),
};

export default expansionModule;
