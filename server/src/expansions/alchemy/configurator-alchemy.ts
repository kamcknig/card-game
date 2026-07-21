import { ExpansionConfiguratorFactory } from '@server-types/index.ts';

const configurator: ExpansionConfiguratorFactory = () => {
  let potionConfigured = false;

  return async args => {
    args.loggerService.info(`configuring match for alchemy`);

    if (potionConfigured) {
      args.loggerService.info(`[alchemy match configurator] potion already configured`);
      return args.config;
    }

    const potionCard = args.cardLibrary['potion'];

    if (!potionCard) {
      throw new Error(`potion card not found in card library`);
    }

    const alchemySupplies = args.config.kingdomSupply.filter(supply =>
      supply.cards.some(card => card.expansionName === 'alchemy'),
    );

    for (const supply of alchemySupplies) {
      if (potionConfigured) {
        break;
      }

      for (const card of supply.cards) {
        if (card.cost.potion === undefined) {
          continue;
        }

        args.loggerService.info(
          `[alchemy match configurator] adding potion card because ${card.cardKey} has a potion cost`,
        );
        args.config.basicSupply.push({
          name: 'potion',
          cards: new Array(16).fill(args.cardLibrary['potion']),
        });
        potionConfigured = true;
        break;
      }
    }

    return args.config;
  };
};

export default configurator;
