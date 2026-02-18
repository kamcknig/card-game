import { ExpansionConfiguratorContext } from '@server-types/index.ts';

export const configureShelters = async (args: ExpansionConfiguratorContext) => {
  const idx = args.rngService.nextIndex(args.config.kingdomSupply.length);

  if (args.config.kingdomSupply[idx].cards[0].expansionName !== 'dark-ages') {
    return;
  }

  args.loggerService.info(`[dark-ages configurator - configuring shelters] shelters needs to be configured`);

  delete args.config.playerStartingHand['estate'];

  for (const key of ['hovel', 'necropolis', 'overgrown-estate']) {
    args.config.playerStartingHand[key] = 1;
  }
};
