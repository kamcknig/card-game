import { ExpansionConfiguratorContext } from '@server-types/index.ts';
import { expansionLibrary } from '../expansion-library.ts';

// Adds the Will-o'-Wisp non-supply pile when boons are in use.
export const configureWillOWisp = (args: ExpansionConfiguratorContext) => {
  if (args.config.nonSupply?.some((supply) => supply.name === 'will-o-wisp')) {
    console.info('[nocturne configurator - will-o-wisp] pile already configured');
    return;
  }

  console.info("[nocturne configurator - will-o-wisp] configuring Will-o'-Wisp pile");

  args.config.nonSupply ??= [];

  const baseCard = structuredClone(
    expansionLibrary['nocturne'].cardData.kingdomSupply['will-o-wisp'],
  );

  if (!baseCard) {
    console.warn('[nocturne configurator - will-o-wisp] card data not found');
    return;
  }

  const card = {
    ...baseCard,
    partOfSupply: false,
    tags: ['will-o-wisp'],
  };

  args.config.nonSupply.push({
    name: 'will-o-wisp',
    cards: new Array(12).fill({ ...card }),
  });

  console.info("[nocturne configurator - will-o-wisp] Will-o'-Wisp pile configured");
};
