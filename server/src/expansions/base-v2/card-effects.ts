import { findOrderedEffectTargets } from '../../utils/find-ordered-effect-targets.ts';
import { isUndefined } from 'lodash-es';
import { Match } from 'shared/shared-types.ts';
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
import { CardLibrary } from '../../match-controller.ts';

const expansionModule: CardExpansionModule = {
  registerCardLifeCycles: () => ({
    'merchant': {
      onEnterPlay: (playerId, cardId) => {
        const id = `merchant-${cardId}`;
        return {
          registerTriggers: [{
            id,
            playerId,
            once: true,
            condition: (_match, cardLibrary, trigger) => {
              const card = cardLibrary.getCard(trigger.cardId);
              return card.cardKey === 'silver' && trigger.playerId === playerId;
            },
            listeningFor: 'cardPlayed',
            generatorFn: function* (_match, _cardLibrary, _trigger, _reaction) {
              yield new GainTreasureEffect({
                sourceCardId: cardId,
                sourcePlayerId: playerId,
                count: 1,
              });
            },
          }],
        };
      },
      onLeavePlay: (_playerId, cardId) => {
        return {
          unregisterTriggers: [`merchant-${cardId}`],
        };
      },
    },
    'moat': {
      onEnterHand: (playerId, cardId) => {
        return {
          registerTriggers: [{
            id: `moat-${cardId}`,
            playerId,
            listeningFor: 'cardPlayed',
            condition: (_match, cardLibrary, trigger) => {
              return cardLibrary.getCard(trigger.cardId).type.includes(
                'ATTACK',
              ) && trigger.playerId !== playerId;
            },
            generatorFn: function* (_match, _cardLibrary, trigger, reaction) {
              const results = (yield new UserPromptEffect({
                actionButtons: [{ label: 'YES', action: 1}, {label: 'NO', action: 2}],
                sourceCardId: trigger.cardId,
                sourcePlayerId: trigger.playerId,
                prompt: 'Reveal moat?',
                playerId: reaction.playerId,
              })) as { action: number };

              console.log('player response to reveal moat', results.action === 1);

              const sourceId = reaction.getSourceId();
              if (results.action === 1 && sourceId) {
                yield new RevealCardEffect({
                  sourceCardId: trigger.cardId,
                  sourcePlayerId: trigger.playerId,
                  cardId: sourceId,
                  playerId: reaction.playerId,
                });
              }

              return results;
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
  }),
  registerScoringFunctions: () => ({
    'gardens': function (match: Match, _cardLibrary: CardLibrary, cardOwnerId: number) {
      const cards = match
        .playerHands[cardOwnerId]
        .concat(match.playerDecks[cardOwnerId])
        .concat(match.playerDiscards[cardOwnerId])
        .concat(match.playArea);

      return Math.floor(cards.length / 10);
    },
  }),
  registerEffects: () => ({
    'artisan': function* (_match, cardLibrary, sourcePlayerId, sourceCardId) {
      console.debug(`choosing card to gain...`);
      let results = (yield new SelectCardEffect({
        prompt: 'Choose card to gain',
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
      console.debug(`card chosen ${cardLibrary.getCard(selectedCardId)}`);
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
        prompt: 'Confirm top-deck card',
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
      console.debug(`card chosen ${cardLibrary.getCard(selectedCardId)}`);
      yield new MoveCardEffect({
        sourcePlayerId,
        sourceCardId,
        toPlayerId: sourcePlayerId,
        cardId: selectedCardId,
        to: {
          location: 'playerDecks',
        },
      });
    },
    'bandit': function* (
      match,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
      reactionContext: Record<number, boolean>,
    ) {
      const goldCardId = match.supply.find((c) =>
        cardLibrary.getCard(c).cardKey === 'gold'
      );
      if (goldCardId) {
        console.debug(`gaining a gold...`);
        const goldCard = cardLibrary.getCard(goldCardId);
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
        match,
      ).filter((id) => !reactionContext[id]);

      console.debug(` ordered targets ${targetPlayerIds}`);

      for (const targetPlayerId of targetPlayerIds) {
        let playerDeck = match.playerDecks[targetPlayerId];
        let playerDiscard = match.playerDiscards[targetPlayerId];

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
            playerId: targetPlayerId,
          });

          playerDeck = match.playerDecks[targetPlayerId];
          playerDiscard = match.playerDiscards[targetPlayerId];
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

        const possibleCardsToTrash = cardIdsToReveal.filter((id) => {
          console.debug(
            `checking if ${cardLibrary.getCard(id)} can be trashed`,
          );
          return cardLibrary.getCard(id).cardKey !== 'copper' &&
            cardLibrary.getCard(id).type.includes('TREASURE');
        });

        if (possibleCardsToTrash.length > 0) {
          console.debug(
            `cards that can be trashed ${
              possibleCardsToTrash.map((cardId) => cardLibrary.getCard(cardId))
            }`,
          );
        }

        const cardsToDiscard = cardIdsToReveal.filter((id) =>
          !possibleCardsToTrash.includes(id)
        );

        if (cardsToDiscard.length > 0) {
          console.debug(
            `cards that will be discarded ${
              cardsToDiscard.map((cardId) => cardLibrary.getCard(cardId))
            }`,
          );
        }

        const cardsToTrash: number[] = [];

        let results;
        if (possibleCardsToTrash.length > 1) {
          console.debug(`prompt user to select card to trash...`);
          results = (yield new UserPromptEffect({
            sourcePlayerId,
            sourceCardId,
            playerId: targetPlayerId,
            prompt: 'Choose a treasure to trash',
            content: {
              cardSelection: {
                cardIds: possibleCardsToTrash,
                selectCount: 1
              },
            },
          })) as { action: number, cardIds: number[] };

          const selectedId = results.cardIds?.[0];

          console.debug(`chose card ${cardLibrary.getCard(selectedId)}`);

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
    'bureaucrat': function* (
      match,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
      reactionContext: Record<number, boolean>,
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
      ).filter((id) => !reactionContext[id]);

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
    'harbinger': function* (
      match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new DrawCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
      });

      yield new GainActionEffect({ count: 1, sourcePlayerId, sourceCardId });

      if (match.playerDiscards[sourcePlayerId].length === 0) {
        console.debug('player has no cards in discard, done processing');
        return;
      }

      const results = (yield new UserPromptEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        prompt: 'Choose card to put on deck?',
        actionButtons: [{label: 'CANCEL', action: 2}],
        validationAction: 1,
        content: {
          cardSelection: {
            cardIds: match.playerDiscards[sourcePlayerId],
            selectCount: 1
          },
        },
      })) as { action: number, cardIds: number[] };

      const selectedId = results?.cardIds?.[0];
      if (selectedId) {
        yield new MoveCardEffect({
          sourcePlayerId,
          sourceCardId,
          cardId: selectedId,
          toPlayerId: sourcePlayerId,
          to: {
            location: 'playerDecks',
          },
        });
      } else {
        console.debug('no card selected');
      }
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
    'merchant': function* (
      _match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
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
    'militia': function* (
      match,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
      reactionContext: Record<number, boolean>,
    ) {
      yield new GainTreasureEffect({ sourcePlayerId, sourceCardId, count: 2 });

      const playerIds = findOrderedEffectTargets(
        sourcePlayerId,
        'ALL_OTHER',
        match,
      ).filter((id) => !reactionContext[id]);

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
    'poacher': function* (
      match,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
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
        `this algorithm needs to change when 'piles' are properly implemented.`,
      );

      const allSupplyCardKeys = match.config.supplyCardKeys.concat(
        match.config.kingdomCardKeys,
      );

      console.debug(`original supply card piles ${allSupplyCardKeys}`);

      const remainingSupplyCardKeys = match.supply.concat(
        match.kingdom,
      ).map((id) => cardLibrary.getCard(id).cardKey).reduce((prev, cardKey) => {
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
        prompt: 'Confirm discard',
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
    'sentry': function* (
      match,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
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

      let playerDeck = match.playerDecks[sourcePlayerId];
      const playerDiscard = match.playerDiscards[sourcePlayerId];

      let numToLookAt = 2;
      const cardCount = playerDeck.length + playerDiscard.length;

      if (cardCount < 2) {
        numToLookAt = Math.min(numToLookAt, cardCount);
        console.debug(
          `not enough cards in deck + discard, setting num to look at to ${numToLookAt}`,
        );
      }

      if (numToLookAt === 0) {
        console.debug(`player does not have enough cards`);
        return;
      }

      if (numToLookAt < playerDeck.length) {
        console.log(`player does not have enough in deck, reshuffling`);

        yield new ShuffleDeckEffect({
          playerId: sourcePlayerId,
        });

        playerDeck = match.playerDecks[sourcePlayerId];
      }

      let cardsToLookAtIds = playerDeck.slice(-numToLookAt);

      console.debug(
        `looking at cards ${
          cardsToLookAtIds.map((id) => cardLibrary.getCard(id))
        }`,
      );

      let result = (yield new UserPromptEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        prompt: 'Choose a card/s to trash?',
        actionButtons: [{label: 'TRASH', action: 1}],
        content: {
          cardSelection: {
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
        `player selected ${
          selectedCardIds.map((id) => cardLibrary.getCard(id))
        } to trash`,
      );

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

      result = (yield new UserPromptEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        prompt: 'Choose card/s to discard?',
        actionButtons: [{label: 'DISCARD', action: 1}],
        content: {
          cardSelection: {
            cardIds: cardsToLookAtIds,
            selectCount: {
              kind: 'upTo',
              count: cardsToLookAtIds.length,
            },
          },
        },
      })) as { action: number; cardIds: number[] };

      selectedCardIds = result.cardIds;
      
      console.debug(
        `player chose ${
          selectedCardIds.map((id) => cardLibrary.getCard(id))
        } to discard`,
      );

      for (const selectedCardId of selectedCardIds) {
        yield new DiscardCardEffect({
          sourceCardId,
          sourcePlayerId,
          playerId: sourcePlayerId,
          cardId: selectedCardId,
        });
      }
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
    'vassal': function* (
      match,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainTreasureEffect({
        sourcePlayerId,
        sourceCardId,
        count: 2,
      });

      let playerDeck = match.playerDecks[sourcePlayerId];

      if (playerDeck.length === 0) {
        console.debug(`not enough cards in deck, shuffling`);
        yield new ShuffleDeckEffect({
          playerId: sourcePlayerId,
        });
        playerDeck = match.playerDecks[sourcePlayerId];
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

      const card = cardLibrary.getCard(cardToDiscardId);

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
        actionButtons: [{label: 'NO', action: 1}, {label: 'PLAY', action: 2}],
      })) as { action: number };

      if (confirm.action !== 2) {
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
      reactionContext: Record<number, boolean>,
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
      ).filter((id) => !reactionContext[id]);

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

