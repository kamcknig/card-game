import { capitalize } from "es-toolkit";
import { CardNoId } from "shared/shared-types.ts";

export const createCardData = (cardKey: string, expansionName: string, templateData: Partial<CardNoId>) => {
  const data = {
    cardKey,
    cardName: templateData.cardName ?? capitalize(cardKey),
    expansionName,
    detailImagePath: `./assets/card-images/${expansionName}/detail/${cardKey}.jpg`,
    fullImagePath: `./assets/card-images/${expansionName}/full-size/${cardKey}.jpg`,
    halfImagePath: `./assets/card-images/${expansionName}/half-size/${cardKey}.jpg`,
    ...templateData ?? {},
  }
  
  return data as CardNoId;
};