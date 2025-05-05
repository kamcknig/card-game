import { CardNoId } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';

export const configureJoust = async (args: ExpansionConfiguratorContext) => {
  const joustPresent = args.config.kingdomCards.some(card => card.cardKey === 'joust');
  
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
  args.config.nonSupplyCardCount ??= {};
  
  for (const key of Object.keys(rewardCardLibrary ?? {})) {
    args.config.nonSupplyCards.push({ ...(rewardCardLibrary[key] ?? {}) })
    args.config.nonSupplyCardCount[key] = args.config.players.length > 2 ? 2 : 1;
  }
  console.log(`[cornucopia configurator - configuring joust] joust configured`);
}