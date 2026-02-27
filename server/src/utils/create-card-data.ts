import { CardKey, CardLikeNoId, CardNoId } from 'shared/types/index.ts';
import { formatCardName } from './format-card-name.ts';

export const createCardData = (cardKey: CardKey, expansionName: string, templateData: Partial<CardNoId>) => {
  const data = {
    ...createCardLike(cardKey, expansionName, templateData),
    halfImagePath: `./assets/card-images/${expansionName}/half-size/${cardKey}.jpg`,
    kingdom: templateData.kingdom ?? cardKey,
  };

  return data as CardNoId;
};

type CreateCardLikeTemplate = Partial<CardLikeNoId> & { kingdom?: string };

export const createCardLike = (
  cardKey: CardKey,
  expansionName: string,
  templateData: CreateCardLikeTemplate,
): CardLikeNoId => {
  // Default the pile/kingdom key to the randomizer data when provided.
  const randomizerFromData = templateData.randomizerData?.randomizer;
  const resolvedKingdom = templateData.kingdom ?? randomizerFromData ?? cardKey;
  const data = {
    cardKey,
    expansionName,
    detailImagePath: `./assets/card-images/${expansionName}/detail/${cardKey}.jpg`,
    fullImagePath: `./assets/card-images/${expansionName}/full-size/${cardKey}.jpg`,
    ...(templateData ?? {}),
    // Default card names follow the standard format rules unless overridden by card data.
    cardName: templateData.cardName ?? formatCardName(cardKey),
    kingdom: resolvedKingdom,
  } as CardLikeNoId;
  return data;
};
