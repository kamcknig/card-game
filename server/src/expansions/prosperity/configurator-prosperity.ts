import './types.ts';
import { ExpansionActionRegistery, CardExpansionConfigurator } from '../../types.ts';
import { Match } from "shared/shared-types.ts";

const configurator: CardExpansionConfigurator = (args) => {
  const kingdomCards = args.config.kingdomCards;
  const randomKingdomCard = kingdomCards[Math.floor(kingdomCards.length * Math.random())];
  console.log(`[prosperity configurator] random kingdom chosen to determine if colony and prosperity should be added to config '${randomKingdomCard.cardKey}'`);
  if (randomKingdomCard.expansionName === 'prosperity') {
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
    console.log(`[prosperity configurator] NOT adding prosperity and colony to config`);
  }
  
  return { ...args.config };
}

export const actionRegistry: ExpansionActionRegistery = (registerFn, { match}) => {
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

export const scoringFunctionFactory = () => (args: {match: Match}) => {
  for (const playerId of Object.keys(args.match.scores)) {
    args.match.scores[+playerId] += args.match.playerVictoryTokens?.[+playerId] ?? 0;
  }
};

export default configurator;
