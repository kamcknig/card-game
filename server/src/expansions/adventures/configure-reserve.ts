import { ExpansionConfiguratorContext } from '@server-types/index.ts';
import { addMatToMatchConfig } from '../../utils/add-mat-to-match-config.ts';
import { getPileDefinitionCard } from '../../utils/get-pile-definition-card.ts';

// Non-RESERVE kingdoms cards that still require the tavern mat (e.g., Miser puts Coppers on it).
const NON_RESERVE_TAVERN_MAT_CARDS: ReadonlyArray<string> = ['miser'];

export const configureReserve = (args: ExpansionConfiguratorContext) => {
  // Use pile-level type overrides when determining whether Reserve cards are present.
  const supplyHasReserve = args.config.kingdomSupply.some(supply =>
    getPileDefinitionCard(supply.cards, supply.name)?.type.includes('RESERVE'),
  );
  // Account for cards like Miser that interact with the tavern mat without being typed RESERVE.
  const supplyHasNonReserveTavernUser = args.config.kingdomSupply.some(supply =>
    NON_RESERVE_TAVERN_MAT_CARDS.includes(supply.name),
  );

  if (!supplyHasReserve && !supplyHasNonReserveTavernUser) {
    return;
  }

  args.loggerService.info(
    `[adventures configurator - configuring reserve] supply requires tavern mat, configuring tavern mat`,
  );

  addMatToMatchConfig('tavern', args.config, args);
};
