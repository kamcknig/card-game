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
import {
  AsyncEffectGeneratorFn,
  EffectGeneratorFn,
  LifecycleCallbackMap,
} from "../../types.ts";
import { findOrderedEffectTargets } from "../../utils/find-ordered-effect-targets.ts";
import { isUndefined } from "es-toolkit";
import { fisherYatesShuffle } from "../../utils/fisher-yates-shuffler.ts";
import { Match } from "shared/shared-types.ts";
import { CardLibrary } from "../../match-controller.ts";

function getPlayerById(match: Match, playerId: number) {
  return match.players.find((player) => player.id === playerId);
}

export default {
  registerCardLifeCycles: (): Record<string, LifecycleCallbackMap> => {
    return {
      "moat": {
        onEnterHand: (playerId, cardId) => {
          return {
            registerTriggers: [{
              id: `moat-${cardId}`,
              playerId,
              listeningFor: "cardPlayed",
              condition: (match, cardLibrary, trigger) => {
                return cardLibrary.getCard(trigger.cardId).type.includes(
                  "ATTACK",
                ) && trigger.playerId !== playerId;
              },
              generatorFn: function* (_match, cardLibrary, trigger, reaction) {
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
    "gardens": function (
      match: Match,
      cardLibrary: CardLibrary,
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
  registerEffects: (): Record<
    string,
    EffectGeneratorFn | AsyncEffectGeneratorFn
  > => ({
    "adventurer": function* (
      matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      // DONE!!
      const name = "adventurer - ";
      let treasuresRevealed = 0;

      const deck = matchState.playerDecks[sourcePlayerId];

      while (treasuresRevealed < 2 && deck.length > 0) {
        const cardId = deck[deck.length - 1];
        console.log(name, `revealing card ${cardLibrary.getCard(cardId)}`);
        yield new RevealCardEffect({
          playerId: sourcePlayerId,
          cardId,
          sourcePlayerId,
          sourceCardId: cardId,
        });
        const card = cardLibrary.getCard(cardId);
        if (card.type.includes("TREASURE")) {
          console.log(name, "card revealed is a treasure, drawing");
          yield new DrawCardEffect({
            playerId: sourcePlayerId,
            sourcePlayerId,
            sourceCardId: cardId,
          });
          ++treasuresRevealed;
        } else {
          console.log(name, "card revealed is not a treasure, discarding");
          yield new DiscardCardEffect({
            playerId: sourcePlayerId,
            cardId,
            sourcePlayerId,
            sourceCardId: cardId,
          });
        }
      }
    },
    "bureaucrat": function* (
      matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
      reactionContext: Record<number, boolean>,
    ) {
      const supply = matchState.supply;
      const l = matchState.supply.length;

      for (let i = l - 1; i >= 0; i--) {
        const card = cardLibrary.getCard(supply[i]);
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

        console.debug(name, "no silver in supply");
      }

      const playerIds = findOrderedEffectTargets(
        sourcePlayerId,
        "ALL_OTHER",
        matchState,
      ).filter((id) => !reactionContext[id]);

      console.debug(
        name,
        `targeting ${playerIds.map((id) => getPlayerById(matchState, id))}`,
      );

      for (const playerId of playerIds) {
        let cardsToReveal = matchState.playerHands[playerId].filter((c) =>
          cardLibrary.getCard(c).type.includes("VICTORY")
        );

        if (cardsToReveal.length === 0) {
          console.debug(
            `${
              getPlayerById(matchState, playerId)
            } has no victory cards, revealing all`,
          );
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
            prompt: "",
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
              location: "playerDecks",
            },
          });
        }
      }
    },
    "cellar": function* (
      matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainActionEffect({ sourcePlayerId, sourceCardId, count: 1 });

      const hasCards = matchState.playerHands[sourcePlayerId].length > 0;
      if (!hasCards) {
        console.debug(name, "player has no cards to choose from");
        return;
      }

      const cardIds = (yield new SelectCardEffect({
        prompt: "",
        playerId: sourcePlayerId,
        sourceCardId,
        sourcePlayerId,
        count: { kind: "variable" },
        restrict: { from: { location: "playerHands" } },
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
        console.debug(name, "no cards discarded, so no cards drawn");
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
    "chancellor": function* (
      matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      const name = "chancellor - ";
      yield new GainTreasureEffect({ count: 2, sourceCardId, sourcePlayerId });

      let deck = matchState.playerDecks[sourcePlayerId];
      if (deck.length === 0) {
        console.log(`${name}player has no cards in deck to discard`);
        return;
      }

      const results = yield new UserPromptEffect({
        prompt: "Discard deck?",
        declineLabel: "NO",
        confirmLabel: "YES",
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
      });

      if (!confirm) {
        console.log(`${name} selected no`);
        return;
      }

      console.log(`${name} selected yes`);

      while (deck.length > 0) {
        const cardId = deck.slice(-1)?.[0];
        yield new DiscardCardEffect({
          sourcePlayerId,
          sourceCardId,
          playerId: sourcePlayerId,
          cardId,
        });
        deck = matchState.playerDecks[sourcePlayerId];
      }
    },
    "chapel": function* (
      matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      const name = "chapel - ";

      console.log(`${name}trashing up to four cards`);

      const hand = matchState.playerHands[sourcePlayerId];

      if (!hand.length) {
        console.log(`${name}player has no cards in hand`);
        return;
      }

      const cardIds = yield new SelectCardEffect({
        prompt: "",
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
        count: { kind: "upTo", count: 4 },
        restrict: { from: { location: "playerHands" } },
      });

      console.log(
        `${name}${getPlayerById(matchState, sourcePlayerId)} chose ${
          (cardIds as number[]).length
        } cards to trash`,
      );
      if ((cardIds as number[])?.length > 0) {
        for (const cardId of (cardIds as number[])) {
          console.log(`${name}trashing card ${cardLibrary.getCard(cardId)}`);
          yield new TrashCardEffect({
            sourcePlayerId,
            sourceCardId,
            playerId: sourcePlayerId,
            cardId,
          });
        }
      }
    },
    "copper": function* (
      _matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainTreasureEffect({ sourcePlayerId, sourceCardId, count: 1 });
    },
    "council-room": function* (
      matchState,
      cardLibrary,
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
        "ALL_OTHER",
        matchState,
      );

      console.debug(
        `targets ${playerIds.map((id) => getPlayerById(matchState, id))}`,
      );

      for (const playerId of playerIds) {
        yield new DrawCardEffect({ playerId, sourcePlayerId, sourceCardId });
      }
    },
    "feast": function* (matchState, cardLibrary, sourcePlayerId, sourceCardId) {
      const name = "feast - ";

      if (!sourceCardId) {
        throw new Error("feast ability requires a sourceCardId");
      }

      console.log(`${name}trashing feast card`);
      yield new TrashCardEffect({
        playerId: sourcePlayerId,
        cardId: sourceCardId,
        sourceCardId,
        sourcePlayerId,
      });

      console.log("gain a card costing up to five treasure");
      const cardIds = yield new SelectCardEffect({
        prompt: "",
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        restrict: {
          from: { location: ["supply", "kingdom"] },
          cost: { kind: "upTo", amount: 5 },
        },
        count: 1,
      });

      if ((cardIds as number[]).length > 0) {
        console.log(
          `${name} ${getPlayerById(matchState, sourcePlayerId)} chose ${
            cardLibrary.getCard((cardIds as number[])[0])
          }`,
        );
        yield new GainCardEffect({
          sourcePlayerId,
          sourceCardId,
          playerId: sourcePlayerId,
          cardId: (cardIds as number[])[0],
          to: {
            location: "playerDiscards",
          },
        });
      }
    },
    "festival": function* (
      _matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainActionEffect({ count: 2, sourcePlayerId, sourceCardId });
      yield new GainBuyEffect({ sourcePlayerId, sourceCardId, count: 1 });
      yield new GainTreasureEffect({ count: 2, sourcePlayerId, sourceCardId });
    },
    "gardens": function* () {
      // has no effects, calculates score as game plays
    },
    "gold": function* (_matchState, cardLibrary, sourcePlayerId, sourceCardId) {
      yield new GainTreasureEffect({ count: 3, sourcePlayerId, sourceCardId });
    },
    "laboratory": function* (
      _matchState,
      cardLibrary,
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
    "library": function* (
      matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
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

        const drawnCard = cardLibrary.getCard(drawnCardId);

        // If it's an Action card, allow the user to decide whether to set it aside.
        if (drawnCard.type.includes("ACTION")) {
          console.debug(`card is an action card ${drawnCard}`);

          const shouldSetAside = (yield new UserPromptEffect({
            sourcePlayerId,
            sourceCardId,
            playerId: sourcePlayerId,
            prompt:
              `You drew ${drawnCard.cardName}. Set it aside (skip putting it in your hand)?`,
            confirmLabel: "SET ASIDE",
            declineLabel: "KEEP",
          })) as boolean;

          if (shouldSetAside) {
            console.debug(`setting card aside`);
          } else {
            console.debug("keeping card in hand");
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
    "market": function* (
      _matchState,
      cardLibrary,
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
    "militia": function* (
      matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
      reactionContext: Record<number, boolean>,
    ) {
      yield new GainTreasureEffect({ sourcePlayerId, sourceCardId, count: 2 });

      const playerIds = findOrderedEffectTargets(
        sourcePlayerId,
        "ALL_OTHER",
        matchState,
      ).filter((id) => !reactionContext[id]);

      console.debug(
        `targets ${playerIds.map((id) => getPlayerById(matchState, id))}`,
      );

      for (const playerId of playerIds) {
        const handCount = matchState.playerHands[playerId].length;
        if (handCount > 3) {
          const cardIds = (yield new SelectCardEffect({
            prompt: "",
            playerId,
            sourceCardId,
            sourcePlayerId,
            count: handCount - 3,
            restrict: {
              from: {
                location: "playerHands",
              },
            },
          })) as number[];

          console.log(
            `${getPlayerById(matchState, playerId)} chose ${
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
    "mine": function* (matchState, cardLibrary, sourcePlayerId, sourceCardId) {
      const hand = matchState.playerHands[sourcePlayerId];

      const hasTreasureCards = hand.some((c) =>
        cardLibrary.getCard(c).type.includes("TREASURE")
      );

      if (!hasTreasureCards) {
        console.debug(`player has no treasure cards in hand`);
        return;
      }

      let cardIds = (yield new SelectCardEffect({
        prompt: "",
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
        prompt: "",
        playerId: sourcePlayerId,
        sourcePlayerId,
        sourceCardId,
        count: 1,
        restrict: {
          from: { location: ["supply", "kingdom"] },
          card: { type: ["TREASURE"] },
          cost: { kind: "upTo", amount: card.cost.treasure + 3 },
        },
      })) as number[];

      cardId = cardIds[0];

      console.debug(`player selected ${card}`);

      yield new GainCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        cardId,
        to: { location: "playerHands" },
      });
    },
    "moat": function* (_matchState, cardLibrary, sourcePlayerId, sourceCardId) {
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
    "moneylender": function* (
      matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      const hand = matchState.playerHands[sourcePlayerId];
      const hasCopper = hand.some((c) =>
        cardLibrary.getCard(c).cardKey === "copper"
      );

      if (!hasCopper) {
        console.debug(`player has no copper in hand`);
        return;
      }

      const cardIds = (yield new SelectCardEffect({
        prompt: "",
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        count: { kind: "upTo", count: 1 },
        restrict: {
          from: { location: "playerHands" },
          card: { cardKeys: ["copper"] },
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
    "remodel": function* (
      matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      if (matchState.playerHands[sourcePlayerId].length === 0) {
        console.debug(`player has no cards in hand`);
        return;
      }

      let cardIds = (yield new SelectCardEffect({
        prompt: "",
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
        count: 1,
        restrict: { from: { location: "playerHands" } },
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
        sourcePlayerId,
        prompt: "",
        sourceCardId,
        playerId: sourcePlayerId,
        count: 1,
        restrict: {
          from: { location: ["supply", "kingdom"] },
          cost: { kind: "upTo", amount: card.cost.treasure + 2 },
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
        to: { location: "playerDiscards" },
      });
    },
    "silver": function* (
      _matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainTreasureEffect({ count: 2, sourcePlayerId, sourceCardId });
    },
    "smithy": function* (
      _matchState,
      cardLibrary,
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
    "spy": function* (matchState, cardLibrary, sourcePlayerId, sourceCardId) {
      const name = "spy - ";
      yield new GainActionEffect({ sourcePlayerId, sourceCardId, count: 1 });
      yield new DrawCardEffect({
        sourceCardId,
        sourcePlayerId,
        playerId: sourcePlayerId,
      });

      const playerIds = findOrderedEffectTargets(
        sourcePlayerId,
        "ALL",
        matchState,
      );
      for (const playerId of playerIds) { // loop all players
        const player = getPlayerById(matchState, playerId);
        let deck = matchState.playerDecks[playerId];
        if (deck.length === 0) {
          console.log(
            `${name}player does not have enough cards in dec, resetting discard`,
          );
          matchState.playerDecks[playerId] = fisherYatesShuffle(
            matchState.playerDiscards[playerId],
          );
          matchState.playerDiscards[playerId] = [];
          deck = matchState.playerDecks[playerId];
        }
        const cardId = deck.slice(-1)[0];

        yield new RevealCardEffect({
          sourcePlayerId,
          sourceCardId,
          cardId,
          playerId,
        });

        const results = yield new UserPromptEffect({
          sourceCardId,
          sourcePlayerId,
          playerId: sourcePlayerId,
          prompt: `Discard or put on ${player?.name}'s deck?`,
          confirmLabel: "DISCARD",
          declineLabel: "DECK",
          content: {
            cardSelection: {
              cardIds: [cardId],
            },
          },
        });

        const discard = results as boolean;

        if (discard) {
          console.log(`${name}player chose to discard`);
          yield new DiscardCardEffect({
            sourceCardId,
            sourcePlayerId,
            cardId,
            playerId,
          });
        }
      }
    },
    "thief": function* (matchState, cardLibrary, sourcePlayerId, sourceCardId) {
      const name = "thief - ";

      // "Each other player reveals the top 2 cards of his deck.
      // If they revealed any Treasure cards, they trash one of them that you choose.
      // You may gain any or all of these trashed cards.
      // They discard the other revealed cards."

      const targetPlayerIds = findOrderedEffectTargets(
        sourcePlayerId,
        "ALL_OTHER",
        matchState,
      );
      const cardsToGain: number[] = [];

      let results;
      for (const playerId of targetPlayerIds) {
        let cardsToDiscard: number[] = [];

        let deck = matchState.playerDecks[playerId];
        const discard = matchState.playerDiscards[playerId];

        // num to reveal is 2 or the number of cards we have to choose from (including a reshuffle if need be)
        const numToReveal = Math.min(2, deck.length + discard.length);

        if (numToReveal === 0) {
          console.log(`${name}player has no cards to reveal`);
          continue;
        }

        // shuffle discard back into deck (make sure deck is on top)
        if (deck.length < numToReveal) {
          matchState.playerDecks[playerId] = fisherYatesShuffle(
            matchState.playerDiscards[playerId],
          ).concat(deck);
          deck = matchState.playerDecks[playerId];
        }

        const cardsToReveal = deck.slice(-numToReveal);
        console.log(`${name}cards to reveal ${cardsToReveal}`);

        const treasureCardIds = cardsToReveal.filter((id) =>
          cardLibrary.getCard(id).type.includes("TREASURE")
        );
        cardsToDiscard = cardsToDiscard.concat(
          cardsToReveal.filter((id) =>
            !cardLibrary.getCard(id).type.includes("TREASURE")
          ),
        );

        let results;

        for (const e of cardsToReveal) {
          yield new RevealCardEffect({
            sourcePlayerId,
            sourceCardId,
            cardId: e,
            playerId,
          });
        }

        if (treasureCardIds.length > 0) {
          console.log(`${name}found ${treasureCardIds.length} treasure cards`);
          // if more than one, choose, otherwise auto-choose the only one
          results = treasureCardIds.length === 1
            ? { match: matchState, results: [treasureCardIds[0]] }
            : yield new UserPromptEffect({
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
              } revealed these cards. Choose one to trash.`,
              confirmLabel: "DONE",
              showDeclineOption: false,
            });

          const cardIds = results as number[];
          const cardId = cardIds[0];

          console.log(
            `${name}chose card ${cardLibrary.getCard(cardId)} to trash`,
          );

          yield new TrashCardEffect({
            playerId,
            sourcePlayerId,
            sourceCardId,
            cardId,
          });

          cardsToGain.push(cardId);
          console.log(
            `${name} adding card ${
              cardLibrary.getCard(cardId)
            } to list to possibly gain`,
          );
        } else {
          console.log(`${name} no treasure cards in player's hand`);
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
        results = yield new UserPromptEffect({
          sourceCardId,
          sourcePlayerId,
          playerId: sourcePlayerId,
          prompt: "Select which cards to keep.",
          confirmLabel: "DONE",
          content: {
            cardSelection: {
              cardIds: cardsToGain,
              selectCount: cardsToGain.length,
            },
          },
          showDeclineOption: false,
        });

        const cardIds = results as number[];
        for (const cardId of cardIds) {
          yield new GainCardEffect({
            sourcePlayerId,
            sourceCardId,
            playerId: sourcePlayerId,
            cardId,
            to: { location: "playerDiscards" },
          });
        }
      }
    },
    "throne-room": function* (
      _matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      const cardIds = (yield new SelectCardEffect({
        prompt: "",
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        count: { kind: "upTo", count: 1 },
        restrict: {
          from: { location: "playerHands" },
          card: { type: ["ACTION"] },
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
    "village": function* (
      _matchState,
      cardLibrary,
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
    "witch": function* (
      matchState,
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
        "ALL_OTHER",
        matchState,
      ).filter((id) => !reactionContext[id]);

      console.debug(
        `targets ${playerIds.map((id) => getPlayerById(matchState, id))}`,
      );

      for (const playerId of playerIds) {
        const supply = matchState.supply;
        const l = supply.length;
        for (let i = l - 1; i >= 0; i--) {
          if (cardLibrary.getCard(supply[i]).cardKey === "curse") {
            yield new GainCardEffect({
              playerId,
              cardId: supply[i],
              to: { location: "playerDiscards" },
              sourcePlayerId,
              sourceCardId,
            });
            break;
          }

          console.debug("no curses found in supply");
        }
      }
    },
    "woodcutter": function* (
      matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainBuyEffect({ count: 1, sourcePlayerId, sourceCardId });
      yield new GainTreasureEffect({ count: 2, sourcePlayerId, sourceCardId });
    },
    "workshop": function* (
      _matchState,
      cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      const cardIds = (yield new SelectCardEffect({
        prompt: "",
        sourcePlayerId,
        sourceCardId,
        playerId: sourcePlayerId,
        count: 1,
        restrict: {
          cost: { kind: "upTo", amount: 4 },
          from: { location: ["supply", "kingdom"] },
        },
      })) as number[];

      const cardId = cardIds[0];

      yield new GainCardEffect({
        playerId: sourcePlayerId,
        sourceCardId,
        sourcePlayerId,
        cardId,
        to: { location: "playerDiscards" },
      });
    },
  }),
};
