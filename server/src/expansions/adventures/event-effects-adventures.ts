import { CardExpansionModule } from "../../types.ts";
import { CardPriceRule } from "../../core/card-price-rules-controller.ts";
import { getCardsInPlay } from "../../utils/get-cards-in-play.ts";
import { CardId, CardNoId, CountSpec } from "shared/shared-types";
import { getTurnPhase } from "../../utils/get-turn-phase.ts";
import { adventuresTokenIds } from "./token-ids-adventures.ts";
import { getCurrentPlayer } from "../../utils/get-current-player.ts";

// Determines the card that defines the pile's type by matching the pile randomizer.
const getPileRandomizerCard = (
  cards: CardNoId[],
  pileName: string,
): CardNoId | undefined => {
  return cards.find((card) => card.randomizer === pileName) ?? cards[0];
};

const effectMap: CardExpansionModule = {
  "alms": {
    registerEffects: () => async (cardEffectArgs) => {
      const event = cardEffectArgs.match.events.find((e) =>
        e.id === cardEffectArgs.cardId
      );
      if (!event) return;

      const priceRule: CardPriceRule = (card, context) => {
        if (context.playerId === cardEffectArgs.playerId) {
          return { restricted: true, cost: card.cost };
        }
        return { restricted: false, cost: card.cost };
      };

      const ruleUnsub = cardEffectArgs.cardPriceController.registerRule(
        event,
        priceRule,
      );

      cardEffectArgs.reactionManager.registerSystemTemplate(event, "endTurn", {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: async () => true,
        triggeredEffectFn: async () => {
          ruleUnsub();
        },
      });

      const treasuresInPlay = getCardsInPlay(cardEffectArgs.findCards)
        .filter((card) => card.type.includes("TREASURE"))
        .filter((card) => card.owner === cardEffectArgs.playerId);

      if (treasuresInPlay.length > 0) {
        console.debug(
          `[alms effect] ${treasuresInPlay.length} treasures in play, not gaining card`,
        );
        return;
      }

      const cards = cardEffectArgs.findCards([
        { location: ["basicSupply", "kingdomSupply"] },
        {
          kind: "upTo",
          playerId: cardEffectArgs.playerId,
          amount: { treasure: 4 },
        },
      ]);

      if (!cards.length) {
        console.debug(`[alms effect] no cards to gain`);
        return;
      }

      const selectedCardIds = await cardEffectArgs.runGameActionDelegate(
        "selectCard",
        {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cards.map((card) => card.id),
          count: 1,
        },
      ) as CardId[];

      if (!selectedCardIds.length) {
        console.warn(`[alms effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(
        selectedCardIds[0],
      );

      console.debug(`[alms effect] gaining card ${selectedCard}`);

      await cardEffectArgs.runGameActionDelegate("gainCard", {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: "playerDiscard" },
      });
    },
  },
  "ball": {
    registerEffects: () => async (cardEffectArgs) => {
      const event = cardEffectArgs.match.events.find((e) =>
        e.id === cardEffectArgs.cardId
      );
      if (!event) {
        console.warn(`[ball effect] event not found`);
        return;
      }

      // Take the -$1 token once if the player does not already have it.
      const alreadyHasToken = Object.values(cardEffectArgs.match.tokens ?? {})
        .some((token) =>
          token.tokenId === adventuresTokenIds.minusCoin &&
          token.ownerId === cardEffectArgs.playerId &&
          token.location.type === "player" &&
          token.location.playerId === cardEffectArgs.playerId
        );
      if (!alreadyHasToken) {
        console.debug(
          `[ball effect] placing -$1 token for player ${cardEffectArgs.playerId}`,
        );
        await cardEffectArgs.runGameActionDelegate("placeToken", {
          tokenId: adventuresTokenIds.minusCoin,
          ownerId: cardEffectArgs.playerId,
          location: { type: "player", playerId: cardEffectArgs.playerId },
          sourceCardId: event.id,
        }, { loggingContext: { source: event.id } });
      }

      const cards = cardEffectArgs.findCards([
        { location: ["basicSupply", "kingdomSupply"] },
        {
          kind: "upTo",
          playerId: cardEffectArgs.playerId,
          amount: { treasure: 4 },
        },
      ]);

      if (!cards.length) {
        console.debug(`[ball effect] no cards to gain`);
        return;
      }

      const gainCount = Math.min(2, cards.length);

      const selectedCardIds = await cardEffectArgs.runGameActionDelegate(
        "selectCard",
        {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain ${gainCount} card${gainCount === 1 ? "" : "s"}`,
          restrict: cards.map((card) => card.id),
          count: gainCount,
        },
      ) as CardId[];

      if (!selectedCardIds.length) {
        console.warn(`[ball effect] no card selected`);
        return;
      }

      for (const selectedCardId of selectedCardIds) {
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
        console.debug(`[ball effect] gaining ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate("gainCard", {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: { location: "playerDiscard" },
        });
      }
    },
  },
  "bonfire": {
    registerEffects: () => async (cardEffectArgs) => {
      const coppersInPlay = getCardsInPlay(cardEffectArgs.findCards)
        .filter((card) =>
          card.cardKey === "copper" && card.owner === cardEffectArgs.playerId
        );

      if (!coppersInPlay.length) {
        console.debug(`[bonfire effect] no coppers in play`);
        return;
      }

      const selectedCardIds = await cardEffectArgs.runGameActionDelegate(
        "selectCard",
        {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash coppers`,
          restrict: coppersInPlay.map((card) => card.id),
          count: { kind: "upTo", count: 2 },
        },
      ) as CardId[];

      if (!selectedCardIds.length) {
        console.warn(`[bonfire effect] no card selected`);
        return;
      }

      console.debug(
        `[bonfire effect] trashing ${selectedCardIds.length} cards`,
      );

      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.runGameActionDelegate("trashCard", {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
        });
      }
    },
  },
  "expedition": {
    registerEffects: () => async (cardEffectArgs) => {
      const event = cardEffectArgs.match.events.find((e) =>
        e.id === cardEffectArgs.cardId
      );
      if (!event) {
        console.warn(`[expedition effect] event not found`);
        return;
      }

      cardEffectArgs.reactionManager.registerSystemTemplate(
        event,
        "endTurnPhase",
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: async (conditionArgs) => {
            if (
              conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId
            ) return false;
            if (
              getTurnPhase(conditionArgs.match.turnPhaseIndex) !== "cleanup"
            ) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            console.warn(
              `[expedition effect] i have programmed this to use the reaction system, but technically the effect should modify the amount of cards drawn, and not take place at the end of cleanup`,
            );

            console.debug(`[expedition endTurnPhase effect] drawing 2 cards`);
            await cardEffectArgs.runGameActionDelegate("drawCard", {
              playerId: cardEffectArgs.playerId,
              count: 2,
            });
          },
        },
      );
    },
  },
  "ferry": {
    registerEffects: () => async (cardEffectArgs) => {
      const event = cardEffectArgs.match.events.find((e) =>
        e.id === cardEffectArgs.cardId
      );
      if (!event) {
        console.warn(`[ferry effect] event not found`);
        return;
      }

      // Build the list of Action supply piles using the randomizer card types.
      const actionSupplyPiles = cardEffectArgs.match.config.kingdomSupply
        .map((supply) => {
          const pileCard = getPileRandomizerCard(supply.cards, supply.name);
          if (!pileCard?.type?.includes("ACTION")) return null;
          return pileCard.randomizer ?? supply.name;
        })
        .filter((pile): pile is string => !!pile);

      if (!actionSupplyPiles.length) {
        console.warn(`[ferry effect] no Action supply piles available`);
        return;
      }

      const result = await cardEffectArgs.runGameActionDelegate(
        "userPrompt",
        {
          playerId: cardEffectArgs.playerId,
          prompt: "Which Action supply?",
          content: {
            type: "select-pile",
            pileNames: actionSupplyPiles,
            selectCount: { kind: "exact", count: 1 } as CountSpec,
          },
        },
      ) as string[];

      const selectedPile = result?.[0];
      if (!selectedPile) {
        console.warn(`[ferry effect] no pile selected`);
        return;
      }

      console.debug(`[ferry effect] moving -$2 cost token to ${selectedPile}`);

      const existingTokenEntry = Object.entries(
        cardEffectArgs.match.tokens ?? {},
      )
        .find(([_tokenInstanceId, token]) =>
          token.tokenId === adventuresTokenIds.minusCostTwo &&
          token.ownerId === cardEffectArgs.playerId
        );

      if (!existingTokenEntry) {
        console.warn(`[ferry effect] no -$2 cost token for player`);
        return;
      }

      // Register the Ferry cost rule the first time the token is placed.
      const cards = cardEffectArgs.cardLibrary.getAllCardsAsArray().filter(
        (c) => c.randomizer === selectedPile
      );

      // todo: this never cleans up old rules, but those old rules won't work when a token moves because the rule
      // checks the location s that's ok. but it really should be cleaned up. there isn'ta  good way in general to
      // track price rules per effect/card/etc
      for (const card of cards) {
        const rule: CardPriceRule = (_card, ruleContext) => {
          const currentPlayer = getCurrentPlayer(ruleContext.match);
          const tokenMatchesTurn = Object.values(ruleContext.match.tokens ?? {})
            .some((token) =>
              token.tokenId === adventuresTokenIds.minusCostTwo &&
              token.ownerId === currentPlayer.id &&
              token.location.type === "supplyPile" &&
              token.location.cardKey === selectedPile
            );
          if (!tokenMatchesTurn) {
            return { restricted: false, cost: { treasure: 0 } };
          }
          return { restricted: false, cost: { treasure: -2 } };
        };
        cardEffectArgs.cardPriceController.registerRule(card, rule);
      }

      // Place the -$2 cost token on the chosen pile if it does not exist yet.
      await cardEffectArgs.runGameActionDelegate("moveToken", {
        tokenInstanceId: existingTokenEntry[0],
        location: { type: "supplyPile", cardKey: selectedPile },
      }, { loggingContext: { source: event.id } });
    },
  },
  "lost-arts": {
    registerEffects: () => async (cardEffectArgs) => {
      // Build the list of Action supply piles using the randomizer card types.
      const actionSupplyPiles = cardEffectArgs.match.config.kingdomSupply
        .map((supply) => {
          const pileCard = getPileRandomizerCard(supply.cards, supply.name);
          if (!pileCard?.type?.includes("ACTION")) return null;
          return pileCard.randomizer ?? supply.name;
        })
        .filter((pile): pile is string => !!pile);

      if (!actionSupplyPiles.length) {
        console.warn(`[lost-arts effect] no Action supply piles available`);
        return;
      }

      const result = await cardEffectArgs.runGameActionDelegate(
        "userPrompt",
        {
          playerId: cardEffectArgs.playerId,
          prompt: "Which Action supply?",
          content: {
            type: "select-pile",
            pileNames: actionSupplyPiles,
            selectCount: { kind: "exact", count: 1 } as CountSpec,
          },
        },
      ) as string[];

      const selectedPile = result?.[0];
      if (!selectedPile) {
        console.warn(`[lost-arts effect] no pile selected`);
        return;
      }

      console.debug(`[lost-arts effect] moving +1 Action token to ${selectedPile}`);

      // Find the player's +1 Action token instance to move.
      const existingTokenEntry = Object.entries(
        cardEffectArgs.match.tokens ?? {},
      )
        .find(([_tokenInstanceId, token]) =>
          token.tokenId === adventuresTokenIds.plusAction &&
          token.ownerId === cardEffectArgs.playerId
        );

      if (!existingTokenEntry) {
        console.warn(`[lost-arts effect] no +1 Action token found for player`);
        return;
      }

      await cardEffectArgs.runGameActionDelegate("moveToken", {
        tokenInstanceId: existingTokenEntry[0],
        location: { type: "supplyPile", cardKey: selectedPile },
      }, { loggingContext: { source: cardEffectArgs.cardId } });
    },
  },
  "quest": {
    registerEffects: () => async (cardEffectArgs) => {
      const hand = cardEffectArgs.cardSourceController.getSource(
        "playerHand",
        cardEffectArgs.playerId,
      );
      const handCards = hand.map(cardEffectArgs.cardLibrary.getCard);

      const result = await cardEffectArgs.runGameActionDelegate("userPrompt", {
        playerId: cardEffectArgs.playerId,
        prompt: "Choose one",
        actionButtons: [
          { label: "DISCARD ATTACK", action: 1 },
          { label: "DISCARD 2 COPPER", action: 2 },
          { label: "DISCARD 6 CARDS", action: 3 },
        ],
      }) as { action: number; result: number[] };

      let selectedCardIds: CardId[] = [];
      let gainGold = false;

      if (result.action === 1) {
        selectedCardIds = await cardEffectArgs.runGameActionDelegate(
          "selectCard",
          {
            playerId: cardEffectArgs.playerId,
            prompt: `Discard attack`,
            restrict: handCards.filter((card) => card.type.includes("ATTACK"))
              .map((card) => card.id),
            count: { kind: "upTo", count: hand.length },
          },
        ) as CardId[];
        gainGold = true;
      } else if (result.action === 2) {
        selectedCardIds = await cardEffectArgs.runGameActionDelegate(
          "selectCard",
          {
            playerId: cardEffectArgs.playerId,
            prompt: `Discard 2 copper`,
            restrict: handCards.filter((card) => card.type.includes("ATTACK"))
              .map((card) => card.id),
            count: { kind: "upTo", count: hand.length },
          },
        ) as CardId[];
        gainGold = selectedCardIds.length === 2;
      } else {
        selectedCardIds = await cardEffectArgs.runGameActionDelegate(
          "selectCard",
          {
            playerId: cardEffectArgs.playerId,
            prompt: `Discard 6 cards`,
            restrict: hand,
            count: 6,
          },
        ) as CardId[];
        gainGold = selectedCardIds.length === 6;
      }

      if (!selectedCardIds.length) {
        console.debug(`[quest effect] no card selected`);
        return;
      }

      if (gainGold) {
        const goldCards = cardEffectArgs.findCards([
          { location: "basicSupply" },
          { cardKeys: "gold" },
        ]);

        if (!goldCards.length) {
          console.debug(`[quest effect] no gold cards in supply`);
          return;
        }

        console.debug(`[quest effect] gaining ${goldCards.slice(-1)[0]}`);

        await cardEffectArgs.runGameActionDelegate("gainCard", {
          playerId: cardEffectArgs.playerId,
          cardId: goldCards.slice(-1)[0],
          to: { location: "playerDiscard" },
        });
      }
    },
  },
  "save": {
    registerEffects: () => async (cardEffectArgs) => {
      const event = cardEffectArgs.match.events.find((e) =>
        e.id === cardEffectArgs.cardId
      );

      if (!event) {
        console.warn(`[save effect] event not found`);
        return;
      }

      await cardEffectArgs.runGameActionDelegate("gainBuy", { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource(
        "playerHand",
        cardEffectArgs.playerId,
      );

      const selectedCardIds = await cardEffectArgs.runGameActionDelegate(
        "selectCard",
        {
          playerId: cardEffectArgs.playerId,
          prompt: `Set aside card`,
          restrict: hand,
          count: 1,
        },
      ) as CardId[];

      if (!selectedCardIds.length) {
        console.debug(`[save effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(
        selectedCardIds[0],
      );

      console.debug(`[save effect] setting aside card ${selectedCard}`);

      await cardEffectArgs.runGameActionDelegate("moveCard", {
        toPlayerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: "set-aside" },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate(
        event,
        "endTurn",
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: async () => true,
          triggeredEffectFn: async (triggeredArgs) => {
            console.debug(
              `[save endTurn effect] moving ${selectedCard} to player ${cardEffectArgs.playerId} hand`,
            );

            await triggeredArgs.runGameActionDelegate("moveCard", {
              toPlayerId: cardEffectArgs.playerId,
              cardId: selectedCard.id,
              to: { location: "playerHand" },
            });
          },
        },
      );

      const priceUnsub = cardEffectArgs.cardPriceController.registerRule(
        event,
        (card, context) => {
          if (context.playerId === cardEffectArgs.playerId) {
            return { restricted: true, cost: card.cost };
          }
          return { restricted: false, cost: card.cost };
        },
      );

      cardEffectArgs.reactionManager.registerSystemTemplate(event, "endTurn", {
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: async () => true,
        triggeredEffectFn: async (triggeredArgs) => {
          priceUnsub();
        },
      });
    },
  },
  "scouting-party": {
    registerEffects: () => async (cardEffectArgs) => {
      const event = cardEffectArgs.match.events.find((e) =>
        e.id === cardEffectArgs.cardId
      );

      if (!event) {
        console.warn(`[scouting-party effect] event not found`);
        return;
      }

      await cardEffectArgs.runGameActionDelegate("gainBuy", { count: 1 });

      const deck = cardEffectArgs.cardSourceController.getSource(
        "playerDeck",
        cardEffectArgs.playerId,
      );

      const cardIdsSetAside: CardId[] = [];

      for (let i = 0; i < 5; i++) {
        if (!deck.length) {
          console.debug(`[scouting-party effect] no cards in deck, shuffling`);

          await cardEffectArgs.runGameActionDelegate("shuffleDeck", {
            playerId: cardEffectArgs.playerId,
          });

          if (!deck.length) {
            console.debug(`[scouting-party effect] no cards in deck still`);
            break;
          }
        }

        cardIdsSetAside.push(deck.slice(-1)[0]);

        await cardEffectArgs.runGameActionDelegate("moveCard", {
          toPlayerId: cardEffectArgs.playerId,
          cardId: deck.slice(-1)[0],
          to: { location: "set-aside" },
        });
      }

      if (!cardIdsSetAside.length) {
        console.debug(`[scouting-party effect] no cards set aside`);
        return;
      }

      const result = await cardEffectArgs.runGameActionDelegate("userPrompt", {
        playerId: cardEffectArgs.playerId,
        prompt: "Discard 3 cards",
        content: {
          type: "select",
          cardIds: cardIdsSetAside,
          selectCount: Math.min(3, cardIdsSetAside.length),
        },
      }) as { action: number; result: CardId[] };

      if (!result.result.length) {
        console.warn(`[scouting-party effect] no card selected`);
        return;
      }

      console.debug(
        `[scouting-party effect] discarding ${result.result.length} cards`,
      );

      for (const cardId of result.result) {
        await cardEffectArgs.runGameActionDelegate("discardCard", {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
      }

      const cardIdsToRearrange = cardIdsSetAside.filter((id) =>
        !result.result.includes(id)
      );

      if (!cardIdsToRearrange.length) {
        console.debug(`[scouting-party effect] no cards to rearrange`);
        return;
      }

      if (cardIdsToRearrange.length === 1) {
        console.debug(`[scouting-party effect] one card left, moving to deck`);

        await cardEffectArgs.runGameActionDelegate("moveCard", {
          toPlayerId: cardEffectArgs.playerId,
          cardId: cardIdsToRearrange[0],
          to: { location: "playerDeck" },
        });
      } else {
        const result = await cardEffectArgs.runGameActionDelegate(
          "userPrompt",
          {
            playerId: cardEffectArgs.playerId,
            prompt: "Put back in any order",
            actionButtons: [{ label: "DONE", action: 1 }],
            content: {
              type: "rearrange",
              cardIds: cardIdsToRearrange,
            },
          },
        ) as { action: number; result: number[] };

        if (!result.result.length) {
          console.warn(`[scouting-party effect] no card selected`);
          return;
        }

        console.debug(
          `[scouting-party effect] putting cards ${result.result} back on deck`,
        );

        for (const cardId of result.result) {
          await cardEffectArgs.runGameActionDelegate("moveCard", {
            toPlayerId: cardEffectArgs.playerId,
            cardId,
            to: { location: "playerDeck" },
          });
        }
      }
    },
  },
  "trade": {
    registerEffects: () => async (cardEffectArgs) => {
      const event = cardEffectArgs.match.events.find((e) =>
        e.id === cardEffectArgs.cardId
      );

      if (!event) {
        console.warn(`[trade effect] event not found`);
        return;
      }

      const hand = cardEffectArgs.cardSourceController.getSource(
        "playerHand",
        cardEffectArgs.playerId,
      );

      const selectedCardIds = await cardEffectArgs.runGameActionDelegate(
        "selectCard",
        {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash cards`,
          restrict: hand,
          count: {
            kind: "upTo",
            count: 2,
          },
        },
      ) as CardId[];

      if (!selectedCardIds.length) {
        console.debug(`[trade effect] no card selected`);
        return;
      }

      const silverCards = cardEffectArgs.findCards([
        { location: "basicSupply" },
        { cardKeys: "silver" },
      ]);

      if (!silverCards.length) {
        console.debug(`[trade effect] no silver cards in supply`);
        return;
      }

      console.debug(
        `[trade effect] gaining ${selectedCardIds.length} silver cards`,
      );

      for (let i = 0; i < selectedCardIds.length; i++) {
        const silverCard = silverCards.slice(-i - 1)[0];

        if (!silverCard) {
          console.debug(`[trade effect] no silver cards in supply`);
          break;
        }

        await cardEffectArgs.runGameActionDelegate("gainCard", {
          playerId: cardEffectArgs.playerId,
          cardId: silverCard,
          to: { location: "playerDiscard" },
        });
      }
    },
  },
  "travelling-fair": {
    registerEffects: () => async (cardEffectArgs) => {
      const event = cardEffectArgs.match.events.find((e) =>
        e.id === cardEffectArgs.cardId
      );

      if (!event) {
        console.warn(`[travelling-fair effect] event not found`);
        return;
      }

      await cardEffectArgs.runGameActionDelegate("gainBuy", { count: 2 });

      cardEffectArgs.reactionManager.registerReactionTemplate(
        event,
        "cardGained",
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          allowMultipleInstances: false,
          compulsory: false,
          condition: async (conditionArgs) => {
            if (
              conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId
            ) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            const card = triggeredArgs.cardLibrary.getCard(
              triggeredArgs.trigger.args.cardId,
            );

            console.debug(
              `[travelling-fair cardGained effect] putting ${card} on deck`,
            );

            await triggeredArgs.runGameActionDelegate("moveCard", {
              toPlayerId: cardEffectArgs.playerId,
              cardId: card.id,
              to: { location: "playerDeck" },
            });
          },
        },
      );

      cardEffectArgs.reactionManager.registerSystemTemplate(event, "endTurn", {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: false,
        condition: async () => true,
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.reactionManager.unregisterTrigger(
            `travelling-fair:${cardEffectArgs.cardId}:cardGained`,
          );
        },
      });
    },
  },
};

export default effectMap;
