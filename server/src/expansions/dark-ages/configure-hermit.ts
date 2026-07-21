import { Supply } from 'shared/types/index.ts';
import { ExpansionConfiguratorContext } from '@server-types/index.ts';

export const configureHermit = async (args: ExpansionConfiguratorContext) => {
  const hermitSupply = args.config.kingdomSupply.find(supply => supply.name === 'hermit');
  if (!hermitSupply) {
    return;
  }

  // Point Hermit at the Madman pile so the detail dialog can show them as
  // siblings, regardless of whether the Madman pile itself still needs to
  // be built below.
  hermitSupply.cards.forEach(card => {
    card.linkedPileKey = 'madman';
  });

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
