import { ExpansionConfiguratorContext } from '../../types.ts';
import { addMatToMatchConfig } from '../../utils/add-mat-to-match-config.ts';
import { getPileDefinitionCard } from '../../utils/get-pile-definition-card.ts';

export const configureReserve = (args: ExpansionConfiguratorContext) => {
  // Use pile-level type overrides when determining whether Reserve cards are present.
  if (!args.config.kingdomSupply.some(supply => getPileDefinitionCard(supply.cards, supply.name)?.type.includes('RESERVE'))) {
    return;
  }
  
  console.info(`[adventures configurator - configuring reserve] cards of type RESERVE included in supply, configuring tavern mat`);
  
  addMatToMatchConfig('tavern', args.config, args);
}
