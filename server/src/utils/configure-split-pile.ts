import { CardKey } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../types.ts';
import { getCardPileKey } from './get-card-pile-key.ts';

type SplitPileConfiguration = {
  pileKey: string;
  desiredOrder: CardKey[];
  logLabel: string;
};

// Configure a split pile to match the desired bottom-to-top order in the kingdom supply.
export const configureSplitPile = (
  args: ExpansionConfiguratorContext,
  options: SplitPileConfiguration,
) => {
  // Find the supply pile containing cards that match the split pile key.
  const splitPileSupply = args.config.kingdomSupply.find((supply) =>
    supply.cards.some((card) => getCardPileKey(card) === options.pileKey)
  );

  if (!splitPileSupply) {
    console.info(
      `[split pile configurator] no ${options.logLabel} pile in kingdom supply`,
    );
    return;
  }

  // Compare the current ordering against the canonical desired ordering.
  const currentOrder = splitPileSupply.cards.map((card) => card.cardKey);
  const orderMatches = currentOrder.length === options.desiredOrder.length &&
    currentOrder.every((key, index) => key === options.desiredOrder[index]);

  if (orderMatches) {
    console.info(
      `[split pile configurator] ${options.logLabel} pile already configured`,
    );
    return;
  }

  // Replace the pile with freshly cloned card templates for deterministic order.
  const nextCards = [];
  for (const cardKey of options.desiredOrder) {
    const cardTemplate = args.cardLibrary[cardKey];
    if (!cardTemplate) {
      console.warn(
        `[split pile configurator] missing card template for ${cardKey}`,
      );
      continue;
    }
    nextCards.push(structuredClone(cardTemplate));
  }
  splitPileSupply.cards = nextCards;

  console.log(
    `[split pile configurator] configured ${options.logLabel} split pile`,
  );
};
