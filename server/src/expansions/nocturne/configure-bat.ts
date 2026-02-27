import { ExpansionConfiguratorContext } from '@server-types/index.ts';

// Adds the Bat non-supply pile when Vampire is present.
export const configureBat = (args: ExpansionConfiguratorContext) => {
  if (args.config.nonSupply?.some(supply => supply.name === 'bat')) {
    args.loggerService.info('[nocturne configurator - bat] pile already configured');
    return;
  }

  args.loggerService.info('[nocturne configurator - bat] configuring Bat pile');

  args.config.nonSupply ??= [];

  const baseCard = structuredClone(args.expansionCatalog['nocturne']?.cardData.kingdomSupply['bat']);

  if (!baseCard) {
    args.loggerService.warn('[nocturne configurator - bat] card data not found');
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

  args.loggerService.info('[nocturne configurator - bat] Bat pile configured');
};
