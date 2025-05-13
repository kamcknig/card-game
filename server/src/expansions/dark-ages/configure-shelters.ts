import { ExpansionConfiguratorContext } from '../../types.ts';

export const configureShelters = async (args: ExpansionConfiguratorContext) => {
  const idx = Math.floor(Math.random() * args.config.kingdomSupply.length);
  
  if (args.config.kingdomSupply[idx].cards[0].expansionName !== 'dark-ages') {
    return;
  }
  
  console.log(`[dark-ages configurator - configuring shelters] shelters needs to be configured`);
  
  delete args.config.playerStartingHand['estate'];
  
  for (const key of ['hovel', 'necropolis', 'overgrown-estate']) {
    args.config.playerStartingHand[key] = 1;
  }
};