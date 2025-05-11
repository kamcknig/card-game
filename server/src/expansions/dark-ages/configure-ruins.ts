import { CardKey, CardNoId } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';
import { createCardData } from '../../utils/create-card-data.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';

export const configureRuins = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomCards.some(card => card.type.includes('LOOTER'))) {
    return;
  }
  
  if (args.config.nonSupplyCards?.some(card => card.tags?.includes('ruins'))) {
    console.log(`[dark-ages configurator - configuring ruins] ruins already in kingdom, not configuring`);
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
    .map(cardKey => new Array(Math.max(numPlayers - 1, 1) * 10).fill(cardKey))
    .flat();
  
  fisherYatesShuffle(ruinsCardKeys, true);
  
  const finalRuins = ruinsCardKeys.reduce((acc, nextRuinsKey) => {
    acc[nextRuinsKey] = (acc[nextRuinsKey] ?? 0) + 1;
    return acc;
  }, {} as Record<CardKey, number>);
  
  args.config.kingdomCards ??= [];
  args.config.kingdomCardCount ??= {};
  
  for (const key of Object.keys(finalRuins)) {
    const cardData = createCardData(key, 'dark-ages', {
      ...ruinsCardLibrary[key] ?? {},
      tags: ['ruins'],
    });
    
    args.config.kingdomCards.push(cardData)
    args.config.kingdomCardCount[key] = finalRuins[key];
  }
  
  console.log(`[dark-ages configurator - configuring ruins] ruins configured`);
};