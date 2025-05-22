import { capitalize } from "es-toolkit";
import { CardKey, CardLikeNoId, CardNoId } from 'shared/shared-types.ts';

export const createCardData = (cardKey: CardKey, expansionName: string, templateData: Partial<CardNoId>) => {
  const data = {
    ...createCardLike(cardKey, expansionName, templateData),
    halfImagePath: `./assets/card-images/${expansionName}/half-size/${cardKey}.jpg`,
    kingdom: templateData.kingdom ?? cardKey,
  }
  
  return data as CardNoId;
};

export const createCardLike = (cardKey: CardKey, expansionName: string, templateData: Partial<CardLikeNoId>): CardLikeNoId => {
  const data = {
    cardKey,
    expansionName,
    detailImagePath: `./assets/card-images/${expansionName}/detail/${cardKey}.jpg`,
    fullImagePath: `./assets/card-images/${expansionName}/full-size/${cardKey}.jpg`,
    ...templateData ?? {},
    cardName: templateData.cardName ?? capitalize(cardKey),
    randomizer: templateData.randomizer !== undefined ? templateData.randomizer : cardKey
  } as CardLikeNoId;
  return data;
}