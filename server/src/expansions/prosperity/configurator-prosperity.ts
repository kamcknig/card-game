import './types.ts';
import {
  CardEffectRegistrar,
  CardExpansionConfigurator,
  EndGameConditionRegistrar,
  ExpansionActionRegistry,
  PlayerScoreDecoratorRegistrar,
} from '../../types.ts';
import { findCards } from '../../utils/find-cards.ts';

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
  
  const charlatanPresent = kingdomCards.find(card => card.cardKey === 'charlatan');
  
  if (charlatanPresent) {
    console.log(`[prosperity configurator] charlatan is part of kingdom - curses gain the treasure type and +1 treasure effect`);
    
    const curseCard = args.config.basicCards.find(card => card.cardKey === 'curse');
    
    if (!curseCard) {
      console.warn(`[prosperity configurator] curse card not found in config`);
    }
    
    curseCard?.type.push('TREASURE');
  }
  
  return args.config;
}

export const registerEndGameConditions = (registrar: EndGameConditionRegistrar) => {
  registrar(({ match, cardLibrary }) => {
    const kingdomCards = match.config.kingdomCards;
    const colonyPresent = kingdomCards.find(card => card.cardKey === 'colony');
    
    if (!colonyPresent) {
      return false;
    }
    
    const colonyCards = findCards(
      match,
      {
        location: 'supply',
        cards: { cardKeys: 'colony' }
      },
      cardLibrary
    );
    return colonyCards.length === 0;
  })
}

export const registerActions: ExpansionActionRegistry = (registerFn, { match }) => {
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

export const registerScoringFunctions = (registrar: PlayerScoreDecoratorRegistrar) => {
  registrar((playerId, match) => {
    match.scores[playerId] += match.playerVictoryTokens?.[playerId] ?? 0;
  });
};

export const registerCardEffects: (registrar: CardEffectRegistrar) => void = (registrar) => {
  registrar('curse', 'prosperity', async (args) => {
    console.log(`[curse effect - prosperity] curse effect called`);
    await args.runGameActionDelegate('gainTreasure', { count: 1 });
  });
};

export default configurator;
