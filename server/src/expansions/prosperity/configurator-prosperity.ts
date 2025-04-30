import { CardExpansionConfigurator } from '../../types.ts';

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

export default configurator;