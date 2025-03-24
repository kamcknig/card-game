import {CardLocation, Match} from "shared/types.ts";
import { isUndefined } from 'es-toolkit';
import { getPlayerById } from './utils/get-player-by-id.ts';

export const findSourceByCardId = (
  cardId: number,
  match: Match,
): { sourceStore: any; index?: number; storeKey?: CardLocation } => {
  let sourceStore;
  let storeKey: CardLocation | undefined;

  if (match.supply.includes(cardId)) {
    sourceStore = match.supply;
    storeKey = 'supply';
    console.debug(`found card ${match.cardsById[cardId]} in the supply`);
  } else if (match.kingdom.includes(cardId)) {
    sourceStore = match.kingdom;
    storeKey = "kingdom";
    console.debug(`found card ${match.cardsById[cardId]} in the kingdom`);
  } else if (match.playArea.includes(cardId)) {
    sourceStore = match.playArea;
    storeKey = "playArea";
    console.debug(`found card ${match.cardsById[cardId]} in the play area`);
  } else if (match.trash.includes(cardId)) {
    sourceStore = match.trash;
    storeKey = "trash";
    console.debug(`found card ${match.cardsById[cardId]} in the trash`);
  } else {
    for (const [playerId, hand] of Object.entries(match.playerHands)) {
      if (hand.includes(cardId)) {
        sourceStore = hand;
        storeKey = "playerHands";
        console.debug(`found card ${match.cardsById[cardId]} in ${getPlayerById(+playerId)} hand`);
        break;
      }
    }

    if (!sourceStore) {
      for (const [playerId, deck] of Object.entries(match.playerDecks)) {
        if (deck.includes(cardId)) {
          storeKey = "playerDecks";
          sourceStore = deck;
          console.debug(`found card ${match.cardsById[cardId]} in ${getPlayerById(+playerId)} deck`);
          break;
        }
      }
    }

    if (!sourceStore) {
      for (const [playerId, discard] of Object.entries(match.playerDiscards)) {
        if (discard.includes(cardId)) {
          storeKey = "playerDiscards";
          sourceStore = discard;
          console.debug(`found card ${match.cardsById[cardId]} in ${getPlayerById(+playerId)} discard`);
          break;
        }
      }
    }
  }

  let idx: number | undefined;
  if (!isUndefined(sourceStore)) {
    idx = sourceStore?.findIndex((e) => e === cardId);
  } else {
    console.error(`could not find card store for ${match.cardsById[cardId]}`);
  }

  return { sourceStore, index: idx, storeKey };
};
