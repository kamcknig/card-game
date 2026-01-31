import { CardKey } from 'shared/shared-types.ts';
import { ExpansionConfiguratorFactory } from '../../types.ts';

// Canonical Castle pile order for 2-player games (bottom -> top).
const castleOrderTwoPlayers: CardKey[] = [
  'kings-castle',
  'grand-castle',
  'sprawling-castle',
  'opulent-castle',
  'haunted-castle',
  'small-castle',
  'crumbling-castle',
  'humble-castle',
];

// Canonical Castle pile order for 3+ players (bottom -> top), doubling select Castles.
const castleOrderThreePlus: CardKey[] = [
  'kings-castle',
  'kings-castle',
  'grand-castle',
  'sprawling-castle',
  'opulent-castle',
  'opulent-castle',
  'haunted-castle',
  'small-castle',
  'small-castle',
  'crumbling-castle',
  'humble-castle',
  'humble-castle',
];

const configurator: ExpansionConfiguratorFactory = () => {
  return async (args) => {
    // Locate the Castles split pile in the kingdom supply, if present.
    const castlesSupply = args.config.kingdomSupply
      .find(supply => supply.cards.some(card => card.randomizer === 'castles'));

    if (!castlesSupply) {
      console.info(`[empires configurator] no castles pile in kingdom supply`);
      return args.config;
    }

    // Choose the canonical order based on player count.
    const playerCount = args.config.players.length;
    const desiredOrder = playerCount > 2 ? castleOrderThreePlus : castleOrderTwoPlayers;
    const currentOrder = castlesSupply.cards.map(card => card.cardKey);

    const orderMatches = currentOrder.length === desiredOrder.length
      && currentOrder.every((key, index) => key === desiredOrder[index]);

    if (orderMatches) {
      console.info(`[empires configurator] castles pile already configured for ${playerCount} players`);
      return args.config;
    }

    // Replace the pile with the canonical ordering, cloning card templates for safety.
    const nextCastleCards = [];
    for (const cardKey of desiredOrder) {
      const cardTemplate = args.cardLibrary[cardKey];
      if (!cardTemplate) {
        console.warn(`[empires configurator] missing card template for ${cardKey}`);
        continue;
      }
      nextCastleCards.push(structuredClone(cardTemplate));
    }
    castlesSupply.cards = nextCastleCards;

    console.log(`[empires configurator] configured castles pile for ${playerCount} players`);

    return args.config;
  };
};

// Ensure victory tokens contribute to score in Empires games.
export default configurator;
