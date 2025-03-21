import {CardLocation, Match} from "shared/types.ts";
import { isUndefined } from 'es-toolkit';

export const findSourceByCardId = (
  cardId: number,
  match: Match,
): { sourceStore: any; index?: number; storeKey?: CardLocation } => {
  let sourceStore;
  let storeKey: CardLocation | undefined;

  if (match.supply.includes(cardId)) {
    sourceStore = match.supply;
    storeKey = 'supply';
    console.log("found card", cardId, "in the supply");
  } else if (match.kingdom.includes(cardId)) {
    sourceStore = match.kingdom;
    storeKey = "kingdom";
    console.log("found card", cardId, "in the kingdom");
  } else if (match.playArea.includes(cardId)) {
    sourceStore = match.playArea;
    storeKey = "playArea";
    console.log("found card", cardId, "in the play area");
  } else if (match.trash.includes(cardId)) {
    sourceStore = match.trash;
    storeKey = "trash";
    console.log("found card", cardId, "in the trash");
  } else {
    for (const [playerId, hand] of Object.entries(match.playerHands)) {
      if (hand.includes(cardId)) {
        sourceStore = hand;
        storeKey = "playerHands";
        console.log("found card", cardId, "in player", playerId, "hand");
        break;
      }
    }

    if (!sourceStore) {
      for (const [playerId, deck] of Object.entries(match.playerDecks)) {
        if (deck.includes(cardId)) {
          storeKey = "playerDecks";
          sourceStore = deck;
          console.log("found card", cardId, "in player", playerId, "deck");
          break;
        }
      }
    }

    if (!sourceStore) {
      for (const [playerId, discard] of Object.entries(match.playerDiscards)) {
        if (discard.includes(cardId)) {
          storeKey = "playerDiscards";
          sourceStore = discard;
          console.log("found card", cardId, "in player", playerId, "discard");
          break;
        }
      }
    }
  }

  let idx: number | undefined;
  if (!isUndefined(sourceStore)) {
    idx = sourceStore?.findIndex((e) => e === cardId);
  } else {
    console.error("could not find card source for");
  }

  return { sourceStore, index: idx, storeKey };
};
