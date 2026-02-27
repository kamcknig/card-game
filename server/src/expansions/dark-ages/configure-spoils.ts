import { ExpansionConfiguratorContext } from '@server-types/index.ts';

export const configureSpoils = async (args: ExpansionConfiguratorContext) => {
  const hasSpoilsSource = args.config.kingdomSupply.some((kingdom) =>
    ['marauder', 'pillage', 'bandit-camp'].includes(kingdom.name)
  );
  const existingSpoilsPiles = (args.config.nonSupply ?? []).filter((supply) => supply.name === 'spoils');

  // Remove stale Spoils piles when no source card is configured.
  if (!hasSpoilsSource) {
    if (existingSpoilsPiles.length > 0) {
      args.loggerService.info(
        `[dark-ages configurator - configuring spoils] removing ${existingSpoilsPiles.length} stale spoils pile(s)`,
      );
      args.config.nonSupply = (args.config.nonSupply ?? []).filter((supply) => supply.name !== 'spoils');
    }
    return;
  }

  // Keep exactly one Spoils pile to preserve deterministic setup convergence.
  if (existingSpoilsPiles.length > 1) {
    args.loggerService.info(
      `[dark-ages configurator - configuring spoils] found ${existingSpoilsPiles.length} spoils piles; trimming to one`,
    );
    let keptFirstSpoilsPile = false;
    args.config.nonSupply = (args.config.nonSupply ?? []).filter((supply) => {
      if (supply.name !== 'spoils') {
        return true;
      }
      if (!keptFirstSpoilsPile) {
        keptFirstSpoilsPile = true;
        return true;
      }
      return false;
    });
    return;
  }

  if (existingSpoilsPiles.length === 1) {
    args.loggerService.debug(`[dark-ages configurator - configuring spoils] spoils already configured`);
    return;
  }

  args.loggerService.info(`[dark-ages configurator - configuring spoils] spoils needs to be configured`);

  args.config.nonSupply ??= [];

  const card = {
    ...structuredClone(args.expansionCatalog['dark-ages']?.cardData.kingdomSupply['spoils']),
    partOfSupply: false,
    tags: ['spoils'],
  };

  args.config.nonSupply.push({
    name: 'spoils',
    cards: new Array(15).fill({ ...card }),
  });

  args.loggerService.info(`[dark-ages configurator - configuring spoils] spoils configured`);
};
