import { findOrderedEffectTargets } from '../../utils/find-ordered-effect-targets.ts';
import { isUndefined } from 'es-toolkit';
import { Match } from 'shared/shared-types.ts';
import { CardLibrary } from '../../match-controller.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { DiscardCardEffect } from '../../effects/discard-card.ts';
import { DrawCardEffect } from '../../effects/draw-card.ts';
import { GainActionEffect } from '../../effects/gain-action.ts';
import { GainBuyEffect } from '../../effects/gain-buy.ts';
import { GainCardEffect } from '../../effects/gain-card.ts';
import { GainTreasureEffect } from '../../effects/gain-treasure.ts';
import { MoveCardEffect } from '../../effects/move-card.ts';
import { PlayCardEffect } from '../../effects/play-card.ts';
import { RevealCardEffect } from '../../effects/reveal-card.ts';
import { SelectCardEffect } from '../../effects/select-card.ts';
import { ShuffleDeckEffect } from '../../effects/shuffle-card.ts';
import { TrashCardEffect } from '../../effects/trash-card.ts';
import { UserPromptEffect } from '../../effects/user-prompt.ts';
import { CardExpansionModule } from '../card-expansion-module.ts';

const expansionModule: CardExpansionModule = {
  registerCardLifeCycles: () => {
    return {
      'moat': {
        onEnterHand: (playerId, cardId) => {
          return {
            registerTriggers: [{
              id: `moat-${cardId}`,
              multipleUse: false,
              playerId,
              listeningFor: 'cardPlayed',
              condition: (_match, cardLibrary, trigger) => {
                return cardLibrary
                  .getCard(trigger.cardId).type.includes('ATTACK') && trigger.playerId !== playerId;
              },
              generatorFn: function* (_match, _cardLibrary, trigger, reaction) {
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
        onLeaveHand: (_playerId, cardId) => {
          return {
            unregisterTriggers: [`moat-${cardId}`],
          };
        },
      },
    };
  },
  registerScoringFunctions: () => ({
    'gardens': function (
      match: Match,
      _cardLibrary: CardLibrary,
      cardOwnerId: number,
    ) {
      const cards = match
        .playerHands[cardOwnerId]
        .concat(match.playerDecks[cardOwnerId])
        .concat(match.playerDiscards[cardOwnerId])
        .concat(match.playArea);

      return Math.floor(cards.length / 10);
    },
  }),
  registerEffects: () => ({
    'adventurer': function* (
      matchState,
      cardLibrary,
      sourcePlayerId,
      _sourceCardId,
    ) {
      let treasuresRevealed = 0;

      let deck = matchState.playerDecks[sourcePlayerId];

      while (treasuresRevealed < 2 && deck.length > 0) {
        const cardId = deck.slice(-1)![0];
        yield new RevealCardEffect({
          playerId: sourcePlayerId,
          cardId,
          sourcePlayerId,
          sourceCardId: cardId,
        });
        const card = cardLibrary.getCard(cardId);
        if (card.type.includes('TREASURE')) {
          console.debug(`card revealed is a treasure, drawing`);
          yield new DrawCardEffect({
            playerId: sourcePlayerId,
            sourcePlayerId,
            sourceCardId: cardId,
          });
          ++treasuresRevealed;
        } else {
          console.debug('card revealed is not a treasure, discarding');
          yield new DiscardCardEffect({
            playerId: sourcePlayerId,
            cardId,
            sourcePlayerId,
            sourceCardId: cardId,
          });
        }
        
        if (deck.length === 0) {
          yield new ShuffleDeckEffect({
            playerId: sourcePlayerId
          });
          deck = matchState.playerDecks[sourcePlayerId];
        }
      }
    },
    'bureaucrat': function* (
      match,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
      reactionContext,
    ) {
      const supply = match.supply;
      const l = match.supply.length;
      
      for (let i = l - 1; i >= 0; i--) {
        const card = cardLibrary.getCard(supply[i]);
        if (card.cardKey === 'silver') {
          yield new GainCardEffect({
            playerId: sourcePlayerId,
            cardId: supply[i],
            to: { location: 'playerDecks' },
            sourceCardId,
            sourcePlayerId,
          });
          break;
        }
        
        console.debug(name, 'no silver in supply');
      }
      
      const playerIds = findOrderedEffectTargets(
        sourcePlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext[id] !== 'immunity');
      
      console.debug(
        name,
        `targeting ${playerIds.map((id) => getPlayerById(match, id))}`,
      );
      
      for (const playerId of playerIds) {
        let cardsToReveal = match.playerHands[playerId].filter((c) =>
          cardLibrary.getCard(c).type.includes('VICTORY')
        );
        
        if (cardsToReveal.length === 0) {
          console.debug(
            `${
              getPlayerById(match, playerId)
            } has no victory cards, revealing all`,
          );
          cardsToReveal = match.playerHands[playerId];
          for (const cardId of cardsToReveal) {
            yield new RevealCardEffect({
              playerId,
              cardId,
              sourcePlayerId,
              sourceCardId,
            });
          }
        } else {
          const cardIds = (yield new SelectCardEffect({
            prompt: 'Reveal victory card',
            playerId,
            count: 1,
            sourcePlayerId,
            sourceCardId,
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
            sourcePlayerId,
            sourceCardId,
          });
          
          yield new MoveCardEffect({
            toPlayerId: playerId,
            sourceCardId,
            sourcePlayerId,
            cardId: cardIds[0],
            to: {
              location: 'playerDecks',
            },
          });
        }
      }
    },
    'cellar': function* (
      match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainActionEffect({ sourcePlayerId, sourceCardId, count: 1 });
      
      const hasCards = match.playerHands[sourcePlayerId].length > 0;
      if (!hasCards) {
        console.debug(name, 'player has no cards to choose from');
        return;
      }
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel discard',
        validPrompt: 'Confirm discard',
        playerId: sourcePlayerId,
        sourceCardId,
        sourcePlayerId,
        count: { kind: 'variable' },
        restrict: { from: { location: 'playerHands' } },
      })) as number[];
      
      for (const cardId of cardIds) {
        yield new DiscardCardEffect({
          cardId,
          playerId: sourcePlayerId,
          sourceCardId,
          sourcePlayerId,
        });
      }
      
      if (!cardIds.length) {
        console.debug(name, 'no cards discarded, so no cards drawn');
        return;
      }
      
      for (let i = 0; i < (cardIds as number[]).length; i++) {
        yield new DrawCardEffect({
          playerId: sourcePlayerId,
          sourcePlayerId,
          sourceCardId,
        });
      }
    },
    'chancellor': function* (
      matchState,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainTreasureEffect({ count: 2, sourceCardId, sourcePlayerId });

      const deck = matchState.playerDecks[sourcePlayerId];
      if (deck.length === 0) {
        console.debug(`${getPlayerById(matchState, sourcePlayerId)} has no cards in deck to discard`);
        return;
      }

      const result = (yield new UserPromptEffect({
        prompt: 'Discard deck?',
        actionButtons: [{label: 'NO', action: 1}, {label: 'YES', action: 2}],
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
      })) as { action: number };

      if (result.action !== 2) {
        console.debug(`${getPlayerById(matchState, sourcePlayerId)} selected no`);
        return;
      }

      while (deck.length > 0) {
        const cardId = deck.slice(-1)![0];
        yield new MoveCardEffect({
          sourcePlayerId,
          sourceCardId,
          toPlayerId: sourcePlayerId,
          cardId,
          to: { location: 'playerDiscards' },
        });
      }
    },
    'chapel': function* (
      match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      const hand = match.playerHands[sourcePlayerId];
      
      if (!hand.length) {
        console.debug(`player has no cards in hand`);
        return;
      }
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel trash',
        validPrompt: 'Confirm trash',
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
        count: { kind: 'upTo', count: 4 },
        restrict: { from: { location: 'playerHands' } },
      })) as number[];
      
      if (cardIds?.length > 0) {
        for (const cardId of (cardIds as number[])) {
          yield new TrashCardEffect({
            sourcePlayerId,
            sourceCardId,
            playerId: sourcePlayerId,
            cardId,
          });
        }
      } else {
        console.debug('no cards selected');
      }
    },
    'copper': function* (
      _matchState,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainTreasureEffect({ sourcePlayerId, sourceCardId, count: 1 });
    },
    'council-room': function* (
      match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      for (let i = 0; i < 4; i++) {
        yield new DrawCardEffect({
          playerId: sourcePlayerId,
          sourcePlayerId,
          sourceCardId,
        });
      }
      
      yield new GainBuyEffect({ sourcePlayerId, sourceCardId, count: 1 });
      
      const playerIds = findOrderedEffectTargets(
        sourcePlayerId,
        'ALL_OTHER',
        match,
      );
      
      console.debug(
        `targets ${playerIds.map((id) => getPlayerById(match, id))}`,
      );
      
      for (const playerId of playerIds) {
        yield new DrawCardEffect({ playerId, sourcePlayerId, sourceCardId });
      }
    },
    'feast': function* (matchState, cardLibrary, sourcePlayerId, sourceCardId) {
      yield new TrashCardEffect({
        playerId: sourcePlayerId,
        cardId: sourceCardId!,
        sourceCardId,
        sourcePlayerId,
      });

      const cardIds = (yield new SelectCardEffect({
        prompt: '',
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost: { kind: 'upTo', amount: 5 },
        },
        count: 1,
      })) as number[];

      const cardId = cardIds?.[0];
      
      if (!isUndefined(cardId)) {
        console.debug(`${getPlayerById(matchState, sourcePlayerId)} chose ${cardLibrary.getCard(cardId)}`);
        yield new GainCardEffect({
          sourcePlayerId,
          sourceCardId,
          playerId: sourcePlayerId,
          cardId,
          to: {
            location: 'playerDiscards',
          },
        });
      }
    },
    'festival': function* (
      _match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainActionEffect({ count: 2, sourcePlayerId, sourceCardId });
      yield new GainBuyEffect({ sourcePlayerId, sourceCardId, count: 1 });
      yield new GainTreasureEffect({ count: 2, sourcePlayerId, sourceCardId });
    },
    'gardens': function* () {
      // has no effects, calculates score as game plays
    },
    'gold': function* (_matchState, _cardLibrary, sourcePlayerId, sourceCardId) {
      yield new GainTreasureEffect({ count: 3, sourcePlayerId, sourceCardId });
    },
    'laboratory': function* (
      _match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      for (let i = 0; i < 2; i++) {
        yield new DrawCardEffect({
          playerId: sourcePlayerId,
          sourcePlayerId,
          sourceCardId,
        });
      }
      yield new GainActionEffect({ sourcePlayerId, sourceCardId, count: 1 });
    },
    'library': function* (
      match,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      // TODO: do the set aside stuff
      // 'Draw until you have 7 cards in hand, skipping any Action cards you choose to; set those aside, discarding them afterward.'
      const setAside: number[] = [];
      
      const hand = match.playerHands[sourcePlayerId];
      const deck = match.playerDecks[sourcePlayerId];
      
      let newHandSize = 7;
      
      if (hand.length + deck.length < newHandSize) {
        console.debug(`total size of hand + deck is less than ${newHandSize}`);
        newHandSize = Math.min(7, hand.length + deck.length);
        console.debug(`new hand size to draw to ${newHandSize}`);
      }
      
      console.debug(`current hand size ${hand.length}`);
      console.debug(`number of set aside cards ${setAside.length}`);
      console.debug(`deck size ${deck.length}`);
      
      while (hand.length < newHandSize + setAside.length && deck.length > 0) {
        const drawnCardId = (yield new DrawCardEffect({
          playerId: sourcePlayerId,
          sourceCardId,
          sourcePlayerId,
        })) as number;
        
        console.debug(`drew card, new hand size ${hand.length}`);
        
        const drawnCard = cardLibrary.getCard(drawnCardId);
        
        // If it's an Action card, allow the user to decide whether to set it aside.
        if (drawnCard.type.includes('ACTION')) {
          console.debug(`card is an action card ${drawnCard}`);
          
          const shouldSetAside = (yield new UserPromptEffect({
            sourcePlayerId,
            sourceCardId,
            playerId: sourcePlayerId,
            prompt: `You drew ${drawnCard.cardName}. Set it aside (skip putting it in your hand)?`,
            actionButtons: [{label: 'KEEP', action: 1}, {label: 'SET ASIDE', action: 2}],
          })) as { action: number };
          
          if (shouldSetAside.action === 2) {
            console.debug(`setting card aside`);
          } else {
            console.debug('keeping card in hand');
          }
          
          // If user picked yes, move the card to a temporary 'aside' location, then continue.
          if (shouldSetAside.action === 2) {
            setAside.push(drawnCardId);
            console.log(`new set aside length ${setAside.length}`);
          }
        }
      }
      
      // Finally, discard all set-aside cards.
      if (setAside.length > 0) {
        console.debug(
          `discarding set aside cards ${
            setAside.map((id) => cardLibrary.getCard(id))
          }`,
        );
        for (const cardId of setAside) {
          yield new DiscardCardEffect({
            sourceCardId,
            sourcePlayerId,
            cardId,
            playerId: sourcePlayerId,
          });
        }
      }
    },
    'market': function* (
      _match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainActionEffect({ sourcePlayerId, sourceCardId, count: 1 });
      yield new DrawCardEffect({
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
      });
      yield new GainBuyEffect({ sourcePlayerId, sourceCardId, count: 1 });
      yield new GainTreasureEffect({ sourcePlayerId, sourceCardId, count: 1 });
    },
    'militia': function* (
      match,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
      reactionContext,
    ) {
      yield new GainTreasureEffect({ sourcePlayerId, sourceCardId, count: 2 });
      
      const playerIds = findOrderedEffectTargets(
        sourcePlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext[id] !== 'immunity');
      
      console.debug(
        `targets ${playerIds.map((id) => getPlayerById(match, id))}`,
      );
      
      for (const playerId of playerIds) {
        const handCount = match.playerHands[playerId].length;
        if (handCount > 3) {
          const cardIds = (yield new SelectCardEffect({
            prompt: 'Confirm discard',
            playerId,
            sourceCardId,
            sourcePlayerId,
            count: handCount - 3,
            restrict: {
              from: {
                location: 'playerHands',
              },
            },
          })) as number[];
          
          console.log(
            `${getPlayerById(match, playerId)} chose ${
              cardIds.map((id) => cardLibrary.getCard(id))
            } to discard`,
          );
          
          for (const cardId of cardIds) {
            yield new DiscardCardEffect({
              sourceCardId,
              sourcePlayerId,
              cardId,
              playerId,
            });
          }
        } else {
          console.debug(`already at 3 or fewer cards`);
        }
      }
    },
    'mine': function* (match, cardLibrary, sourcePlayerId, sourceCardId) {
      const hand = match.playerHands[sourcePlayerId];
      
      const hasTreasureCards = hand.some((c) =>
        cardLibrary.getCard(c).type.includes('TREASURE')
      );
      
      if (!hasTreasureCards) {
        console.debug(`player has no treasure cards in hand`);
        return;
      }
      
      let cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel trash',
        validPrompt: 'Confirm trash',
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
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
        console.debug(`player selected no card`);
        return;
      }
      
      console.debug(`player selected ${cardLibrary.getCard(cardId)}`);
      
      yield new TrashCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        cardId,
      });
      
      const card = cardLibrary.getCard(cardId);
      
      cardIds = (yield new SelectCardEffect({
        prompt: 'Confirm gain card',
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
        count: 1,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          card: { type: ['TREASURE'] },
          cost: { kind: 'upTo', amount: card.cost.treasure + 3 },
        },
      })) as number[];
      
      cardId = cardIds[0];
      
      console.debug(`player selected ${card}`);
      
      yield new GainCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        cardId,
        to: { location: 'playerHands' },
      });
    },
    'moat': function* (_match, _cardLibrary, sourcePlayerId, sourceCardId) {
      yield new DrawCardEffect({
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
      });
      yield new DrawCardEffect({
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
      });
    },
    'moneylender': function* (
      match,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      const hand = match.playerHands[sourcePlayerId];
      const hasCopper = hand.some((c) =>
        cardLibrary.getCard(c).cardKey === 'copper'
      );
      
      if (!hasCopper) {
        console.debug(`player has no copper in hand`);
        return;
      }
      
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel trash',
        validPrompt: 'Confirm trash',
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        count: { kind: 'upTo', count: 1 },
        restrict: {
          from: { location: 'playerHands' },
          card: { cardKeys: ['copper'] },
        },
      })) as number[];
      
      if (cardIds?.length === 0) {
        console.debug(`player didn't choose copper`);
        return;
      }
      
      yield new TrashCardEffect({
        playerId: sourcePlayerId,
        sourceCardId,
        sourcePlayerId,
        cardId: cardIds[0],
      });
      
      yield new GainTreasureEffect({
        sourcePlayerId,
        sourceCardId,
        count: 3,
      });
    },
    'remodel': function* (
      match,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      if (match.playerHands[sourcePlayerId].length === 0) {
        console.debug(`player has no cards in hand`);
        return;
      }
      
      let cardIds = (yield new SelectCardEffect({
        prompt: 'Confirm trash',
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        count: 1,
        restrict: { from: { location: 'playerHands' } },
      })) as number[];
      
      let cardId = cardIds[0];
      const card = cardLibrary.getCard(cardId);
      
      console.debug(`player chose card ${card} to trash`);
      
      yield new TrashCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        cardId: cardIds[0],
      });
      
      cardIds = (yield new SelectCardEffect({
        prompt: 'Gain card',
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        count: 1,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost: { kind: 'upTo', amount: card.cost.treasure + 2 },
        },
      })) as number[];
      
      cardId = cardIds[0];
      
      console.debug(
        `player chose card ${cardLibrary.getCard(cardId)} to gain`,
      );
      
      yield new GainCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        cardId,
        to: { location: 'playerDiscards' },
      });
    },
    'silver': function* (
      _matchState,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainTreasureEffect({ count: 2, sourcePlayerId, sourceCardId });
    },
    'smithy': function* (
      _match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      for (let i = 0; i < 3; i++) {
        yield new DrawCardEffect({
          playerId: sourcePlayerId,
          sourcePlayerId,
          sourceCardId,
        });
      }
    },
    'spy': function* (matchState, _cardLibrary, sourcePlayerId, sourceCardId, reactionContext) {
      yield new GainActionEffect({ sourcePlayerId, sourceCardId, count: 1 });
      yield new DrawCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
      });

      const playerIds = findOrderedEffectTargets(
        sourcePlayerId,
        'ALL',
        matchState,
      ).filter((id) => reactionContext[id] !== 'immunity');
      
      console.debug(
        `targets ${playerIds.map((id) => getPlayerById(matchState, id))}`,
      );
      
      for (const playerId of playerIds) { // loop all players
        const player = getPlayerById(matchState, playerId);
        let deck = matchState.playerDecks[playerId];
        if (deck.length === 0) {
          yield new ShuffleDeckEffect({playerId});
          deck = matchState.playerDecks[playerId];
        }
        const cardId = deck.slice(-1)[0];

        yield new RevealCardEffect({
          sourcePlayerId,
          sourceCardId,
          cardId,
          playerId,
        });

        const discard = (yield new UserPromptEffect({
          sourceCardId,
          sourcePlayerId,
          playerId: sourcePlayerId,
          prompt: `Discard or put on ${player?.name}'s deck?`,
          actionButtons: [{label: 'DECK', action: 1}, {label: 'DISCARD', action: 2}],
          content: {
            cardSelection: {
              cardIds: [cardId],
            },
          },
        })) as { action: number; cardIds: number[] };

        if (discard.action === 2) {
          console.debug(`${getPlayerById(matchState, sourcePlayerId)} chose to discard`);
          yield new DiscardCardEffect({
            sourceCardId,
            sourcePlayerId,
            cardId,
            playerId,
          });
        }
      }
    },
    'thief': function* (matchState, cardLibrary, sourcePlayerId, sourceCardId, reactionContext) {
      // 'Each other player reveals the top 2 cards of his deck.
      // If they revealed any Treasure cards, they trash one of them that you choose.
      // You may gain any or all of these trashed cards.
      // They discard the other revealed cards.'

      const targetPlayerIds = findOrderedEffectTargets(
        sourcePlayerId,
        'ALL_OTHER',
        matchState,
      ).filter((id) => reactionContext[id] !== 'immunity');
      
      const cardsToGain: number[] = [];

      for (const playerId of targetPlayerIds) {
        let deck = matchState.playerDecks[playerId];
        let discard = matchState.playerDiscards[playerId];

        // num to reveal is 2 or the number of cards we have to choose from (including a reshuffle if need be)
        const numToReveal = Math.min(2, deck.length + discard.length);

        if (numToReveal === 0) {
          console.log(`${getPlayerById(matchState, playerId)} has not cards to reveal`);
          continue;
        }

        // shuffle discard back into deck (make sure deck is on top)
        if (deck.length < numToReveal) {
          yield new ShuffleDeckEffect({playerId})
          deck = matchState.playerDecks[playerId];
          discard = matchState.playerDiscards[playerId];
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
            sourcePlayerId,
            sourceCardId,
            cardId: e,
            playerId,
          });
        }

        if (treasureCardIds.length > 0) {
          console.debug(`Revealed ${treasureCardIds.length} treasure cards`);
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
                  cardSelection: {
                    cardIds: treasureCardIds,
                    selectCount: 1,
                  },
                },
                playerId: sourcePlayerId,
                sourcePlayerId,
                sourceCardId,
                prompt: `${
                  getPlayerById(matchState, playerId)?.name
                } revealed these cards. Choose one to trash.`
              })) as { action: number; cardIds: number[] };
            }
          }
          
          const cardId = Array.isArray(result) ? result[0] : result.cardIds[0];

          console.debug(
            `${getPlayerById(matchState, sourcePlayerId)} chose card ${cardLibrary.getCard(cardId)} to trash`,
          );

          yield new TrashCardEffect({
            playerId,
            sourcePlayerId,
            sourceCardId,
            cardId,
          });

          cardsToGain.push(cardId);
          
          console.debug(`adding card ${cardLibrary.getCard(cardId)} to list to possibly gain`);
        } else {
          console.debug(`${name} no treasure cards in player's hand`);
        }

        for (const cardId of cardsToDiscard) {
          yield new DiscardCardEffect({
            sourceCardId,
            sourcePlayerId,
            cardId,
            playerId,
          });
        }
      }

      if (cardsToGain.length > 0) {
        const result = (yield new UserPromptEffect({
          sourceCardId,
          sourcePlayerId,
          playerId: sourcePlayerId,
          prompt: 'Select which cards to keep.',
          actionButtons: [{label: 'DONE', action: 1}],
          content: {
            cardSelection: {
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
            sourcePlayerId,
            sourceCardId,
            playerId: sourcePlayerId,
            cardId,
            to: { location: 'playerDiscards' },
          });
        }
      }
    },
    'throne-room': function* (
      _match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Confirm action',
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        count: { kind: 'upTo', count: 1 },
        restrict: {
          from: { location: 'playerHands' },
          card: { type: ['ACTION'] },
        },
      })) as number[];
      
      const cardId = cardIds?.[0];
      
      if (isUndefined(cardId)) {
        console.debug(`player chose no cards`);
        return;
      }
      
      yield new PlayCardEffect({
        sourceCardId,
        sourcePlayerId,
        cardId: cardIds[0],
        playerId: sourcePlayerId,
      });
      
      yield new PlayCardEffect({
        sourceCardId,
        sourcePlayerId,
        cardId: cardIds[0],
        playerId: sourcePlayerId,
      });
    },
    'village': function* (
      _match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainActionEffect({ count: 2, sourcePlayerId, sourceCardId });
      yield new DrawCardEffect({
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
      });
    },
    'witch': function* (
      match,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
      reactionContext,
    ) {
      for (let i = 0; i < 2; i++) {
        yield new DrawCardEffect({
          playerId: sourcePlayerId,
          sourcePlayerId,
          sourceCardId,
        });
      }
      
      // get list of potential players
      const playerIds = findOrderedEffectTargets(
        sourcePlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext[id] !== 'immunity');
      
      console.debug(
        `targets ${playerIds.map((id) => getPlayerById(match, id))}`,
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
              sourcePlayerId,
              sourceCardId,
            });
            break;
          }
          
          console.debug('no curses found in supply');
        }
      }
    },
    'woodcutter': function* (
      _matchState,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainBuyEffect({ count: 1, sourcePlayerId, sourceCardId });
      yield new GainTreasureEffect({ count: 2, sourcePlayerId, sourceCardId });
    },
    'workshop': function* (
      _match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Gain card',
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        count: 1,
        restrict: {
          cost: { kind: 'upTo', amount: 4 },
          from: { location: ['supply', 'kingdom'] },
        },
      })) as number[];
      
      const cardId = cardIds[0];
      
      yield new GainCardEffect({
        playerId: sourcePlayerId,
        sourceCardId,
        sourcePlayerId,
        cardId,
        to: { location: 'playerDiscards' },
      });
    },
  }),
};

export default expansionModule;
