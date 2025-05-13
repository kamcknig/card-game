import { Supply } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';
import { expansionLibrary } from '../expansion-library.ts';

export const configureJoust = async (args: ExpansionConfiguratorContext) => {
  const joustPresent = args.config.kingdomSupply.some(supply => supply.name === 'joust');
  
  if (!joustPresent || args.config.nonSupply?.some(supply => supply.name === 'rewards')) {
    return;
  }
  
  console.log(`[cornucopia configurator - configuring joust] joust present in supply`);
  
  args.config.nonSupply ??= [];
  
  const rewardsKingdom = {
    name: 'rewards',
    cards: []
  } as Supply;
  
  args.config.nonSupply.push(rewardsKingdom);
  
  const expansionData = expansionLibrary['cornucopia-and-guilds'];
  const expansionKingdomCards = expansionData.cardData.kingdomSupply;
  const rewards = Object.keys(expansionKingdomCards).filter(key => expansionKingdomCards[key].type.includes('REWARD'));
  
  for (const key of  rewards ?? []) {
    const cardData = {
      ...structuredClone(expansionKingdomCards[key]) ?? {},
      partOfSupply: false,
    };
    const count = args.config.players.length > 2 ? 2 : 1;
    rewardsKingdom.cards = [...rewardsKingdom.cards, ...new Array(count).fill(cardData)];
  }
  console.log(`[cornucopia configurator - configuring joust] joust configured`);
}
