import { loggerService } from '@logger';
import { ExpansionConfiguratorContext } from '@server-types/index.ts';

// Adds the Will-o'-Wisp non-supply pile when boons are in use.
export const configureWillOWisp = (args: ExpansionConfiguratorContext) => {
  if (args.config.nonSupply?.some((supply) => supply.name === 'will-o-wisp')) {
    loggerService.info('[nocturne configurator - will-o-wisp] pile already configured');
    return;
  }

  loggerService.info("[nocturne configurator - will-o-wisp] configuring Will-o'-Wisp pile");

  args.config.nonSupply ??= [];

  const baseCard = structuredClone(
    args.expansionCatalog['nocturne']?.cardData.kingdomSupply['will-o-wisp'],
  );

  if (!baseCard) {
    loggerService.warn('[nocturne configurator - will-o-wisp] card data not found');
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

  loggerService.info("[nocturne configurator - will-o-wisp] Will-o'-Wisp pile configured");
};
