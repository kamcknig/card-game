import { expansionLibrary } from '../expansion-library.ts';
import { ExpansionConfiguratorFactory } from '../../types.ts';
import { uniqueByProp } from '../../core/match-configurator.ts';

// Seeds boons when Fate cards are present in the selected kingdom.
const configurator: ExpansionConfiguratorFactory = () => async (args) => {
  // Gather all selected kingdom cards to detect Fate types.
  const kingdomCards = args.config.kingdomSupply.flatMap(supply => supply.cards);
  // Fate cards determine whether boons are active for this match.
  const fateCards = kingdomCards.filter(card => card.type?.includes('FATE'));

  if (fateCards.length < 1) {
    // Clear out boons when the match does not contain any Fate cards.
    if ((args.config.boons ?? []).length > 0) {
      console.info('[nocturne configurator] clearing boons because no Fate cards are present');
    }
    // Ensure boons are cleared when Fate cards are absent.
    args.config.boons = [];
    return args.config;
  }

  // Limit boon selection to expansions that actually contributed Fate cards.
  const expansionsWithFate = Array.from(new Set(fateCards.map(card => card.expansionName)));
  // Pull boon definitions from the expansion library.
  const boons = expansionsWithFate.flatMap(expansionName =>
    Object.values(expansionLibrary[expansionName]?.boons ?? {})
  );
  // De-duplicate boons across expansions by card key.
  const uniqueBoons = uniqueByProp(boons, 'cardKey');

  if (uniqueBoons.length < 1) {
    // Log missing boon definitions so configuration issues are visible.
    console.warn(`[nocturne configurator] Fate cards present but no boons found for expansions ${expansionsWithFate.join(', ')}`);
    args.config.boons = [];
    return args.config;
  }

  // Seed the computed configuration with the selected boons.
  console.info(`[nocturne configurator] Fate cards present, seeding ${uniqueBoons.length} boons`);
  args.config.boons = structuredClone(uniqueBoons);
  return args.config;
};

export default configurator;
