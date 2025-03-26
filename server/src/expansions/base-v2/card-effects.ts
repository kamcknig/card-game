import {
  DiscardCardEffect,
  DrawCardEffect,
  GainActionEffect,
  GainBuyEffect,
  GainCardEffect,
  GainTreasureEffect,
  MoveCardEffect,
  PlayCardEffect,
  RevealCardEffect,
  SelectCardEffect, ShuffleDeckEffect,
  TrashCardEffect,
  UserPromptEffect,
} from "../../effect.ts";
import {AsyncEffectGeneratorFn, EffectGeneratorFn, LifecycleCallbackMap,} from "../../types.ts";
import {findOrderedEffectTargets} from "../../utils/find-ordered-effect-targets.ts";
import {getPlayerById} from "../../utils/get-player-by-id.ts";
import {isUndefined} from "lodash-es";
import {Match} from "shared/types.ts";
import { getGameState } from '../../utils/get-game-state.ts';

export default {
  registerCardLifeCycles: (): Record<string, LifecycleCallbackMap> => ({
    "merchant": {
      onEnterPlay: (playerId, cardId) => {
        const id = `merchant-${cardId}`;
        return {
          registerTriggers: [{
            id,
            playerId,
            once: true,
            condition: (match, trigger) => {
              const card = match.cardsById[trigger.cardId];
              return card.cardKey === 'silver' && trigger.playerId === playerId;
            },
            listeningFor: "cardPlayed",
            generatorFn: function* (_match, _trigger, _reaction) {
              yield new GainTreasureEffect({
                sourceCardId: cardId,
                sourcePlayerId: playerId,
                count: 1,
              });
            },
          }]
        }
      },
      onLeavePlay: (_playerId, cardId) => {
        return {
          unregisterTriggers: [`merchant-${cardId}`],
        }
      }
    },
    "moat": {
      onEnterHand: (playerId, cardId) => {
        return {
          registerTriggers: [{
            id: `moat-${cardId}`,
            playerId,
            listeningFor: "cardPlayed",
            condition: (match, trigger) => {
              return match.cardsById[trigger.cardId].type.includes("ATTACK") && trigger.playerId !== playerId;
            },
            generatorFn: function* (_match, trigger, reaction) {
              const results = yield new UserPromptEffect({
                confirmLabel: "YES",
                declineLabel: "NO",
                sourceCardId: trigger.cardId,
                sourcePlayerId: trigger.playerId,
                prompt: "Reveal moat?",
                playerId: reaction.playerId,
              });

              console.log("player response to reveal moat", results);

              const sourceId = reaction.getSourceId();
              if (results && sourceId) {
                yield new RevealCardEffect({
                  sourceCardId: trigger.cardId,
                  sourcePlayerId: trigger.playerId,
                  cardId: sourceId,
                  playerId: reaction.playerId,
                });
              }
              
              return results;
            },
          }]
        }
      },
      onLeaveHand: (_playerId, cardId) => {
        return {
          unregisterTriggers: [`moat-${cardId}`],
        }
      }
    },
  }),
  registerScoringFunctions: () => ({
    "gardens": function (match: Match, cardOwnerId: number) {
      const cards = match
        .playerHands[cardOwnerId]
        .concat(match.playerDecks[cardOwnerId])
        .concat(match.playerDiscards[cardOwnerId])
        .concat(match.playArea);

      return Math.floor(cards.length / 10);
    },
  }),
  registerEffects: (): Record<
    string,
    EffectGeneratorFn | AsyncEffectGeneratorFn
  > => ({
    "artisan": function* (match, sourcePlayerId, sourceCardId) {
      console.debug(`choosing card to gain...`);
      let results = (yield new SelectCardEffect({
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
        restrict: {
          from: {
            location: ['supply', 'kingdom'],
          },
          cost: {
            kind: 'upTo',
            amount: 5,
          },
        },
      })) as number[];
      let selectedCardId = results[0];
      console.debug(`card chosen ${match.cardsById[selectedCardId]}`);
      yield new GainCardEffect({
        playerId: sourcePlayerId,
        sourceCardId,
        sourcePlayerId,
        cardId: selectedCardId,
        to: {
          location: 'playerHands',
        },
      });

      console.debug(`choosing card to put on deck...`);
      results = (yield new SelectCardEffect({
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
        restrict: {
          from: {
            location: 'playerHands',
          },
        },
      })) as number[];
      selectedCardId = results[0];
      console.debug(`card chosen ${match.cardsById[selectedCardId]}`);
      yield new MoveCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        cardId: selectedCardId,
        to: {
          location: 'playerDecks',
        },
      });
    },
    "bandit": function* (matchState, sourcePlayerId, sourceCardId, reactionContext: Record<number, boolean>) {
      const cardsById = matchState.cardsById;
      const goldCardId = matchState.supply.find((c) =>
        cardsById[c].cardKey === 'gold'
      );
      if (goldCardId) {
        console.debug(`gaining a gold...`);
        const goldCard = cardsById[goldCardId];
        yield new GainCardEffect({
          sourceCardId,
          sourcePlayerId,
          playerId: sourcePlayerId,
          cardId: goldCard.id,
          to: {
            location: 'playerDiscards',
          },
        });
      } else {
        console.debug(`no gold available`);
      }

      const targetPlayerIds = findOrderedEffectTargets(
        sourcePlayerId,
        'ALL_OTHER',
        matchState,
      ).filter(id => !reactionContext[id]);

      console.debug(` ordered targets ${targetPlayerIds}`);

      for (const targetPlayerId of targetPlayerIds) {
        let playerDeck = matchState.playerDecks[targetPlayerId];
        let playerDiscard = matchState.playerDiscards[targetPlayerId];

        let numToReveal = 2;
        const totalCards = playerDiscard.length + playerDeck.length;
        numToReveal = Math.min(numToReveal, totalCards);

        if (numToReveal === 0) {
          console.debug(`player has no cards to reveal`);
          continue;
        }

        if (playerDeck.length < numToReveal) {
          console.debug(`not enough cards in deck, shuffling...`);
          
          yield new ShuffleDeckEffect({
            playerId: targetPlayerId
          });
          
          playerDeck = matchState.playerDecks[targetPlayerId];
          playerDiscard = matchState.playerDiscards[targetPlayerId];
        }

        const cardIdsToReveal = playerDeck.slice(-numToReveal);
        
        for (const cardId of cardIdsToReveal) {
          yield new RevealCardEffect({
            sourceCardId,
            sourcePlayerId,
            playerId: targetPlayerId,
            cardId,
          });
        }

        const cardsById = matchState.cardsById;
        const possibleCardsToTrash = cardIdsToReveal.filter((id) => {
          console.debug(`checking if ${cardsById[id]} can be trashed`);
          return cardsById[id].cardKey !== 'copper' && cardsById[id].type.includes('TREASURE')
        });
        
        if (possibleCardsToTrash.length > 0) {
          console.debug(`cards that can be trashed ${possibleCardsToTrash.map((cardId) => cardsById[cardId])}`);
        }
        
        const cardsToDiscard = cardIdsToReveal.filter((id) =>
          !possibleCardsToTrash.includes(id)
        );
        
        if (cardsToDiscard.length > 0) {
          console.debug(`cards that will be discarded ${cardsToDiscard.map((cardId) => cardsById[cardId])}`);
        }
        
        const cardsToTrash: number[] = [];

        let results;
        if (possibleCardsToTrash.length > 1) {
          console.debug(`prompt user to select card to trash...`);
          results = (yield new UserPromptEffect({
            sourcePlayerId,
            sourceCardId,
            playerId: targetPlayerId,
            confirmLabel: 'TRASH',
            showDeclineOption: false,
            prompt: 'Choose a treasure to trash',
            content: {
              cardSelection: {
                cardIds: possibleCardsToTrash,
              },
            },
          })) as number[];

          const selectedId = results[0];
          
          console.debug(`chose card ${cardsById[selectedId]}`);
          
          const otherCardId = possibleCardsToTrash.find((id) =>
            id !== selectedId
          );
          
          if (otherCardId) {
            cardsToDiscard.push(otherCardId);
          }
          
          cardsToTrash.push(selectedId);
        } else if (possibleCardsToTrash.length > 0) {
          cardsToTrash.push(possibleCardsToTrash[0]);
        }

        for (const cardId of cardsToTrash) {
          yield new TrashCardEffect({
            sourcePlayerId,
            sourceCardId,
            playerId: targetPlayerId,
            cardId: cardId,
          });
        }

        for (const cardId of cardsToDiscard) {
          yield new DiscardCardEffect({
            playerId: targetPlayerId,
            sourceCardId,
            sourcePlayerId,
            cardId,
          });
        }
      }
    },
    "bureaucrat": function* (matchState, sourcePlayerId, sourceCardId, reactionContext: Record<number, boolean>) {
      const supply = matchState.supply;
      const l = matchState.supply.length;

      for (let i = l - 1; i >= 0; i--) {
        const card = matchState.cardsById[supply[i]];
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
        matchState,
      ).filter(id => !reactionContext[id]);

      console.debug(name, `targeting ${playerIds.map(id => getPlayerById(id))}`);
      
      for (const playerId of playerIds) {
        let cardsToReveal = matchState.playerHands[playerId].filter((c) =>
          matchState.cardsById[c].type.includes('VICTORY')
        );
        
        if (cardsToReveal.length === 0) {
          console.debug(`${getPlayerById(playerId)} has no victory cards, revealing all`);
          cardsToReveal = matchState.playerHands[playerId];
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
            playerId,
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
    "cellar": function* (matchState, sourcePlayerId, sourceCardId) {
      yield new GainActionEffect({ sourcePlayerId, sourceCardId, count: 1 });

      const hasCards = matchState.playerHands[sourcePlayerId].length > 0;
      if (!hasCards) {
        console.debug(name, 'player has no cards to choose from');
        return;
      }

      const cardIds = (yield new SelectCardEffect({
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
    "chapel": function* (matchState, sourcePlayerId, sourceCardId) {
      const hand = matchState.playerHands[sourcePlayerId];

      if (!hand.length) {
        console.debug(`player has no cards in hand`);
        return;
      }

      const cardIds = (yield new SelectCardEffect({
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
    "copper": function* (_matchState, sourcePlayerId, sourceCardId) {
      yield new GainTreasureEffect({ sourcePlayerId, sourceCardId, count: 1 });
    },
    "council-room": function* (matchState, sourcePlayerId, sourceCardId) {
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
        matchState,
      );

      console.debug(`targets ${playerIds.map(id => getPlayerById(id))}`);
      
      for (const playerId of playerIds) {
        yield new DrawCardEffect({ playerId, sourcePlayerId, sourceCardId });
      }
    },
    "festival": function* (_matchState, sourcePlayerId, sourceCardId) {
      yield new GainActionEffect({ count: 2, sourcePlayerId, sourceCardId });
      yield new GainBuyEffect({ sourcePlayerId, sourceCardId, count: 1 });
      yield new GainTreasureEffect({ count: 2, sourcePlayerId, sourceCardId });
    },
    "gardens": function* () {
      // has no effects, calculates score as game plays
    },
    "gold": function* (_matchState, sourcePlayerId, sourceCardId) {
      yield new GainTreasureEffect({ count: 3, sourcePlayerId, sourceCardId });
    },
    "harbinger": function* (matchState, sourcePlayerId, sourceCardId) {
      yield new DrawCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
      });
      
      yield new GainActionEffect({ count: 1, sourcePlayerId, sourceCardId });

      if (matchState.playerDiscards[sourcePlayerId].length === 0) {
        console.debug('player has no cards in discard, done processing');
        return;
      }

      const results = (yield new UserPromptEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        prompt: 'Choose card to put on deck?',
        confirmLabel: 'DONE',
        declineLabel: 'NO',
        content: {
          cardSelection: {
            cardIds: matchState.playerDiscards[sourcePlayerId],
          },
        },
      })) as number[];

      const selectedId = results?.[0];
      if (selectedId) {
        yield new MoveCardEffect({
          sourcePlayerId,
          sourceCardId,
          cardId: selectedId,
          playerId: sourcePlayerId,
          to: {
            location: 'playerDecks',
          },
        });
      } else {
        console.debug('no card selected');
      }
    },
    "laboratory": function* (_matchState, sourcePlayerId, sourceCardId) {
      for (let i = 0; i < 2; i++) {
        yield new DrawCardEffect({
          playerId: sourcePlayerId,
          sourcePlayerId,
          sourceCardId,
        });
      }
      yield new GainActionEffect({ sourcePlayerId, sourceCardId, count: 1 });
    },
    "library": function* (matchState, sourcePlayerId, sourceCardId) {
      // TODO: do the set aside stuff
      // "Draw until you have 7 cards in hand, skipping any Action cards you choose to; set those aside, discarding them afterward."
      const setAside: number[] = [];

      const hand = matchState.playerHands[sourcePlayerId];
      const deck = matchState.playerDecks[sourcePlayerId];
      
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

        const drawnCard = matchState.cardsById[drawnCardId];

        // If it's an Action card, allow the user to decide whether to set it aside.
        if (drawnCard.type.includes('ACTION')) {
          console.debug(`card is an action card ${drawnCard}`);

          const shouldSetAside = (yield new UserPromptEffect({
            sourcePlayerId,
            sourceCardId,
            playerId: sourcePlayerId,
            prompt:
              `You drew ${drawnCard.cardName}. Set it aside (skip putting it in your hand)?`,
            confirmLabel: 'SET ASIDE',
            declineLabel: 'KEEP',
          })) as boolean;
          
          if (shouldSetAside) {
            console.debug(`setting card aside`);
          } else {
            console.debug('keeping card in hand');
          }
          
          // If user picked yes, move the card to a temporary 'aside' location, then continue.
          if (shouldSetAside) {
            setAside.push(drawnCardId);
            console.log(`new set aside length ${setAside.length}`);
          }
        }
      }

      // Finally, discard all set-aside cards.
      if (setAside.length > 0) {
        console.debug(`discarding set aside cards ${setAside.map(id => matchState.cardsById[id])}`);
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
    "market": function* (_matchState, sourcePlayerId, sourceCardId) {
      yield new GainActionEffect({ sourcePlayerId, sourceCardId, count: 1 });
      yield new DrawCardEffect({
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
      });
      yield new GainBuyEffect({ sourcePlayerId, sourceCardId, count: 1 });
      yield new GainTreasureEffect({ sourcePlayerId, sourceCardId, count: 1 });
    },
    "merchant": function* (_matchState, sourcePlayerId, sourceCardId) {
      yield new DrawCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
      });
      yield new GainActionEffect({
        sourcePlayerId,
        sourceCardId,
        count: 1,
      });
    },
    "militia": function* (matchState, sourcePlayerId, sourceCardId, reactionContext: Record<number, boolean>) {
      yield new GainTreasureEffect({ sourcePlayerId, sourceCardId, count: 2 });

      const playerIds = findOrderedEffectTargets(
          sourcePlayerId,
          'ALL_OTHER',
          matchState,
      ).filter(id => !reactionContext[id]);

      console.debug(`targets ${playerIds.map(id => getPlayerById(id))}`);

      for (const playerId of playerIds) {
        const handCount = matchState.playerHands[playerId].length;
        if (handCount > 3) {
          const cardIds = (yield new SelectCardEffect({
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
            `${getPlayerById(playerId)} chose ${cardIds.map(id => matchState.cardsById[id])} to discard`,
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
    "mine": function* (matchState, sourcePlayerId, sourceCardId) {
      const hand = matchState.playerHands[sourcePlayerId];
      
      const hasTreasureCards = hand.some((c) =>
        matchState.cardsById[c].type.includes('TREASURE')
      );

      if (!hasTreasureCards) {
        console.debug(`player has no treasure cards in hand`);
        return;
      }
      
      let cardIds = (yield new SelectCardEffect({
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

      console.debug(`player selected ${matchState.cardsById[cardId]}`);

      yield new TrashCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        cardId,
      });

      const card = matchState.cardsById[cardId];

      cardIds = (yield new SelectCardEffect({
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
    "moat": function* (_matchState, sourcePlayerId, sourceCardId) {
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
    "moneylender": function* (matchState, sourcePlayerId, sourceCardId) {
      const hand = matchState.playerHands[sourcePlayerId];
      const hasCopper = hand.some((c) =>
        matchState.cardsById[c].cardKey === 'copper'
      );
      
      if (!hasCopper) {
        console.debug(`player has no copper in hand`);
        return;
      }
      
      const cardIds = (yield new SelectCardEffect({
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
    "poacher": function* (matchState, sourcePlayerId, sourceCardId) {
      yield new DrawCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
      });
      
      yield new GainActionEffect({
        sourcePlayerId,
        sourceCardId,
        count: 1,
      });
      
      yield new GainTreasureEffect({
        sourcePlayerId,
        sourceCardId,
        count: 1,
      });

      // todo
      console.warn(
        'this algorithm needs to change when "piles" are properly implemented.',
      );

      const cardsById = matchState.cardsById;
      
      const allSupplyCardKeys = matchState.config.supplyCardKeys.concat(
        matchState.config.kingdomCardKeys,
      );
      
      console.debug(`original supply card piles ${allSupplyCardKeys}`);
      
      const remainingSupplyCardKeys = matchState.supply.concat(
        matchState.kingdom,
      ).map((id) => cardsById[id].cardKey).reduce((prev, cardKey) => {
        if (prev.includes(cardKey)) {
          return prev;
        }
        return prev.concat(cardKey);
      }, [] as string[]);
      
      console.debug(`remaining supply card piles ${remainingSupplyCardKeys}`);

      const emptyPileCount = allSupplyCardKeys.length -
        remainingSupplyCardKeys.length;

      console.debug(`number of empty supply piles ${emptyPileCount}`);
      
      if (emptyPileCount === 0) {
        return;
      }

      const cardIds = (yield new SelectCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        count: emptyPileCount,
        restrict: {
          from: {
            location: 'playerHands',
          },
        },
      })) as number[];

      for (const cardId of cardIds) {
        yield new DiscardCardEffect({
          sourceCardId,
          sourcePlayerId,
          playerId: sourcePlayerId,
          cardId,
        });
      }
    },
    "remodel": function* (matchState, sourcePlayerId, sourceCardId) {
      if (matchState.playerHands[sourcePlayerId].length === 0) {
        console.debug(`player has no cards in hand`);
        return;
      }

      let cardIds = (yield new SelectCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        count: 1,
        restrict: { from: { location: 'playerHands' } },
      })) as number[];

      let cardId = cardIds[0];
      const card = matchState.cardsById[cardId];

      console.debug(`player chose card ${card} to trash`);

      yield new TrashCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        cardId: cardIds[0],
      });

      cardIds = (yield new SelectCardEffect({
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
        `player chose card ${matchState.cardsById[cardId]} to gain`,
      );

      yield new GainCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        cardId,
        to: { location: 'playerDiscards' },
      });
    },
    "silver": function* (_matchState, sourcePlayerId, sourceCardId) {
      yield new GainTreasureEffect({ count: 2, sourcePlayerId, sourceCardId });
    },
    "sentry": function* (matchState, sourcePlayerId, sourceCardId) {
      yield new DrawCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
      });

      yield new GainActionEffect({
        sourcePlayerId,
        sourceCardId,
        count: 1,
      });
      
      let playerDeck = matchState.playerDecks[sourcePlayerId];
      const playerDiscard = matchState.playerDiscards[sourcePlayerId];

      let numToLookAt = 2;
      const cardCount = playerDeck.length + playerDiscard.length;
      
      if (cardCount < 2) {
        numToLookAt = Math.min(numToLookAt, cardCount);
        console.debug(`not enough cards in deck + discard, setting num to look at to ${numToLookAt}`);
      }

      if (numToLookAt === 0) {
        console.debug(`player does not have enough cards`);
        return;
      }

      if (numToLookAt < playerDeck.length) {
        console.log(`player does not have enough in deck, reshuffling`);
        
        yield new ShuffleDeckEffect({
          playerId: sourcePlayerId
        });
        
        playerDeck = matchState.playerDecks[sourcePlayerId];
      }

      let cardsToLookAtIds = playerDeck.slice(-numToLookAt);

      console.debug(`looking at cards ${cardsToLookAtIds.map(id => matchState.cardsById[id])}`);
      
      let selectedCardIds = (yield new UserPromptEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        prompt: 'Choose a card/s to trash?',
        confirmLabel: 'TRASH',
        showDeclineOption: false,
        content: {
          cardSelection: {
            cardIds: cardsToLookAtIds,
            selectCount: {
              kind: 'upTo',
              count: cardsToLookAtIds.length,
            },
          },
        },
      })) as number[];

      console.debug(`player selected ${selectedCardIds.map(id => matchState.cardsById[id])} to trash`);

      if (selectedCardIds.length > 0) {
        for (const selectedCardId of selectedCardIds) {
          yield new TrashCardEffect({
            sourcePlayerId,
            sourceCardId,
            playerId: sourcePlayerId,
            cardId: selectedCardId,
          });
        }
      }

      cardsToLookAtIds = cardsToLookAtIds.filter((id) =>
        !selectedCardIds.includes(id)
      );

      if (cardsToLookAtIds.length === 0) {
        console.debug(`all cards trashed, not selecting for discard`);
        return;
      }

      selectedCardIds = (yield new UserPromptEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        prompt: 'Choose card/s to discard?',
        confirmLabel: 'DISCARD',
        showDeclineOption: false,
        content: {
          cardSelection: {
            cardIds: cardsToLookAtIds,
            selectCount: {
              kind: 'upTo',
              count: cardsToLookAtIds.length,
            },
          },
        },
      })) as number[];

      console.debug(`player chose ${selectedCardIds.map(id => matchState.cardsById[id])} to discard`);

      for (const selectedCardId of selectedCardIds) {
        yield new DiscardCardEffect({
          sourceCardId,
          sourcePlayerId,
          playerId: sourcePlayerId,
          cardId: selectedCardId,
        });
      }
    },
    "smithy": function* (_matchState, sourcePlayerId, sourceCardId) {
      for (let i = 0; i < 3; i++) {
        yield new DrawCardEffect({
          playerId: sourcePlayerId,
          sourcePlayerId,
          sourceCardId,
        });
      }
    },
    "throne-room": function* (_matchState, sourcePlayerId, sourceCardId) {
      const cardIds = (yield new SelectCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        count: { kind: 'upTo', count: 1 },
        restrict: { from: { location: 'playerHands' }, card: { type: ['ACTION'] } },
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
    "vassal": function* (matchState, sourcePlayerId, sourceCardId) {
      yield new GainTreasureEffect({
        sourcePlayerId,
        sourceCardId,
        count: 2,
      });

      let playerDeck = matchState.playerDecks[sourcePlayerId];
      
      if (playerDeck.length === 0) {
        console.debug(`not enough cards in deck, shuffling`);
        yield new ShuffleDeckEffect({
          playerId: sourcePlayerId
        });
        playerDeck = matchState.playerDecks[sourcePlayerId];
      }

      const cardToDiscardId = playerDeck.slice(-1)?.[0];

      if (!cardToDiscardId) {
        console.debug('no cards to discard...');
        return;
      }

      yield new DiscardCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        cardId: cardToDiscardId,
      });

      const card = matchState.cardsById[cardToDiscardId];
      
      console.debug(`card discarded ${card}`);
      
      if (!card.type.includes('ACTION')) {
        console.debug(`card is not an action, done processing`);
        return;
      }
      
      const confirm = (yield new UserPromptEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        prompt: `Play card ${card.cardName}?`,
        confirmLabel: 'PLAY',
        declineLabel: 'NO',
      })) as boolean;

      if (!confirm) {
        console.debug(`player chose not to play card`);
        return;
      }

      yield new PlayCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        cardId: cardToDiscardId,
      });
    },
    "village": function* (_matchState, sourcePlayerId, sourceCardId) {
      yield new GainActionEffect({ count: 2, sourcePlayerId, sourceCardId });
      yield new DrawCardEffect({
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
      });
    },
    "witch": function* (matchState, sourcePlayerId, sourceCardId, reactionContext: Record<number, boolean>) {
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
        matchState,
      ).filter(id => !reactionContext[id]);

      console.debug(`targets ${playerIds.map(id => getPlayerById(id))}`);

      for (const playerId of playerIds) {
        const supply = matchState.supply;
        const l = supply.length;
        for (let i = l - 1; i >= 0; i--) {
          if (matchState.cardsById[supply[i]].cardKey === 'curse') {
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
    "workshop": function* (_matchState, sourcePlayerId, sourceCardId) {
      const cardIds = (yield new SelectCardEffect({
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
