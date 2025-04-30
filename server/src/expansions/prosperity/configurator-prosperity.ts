import './types.ts';
import { CardEffectFn, CardExpansionConfigurator, ExpansionActionRegistery, } from '../../types.ts';
import { CardKey, Match } from 'shared/shared-types.ts';
import { findCards } from '../../utils/find-cards.ts';
import { CardLibrary } from '../../core/card-library.ts';

const configurator: CardExpansionConfigurator = (args) => {
  const kingdomCards = args.config.kingdomCards;
  const randomKingdomCard = kingdomCards[Math.floor(kingdomCards.length * Math.random())];
  console.log(`[prosperity configurator] random kingdom chosen to determine if colony and prosperity should be added to config '${randomKingdomCard.cardKey}'`);
  let colonyPresent = false;
  colonyPresent = true;
  if (randomKingdomCard.expansionName === 'prosperity') {
    colonyPresent = true;
    console.log(`[prosperity configurator] adding prosperity and colony to config`);
    
    args.config.basicCards = [
      ...args.config.basicCards,
      { ...args.expansionData.cardData.basicSupply['platinum'] },
      { ...args.expansionData.cardData.basicSupply['colony'] }
    ];
    args.config.basicCardCount['platinum'] = 12;
    args.config.basicCardCount['colony'] = args.config.players.length >= 3 ? 12 : 8;
  }
  else {
    args.config.basicCards = [
      ...args.config.basicCards,
      { ...args.expansionData.cardData.basicSupply['platinum'] },
      { ...args.expansionData.cardData.basicSupply['colony'] }
    ];
    args.config.basicCardCount['platinum'] = 12;
    args.config.basicCardCount['colony'] = args.config.players.length >= 3 ? 12 : 8;
    console.log(`[prosperity configurator] NOT adding prosperity and colony to config`);
  }
  
  const charlatanPresent = kingdomCards.find(card => card.cardKey === 'charlatan');
  
  if (charlatanPresent) {
    console.log(`[prosperity configurator] charlatan is part of kingdom - curses gain the treasure type and +1 treasure effect`);
    const curseCard = args.config.basicCards.find(card => card.cardKey === 'curse');
    if (!curseCard) {
      console.warn(`[prosperity configurator] curse card not found in config`);
    }
    curseCard?.type.push('TREASURE');
  }
  
  const endGameConditions = (endGameArgs: { match: Match, cardLibrary: CardLibrary }) => {
    if (!colonyPresent) {
      return false;
    }
    
    const colonyCards = findCards(
      endGameArgs.match,
      {
        location: 'supply',
        cards: { cardKeys: 'colony' }
      },
      endGameArgs.cardLibrary
    );
    return colonyCards.length === 0;
  }
  
  return { config: args.config, endGameConditions: colonyPresent ? endGameConditions : undefined };
}

export const actionRegistry: ExpansionActionRegistery = (registerFn, { match }) => {
  console.log(`[prosperity action registry] registering gainVictoryToken action`);
  registerFn('gainVictoryToken', async ({ playerId, count }) => {
    console.log(`[gainVictoryToken action] player ${playerId} gained ${count} victory tokens`);
    match.playerVictoryTokens ??= {};
    match.playerVictoryTokens[playerId] ??= 0;
    const newCount = match.playerVictoryTokens[playerId] + count;
    match.playerVictoryTokens[playerId] = newCount;
    console.log(`[gainVictoryToken action] player ${playerId} new victory token count ${newCount}`);
  });
}

export const scoringFunctionFactory = () => (args: { match: Match }) => {
  for (const playerId of Object.keys(args.match.scores)) {
    args.match.scores[+playerId] += args.match.playerVictoryTokens?.[+playerId] ?? 0;
  }
};

export const cardEffectsFactory: () => Record<CardKey, CardEffectFn> = () => ({
  'curse': async (args) => {
    console.log(`[curse effect - prosperity] curse effect called`);
    await args.runGameActionDelegate('gainTreasure', { count: 1 });
  }
});

export default configurator;
