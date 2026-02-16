import { CardEffectFunctionContext } from '@server-types/index.ts';
import { Card, CardId, CardKey, CardLocationSpec, PlayerId } from 'shared/types/index.ts';
import { getCardPileKey } from './get-card-pile-key.ts';

// Supply locations that can provide top cards for pile-key gain effects.
type SupplyLocation = 'basicSupply' | 'kingdomSupply';

// Shared context used to read supply cards and execute gain actions.
type GainTopSupplyCardByPileKeyContext = Pick<CardEffectFunctionContext, 'findCards' | 'runGameActionDelegate'>;

// Finds the top card in the specified Supply location(s) for the given pile key.
export const findTopSupplyCardForPileKey = (
  context: GainTopSupplyCardByPileKeyContext,
  args: {
    pileKey: CardKey;
    from?: SupplyLocation | SupplyLocation[];
  },
): Card | undefined => {
  // Normalize input so callers can pass one location or a list.
  const supplyLocations = args.from
    ? (Array.isArray(args.from) ? args.from : [args.from])
    : ['basicSupply', 'kingdomSupply'];

  // Filter by pile key so split piles resolve to the correct current top card.
  return context.findCards([
    { location: supplyLocations },
  ]).filter((card) => getCardPileKey(card) === args.pileKey).slice(-1)[0];
};

// Gains the current top card for a pile key from Supply to the specified destination.
export const gainTopSupplyCardForPileKey = async (
  context: GainTopSupplyCardByPileKeyContext,
  args: {
    playerId: PlayerId;
    pileKey: CardKey;
    to: CardLocationSpec;
    from?: SupplyLocation | SupplyLocation[];
    logTag?: string;
  },
): Promise<CardId | undefined> => {
  // Use a stable default tag so logs are still useful if a caller omits logTag.
  const tag = args.logTag ?? 'gainTopSupplyCardForPileKey';
  const fromLocations = args.from
    ? (Array.isArray(args.from) ? args.from : [args.from])
    : ['basicSupply', 'kingdomSupply'];

  console.debug(
    `[${tag}] attempting top-supply gain for player ${args.playerId}: pileKey=${args.pileKey}, from=${fromLocations.join(',')}, to=${args.to.location}`,
  );

  const topSupplyCard = findTopSupplyCardForPileKey(context, { pileKey: args.pileKey, from: args.from });
  if (!topSupplyCard) {
    console.debug(`[${tag}] no ${args.pileKey} pile card in Supply to gain`);
    return undefined;
  }

  console.debug(`[${tag}] found top cardId=${topSupplyCard.id} for pile ${args.pileKey}, gaining now`);

  await context.runGameActionDelegate('gainCard', {
    playerId: args.playerId,
    cardId: topSupplyCard.id,
    to: args.to,
  });

  console.debug(`[${tag}] gained cardId=${topSupplyCard.id} for player ${args.playerId}`);

  return topSupplyCard.id;
};
