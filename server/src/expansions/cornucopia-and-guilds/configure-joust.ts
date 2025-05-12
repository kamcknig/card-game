import { CardNoId, Supply } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';
import { createCardData } from '../../utils/create-card-data.ts';

export const configureJoust = async (args: ExpansionConfiguratorContext) => {
  const joustPresent = args.config.kingdomSupply.some(supply => supply.name === 'joust');
  
  if (!joustPresent || args.config.nonSupply?.some(supply => supply.name === 'rewards')) {
    return;
  }
  
  console.log(`[cornucopia configurator - configuring joust] joust present in supply`);
  
  let rewardCardLibrary: Record<string, CardNoId> = {};
  
  try {
    const rewardCardLibraryModule = await import('./card-library-rewards.json', { with: { type: 'json' } });
    rewardCardLibrary = rewardCardLibraryModule.default as unknown as Record<string, CardNoId>;
  } catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(`[cornucopia configurator - configuring joust] failed to load reward library for joust`);
      return;
    }
  }
  
  args.config.nonSupply ??= [];
  
  const rewardsKingdom = {
    name: 'rewards',
    cards: []
  } as Supply;
  
  args.config.nonSupply.push(rewardsKingdom);
  
  for (const key of Object.keys(rewardCardLibrary ?? {})) {
    const cardData = createCardData(key, 'cornucopia-and-guilds', {
      ...rewardCardLibrary[key] ?? {},
    });
    const count = args.config.players.length > 2 ? 2 : 1;
    rewardsKingdom.cards = [...rewardsKingdom.cards, ...new Array(count).fill(cardData)];
  }
  console.log(`[cornucopia configurator - configuring joust] joust configured`);
}
