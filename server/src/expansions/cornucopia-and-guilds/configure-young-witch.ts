import { ExpansionConfiguratorContext } from '@server-types/index.ts';
import { getDefaultKingdomSupplySize } from '../../utils/get-default-kingdom-supply-size.ts';
import { getAvailableKingdomRandomizerGroups } from '../../utils/get-available-kingdom-randomizer-groups.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { ExpansionData } from '../expansion-library.ts';

export const configureYoungWitch = (args: ExpansionConfiguratorContext) => {
  const youngWitchPresent = args.config.kingdomSupply.some(supply => supply.name === 'young-witch');

  // if no witch is present, or if the bane is already configured, no need to configure
  if (
    !youngWitchPresent ||
    args.config.kingdomSupply.some(supply => supply.cards.some(card => card.tags?.includes('bane')))
  ) {
    return;
  }

  args.loggerService.info(`[cornucopia configurator - configuring young-witch] young witch present in supply`);

  const selectedExpansions = args.config.expansions.reduce((expansions, configuredExpansion) => {
    const expansionData = args.expansionCatalog[configuredExpansion.name];
    if (!expansionData) {
      args.loggerService.warn(
        `[cornucopia configurator - configuring young-witch] expansion ${configuredExpansion.name} not found`,
      );
      return expansions;
    }

    expansions.push(expansionData);
    return expansions;
  }, [] as ExpansionData[]);

  const existingPileKeys = Array.from(
    new Set(args.config.kingdomSupply.flatMap(supply => supply.cards.map(card => getCardPileKey(card)))),
  );
  const bannedPileKeys = args.config.bannedKingdoms.map(card => getCardPileKey(card));
  const availableGroups = getAvailableKingdomRandomizerGroups({
    expansions: selectedExpansions,
    excludedPileKeys: existingPileKeys,
    bannedPileKeys,
  });

  if (!availableGroups.length) {
    args.loggerService.info(
      `[cornucopia configurator - configuring young-witch] no available kingdoms, not adding new kingdom`,
    );
    return;
  }

  const chosenGroup = availableGroups[args.rngService.nextIndex(availableGroups.length)];
  if (chosenGroup.cards.length < 1) {
    args.loggerService.warn(
      `[cornucopia configurator - configuring young-witch] selected ${chosenGroup.pileKey} but it has no cards`,
    );
    return;
  }
  const chosenCard = structuredClone(chosenGroup.cards[0]);

  args.loggerService.info(
    `[cornucopia configurator - configuring young-witch] adding ${chosenGroup.pileKey} to kingdom as the "bane" card`,
  );

  chosenCard.tags = Array.from(new Set([...(chosenCard.tags ?? []), 'bane']));

  args.config.kingdomSupply.push({
    name: chosenCard.kingdom,
    cards: new Array(getDefaultKingdomSupplySize(chosenCard, args.config)).fill(chosenCard),
  });
};
