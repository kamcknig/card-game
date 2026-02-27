import { Supply } from 'shared/types/index.ts';
import { ExpansionConfiguratorContext } from '@server-types/index.ts';

export const configureHermit = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomSupply.some(supply => supply.name === 'hermit')) {
    return;
  }

  if (args.config.nonSupply?.some(supply => supply.name === 'madman')) {
    return;
  }

  args.loggerService.info(`[dark-ages configurator - configuring hermit] hermit needs to be configured`);

  const cardData = {
    ...(structuredClone(args.expansionCatalog['dark-ages']?.cardData.kingdomSupply['madman']) ?? {}),
    partOfSupply: false,
  };

  args.config.nonSupply ??= [];

  args.config.nonSupply.push({
    name: 'madman',
    cards: new Array(10).fill({ ...cardData }),
  } as Supply);

  args.loggerService.info(`[dark-ages configurator - configuring hermit] ruins configured`);
};
