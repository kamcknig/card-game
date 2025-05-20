import { ExpansionConfiguratorContext } from '../../types.ts';
import { addMatToMatchConfig } from '../../utils/add-mat-to-match-config.ts';

export const configureReserve = (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomSupply.some(supply => supply.cards[0].type.includes('RESERVE'))) {
    return;
  }
  
  console.log(`[adventures configurator - configuring reserve] cards of type RESERVE included in supply, configuring tavern mat`);
  
  addMatToMatchConfig('tavern', args.config, args);
}