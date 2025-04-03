import { findOrderedEffectTargets } from '../../utils/find-ordered-effect-targets.ts';
import { isUndefined } from 'lodash-es';
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
  registerCardLifeCycles: () => ({
    'merchant': {
      onEnterPlay: ({ playerId, cardId }) => {
        const id = `merchant-${cardId}`;
        return {
          registerTriggers: [{
            id,
            playerId,
            once: true,
            condition: ({ cardLibrary, trigger }) => {
              const card = cardLibrary.getCard(trigger.cardId);
              return card.cardKey === 'silver' && trigger.playerId === playerId;
            },
            listeningFor: 'cardPlayed',
            generatorFn: function* () {
              yield new GainTreasureEffect({
                sourceCardId: cardId,
                sourcePlayerId: playerId,
                count: 1,
              });
            },
          }],
        };
      },
      onLeavePlay: ({ cardId }) => {
        return {
          unregisterTriggers: [`merchant-${cardId}`],
        };
      },
    },
    'moat': {
      onEnterHand: ({ playerId, cardId }) => {
        return {
          registerTriggers: [{
            id: `moat-${cardId}`,
            playerId,
            multipleUse: false,
            listeningFor: 'cardPlayed',
            condition: ({ cardLibrary, trigger }) => {
              return cardLibrary.getCard(trigger.cardId).type.includes(
                'ATTACK',
              ) && trigger.playerId !== playerId;
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
  }),
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
    'artisan': function* ({cardLibrary, triggerPlayerId, triggerCardId}) {
      console.debug(`[ARTISAN EFFECT] choosing card to gain...`);
      let results = (yield new SelectCardEffect({
        prompt: 'Choose card to gain',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerPlayerId,
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
      console.debug(`[ARTISAN EFFECT] card chosen ${cardLibrary.getCard(selectedCardId)}`);
      yield new GainCardEffect({
        playerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        cardId: selectedCardId,
        to: {
          location: 'playerHands',
        },
      });

      console.debug(`[ARTISAN EFFECT] choosing card to put on deck...`);
      results = (yield new SelectCardEffect({
        prompt: 'Confirm top-deck card',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        restrict: {
          from: {
            location: 'playerHands',
          },
        },
      })) as number[];
      selectedCardId = results[0];
      console.debug(`[ARTISAN EFFECT] card chosen ${cardLibrary.getCard(selectedCardId)}`);
      yield new MoveCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        toPlayerId: triggerPlayerId,
        cardId: selectedCardId,
        to: {
          location: 'playerDecks',
        },
      });
    },
    'bandit': function* ({
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext
    }) {
      const goldCardId = match.supply.find((c) =>
        cardLibrary.getCard(c).cardKey === 'gold'
      );
      if (goldCardId) {
        console.debug(`[BANDIT EFFECT] gaining a gold...`);
        const goldCard = cardLibrary.getCard(goldCardId);
        yield new GainCardEffect({
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
          cardId: goldCard.id,
          to: {
            location: 'playerDiscards',
          },
        });
      } else {
        console.debug(`[BANDIT EFFECT] no gold available`);
      }

      const targetPlayerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext[id] !== 'immunity');

      console.debug(`[BANDIT EFFECT] ordered targets ${targetPlayerIds}`);

      for (const targetPlayerId of targetPlayerIds) {
        let playerDeck = match.playerDecks[targetPlayerId];
        let playerDiscard = match.playerDiscards[targetPlayerId];

        let numToReveal = 2;
        const totalCards = playerDiscard.length + playerDeck.length;
        numToReveal = Math.min(numToReveal, totalCards);

        if (numToReveal === 0) {
          console.debug(`[BANDIT EFFECT] player has no cards to reveal`);
          continue;
        }

        if (playerDeck.length < numToReveal) {
          console.debug(`[BANDIT EFFECT] not enough cards in deck, shuffling...`);

          yield new ShuffleDeckEffect({
            playerId: targetPlayerId,
          });

          playerDeck = match.playerDecks[targetPlayerId];
          playerDiscard = match.playerDiscards[targetPlayerId];
        }

        const cardIdsToReveal = playerDeck.slice(-numToReveal);

        for (const cardId of cardIdsToReveal) {
          yield new RevealCardEffect({
            sourceCardId: triggerCardId,
            sourcePlayerId: triggerPlayerId,
            playerId: targetPlayerId,
            cardId,
          });
        }

        const possibleCardsToTrash = cardIdsToReveal.filter((id) => {
          console.debug(
            `[BANDIT EFFECT] checking if ${cardLibrary.getCard(id)} can be trashed`,
          );
          return cardLibrary.getCard(id).cardKey !== 'copper' &&
            cardLibrary.getCard(id).type.includes('TREASURE');
        });

        if (possibleCardsToTrash.length > 0) {
          console.debug(
            `[BANDIT EFFECT] cards that can be trashed ${
              possibleCardsToTrash.map((cardId) => cardLibrary.getCard(cardId))
            }`,
          );
        }

        const cardsToDiscard = cardIdsToReveal.filter((id) =>
          !possibleCardsToTrash.includes(id)
        );

        if (cardsToDiscard.length > 0) {
          console.debug(
            `[BANDIT EFFECT] cards that will be discarded ${
              cardsToDiscard.map((cardId) => cardLibrary.getCard(cardId))
            }`,
          );
        }

        const cardsToTrash: number[] = [];

        let results;
        if (possibleCardsToTrash.length > 1) {
          console.debug(`[BANDIT EFFECT] prompt user to select card to trash...`);
          results = (yield new UserPromptEffect({
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            playerId: targetPlayerId,
            prompt: 'Choose a treasure to trash',
            content: {
              cards: {
                cardIds: possibleCardsToTrash,
                selectCount: 1
              },
            },
          })) as { action: number, cardIds: number[] };

          const selectedId = results.cardIds?.[0];

          console.debug(`[BANDIT EFFECT] chose card ${cardLibrary.getCard(selectedId)}`);

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
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            playerId: targetPlayerId,
            cardId: cardId,
          });
        }

        for (const cardId of cardsToDiscard) {
          yield new DiscardCardEffect({
            playerId: targetPlayerId,
            sourceCardId: triggerCardId,
            sourcePlayerId: triggerPlayerId,
            cardId,
          });
        }
      }
    },
    'bureaucrat': function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
      reactionContext
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

        console.debug('[BUREAUCRAT EFFECT] no silver in supply');
      }

      const playerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext[id] !== 'immunity');

      console.debug(
        `[BUREAUCRAT EFFECT] targeting ${playerIds.map((id) => getPlayerById(match, id))}`,
      );

      for (const playerId of playerIds) {
        let cardsToReveal = match.playerHands[playerId].filter((c) =>
          cardLibrary.getCard(c).type.includes('VICTORY')
        );

        if (cardsToReveal.length === 0) {
          console.debug(
            `[BUREAUCRAT EFFECT] ${
              getPlayerById(match, playerId)
            } has no victory cards, revealing all`,
          );
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
            sourceCardId: triggerCardId,
            sourcePlayerId: triggerPlayerId,
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
      triggerPlayerId, triggerCardId,
    }) {
      yield new GainActionEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });

      const hasCards = match.playerHands[triggerPlayerId].length > 0;
      if (!hasCards) {
        console.debug('[CELLAR EFFECT] player has no cards to choose from');
        return;
      }

      const cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel discard',
        validPrompt: 'Confirm discard',
        playerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        count: { kind: 'variable' },
        restrict: { from: { location: 'playerHands' } },
      })) as number[];

      for (const cardId of cardIds) {
        yield new DiscardCardEffect({
          cardId,
          playerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
        });
      }

      if (!cardIds.length) {
        console.debug('[CELLAR EFFECT] no cards discarded, so no cards drawn');
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
    'chapel': function* ({
      match,
      triggerPlayerId, triggerCardId,
    }) {
      const hand = match.playerHands[triggerPlayerId];

      if (!hand.length) {
        console.debug(`[CHAPEL EFFECT] player has no cards in hand`);
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
        console.debug('[CHAPEL EFFECT] no cards selected');
      }
    },
    'council-room': function* ({
      match,
      triggerPlayerId, triggerCardId,
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

      console.debug(
        `[COUNCIL ROOM EFFECT] targets ${playerIds.map((id) => getPlayerById(match, id))}`,
      );

      for (const playerId of playerIds) {
        yield new DrawCardEffect({ playerId, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
      }
    },
    'festival': function* ({
      triggerPlayerId, triggerCardId,
    }) {
      yield new GainActionEffect({ count: 2, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
      yield new GainBuyEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 1 });
      yield new GainTreasureEffect({ count: 2, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });
    },
    'gardens': function* () {
      // has no effects, calculates score as game plays
    },
    'harbinger': function* ({
      match,
      triggerPlayerId, triggerCardId,
    }) {
      yield new DrawCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
      });

      yield new GainActionEffect({ count: 1, sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId });

      if (match.playerDiscards[triggerPlayerId].length === 0) {
        console.debug('[HARBINGER EFFECT] player has no cards in discard, done processing');
        return;
      }

      const results = (yield new UserPromptEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        prompt: 'Choose card to put on deck?',
        actionButtons: [{label: 'CANCEL', action: 2}],
        validationAction: 1,
        content: {
          cards: {
            cardIds: match.playerDiscards[triggerPlayerId],
            selectCount: 1
          },
        },
      })) as { action: number, cardIds: number[] };

      const selectedId = results?.cardIds?.[0];
      if (selectedId) {
        yield new MoveCardEffect({
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          cardId: selectedId,
          toPlayerId: triggerPlayerId,
          to: {
            location: 'playerDecks',
          },
        });
      } else {
        console.debug('[HARBINGER EFFECT] no card selected');
      }
    },
    'laboratory': function* ({
      triggerPlayerId, triggerCardId,
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
      triggerPlayerId, triggerCardId,
    }) {
      // TODO: do the set aside stuff
      // 'Draw until you have 7 cards in hand, skipping any Action cards you choose to; set those aside, discarding them afterward.'
      const setAside: number[] = [];

      const hand = match.playerHands[triggerPlayerId];
      const deck = match.playerDecks[triggerPlayerId];

      let newHandSize = 7;

      if (hand.length + deck.length < newHandSize) {
        console.debug(`[LIBRARY EFFECT] total size of hand + deck is less than ${newHandSize}`);
        newHandSize = Math.min(7, hand.length + deck.length);
        console.debug(`[LIBRARY EFFECT] new hand size to draw to ${newHandSize}`);
      }

      console.debug(`[LIBRARY EFFECT] current hand size ${hand.length}`);
      console.debug(`[LIBRARY EFFECT] number of set aside cards ${setAside.length}`);
      console.debug(`[LIBRARY EFFECT] deck size ${deck.length}`);

      while (hand.length < newHandSize + setAside.length && deck.length > 0) {
        const drawnCardId = (yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
        })) as number;

        console.debug(`[LIBRARY EFFECT] drew card, new hand size ${hand.length}`);

        const drawnCard = cardLibrary.getCard(drawnCardId);

        // If it's an Action card, allow the user to decide whether to set it aside.
        if (drawnCard.type.includes('ACTION')) {
          console.debug(`[LIBRARY EFFECT] card is an action card ${drawnCard}`);

          const shouldSetAside = (yield new UserPromptEffect({
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            playerId: triggerPlayerId,
            prompt: `You drew ${drawnCard.cardName}. Set it aside (skip putting it in your hand)?`,
            actionButtons: [{label: 'KEEP', action: 1}, {label: 'SET ASIDE', action: 2}],
          })) as { action: number };

          if (shouldSetAside.action === 2) {
            console.debug(`[LIBRARY EFFECT] setting card aside`);
          } else {
            console.debug('[LIBRARY EFFECT] keeping card in hand');
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
        console.debug(
          `[LIBRARY EFFECT] discarding set aside cards ${
            setAside.map((id) => cardLibrary.getCard(id))
          }`,
        );
        for (const cardId of setAside) {
          yield new DiscardCardEffect({
            sourceCardId: triggerCardId,
            sourcePlayerId: triggerPlayerId,
            cardId,
            playerId: triggerPlayerId,
          });
        }
      }
    },
    'market': function* ({
      triggerPlayerId, triggerCardId,
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
    'merchant': function* ({
      triggerPlayerId, triggerCardId,
    }) {
      yield new DrawCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
      });
      yield new GainActionEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
      });
    },
    'militia': function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
      reactionContext
    }) {
      yield new GainTreasureEffect({ sourcePlayerId: triggerPlayerId, sourceCardId: triggerCardId, count: 2 });

      const playerIds = findOrderedEffectTargets(
        triggerPlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => reactionContext[id] !== 'immunity');

      console.debug(
        `[MILITIA EFFECT] targets ${playerIds.map((id) => getPlayerById(match, id))}`,
      );

      for (const playerId of playerIds) {
        const handCount = match.playerHands[playerId].length;
        if (handCount > 3) {
          const cardIds = (yield new SelectCardEffect({
            prompt: 'Confirm discard',
            playerId,
            sourceCardId: triggerCardId,
            sourcePlayerId: triggerPlayerId,
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
              sourceCardId: triggerCardId,
              sourcePlayerId: triggerPlayerId,
              cardId,
              playerId,
            });
          }
        } else {
          console.debug(`[MILITIA EFFECT] already at 3 or fewer cards`);
        }
      }
    },
    'mine': function* ({match, cardLibrary, triggerPlayerId, triggerCardId}) {
      const hand = match.playerHands[triggerPlayerId];

      const hasTreasureCards = hand.some((c) =>
        cardLibrary.getCard(c).type.includes('TREASURE')
      );

      if (!hasTreasureCards) {
        console.debug(`[MINE EFFECT] player has no treasure cards in hand`);
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
        console.debug(`[MINE EFFECT] player selected no card`);
        return;
      }

      console.debug(`[MINE EFFECT] player selected ${cardLibrary.getCard(cardId)}`);

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

      console.debug(`[MINE EFFECT] player selected ${card}`);

      yield new GainCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        cardId,
        to: { location: 'playerHands' },
      });
    },
    'moat': function* ({triggerPlayerId, triggerCardId}) {
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
      triggerPlayerId, triggerCardId,
    }) {
      const hand = match.playerHands[triggerPlayerId];
      const hasCopper = hand.some((c) =>
        cardLibrary.getCard(c).cardKey === 'copper'
      );

      if (!hasCopper) {
        console.debug(`[MONEYLENDER EFFECT] player has no copper in hand`);
        return;
      }

      const cardIds = (yield new SelectCardEffect({
        prompt: 'Cancel trash',
        validPrompt: 'Confirm trash',
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        count: { kind: 'upTo', count: 1 },
        restrict: {
          from: { location: 'playerHands' },
          card: { cardKeys: ['copper'] },
        },
      })) as number[];

      if (cardIds?.length === 0) {
        console.debug(`[MONEYLENDER EFFECT] player didn't choose copper`);
        return;
      }

      yield new TrashCardEffect({
        playerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        cardId: cardIds[0],
      });

      yield new GainTreasureEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 3,
      });
    },
    'poacher': function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
    }) {
      yield new DrawCardEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
      });

      yield new GainActionEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
      });

      yield new GainTreasureEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
      });

      // todo
      console.warn(
        `this algorithm needs to change when 'piles' are properly implemented.`,
      );

      const allSupplyCardKeys = match.config.supplyCardKeys.concat(
        match.config.kingdomCardKeys,
      );

      console.debug(`[POACHER EFFECT] original supply card piles ${allSupplyCardKeys}`);

      const remainingSupplyCardKeys = match.supply.concat(
        match.kingdom,
      ).map((id) => cardLibrary.getCard(id).cardKey).reduce((prev, cardKey) => {
        if (prev.includes(cardKey)) {
          return prev;
        }
        return prev.concat(cardKey);
      }, [] as string[]);

      console.debug(`[POACHER EFFECT] remaining supply card piles ${remainingSupplyCardKeys}`);

      const emptyPileCount = allSupplyCardKeys.length -
        remainingSupplyCardKeys.length;

      console.debug(`[POACHER EFFECT] number of empty supply piles ${emptyPileCount}`);

      if (emptyPileCount === 0) {
        return;
      }

      const cardIds = (yield new SelectCardEffect({
        prompt: 'Confirm discard',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        count: emptyPileCount,
        restrict: {
          from: {
            location: 'playerHands',
          },
        },
      })) as number[];

      for (const cardId of cardIds) {
        yield new DiscardCardEffect({
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
          cardId,
        });
      }
    },
    'remodel': function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
    }) {
      if (match.playerHands[triggerPlayerId].length === 0) {
        console.debug(`[REMODEL EFFECT] player has no cards in hand`);
        return;
      }

      let cardIds = (yield new SelectCardEffect({
        prompt: 'Confirm trash',
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        count: 1,
        restrict: { from: { location: 'playerHands' } },
      })) as number[];

      let cardId = cardIds[0];
      const card = cardLibrary.getCard(cardId);

      console.debug(`[REMODEL EFFECT] player chose card ${card} to trash`);

      yield new TrashCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
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

      console.debug(
        `[REMODEL EFFECT] player chose card ${cardLibrary.getCard(cardId)} to gain`,
      );

      yield new GainCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        cardId,
        to: { location: 'playerDiscards' },
      });
    },
    'sentry': function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
    }) {
      yield new DrawCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
      });

      yield new GainActionEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
      });

      const playerDeck = match.playerDecks[triggerPlayerId];
      const numToLookAt = Math.min(2, playerDeck.length);
      
      if (numToLookAt === 0) {
        console.debug(`[SENTRY EFFECT] player does not have enough cards`);
        return;
      }

      const cardsToLookAtIds = playerDeck.slice(-numToLookAt);

      console.debug(
        `[SENTRY EFFECT] looking at cards ${
          cardsToLookAtIds.map((id) => cardLibrary.getCard(id))
        }`,
      );
      
      let result = (yield new UserPromptEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        prompt: 'Choose card/s to trash?',
        actionButtons: [{label: 'TRASH', action: 1}],
        content: {
          cards: {
            cardIds: cardsToLookAtIds,
            selectCount: {
              kind: 'upTo',
              count: cardsToLookAtIds.length,
            },
          },
        },
      })) as { action: number; cardIds: number[] };
      
      let selectedCardIds = result.cardIds;
      
      console.debug(
        `[SENTRY EFFECT] player selected ${
          selectedCardIds.map((id) => cardLibrary.getCard(id))
        } to trash`,
      );
      
      for (const cardId of selectedCardIds) {
        yield new TrashCardEffect({
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          playerId: triggerPlayerId,
          cardId: cardId,
        });
      }
      
      const cardsToDiscard = cardsToLookAtIds.filter((id) =>
        !selectedCardIds.includes(id)
      );

      if (cardsToDiscard.length === 0) {
        console.debug(`[SENTRY EFFECT] all cards trashed, not selecting for discard`);
        return;
      }
      
      //Look at the top 2 cards of your deck. Trash and/or discard any number of them. Put the rest back on top in any order."
      result = (yield new UserPromptEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        prompt: 'Choose card/s to discard?',
        actionButtons: [{label: 'DISCARD', action: 1}],
        content: {
          cards: {
            cardIds: cardsToDiscard,
            selectCount: {
              kind: 'upTo',
              count: cardsToDiscard.length,
            },
          },
        },
      })) as { action: number; cardIds: number[] };

      selectedCardIds = result.cardIds;
      
      if (selectedCardIds.length === 0) {
        console.debug(`[SENTRY EFFECT] player chose not to discard cards`);
        return;
      }
      
      console.debug(
        `[SENTRY EFFECT] player chose ${
          selectedCardIds.map((id) => cardLibrary.getCard(id))
        } to discard`,
      );

      for (const selectedCardId of selectedCardIds) {
        yield new DiscardCardEffect({
          sourceCardId: triggerCardId,
          sourcePlayerId: triggerPlayerId,
          playerId: triggerPlayerId,
          cardId: selectedCardId,
        });
      }
    },
    'smithy': function* ({
      triggerPlayerId, triggerCardId,
    }) {
      for (let i = 0; i < 3; i++) {
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
        });
      }
    },
    'throne-room': function* ({
      triggerPlayerId, triggerCardId,
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
        console.debug(`[THRONE ROOM EFFECT] player chose no cards`);
        return;
      }

      yield new PlayCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        cardId: cardIds[0],
        playerId: triggerPlayerId,
      });

      yield new PlayCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        cardId: cardIds[0],
        playerId: triggerPlayerId,
      });
    },
    'vassal': function* ({
      match,
      cardLibrary,
      triggerPlayerId, triggerCardId,
    }) {
      yield new GainTreasureEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 2,
      });

      let playerDeck = match.playerDecks[triggerPlayerId];

      if (playerDeck.length === 0) {
        console.debug(`[VASSAL EFFECT] not enough cards in deck, shuffling`);
        yield new ShuffleDeckEffect({
          playerId: triggerPlayerId,
        });
        playerDeck = match.playerDecks[triggerPlayerId];
      }

      const cardToDiscardId = playerDeck.slice(-1)?.[0];

      if (!cardToDiscardId) {
        console.debug('[VASSAL EFFECT] no cards to discard...');
        return;
      }

      yield new DiscardCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        cardId: cardToDiscardId,
      });

      const card = cardLibrary.getCard(cardToDiscardId);

      console.debug(`[VASSAL EFFECT] card discarded ${card}`);

      if (!card.type.includes('ACTION')) {
        console.debug(`[VASSAL EFFECT] card is not an action, done processing`);
        return;
      }

      const confirm = (yield new UserPromptEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        prompt: `Play card ${card.cardName}?`,
        actionButtons: [{label: 'NO', action: 1}, {label: 'PLAY', action: 2}],
      })) as { action: number };

      if (confirm.action !== 2) {
        console.debug(`[VASSAL EFFECT] player chose not to play card`);
        return;
      }

      yield new PlayCardEffect({
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        playerId: triggerPlayerId,
        cardId: cardToDiscardId,
      });
    },
    'village': function* ({
      triggerPlayerId, triggerCardId,
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
      triggerPlayerId, triggerCardId,
      reactionContext
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

      console.debug(
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
    'workshop': function* ({
      triggerPlayerId, triggerCardId,
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
        sourceCardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        cardId,
        to: { location: 'playerDiscards' },
      });
    },
  }),
};

export default expansionModule;

