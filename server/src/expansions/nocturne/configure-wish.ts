import { ExpansionConfiguratorContext } from '../../types.ts';
import { expansionLibrary } from '../expansion-library.ts';

// Adds the Wish non-supply pile when cards that gain Wishes are present.
export const configureWish = (args: ExpansionConfiguratorContext) => {
  if (args.config.nonSupply?.some((supply) => supply.name === 'wish')) {
    console.info('[nocturne configurator - wish] pile already configured');
    return;
  }

  console.info('[nocturne configurator - wish] configuring Wish pile');

  args.config.nonSupply ??= [];

  const baseCard = structuredClone(
    expansionLibrary['nocturne'].cardData.kingdomSupply['wish'],
  );

  if (!baseCard) {
    console.warn('[nocturne configurator - wish] card data not found');
    return;
  }

  const card = {
    ...baseCard,
    partOfSupply: false,
    tags: ['wish'],
  };

  args.config.nonSupply.push({
    name: 'wish',
    cards: new Array(12).fill({ ...card }),
  });

  console.info('[nocturne configurator - wish] Wish pile configured');
};
