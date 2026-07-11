import { Supply } from 'shared/types/index.ts';
import { ExpansionConfiguratorContext } from '@server-types/index.ts';

export const configureUrchin = async (args: ExpansionConfiguratorContext) => {
  const urchinSupply = args.config.kingdomSupply.find(supply => supply.name === 'urchin');
  if (!urchinSupply) {
    return;
  }

  // Point Urchin at the Mercenary pile so the detail dialog can show them as
  // siblings, regardless of whether the Mercenary pile itself still needs
  // to be built below.
  urchinSupply.cards.forEach(card => {
    card.linkedPileKey = 'mercenary';
  });

  if (args.config.nonSupply?.some(supply => supply.name === 'mercenary')) {
    return;
  }

  args.loggerService.info(`[dark-ages configurator - configuring urchin] urchin needs to be configured`);

  const cardData = {
    ...(structuredClone(args.expansionCatalog['dark-ages']?.cardData.kingdomSupply['mercenary']) ?? {}),
    partOfSupply: false,
  };

  args.config.nonSupply ??= [];

  args.config.nonSupply.push({
    name: 'mercenary',
    cards: new Array(10).fill({ ...cardData }),
  } as Supply);

  args.loggerService.info(`[dark-ages configurator - configuring urchin] urchin configured`);
};
