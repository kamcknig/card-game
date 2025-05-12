import { CardKey, CardNoId, Supply } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';
import { createCardData } from '../../utils/create-card-data.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';

export const configureRuins = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomSupply.some(supply => supply.cards.some(card => card.type.includes('LOOTER')))) {
    return;
  }
  
  if (args.config.kingdomSupply?.some(supply => supply.name === 'ruins')) {
    return;
  }
  
  console.log(`[dark-ages configurator - configuring ruins] ruins needs to be configured`);
  
  let ruinsCardLibrary: Record<string, CardNoId> = {};
  
  try {
    const ruinsCardLibraryModule = await import('./card-library-ruins.json', { with: { type: 'json' } });
    ruinsCardLibrary = ruinsCardLibraryModule.default as unknown as Record<string, CardNoId>;
  } catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(`[dark-ages configurator - configuring ruins] failed to load ruins library`);
      return;
    }
  }
  
  const numPlayers = args.config.players.length;
  
  const ruinsCardKeys = Object.keys(ruinsCardLibrary)
    .map(cardKey => new Array(10).fill(cardKey))
    .flat();
  
  fisherYatesShuffle(ruinsCardKeys, true);
  
  ruinsCardKeys.length = 10 * Math.max(1, numPlayers - 1);
  
  args.config.kingdomSupply ??= [];
  
  const ruinsKingdom = {
    name: 'ruins',
    cards: ruinsCardKeys.map(cardKey => {
      const cardData = createCardData(cardKey, 'dark-ages', {
        ...ruinsCardLibrary[cardKey] ?? {},
        tags: ['ruins'],
      });
      return cardData;
    })
  } as Supply;
  
  args.config.kingdomSupply.push(ruinsKingdom);
  
  console.log(`[dark-ages configurator - configuring ruins] ruins configured`);
};