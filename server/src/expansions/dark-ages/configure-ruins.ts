import { Supply } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';
import { expansionLibrary, rawCardLibrary } from '../expansion-library.ts';

export const configureRuins = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomSupply.some(supply => supply.cards.some(card => card.type.includes('LOOTER')))) {
    return;
  }
  
  if (args.config.kingdomSupply?.some(supply => supply.name === 'ruins')) {
    return;
  }
  
  console.log(`[dark-ages configurator - configuring ruins] ruins needs to be configured`);
  
  const expansionData = expansionLibrary['dark-ages'];
  const expansionKingdoms = expansionData.cardData.kingdomSupply;
  let ruinsCardKeys = Object.keys(expansionKingdoms).filter(key => expansionKingdoms[key].type.includes('RUINS'));
  
  const numPlayers = args.config.players.length;
  
  ruinsCardKeys = ruinsCardKeys
    .map(cardKey => new Array(10).fill(cardKey))
    .flat();
  
  fisherYatesShuffle(ruinsCardKeys, true);
  
  ruinsCardKeys.length = 10 * Math.max(1, numPlayers - 1);
  
  args.config.kingdomSupply ??= [];
  
  const ruinsKingdom = {
    name: 'ruins',
    cards: ruinsCardKeys.map(cardKey => {
      const cardData = {
        ...structuredClone(rawCardLibrary[cardKey]),
        tags: ['ruins'],
      };
      return cardData;
    })
  } as Supply;
  
  args.config.kingdomSupply.push(ruinsKingdom);
  
  console.log(`[dark-ages configurator - configuring ruins] ruins configured`);
};