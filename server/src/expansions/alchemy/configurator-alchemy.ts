import { ExpansionConfiguratorFactory } from '../../types.ts';

const configurator: ExpansionConfiguratorFactory = () => {
  let potionConfigured = false;
  
  return async (args) => {
    console.log(`configuring match for alchemy`);
    
    if (potionConfigured) {
      console.log(`[alchemy match configurator] potion already configured`);
      return args.config;
    }
    
    const potionCard = args.cardLibrary['potion'];
    
    if (!potionCard) {
      throw new Error(`potion card not found in card library`);
    }
    
    const expansionCards = args.config.kingdomCards.filter(card => card.expansionName === 'alchemy');
    
    for (const card of expansionCards) {
      if (card.cost.potion === undefined) {
        continue;
      }
      
      console.log(`[alchemy match configurator] adding potion card because ${card.cardKey} has a potion cost`);
      args.config.basicCards.push(args.cardLibrary['potion'])
      args.config.basicCardCount[potionCard.cardKey] = 16;
      potionConfigured = true;
      break;
    }
    
    return args.config;
  }
}

export default configurator;