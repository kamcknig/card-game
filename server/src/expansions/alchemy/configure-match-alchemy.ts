import { CardKey, CardNoId, ComputedMatchConfiguration, MatchConfiguration } from 'shared/shared-types.ts';

const configurator = (args: { config: ComputedMatchConfiguration, cardLibrary: Record<CardKey, CardNoId> }) => {
  console.log(`configuring match for alchemy`);
  
  const expansionCards = args.config.kingdomCards.filter(card => card.expansionName === 'alchemy');
  if (expansionCards.length === 0) {
    return args.config
  }
  
  const potionCard = args.cardLibrary['potion'];
  
  if (!potionCard) {
    throw new Error(`potion card not found in card library`);
  }
  
  for (const card of expansionCards) {
    if (card.cost.potion === undefined) {
      continue;
    }
    
    console.log(`[alchemy match configurator] adding potion card because ${card.cardKey} has a potion cost`);
    args.config.basicCards.push(args.cardLibrary['potion'])
    args.config.basicCardCount[potionCard.cardKey] = 16;
    break;
  }
}

export default configurator;