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
  SelectCardEffect,
  TrashCardEffect,
  UserPromptEffect,
} from "../../effect.ts";
import {AsyncEffectGeneratorFn, EffectGeneratorFn, LifecycleCallbackMap,} from "../../types.ts";
import {findOrderedEffectTargets} from "../../utils/find-ordered-effect-targets.ts";
import {getPlayerById} from "../../utils/get-player-by-id.ts";
import {isUndefined} from "lodash-es";
import {Match} from "shared/types.ts";
import {fisherYatesShuffle} from "../../utils/fisher-yates-shuffler.ts";

export default {
  registerCardLifeCycles: (): Record<string, LifecycleCallbackMap> => ({
    "merchant": {
      onEnterPlay: (playerId, cardId) => {
        return {
          registerTriggers: [{
            id: `merchant-${cardId}`,
            playerId,
            once: true,
            condition: (match, trigger) => {
              const card = match.cardsById[trigger.cardId];
              console.log(`trigger condition for merchant-${cardId}`);
              console.log(`card played ${card} by player ${trigger.playerId}`);
              return card.cardKey === "silver" && trigger.playerId === playerId;
            },
            listeningFor: "cardPlayed",
            generatorFn: function* (match, trigger, reaction) {
              const name = "merchant reaction - ";
              console.log(`${name} gaining a treasure`);
              yield new GainTreasureEffect({
                sourceCardId: cardId,
                sourcePlayerId: playerId,
                count: 1,
              });
            },
          }]
        }
      },
      onLeavePlay: (playerId, cardId) => {
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
            generatorFn: function* (match, trigger, reaction) {
              console.log(
                  `confirming player ${
                      getPlayerById(reaction.playerId)
                  } to reveal moat`,
              );

              const results = yield new UserPromptEffect({
                confirmLabel: "YES",
                declineLabel: "NO",
                sourceCardId: trigger.cardId,
                sourcePlayerId: trigger.playerId,
                prompt: "Reveal moat?",
                playerId: reaction.playerId,
              });

              console.log("player response to reveal moat", results.results);

              const sourceId = reaction.getSourceId();
              if (results.results && sourceId) {
                yield new RevealCardEffect({
                  sourceCardId: trigger.cardId,
                  sourcePlayerId: trigger.playerId,
                  cardId: sourceId,
                  playerId: reaction.playerId,
                });
              }

              return { match, results: results.results };
            },
          }]
        }
      },
      onLeaveHand: (playerId, cardId) => {
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
      const name = "artisan - ";

      console.log(`${name}choosing card to gain...`);
      let results = yield new SelectCardEffect({
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
        restrict: {
          from: {
            location: ["supply", "kingdom"],
          },
          cost: {
            kind: "upTo",
            amount: 5,
          },
        },
      });
      let selectedCardIds = results.results as number[];
      let selectedCardId = selectedCardIds[0];
      console.log(`${name}card chosen ${match.cardsById[selectedCardId]}`);
      yield new GainCardEffect({
        playerId: sourcePlayerId,
        sourceCardId,
        sourcePlayerId,
        cardId: selectedCardId,
        to: {
          location: "playerHands",
        },
      });

      console.log(`${name}choosing card to put on deck...`);
      results = yield new SelectCardEffect({
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
        restrict: {
          from: {
            location: "playerHands",
          },
        },
      });
      selectedCardIds = results.results as number[];
      selectedCardId = selectedCardIds[0];
      console.log(`${name}card chosen ${match.cardsById[selectedCardId]}`);
      yield new MoveCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        cardId: selectedCardId,
        to: {
          location: "playerDecks",
        },
      });
    },
    "bandit": function* (matchState, sourcePlayerId, sourceCardId, reactionContext: Record<number, boolean>) {
      const name = "bandit - ";

      const cardsById = matchState.cardsById;
      const goldCardId = matchState.supply.find((c) =>
        cardsById[c].cardKey === "gold"
      );
      if (goldCardId) {
        console.log(`${name}gaining a gold...`);
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
        console.log(`${name}no gold available`);
      }

      const targetPlayerIds = findOrderedEffectTargets(
        sourcePlayerId,
        "ALL_OTHER",
        matchState,
      ).filter(id => !reactionContext[id]);

      console.log(`${name}possible targets ${targetPlayerIds}`);

      for (const targetPlayerId of targetPlayerIds) {
        let playerDeck = matchState.playerDecks[targetPlayerId];
        let playerDiscard = matchState.playerDiscards[targetPlayerId];

        let numToReveal = 2;
        const totalCards = playerDiscard.length + playerDeck.length;
        numToReveal = Math.min(numToReveal, totalCards);

        if (numToReveal === 0) {
          console.log(`${name}player has no cards to reveal`);
          continue;
        }

        if (playerDeck.length < numToReveal) {
          console.log(`${name}not enough cards in deck, shuffling...`);
          matchState.playerDecks[targetPlayerId] = fisherYatesShuffle(
            matchState.playerDiscards[targetPlayerId],
          ).concat(playerDeck);
          matchState.playerDiscards[targetPlayerId] = [];
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
        const possibleCardsToTrash = cardIdsToReveal.filter((id) =>
          cardsById[id].cardKey !== "copper" &&
          cardsById[id].type.includes("TREASURE")
        );
        const cardsToDiscard = cardIdsToReveal.filter((id) =>
          !possibleCardsToTrash.includes(id)
        );
        const cardsToTrash: number[] = [];

        let results;
        if (possibleCardsToTrash.length > 1) {
          console.log(`${name}prompt user to select card to trash...`);
          results = yield new UserPromptEffect({
            sourcePlayerId,
            sourceCardId,
            playerId: targetPlayerId,
            confirmLabel: "TRASH",
            showDeclineOption: false,
            prompt: "Choose a treasure to trash",
            content: {
              cardSelection: {
                cardIds: possibleCardsToTrash,
              },
            },
          });

          const selectedIds = results.results as number[];
          const selectedId = selectedIds[0];
          const otherCardId = possibleCardsToTrash.find((id) =>
            id !== selectedId
          );
          if (otherCardId) {
            cardsToDiscard.push(otherCardId);
          }
          cardsToTrash.push(selectedId);
        } else {
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
      const name = "bureaucrat - ";
      console.log(name, "gaining a silver...");

      const supply = matchState.supply;
      const l = matchState.supply.length;

      for (let i = l - 1; i >= 0; i--) {
        const card = matchState.cardsById[supply[i]];
        if (card.cardKey === "silver") {
          yield new GainCardEffect({
            playerId: sourcePlayerId,
            cardId: supply[i],
            to: { location: "playerDecks" },
            sourceCardId,
            sourcePlayerId,
          });
          break;
        }

        console.log(name, "no silver in supply");
      }

      console.log(name, "obtaining attack targets...");

      let playerIds = findOrderedEffectTargets(
        sourcePlayerId,
        "ALL_OTHER",
        matchState,
      ).filter(id => !reactionContext[id]);

      console.log(name, `all available targets ${playerIds}`);

      for (const playerId of playerIds) {
        let cardsToReveal = matchState.playerHands[playerId].filter((c) =>
          matchState.cardsById[c].type.includes("VICTORY")
        );
        if (cardsToReveal.length === 0) {
          console.log(`${name} ${getPlayerById(playerId)} has no victory cards, revealing all`);
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
          const { results: cardIds } = yield new SelectCardEffect({
            playerId,
            count: 1,
            sourcePlayerId,
            sourceCardId,
            restrict: {
              from: {
                location: "playerHands",
              },
              card: {
                type: "VICTORY",
              },
            },
          });

          if (!(cardIds as number[]).length) {
            console.warn(
              "player selected no cards, that shouldn't have happened",
            );
            return;
          }

          yield new RevealCardEffect({
            playerId,
            cardId: (cardIds as number[])[0],
            sourcePlayerId,
            sourceCardId,
          });

          yield new MoveCardEffect({
            playerId,
            sourceCardId,
            sourcePlayerId,
            cardId: (cardIds as number[])[0],
            to: {
              location: "playerDecks",
            },
          });
        }
      }
    },
    "cellar": function* (matchState, sourcePlayerId, sourceCardId) {
      const name = "cellar - ";

      console.debug(name, "gaining action...");
      yield new GainActionEffect({ sourcePlayerId, sourceCardId, count: 1 });

      const hasCards = matchState.playerHands[sourcePlayerId].length > 0;
      if (!hasCards) {
        console.log(name, "no cards to choose from");
        return;
      }

      console.log(
        `${name} ${getPlayerById(sourcePlayerId)} selecting cards...`,
      );
      const { results: cardIds } = yield new SelectCardEffect({
        playerId: sourcePlayerId,
        sourceCardId,
        sourcePlayerId,
        count: { kind: "variable" },
        restrict: { from: { location: "playerHands" } },
      });
      console.log(name, "player", sourcePlayerId, "selected", cardIds);

      for (const [idx, cardId] of (cardIds as number[]).entries()) {
        console.log(
          `discarding ${idx + 1} of ${
            (cardIds as number[]).length
          } cards, current card ${matchState.cardsById[cardId]}`,
        );
        yield new DiscardCardEffect({
          cardId,
          playerId: sourcePlayerId,
          sourceCardId,
          sourcePlayerId,
        });
      }

      if (!(cardIds as number[]).length) {
        console.log(name, "no cards discarded, so no cards drawn");
        return;
      }

      for (let i = 0; i < (cardIds as number[]).length; i++) {
        console.log(
          `player ${getPlayerById(sourcePlayerId)} drawing card ${i + 1} of ${
            (cardIds as number[]).length
          }`,
        );
        yield new DrawCardEffect({
          playerId: sourcePlayerId,
          sourcePlayerId,
          sourceCardId,
        });
      }
    },
    "chapel": function* (matchState, sourcePlayerId, sourceCardId) {
      const name = "chapel - ";

      console.log(`${name}trashing up to four cards`);

      const hand = matchState.playerHands[sourcePlayerId];

      if (!hand.length) {
        console.log(`${name}player has no cards in hand`);
        return;
      }

      const { results: cardIds } = yield new SelectCardEffect({
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
        count: { kind: "upTo", count: 4 },
        restrict: { from: { location: "playerHands" } },
      });

      console.log(
        `${name}${getPlayerById(sourcePlayerId)} chose ${
          (cardIds as number[]).length
        } cards to trash`,
      );
      if ((cardIds as number[])?.length > 0) {
        for (const cardId of (cardIds as number[])) {
          console.log(`${name}trashing card ${matchState.cardsById[cardId]}`);
          yield new TrashCardEffect({
            sourcePlayerId,
            sourceCardId,
            playerId: sourcePlayerId,
            cardId,
          });
        }
      }
    },
    "copper": function* (matchState, sourcePlayerId, sourceCardId) {
      // DONE!
      yield new GainTreasureEffect({ sourcePlayerId, sourceCardId, count: 1 });
    },
    "council-room": function* (matchState, sourcePlayerId, sourceCardId) {
      const name = "council-room - ";
      // "Each other player draws a card."

      console.log(name, "draw four cards");
      for (let i = 0; i < 4; i++) {
        yield new DrawCardEffect({
          playerId: sourcePlayerId,
          sourcePlayerId,
          sourceCardId,
        });
      }

      console.log(name, "gain one buy");
      yield new GainBuyEffect({ sourcePlayerId, sourceCardId, count: 1 });

      const playerIds = findOrderedEffectTargets(
        sourcePlayerId,
        "ALL_OTHER",
        matchState,
      );

      console.log(name, "all other players", playerIds, "draw one card");
      for (const playerId of playerIds) {
        console.log(name, "player", playerId, "gains one card");
        yield new DrawCardEffect({ playerId, sourcePlayerId, sourceCardId });
      }
    },
    "festival": function* (matchState, sourcePlayerId, sourceCardId) {
      yield new GainActionEffect({ count: 2, sourcePlayerId, sourceCardId });
      yield new GainBuyEffect({ sourcePlayerId, sourceCardId, count: 1 });
      yield new GainTreasureEffect({ count: 2, sourcePlayerId, sourceCardId });
    },
    "gardens": function* () {
      // has no effects, calculates score as game plays
    },
    "gold": function* (matchState, sourcePlayerId, sourceCardId) {
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
        return;
      }

      const results = yield new UserPromptEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        prompt: "Choose card to put on deck?",
        confirmLabel: "DONE",
        declineLabel: "NO",
        content: {
          cardSelection: {
            cardIds: matchState.playerDiscards[sourcePlayerId],
          },
        },
      });

      const selectedId = (results.results as number[])?.[0];
      if (selectedId) {
        yield new MoveCardEffect({
          sourcePlayerId,
          sourceCardId,
          cardId: selectedId,
          playerId: sourcePlayerId,
          to: {
            location: "playerDecks",
          },
        });
      }
    },
    "laboratory": function* (matchState, sourcePlayerId, sourceCardId) {
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
      const name = "library - ";

      // TODO: do the set aside stuff
      // "Draw until you have 7 cards in hand, skipping any Action cards you choose to; set those aside, discarding them afterward."
      const setAside: number[] = [];

      let hand = matchState.playerHands[sourcePlayerId];
      let deck = matchState.playerDecks[sourcePlayerId];
      let newHandSize = 7;
      if (hand.length + deck.length > newHandSize) {
        console.log(
          `${name}total size of hand + deck is less than ${newHandSize}`,
        );
        newHandSize = Math.min(7, hand.length + deck.length);
        console.log(`${name}new hand size ${newHandSize}`);
      }

      while (hand.length < newHandSize + setAside.length && deck.length > 0) {
        const results = yield new DrawCardEffect({
          playerId: sourcePlayerId,
          sourceCardId,
          sourcePlayerId,
        });
        const drawnCardId = results.results as number;
        console.log(`${name}drew card, new hand size`);

        const drawnCard = matchState.cardsById[drawnCardId];

        // If it's an Action card, allow the user to decide whether to set it aside.
        if (drawnCard.type.includes("ACTION")) {
          console.log(`${name} card is an action card`);

          // A yes/no prompt. If user returns true, we set it aside.
          const { results } = yield new UserPromptEffect({
            sourcePlayerId,
            sourceCardId,
            playerId: sourcePlayerId,
            prompt:
              `You drew ${drawnCard.cardName}. Set it aside (skip putting it in your hand)?`,
            confirmLabel: "SET ASIDE",
            declineLabel: "KEEP",
          });
          const shouldSetAside = results as boolean;

          console.log(`${name}setting card aside`, shouldSetAside);

          // If user picked yes, move the card to a temporary 'aside' location, then continue.
          if (shouldSetAside) {
            setAside.push(drawnCardId);
          }
        }
      }

      // Finally, discard all set-aside cards.
      if (setAside.length > 0) {
        console.log(`${name}discarding set aside cards ${setAside}`);
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
    "market": function* (matchState, sourcePlayerId, sourceCardId) {
      yield new GainActionEffect({ sourcePlayerId, sourceCardId, count: 1 });
      yield new DrawCardEffect({
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
      });
      yield new GainBuyEffect({ sourcePlayerId, sourceCardId, count: 1 });
      yield new GainTreasureEffect({ sourcePlayerId, sourceCardId, count: 1 });
    },
    "merchant": function* (matchState, sourcePlayerId, sourceCardId) {
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
      const name = "militia - ";

      yield new GainTreasureEffect({ sourcePlayerId, sourceCardId, count: 2 });

      const playerIds = findOrderedEffectTargets(
          sourcePlayerId,
          "ALL_OTHER",
          matchState,
      ).filter(id => !reactionContext[id]);

      console.log(`${name}other players`, playerIds, "discard down to 3 cards");

      for (const playerId of playerIds) {
        const handCount = matchState.playerHands[playerId].length;
        console.log(`${name}${getPlayerById(playerId)} has ${handCount} cards`);
        if (handCount > 3) {
          const results = yield new SelectCardEffect({
            playerId,
            sourceCardId,
            sourcePlayerId,
            count: handCount - 3,
            restrict: {
              from: {
                location: "playerHands",
              },
            },
          });

          const cardIds = results.results as number[];
          console.log(
            `${name}${getPlayerById(playerId)} chose ${cardIds} to discard`,
          );
          for (const cardId of cardIds) {
            yield new DiscardCardEffect({
              sourceCardId,
              sourcePlayerId,
              cardId,
              playerId,
            });
          }
        }
      }
    },
    "mine": function* (matchState, sourcePlayerId, sourceCardId) {
      const name = "mine - ";

      const hand = matchState.playerHands[sourcePlayerId];
      const hasTreasureCards = hand.some((c) =>
        matchState.cardsById[c].type.includes("TREASURE")
      );

      if (hasTreasureCards) {
        let results = yield new SelectCardEffect({
          playerId: sourcePlayerId,
          sourcePlayerId,
          sourceCardId,
          count: {
            kind: "upTo",
            count: 1,
          },
          restrict: {
            from: { location: "playerHands" },
            card: { type: ["TREASURE"] },
          },
        });

        let cardIds = results.results as number[];
        let cardId = cardIds[0];

        if (!cardId) {
          console.log(`${name}player selected no card`);
          return;
        }

        console.log(`${name}player selected ${matchState.cardsById[cardId]}`);

        yield new TrashCardEffect({
          sourcePlayerId,
          sourceCardId,
          playerId: sourcePlayerId,
          cardId,
        });

        const card = matchState.cardsById[cardId];

        results = yield new SelectCardEffect({
          playerId: sourcePlayerId,
          sourcePlayerId,
          sourceCardId,
          count: 1,
          restrict: {
            from: { location: ["supply", "kingdom"] },
            card: { type: ["TREASURE"] },
            cost: { kind: "upTo", amount: card.cost.treasure + 3 },
          },
        });
        cardIds = results.results as number[];
        cardId = cardIds[0];
        console.log(`${name}player selected ${card}`);
        yield new GainCardEffect({
          sourceCardId,
          sourcePlayerId,
          playerId: sourcePlayerId,
          cardId,
          to: { location: "playerHands" },
        });
      } else {
        console.log(`${name}player has no treasure cards in hand`);
      }
    },
    "moat": function* (matchState, sourcePlayerId, sourceCardId) {
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
      const name = "moneylender - ";

      const hand = matchState.playerHands[sourcePlayerId];
      const hasCopper = hand.some((c) =>
        matchState.cardsById[c].cardKey === "copper"
      );
      if (hasCopper) {
        const results = yield new SelectCardEffect({
          sourceCardId,
          sourcePlayerId,
          playerId: sourcePlayerId,
          count: { kind: "upTo", count: 1 },
          restrict: {
            from: { location: "playerHands" },
            card: { cardKeys: ["copper"] },
          },
        });
        const cardIds = results.results as number[];

        if (cardIds.length > 0) {
          console.log(`${name}player selected a copper`);
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
        } else {
          console.log(`${name}player chose no copper`);
        }
      } else {
        console.log(`${name}player has no copper in hand`);
      }
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
      const allSupplyCardKeys = matchState.supplyCardKeys.concat(
        matchState.kingdomCardKeys,
      );
      const remainingSupplyCardKeys = matchState.supply.concat(
        matchState.kingdom,
      ).map((id) => cardsById[id].cardKey).reduce((prev, cardKey) => {
        if (prev.includes(cardKey)) {
          return prev;
        }
        return prev.concat(cardKey);
      }, [] as string[]);

      const emptyPileCount = allSupplyCardKeys.length -
        remainingSupplyCardKeys.length;

      if (emptyPileCount === 0) {
        return;
      }

      const results = yield new SelectCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        count: emptyPileCount,
        restrict: {
          from: {
            location: "playerHands",
          },
        },
      });

      const cardIds = results.results as number[];
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
      const name = "remodel - ";

      if (matchState.playerHands[sourcePlayerId].length === 0) {
        console.log(`${name}player has no cards in hand`);
        return;
      }

      let results = yield new SelectCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        count: 1,
        restrict: { from: { location: "playerHands" } },
      });

      let cardIds = results.results as number[];
      let cardId = cardIds[0];
      const card = matchState.cardsById[cardId];

      console.log(`${name}player chose card ${card} to trash`);

      yield new TrashCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        cardId: cardIds[0],
      });

      results = yield new SelectCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        count: 1,
        restrict: {
          from: { location: ["supply", "kingdom"] },
          cost: { kind: "upTo", amount: card.cost.treasure + 2 },
        },
      });

      cardIds = results.results as number[];
      cardId = cardIds[0];

      console.log(
        `${name}player chose card ${matchState.cardsById[cardId]} to gain`,
      );

      yield new GainCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        cardId,
        to: { location: 'playerDiscards' },
      });
    },
    "silver": function* (matchState, sourcePlayerId, sourceCardId) {
      yield new GainTreasureEffect({ count: 2, sourcePlayerId, sourceCardId });
    },
    "sentry": function* (matchState, sourcePlayerId, sourceCardId) {
      const name = "sentry - ";

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
      numToLookAt = Math.min(numToLookAt, cardCount);

      if (numToLookAt === 0) {
        console.log(`${name}player does not have enough cards`);
        return;
      }

      if (numToLookAt < playerDeck.length) {
        console.log(`${name}player does not have enough in deck, reshuffling`);
        matchState.playerDecks[sourcePlayerId] = fisherYatesShuffle(
          playerDiscard,
        ).concat(playerDeck);
        matchState.playerDiscards[sourcePlayerId] = [];
        playerDeck = matchState.playerDecks[sourcePlayerId];
      }

      let cardsToLookAtIds = playerDeck.slice(-numToLookAt);

      console.log(`${name}asking player which cards to trash`);
      let results = yield new UserPromptEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        prompt: "Choose a card/s to trash?",
        confirmLabel: "TRASH",
        showDeclineOption: false,
        content: {
          cardSelection: {
            cardIds: cardsToLookAtIds,
            selectCount: {
              kind: "upTo",
              count: cardsToLookAtIds.length,
            },
          },
        },
      });

      let selectedCardIds = results.results as number[];
      console.log(`${name}player selected ${selectedCardIds}`);

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
        console.log(`${name}all cards trashed, not selecting for discard`);
        return;
      }

      console.log(`${name}asking player which cards to discard`);
      results = yield new UserPromptEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        prompt: "Choose card/s to discard?",
        confirmLabel: "DISCARD",
        showDeclineOption: false,
        content: {
          cardSelection: {
            cardIds: cardsToLookAtIds,
            selectCount: {
              kind: "upTo",
              count: cardsToLookAtIds.length,
            },
          },
        },
      });

      selectedCardIds = results.results as number[];

      console.log(`${name}player chose ${selectedCardIds}`);

      for (const selectedCardId of selectedCardIds) {
        yield new DiscardCardEffect({
          sourceCardId,
          sourcePlayerId,
          playerId: sourcePlayerId,
          cardId: selectedCardId,
        });
      }
    },
    "smithy": function* (matchState, sourcePlayerId, sourceCardId) {
      for (let i = 0; i < 3; i++) {
        yield new DrawCardEffect({
          playerId: sourcePlayerId,
          sourcePlayerId,
          sourceCardId,
        });
      }
    },
    "throne-room": function* (matchState, sourcePlayerId, sourceCardId) {
      const name = "throne-room - ";
      const results = yield new SelectCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        count: { kind: "upTo", count: 1 },
        restrict: { from: { location: "playerHands" }, card: { type: ["ACTION"] } },
      });

      const cardIds = results.results as number[];
      const cardId = cardIds?.[0];


      if (isUndefined(cardId)) {
        console.log(`${name}player chose no cards`);
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
        matchState.playerDecks[sourcePlayerId] = fisherYatesShuffle(
          matchState.playerDiscards[sourcePlayerId],
        ).concat(playerDeck);
        matchState.playerDiscards[sourcePlayerId] = [];
        playerDeck = matchState.playerDecks[sourcePlayerId];
      }

      const cardToDiscardId = playerDeck.slice(-1)?.[0];

      if (!cardToDiscardId) {
        return;
      }

      yield new DiscardCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        cardId: cardToDiscardId,
      });

      const card = matchState.cardsById[cardToDiscardId];
      if (!card.type.includes("ACTION")) {
        return;
      }
      let results = yield new UserPromptEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        prompt: `Play card ${card.cardName}?`,
        confirmLabel: "PLAY",
        declineLabel: "NO",
      });

      const confirm = !!results.results;

      if (!confirm) {
        return;
      }

      yield new PlayCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        cardId: cardToDiscardId,
      });
    },
    "village": function* (matchState, sourcePlayerId, sourceCardId) {
      yield new GainActionEffect({ count: 2, sourcePlayerId, sourceCardId });
      yield new DrawCardEffect({
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
      });
    },
    "witch": function* (matchState, sourcePlayerId, sourceCardId, reactionContext: Record<number, boolean>) {
      const name = "witch - ";
      // "Each other player gains a Curse card."

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
      ).filter(id => reactionContext[id]);

      console.log(name, "obtaining targets, initial available", playerIds);

      for (const playerId of playerIds) {
        const supply = matchState.supply;
        const l = supply.length;
        for (let i = l - 1; i >= 0; i--) {
          if (matchState.cardsById[supply[i]].cardKey === "curse") {
            yield new GainCardEffect({
              playerId,
              cardId: supply[i],
              to: { location: 'playerDiscards' },
              sourcePlayerId,
              sourceCardId,
            });
            break;
          }

          console.log(name, "no curses found in supply");
        }
      }
    },
    "workshop": function* (matchState, sourcePlayerId, sourceCardId) {
      const results = yield new SelectCardEffect({
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        count: 1,
        restrict: {
          cost: { kind: "upTo", amount: 4 },
          from: { location: ["supply", "kingdom"] },
        },
      });
      const cardIds = results.results as number[];
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
