import { Supply } from 'shared/types/index.ts';
import { ExpansionConfiguratorContext } from '@server-types/index.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';

export const configureRuins = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomSupply.some(supply => supply.cards.some(card => card.type.includes('LOOTER')))) {
    return;
  }

  // Point every Looter-typed trigger card at the Ruins pile so the detail
  // dialog can show them as siblings (many:1 — several Looters can share
  // the one Ruins pile). Stamped every pass, independent of whether the
  // Ruins pile itself still needs to be built below.
  for (const supply of args.config.kingdomSupply) {
    for (const card of supply.cards) {
      if (card.type.includes('LOOTER')) {
        card.linkedPileKey = 'ruins';
      }
    }
  }

  if (args.config.kingdomSupply?.some(supply => supply.name === 'ruins')) {
    return;
  }

  args.loggerService.info(`[dark-ages configurator - configuring ruins] ruins needs to be configured`);

  const expansionData = args.expansionCatalog['dark-ages'];
  const expansionKingdoms = expansionData.cardData.kingdomSupply;
  let ruinsCardKeys = Object.keys(expansionKingdoms).filter(key => expansionKingdoms[key].type.includes('RUINS'));

  const numPlayers = args.config.players.length;

  ruinsCardKeys = ruinsCardKeys.map(cardKey => new Array(10).fill(cardKey)).flat();

  fisherYatesShuffle(ruinsCardKeys, true, () => args.rngService.nextFloat());

  ruinsCardKeys.length = 10 * Math.max(1, numPlayers - 1);

  args.config.kingdomSupply ??= [];

  const ruinsKingdom = {
    name: 'ruins',
    cards: ruinsCardKeys.map(cardKey => {
      const baseCard = structuredClone(args.cardLibrary[cardKey]);
      // Model Ruins as a single pile so pile-key lookups resolve to "ruins" instead of per-card keys.
      const cardData = {
        ...baseCard,
        kingdom: 'ruins',
        randomizerData: {
          ...(baseCard.randomizerData ?? {}),
          randomizer: 'ruins',
        },
        tags: Array.from(new Set([...(baseCard.tags ?? []), 'ruins'])),
      };
      return cardData;
    }),
  } as Supply;

  args.config.kingdomSupply.push(ruinsKingdom);

  args.loggerService.info(`[dark-ages configurator - configuring ruins] ruins configured`);
};
