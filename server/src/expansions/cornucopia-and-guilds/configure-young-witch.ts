import { expansionLibrary } from '../expansion-library.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';
import { CardKey } from 'shared/shared-types.ts';
import { getDefaultKingdomSupplySize } from '../../utils/get-default-kingdom-supply-size.ts';

export const configureYoungWitch = (args: ExpansionConfiguratorContext) => {
  const youngWitchPresent = args.config.kingdomSupply.some(supply => supply.name === 'young-witch');
  
  // if no witch is present, or if the bane is already configured, no need to configure
  if (!youngWitchPresent || args.config.kingdomSupply.some(supply => supply.cards.some(card => card.tags?.includes('bane')))) {
    return;
  }
  
  console.log(`[cornucopia configurator - configuring young-witch] young witch present in supply`);
  
  const availableKingdoms = args.config.expansions.reduce((acc, nextExpansion) => {
    const exp = expansionLibrary[nextExpansion.name];
    if (!exp) return acc;
    
    for (const key of Object.keys(exp.cardData.kingdomSupply)) {
      acc[key] = { cardKey: key, expansionName: nextExpansion.name };
    }
    return acc;
  }, {} as Record<CardKey, { cardKey: CardKey; expansionName: string }>);
  
  const kingdomCardKeys =
    Array.from(
      new Set(
        args.config.kingdomSupply.map(supply => supply.cards.map(card => card.cardKey)).flat()
      )
    );
  const bannedKeys = args.config.bannedKingdoms.map(card => card.cardKey);
  const availableKeys = Object.keys(availableKingdoms)
    .filter(key => !bannedKeys.includes(key) && !kingdomCardKeys.includes(key));
  
  if (!availableKeys.length) {
    console.log(`[cornucopia configurator - configuring young-witch] no available kingdoms, not adding new kingdom`);
    return;
  }
  
  const chosenKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
  
  console.log(`[cornucopia configurator - configuring young-witch] adding ${chosenKey} to kingdom as the "bane" card`);
  
  const chosenCard = structuredClone(expansionLibrary[availableKingdoms[chosenKey].expansionName].cardData.kingdomSupply[chosenKey]);
  chosenCard.tags = ['bane'];
  
  args.config.kingdomSupply.push({
    name: chosenCard.cardKey,
    cards: new Array(getDefaultKingdomSupplySize(chosenCard, args.config)).fill(chosenCard),
  });
}