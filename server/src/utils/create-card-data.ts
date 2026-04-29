import { CardKey, CardLikeNoId, CardNoId } from 'shared/types/index.ts';
import { formatCardName } from './format-card-name.ts';

export const createCardData = (cardKey: CardKey, expansionName: string, templateData: Partial<CardNoId>) => {
  // Cards inherit artImagePath and detailImagePath from createCardLike, both
  // already in the flat asset layout. Only the kingdom default is card-specific.
  const data = {
    ...createCardLike(cardKey, expansionName, templateData),
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
    artImagePath: `./assets/card-images/${expansionName}/${cardKey}-art.jpg`,
    detailImagePath: `./assets/card-images/${expansionName}/${cardKey}-detail.jpg`,
    ...(templateData ?? {}),
    // Default card names follow the standard format rules unless overridden by card data.
    cardName: templateData.cardName ?? formatCardName(cardKey),
    kingdom: resolvedKingdom,
  } as CardLikeNoId;
  return data;
};
