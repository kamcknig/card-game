import { ExpansionConfiguratorContext } from '@server-types/index.ts';
import { expansionLibrary } from '../expansion-library.ts';

// Adds the Imp non-supply pile when cards that gain Imps are present.
export const configureImp = (args: ExpansionConfiguratorContext) => {
  if (args.config.nonSupply?.some((supply) => supply.name === 'imp')) {
    console.info('[nocturne configurator - imp] pile already configured');
    return;
  }

  console.info('[nocturne configurator - imp] configuring Imp pile');

  args.config.nonSupply ??= [];

  const baseCard = structuredClone(
    expansionLibrary['nocturne'].cardData.kingdomSupply['imp'],
  );

  if (!baseCard) {
    console.warn('[nocturne configurator - imp] card data not found');
    return;
  }

  const card = {
    ...baseCard,
    partOfSupply: false,
    tags: ['imp'],
  };

  args.config.nonSupply.push({
    name: 'imp',
    cards: new Array(13).fill({ ...card }),
  });

  console.info('[nocturne configurator - imp] Imp pile configured');
};
