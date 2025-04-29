import { CardId, CardLocation, Match, Mats, Zones } from 'shared/shared-types.ts';
import { isUndefined } from 'es-toolkit';

import { CardLibrary } from '../core/card-library.ts';

export const findSourceByCardId = (
  cardId: number,
  match: Match,
  cardLibrary: CardLibrary,
) => {
  let sourceStore: CardId[] | undefined = undefined;
  let storeKey: CardLocation = 'supply';
  
  if (match.basicSupply.includes(cardId)) {
    sourceStore = match.basicSupply;
    storeKey = 'supply';
  }
  else if (match.kingdomSupply.includes(cardId)) {
    sourceStore = match.kingdomSupply;
    storeKey = 'kingdom';
  }
  else if (match.playArea.includes(cardId)) {
    sourceStore = match.playArea;
    storeKey = 'playArea';
  }
  else if (match.trash.includes(cardId)) {
    sourceStore = match.trash;
    storeKey = 'trash';
  }
  else if (match.activeDurationCards.includes(cardId)) {
    sourceStore = match.activeDurationCards;
    storeKey = 'activeDuration';
  }
  else {
    for (const [playerId, playerMats] of Object.entries(match.mats)) {
      for (const [mat, cardIds] of Object.entries(playerMats)) {
        if (cardIds.includes(cardId)) {
          sourceStore = match.mats[+playerId][mat as Mats];
          storeKey = mat as Mats;
        }
      }
    }
    
    for (const [zone, cardIds] of Object.entries(match.zones)) {
      if (cardIds.includes(cardId)) {
        sourceStore = match.zones[zone as Zones];
        storeKey = zone as Zones;
      }
    }
    
    for (const hand of Object.values(match.playerHands)) {
      if (hand.includes(cardId)) {
        sourceStore = hand;
        storeKey = 'playerHands';
        break;
      }
    }
    
    if (!sourceStore) {
      for (const deck of Object.values(match.playerDecks)) {
        if (deck.includes(cardId)) {
          storeKey = 'playerDecks';
          sourceStore = deck;
          break;
        }
      }
    }
    
    if (!sourceStore) {
      for (const discard of Object.values(match.playerDiscards)) {
        if (discard.includes(cardId)) {
          storeKey = 'playerDiscards';
          sourceStore = discard;
          break;
        }
      }
    }
  }
  
  let idx: number | undefined;
  if (!isUndefined(sourceStore)) {
    idx = sourceStore?.findIndex((e) => e === cardId);
  }
  else {
    console.error(`[FIND CARD SOURCE] could not find card store for ${cardLibrary.getCard(cardId)}`);
    throw new Error('Could not find card store');
  }
  
  return { sourceStore, index: idx, storeKey };
};
