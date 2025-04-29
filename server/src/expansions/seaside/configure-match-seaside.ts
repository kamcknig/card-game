import { CardKey, CardNoId, ComputedMatchConfiguration, Mats } from 'shared/shared-types.ts';
import { CardExpansionConfigurator } from '../../types.ts';

export const addMatToMatchConfig = (mat: string, config: ComputedMatchConfiguration) => {
  for (const player of config.players) {
    config.mats ??= {} as any;
    config.mats[player.id] ??= {} as any;
    config.mats[player.id][mat as Mats] = [];
  }
}

const configurator: CardExpansionConfigurator = (args: { config: ComputedMatchConfiguration, cardLibrary: Record<CardKey, CardNoId> }) => {
  for (const kingdomCard of args.config.kingdomCards) {
    if (kingdomCard.mat) {
      console.log(`[seaside configurator] adding ${kingdomCard.mat} for ${args.cardLibrary[kingdomCard.cardKey]} to config`);
      addMatToMatchConfig(kingdomCard.mat, args.config)
    }
  }
  
  return args.config;
}

export default configurator;