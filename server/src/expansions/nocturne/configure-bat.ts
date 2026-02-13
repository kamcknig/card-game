import { ExpansionConfiguratorContext } from '@server-types/index.ts';
import { expansionLibrary } from '../expansion-library.ts';

// Adds the Bat non-supply pile when Vampire is present.
export const configureBat = (args: ExpansionConfiguratorContext) => {
  if (args.config.nonSupply?.some((supply) => supply.name === 'bat')) {
    console.info('[nocturne configurator - bat] pile already configured');
    return;
  }

  console.info('[nocturne configurator - bat] configuring Bat pile');

  args.config.nonSupply ??= [];

  const baseCard = structuredClone(
    expansionLibrary['nocturne'].cardData.kingdomSupply['bat'],
  );

  if (!baseCard) {
    console.warn('[nocturne configurator - bat] card data not found');
    return;
  }

  const card = {
    ...baseCard,
    partOfSupply: false,
    tags: ['bat'],
  };

  args.config.nonSupply.push({
    name: 'bat',
    cards: new Array(10).fill({ ...card }),
  });

  console.info('[nocturne configurator - bat] Bat pile configured');
};
