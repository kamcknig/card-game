import { ExpansionConfiguratorContext } from '@server-types/index.ts';

// Each traveller line's four upgrade-tier cards live in their own 5-copy
// pile beside the supply (not one of the 10 chosen Kingdom piles), mirroring
// dark-ages configure-spoils.ts's add/remove symmetry.
const TRAVELLER_LINES: Record<string, string[]> = {
  page: ['treasure-hunter', 'warrior', 'hero', 'champion'],
  peasant: ['soldier', 'fugitive', 'disciple', 'teacher'],
};

export const configureTravellers = async (args: ExpansionConfiguratorContext) => {
  for (const [baseCardKey, upgradeCardKeys] of Object.entries(TRAVELLER_LINES)) {
    const hasBaseCard = args.config.kingdomSupply.some(supply => supply.name === baseCardKey);

    for (const upgradeCardKey of upgradeCardKeys) {
      const existingPiles = (args.config.nonSupply ?? []).filter(supply => supply.name === upgradeCardKey);

      if (!hasBaseCard) {
        if (existingPiles.length > 0) {
          args.loggerService.info(
            `[adventures configurator - configuring travellers] removing stale ${upgradeCardKey} pile`,
          );
          args.config.nonSupply = (args.config.nonSupply ?? []).filter(supply => supply.name !== upgradeCardKey);
        }
        continue;
      }

      if (existingPiles.length > 0) {
        args.loggerService.debug(
          `[adventures configurator - configuring travellers] ${upgradeCardKey} already configured`,
        );
        continue;
      }

      args.loggerService.info(`[adventures configurator - configuring travellers] configuring ${upgradeCardKey} pile`);

      args.config.nonSupply ??= [];

      const card = {
        ...structuredClone(args.expansionCatalog['adventures']?.cardData.kingdomSupply[upgradeCardKey]),
        partOfSupply: false,
        tags: ['traveller'],
      };

      args.config.nonSupply.push({
        name: upgradeCardKey,
        cards: new Array(5).fill({ ...card }),
      });
    }
  }
};
