import { Supply } from 'shared/types/index.ts';
import { ExpansionConfiguratorContext } from '@server-types/index.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';

export const configureRuins = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomSupply.some((supply) => supply.cards.some((card) => card.type.includes('LOOTER')))) {
    return;
  }

  if (args.config.kingdomSupply?.some((supply) => supply.name === 'ruins')) {
    return;
  }

  console.info(`[dark-ages configurator - configuring ruins] ruins needs to be configured`);

  const expansionData = args.expansionCatalog['dark-ages'];
  const expansionKingdoms = expansionData.cardData.kingdomSupply;
  let ruinsCardKeys = Object.keys(expansionKingdoms).filter((key) => expansionKingdoms[key].type.includes('RUINS'));

  const numPlayers = args.config.players.length;

  ruinsCardKeys = ruinsCardKeys
    .map((cardKey) => new Array(10).fill(cardKey))
    .flat();

  fisherYatesShuffle(ruinsCardKeys, true, () => args.rngService.nextFloat());

  ruinsCardKeys.length = 10 * Math.max(1, numPlayers - 1);

  args.config.kingdomSupply ??= [];

  const ruinsKingdom = {
    name: 'ruins',
    cards: ruinsCardKeys.map((cardKey) => {
      const cardData = {
        ...structuredClone(args.cardLibrary[cardKey]),
        tags: ['ruins'],
      };
      return cardData;
    }),
  } as Supply;

  args.config.kingdomSupply.push(ruinsKingdom);

  console.info(`[dark-ages configurator - configuring ruins] ruins configured`);
};
