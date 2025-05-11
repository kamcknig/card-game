import { CardNoId, Match } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';
import { MatchCardLibrary } from '../../core/match-card-library.ts';
import { createCard } from '../../utils/create-card.ts';
import { createCardData } from '../../utils/create-card-data.ts';

export const configureJoust = async (args: ExpansionConfiguratorContext) => {
  const joustPresent = args.config.kingdomSupply.some(kingdom => kingdom.card.cardKey === 'joust');
  
  if (!joustPresent) {
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
  
  args.config.nonSupplyCards ??= [];
  
  for (const key of Object.keys(rewardCardLibrary ?? {})) {
    const cardData = createCardData(key, 'cornucopia-and-guilds', {
      ...rewardCardLibrary[key] ?? {},
    });
    args.config.nonSupplyCards.push({
      card: cardData,
      count: args.config.players.length > 2 ? 2 : 1
    });
  }
  console.log(`[cornucopia configurator - configuring joust] joust configured`);
}
