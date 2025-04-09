import { AppSocket, EffectHandlerMap, IEffectRunner, ReactionTemplate, } from '../types.ts';
import { fisherYatesShuffle } from '../utils/fisher-yates-shuffler.ts';
import { findCards } from '../utils/find-cards.ts';
import { ReactionManager } from './reaction-manager.ts';
import { Match, PlayerId } from 'shared/shared-types.ts';
import { findOrderedEffectTargets } from '../utils/find-ordered-effect-targets.ts';
import { findSourceByCardId } from '../utils/find-source-by-card-id.ts';
import { findSpecLocationBySource } from '../utils/find-spec-location-by-source.ts';
import { findSourceByLocationSpec } from '../utils/find-source-by-location-spec.ts';
import { castArray, isNumber, isUndefined, toNumber } from 'es-toolkit/compat';
import { MoveCardEffect } from './effects/move-card.ts';
import { cardDataOverrides, getCardOverrides } from '../card-data-overrides.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { UserPromptEffect } from './effects/user-prompt.ts';
import { CardLibrary } from './card-library.ts';
import { ShuffleDeckEffect } from './effects/shuffle-card.ts';
import { cardLifecycleMap } from './card-lifecycle-map.ts';

/**
 * Returns an object whose properties are functions. The names are a union of Effect types
 * and whose values are functions to implement that Effect within the system
 */
export const createEffectHandlerMap = (
  socketMap: Map<PlayerId, AppSocket>,
  reactionManager: ReactionManager,
  cardEffectRunner: IEffectRunner,
  interactivityController: CardInteractivityController,
  cardLibrary: CardLibrary,
): EffectHandlerMap => {
  const effectHandlerMap: EffectHandlerMap = {
    discardCard(effect, match) {
      socketMap.forEach((s) =>
        s.emit("addLogEntry", {
          type: "discard",
          playerSourceId: effect.playerId,
          cardId: effect.cardId,
        })
      );

      return effectHandlerMap.moveCard(
        new MoveCardEffect({
          sourceCardId: effect.sourceCardId,
          sourcePlayerId: effect.sourcePlayerId,
          cardId: effect.cardId,
          toPlayerId: effect.playerId,
          to: { location: "playerDiscards" },
        }),
        match,
      );
    },
    drawCard(effect, match) {
      let deck = match.playerDecks[effect.playerId];
      const discard = match.playerDiscards[effect.playerId];

      if (discard.length + deck.length === 0) {
        console.log(
          "[DRAW CARD EFFECT HANDLER] not enough cards to draw in deck + hand",
        );
        return;
      }

      // todo: here and other places, i'm manually shuffling the discard into the deck.
      // this might mess with reaction triggers as they are added when cards are moved
      // to different play areas via the moveCard effect handler. (there are some in
      // later sets that can be played from the deck for example and if those are handled
      // via reactions and triggers then their reactions wont' get registered properly
      if (deck.length === 0) {
        console.log(
          `[DRAW CARD EFFECT HANDLER] not enough cards in deck, shuffling`,
        );
        effectHandlerMap.shuffleDeck(
          new ShuffleDeckEffect({
            playerId: effect.playerId,
          }),
          match,
        );
        deck = match.playerDecks[effect.playerId];
      }

      const drawnCardId = deck.slice(-1)?.[0];
      if (!drawnCardId) {
        console.log(`[DRAW CARD EFFECT HANDLER] no card drawn`);
        return;
      }

      console.log(
        `[DRAW CARD EFFECT HANDLER] card drawn ${
          cardLibrary.getCard(drawnCardId)
        }`,
      );

      socketMap.forEach((s) =>
        s.emit("addLogEntry", {
          type: "draw",
          playerSourceId: effect.playerId,
          cardId: drawnCardId,
        })
      );

      effectHandlerMap.moveCard(
        new MoveCardEffect({
          sourceCardId: effect.sourceCardId,
          sourcePlayerId: effect.sourcePlayerId,
          cardId: drawnCardId,
          toPlayerId: effect.playerId,
          to: { location: "playerHands" },
        }),
        match,
      );

      return { result: drawnCardId };
    },
    gainAction(effect, match) {
      match.playerActions = match.playerActions + effect.count;

      socketMap.forEach((s) =>
        s.emit("addLogEntry", {
          type: "gainAction",
          count: effect.count,
          playerSourceId: effect.sourcePlayerId,
        })
      );
      return undefined;
    },
    gainBuy(effect, match) {
      match.playerBuys = match.playerBuys + effect.count;
      socketMap.forEach((s) =>
        s.emit("addLogEntry", {
          type: "gainBuy",
          count: effect.count,
          playerSourceId: effect.sourcePlayerId,
        })
      );
      return undefined;
    },
    gainCard(effect, match) {
      effect.to.location ??= "playerDiscards";

      socketMap.forEach((s) =>
        s.emit("addLogEntry", {
          type: "gainCard",
          cardId: effect.cardId,
          playerSourceId: effect.playerId,
        })
      );

      return effectHandlerMap.moveCard(
        new MoveCardEffect({
          to: effect.to,
          sourcePlayerId: effect.sourcePlayerId,
          sourceCardId: effect.sourceCardId,
          toPlayerId: effect.playerId,
          cardId: effect.cardId,
        }),
        match,
      );
    },
    gainTreasure(effect, match) {
      match.playerTreasure = match.playerTreasure + effect.count;
      socketMap.forEach((s) =>
        s.emit("addLogEntry", {
          type: "gainTreasure",
          count: effect.count,
          playerSourceId: effect.sourcePlayerId,
        })
      );
      return undefined;
    },
    moveCard(
      effect: MoveCardEffect,
      match: Match,
    ) {
      const card = cardLibrary.getCard(effect.cardId);

      const {
        sourceStore: oldStore,
        index,
        storeKey: oldStoreKey,
      } = findSourceByCardId(effect.cardId, match, cardLibrary);

      if (!oldStoreKey || isUndefined(index)) {
        console.log(
          "[MOVE CARD EFFECT HANDLER] could not find card in a store to move it",
        );
        return undefined;
      }

      console.log(
        `[MOVE CARD EFFECT HANDLER] moving card ${card} from ${oldStoreKey} to ${effect.to.location}`,
      );

      effect.to.location = castArray(effect.to.location);

      const newStore = findSourceByLocationSpec({
        spec: effect.to,
        playerId: effect.toPlayerId,
      }, match);

      if (!newStore) {
        console.log(
          "[MOVE CARD EFFECT HANDLER] could not find new store to move card to",
        );
        return undefined;
      }

      oldStore.splice(index, 1);

      const oldLoc = findSpecLocationBySource(match, oldStore);
      let unregisterIds: string[] | undefined = undefined;

      // when a card moves out of a location, check if we need to unregister any triggers for the card
      // todo: account for moves to non-player locations i.e., deck, trash, discard, etc.
      // todo: this can also add triggers, not just remove
      switch (oldLoc) {
        case "playerHands":
          unregisterIds = cardLifecycleMap[card.cardKey]?.["onLeaveHand"]?.({
            playerId: effect.toPlayerId!,
            cardId: effect.cardId,
          })?.unregisterTriggers;
          break;
        case "playArea":
          unregisterIds = cardLifecycleMap[card.cardKey]?.["onLeavePlay"]?.({
            playerId: effect.toPlayerId!,
            cardId: effect.cardId,
          })?.unregisterTriggers;
          break;
      }

      unregisterIds?.forEach((id) => reactionManager.unregisterTrigger(id));

      newStore.splice(
        isNaN(toNumber(effect.to.index)) ? newStore.length : effect.to.index!,
        0,
        effect.cardId,
      );
      // newStore.push(effect.cardId);

      // when a card moves to a new location, check if we need to register any triggers for the card
      // todo: account for moves to non-player locations i.e., deck, trash, discard, etc.
      // todo: this can also remove triggers, not just add
      let triggerTemplates: ReactionTemplate[] | void = undefined;
      if (effect.toPlayerId) {
        switch (effect.to.location[0]) {
          case "playerHands":
            triggerTemplates = cardLifecycleMap[card.cardKey]
              ?.["onEnterHand"]?.({
                playerId: effect.toPlayerId,
                cardId: effect.cardId,
              })?.registerTriggers;
            break;
        }
      } else {
        switch(effect.to.location[0]) {
          case "playArea":
            triggerTemplates = cardLifecycleMap[card.cardKey]
              ?.["onEnterPlay"]?.({
              playerId: effect.sourcePlayerId,
              cardId: effect.cardId,
            })?.registerTriggers;
        }
      }
      triggerTemplates?.forEach((triggerTemplate) =>
        reactionManager.registerReactionTemplate(triggerTemplate)
      );

      // update the match stores old location
      if (
        ["playerHands", "playerDecks", "playerDiscards"].includes(oldStoreKey)
      ) {
        if (effect.toPlayerId) {
          switch (oldStoreKey) {
            case "playerHands":
              match.playerHands = {
                ...match.playerHands,
                [effect.toPlayerId]: oldStore,
              };
              break;
            case "playerDiscards":
              match.playerDiscards = {
                ...match.playerDiscards,
                [effect.toPlayerId]: oldStore,
              };
              break;
            case "playerDecks":
              match.playerDecks = {
                ...match.playerDecks,
                [effect.toPlayerId]: oldStore,
              };
              break;
          }
        }
      } else {
        match[oldStoreKey] = oldStore;
      }
      
      // update the match stores new location
      if (
        effect.to.location.some((l) =>
          ["playerHands", "playerDecks", "playerDiscards"].includes(l)
        )
      ) {
        if (effect.toPlayerId) {
          switch (effect.to.location[0]) {
            case "playerHands":
              match.playerHands = {
                ...match.playerHands,
                [effect.toPlayerId]: newStore,
              };
              break;
            case "playerDiscards":
              match.playerDiscards = {
                ...match.playerDiscards,
                [effect.toPlayerId]: newStore,
              };
              break;
            case "playerDecks":
              match.playerDecks = {
                ...match.playerDecks,
                [effect.toPlayerId]: newStore,
              };
              break;
          }
        }
      } else {
        match[effect.to.location[0]] = newStore as unknown as any;
      }
    },
    playCard(effect, match) {
      const { playerId, sourceCardId, sourcePlayerId, cardId } = effect;

      socketMap.forEach((s) =>
        s.emit("addLogEntry", {
          type: "playCard",
          cardId: effect.cardId,
          playerSourceId: effect.sourcePlayerId,
        })
      );

      match.cardsPlayed[sourcePlayerId] ??= [];
      match.cardsPlayed[sourcePlayerId].push(sourceCardId);
      return { result: undefined };
    },
    revealCard(effect, _match) {
      console.log(
        `[REVEAL CARD EFFECT HANDLER] revealing card ${
          cardLibrary.getCard(effect.cardId)
        }`,
      );
      socketMap.forEach((s) =>
        s.emit("addLogEntry", {
          type: "revealCard",
          cardId: effect.cardId,
          playerSourceId: effect.playerId,
        })
      );

      return undefined;
    },
    selectCard(effect, match) {
      effect.count ??= 1;

      let selectableCardIds: number[] = [];
      const playerId = effect.playerId;

      if (effect.restrict === "SELF") { // the card that triggered the effect action
        if (effect.sourceCardId) {
          console.log(
            `[SELECT CARD EFFECT HANDLER] setting selection to effect's source card ${
              cardLibrary.getCard(effect.sourceCardId)
            }`,
          );
          selectableCardIds = [effect.sourceCardId];
        } else {
          throw new Error(
            `[SELECT CARD EFFECT HANDLER] effect restriction set to 'SELF' but no sourceCardId was found.`,
          );
        }
      } else if (Array.isArray(effect.restrict)) { // should be a list of card IDs
        console.log(
          `[SELECT CARD EFFECT HANDLER] setting selection to list of cards ${
            effect.restrict.map((id) => cardLibrary.getCard(id))
          }`,
        );
        return { result: effect.restrict };
      } else if (effect.restrict.from) {
        if (effect.restrict.from.location === "playerDecks") {
          console.warn(
            "[SELECT CARD EFFECT HANDLER] will not be able to select from deck, not sending it to client, nor able to show them to them right now",
          );
          return { result: [] };
        }
        selectableCardIds = findCards(
          match,
          effect.restrict,
          cardLibrary,
          playerId,
        );
        console.log(
          `[SELECT CARD EFFECT HANDLER] found selectable cards ${
            selectableCardIds.map((id) => cardLibrary.getCard(id))
          }`,
        );
      }

      if (selectableCardIds?.length === 0) {
        console.log(
          `[SELECT CARD EFFECT HANDLER] found no cards within restricted set ${effect.restrict}`,
        );
        return { result: [] };
      }

      // if there aren't enough cards, depending on the selection type, we might simply implicitly select cards
      // because the player would be forced to select hem all anyway
      if (isNumber(effect.count)) {
        const count = effect.count;

        console.log(
          `[SELECT CARD EFFECT HANDLER] selection count is an exact count ${count} checking if user has that many cards`,
        );

        if (selectableCardIds.length <= count) {
          console.log(
            "[SELECT CARD EFFECT HANDLER] user does not have enough, or has exactly the amount of cards to select from, selecting all automatically",
          );
          return { result: selectableCardIds };
        }
      }
      
      const socket = socketMap.get(playerId);
      const currentPlayer = match.players[match.currentPlayerTurnIndex];
      const signalId = `selectCard:${playerId}:${Date.now()}`;
      
      // if the player being prompted is not the current player,
      // let the other players know that we are waiting.
      if (currentPlayer.id !== effect.playerId) {
        socket?.on('userInputReceived', (signal) => {
          if (signal !== signalId) return;
          socketMap.forEach((s) =>
            s !== socket && s.emit("doneWaitingForPlayer", effect.playerId)
          );
        });
        
        socketMap.forEach((s) =>
          s !== socket && s.emit("waitingForPlayer", effect.playerId)
        );
      }
      
      socket?.emit("selectCard", signalId, { ...effect, selectableCardIds });
      
      return {
        pause: true,
        signalId
      }
    },
    shuffleDeck(effect: ShuffleDeckEffect, match: Match) {
      const playerId = effect.playerId;
      console.log(
        `[SHUFFLE DECK EFFECT HANDLER] shuffling deck for ${
          match.players.find((player) => player.id === playerId)
        }`,
      );

      const deck = match.playerDecks[playerId];
      const discard = match.playerDiscards[playerId];

      match.playerDecks[playerId] = fisherYatesShuffle(discard).concat(deck);
      match.playerDiscards[playerId] = [];

      match.playerDecks = {
        ...match.playerDecks ?? {},
        [playerId]: match.playerDecks[playerId],
      };
      match.playerDiscards = {
        ...match.playerDiscards ?? {},
        [playerId]: [],
      };
      
      return undefined;
    },
    trashCard(effect, match) {
      socketMap.forEach((s) =>
        s.emit("addLogEntry", {
          type: "trashCard",
          cardId: effect.cardId,
          playerSourceId: effect.playerId!,
        })
      );

      return effectHandlerMap.moveCard(
        new MoveCardEffect({
          to: { location: "trash" },
          sourcePlayerId: effect.sourcePlayerId,
          sourceCardId: effect.sourceCardId,
          toPlayerId: effect.playerId,
          cardId: effect.cardId,
        }),
        match,
      );
    },
    userPrompt(effect: UserPromptEffect, match: Match) {
      console.log(
        "[USER PROMPT EFFECT HANDLER] effectHandler userPrompt",
        effect,
      );

      const socket = socketMap.get(effect.playerId);
      const currentPlayer = match.players[match.currentPlayerTurnIndex];
      const signalId = `userPrompt:${effect.playerId}:${Date.now()}`;
      socket?.emit("userPrompt", signalId, effect);

      // if the player being prompted is not the current player,
      // let the other players know that we are waiting.
      if (currentPlayer.id !== effect.playerId) {
        socket?.on('userInputReceived', (signal) => {
          if (signal !== signalId) return;
          socketMap.forEach((s) =>
            s !== socket && s.emit("doneWaitingForPlayer", effect.playerId)
          );
        });
        
        socketMap.forEach((s) =>
          s !== socket && s.emit("waitingForPlayer", effect.playerId)
        );
      }
      
      return {
        pause: true,
        signalId,
      };
    },
    modifyCost(effect, match) {
      const targets = findOrderedEffectTargets(
        effect.sourcePlayerId,
        effect.appliesTo,
        match,
      );

      cardDataOverrides.push({ targets, overrideEffect: effect });

      const overrides = getCardOverrides(match, cardLibrary);

      for (const targetId of targets) {
        const playerOverrides = overrides?.[targetId];
        const socket = socketMap.get(targetId);
        socket?.emit("setCardDataOverrides", playerOverrides);
      }

      // todo is this needed?
      interactivityController.checkCardInteractivity();
      
      return undefined
    }
  };
  return effectHandlerMap;
};
