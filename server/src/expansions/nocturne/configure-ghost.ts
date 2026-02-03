import { ExpansionConfiguratorContext } from '../../types.ts';
import { expansionLibrary } from '../expansion-library.ts';

// Adds the Ghost non-supply pile when Cemetery (Haunted Mirror heirloom) is present.
export const configureGhost = (args: ExpansionConfiguratorContext) => {
  if (args.config.nonSupply?.some(supply => supply.name === 'ghost')) {
    console.info('[nocturne configurator - ghost] pile already configured');
    return;
  }

  console.info('[nocturne configurator - ghost] configuring Ghost pile');

  args.config.nonSupply ??= [];

  const baseCard = structuredClone(
    expansionLibrary['nocturne'].cardData.kingdomSupply['ghost']
  );

  if (!baseCard) {
    console.warn('[nocturne configurator - ghost] card data not found');
    return;
  }

  const card = {
    ...baseCard,
    partOfSupply: false,
    tags: ['ghost'],
  };

  args.config.nonSupply.push({
    name: 'ghost',
    cards: new Array(6).fill({ ...card }),
  });

  console.info('[nocturne configurator - ghost] Ghost pile configured');
};
