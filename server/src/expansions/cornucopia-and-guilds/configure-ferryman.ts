import { CardKey } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';
import { expansionLibrary } from '../expansion-library.ts';
import { getDefaultKingdomSupplySize } from '../../utils/get-default-kingdom-supply-size.ts';

export const configureFerryman = (args: ExpansionConfiguratorContext) => {
  const ferrymanPresent = args.config.kingdomSupply.some(supply => supply.name === 'ferryman');
  
  // if no witch is present, or if the bane is already configured, no need to configure
  if (!ferrymanPresent || args.config.kingdomSupply.some(supply => supply.cards.some(card => card.tags?.includes('ferryman')))) {
    return;
  }
  
  console.log(`[cornucopia configurator - configuring ferryman] ferryman present in supply`);
  
  const availableKingdoms = args.config.expansions.reduce((acc, nextExpansion) => {
    const exp = expansionLibrary[nextExpansion.name];
    if (!exp) return acc;
    
    for (const key of Object.keys(exp.cardData.kingdomSupply)) {
      const cardData = exp.cardData.kingdomSupply[key];
      
      if (cardData.randomizer === null) return acc;
      
      const cost = cardData.cost.treasure;
      if (cost !== 3 && cost !== 4) {
        return acc;
      }
      
      acc[key] = { cardKey: key, expansionName: nextExpansion.name };
    }
    return acc;
  }, {} as Record<CardKey, { cardKey: CardKey; expansionName: string }>);
  
  const kingdomCardKeys = Array.from(new Set(args.config.kingdomSupply.map(supply => supply.cards.map(card => card.cardKey))
    .flat()));
  const bannedKeys = args.config.bannedKingdoms.map(card => card.cardKey);
  const availableKeys = Object.keys(availableKingdoms)
    .filter(key => !bannedKeys.includes(key) && !kingdomCardKeys.includes(key));
  
  if (!availableKeys.length) {
    console.log(`[cornucopia configurator - configuring ferryman] no available kingdoms, not adding new kingdom`);
    return;
  }
  
  const chosenKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
  
  console.log(`[cornucopia configurator - configuring ferryman] adding ${chosenKey} to kingdom as the "ferryman" card`);
  
  const chosenCard = structuredClone(expansionLibrary[availableKingdoms[chosenKey].expansionName].cardData.kingdomSupply[chosenKey]);
  chosenCard.tags = ['ferryman'];
  args.config.kingdomSupply.push({
    name: chosenCard.kingdom,
    cards: new Array(getDefaultKingdomSupplySize(chosenCard, args.config)).fill(chosenCard)
  });
}