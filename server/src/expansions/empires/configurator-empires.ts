import { CardKey } from "shared/shared-types.ts";
import {
  ExpansionConfiguratorContext,
  ExpansionConfiguratorFactory,
} from "../../types.ts";
import { getCardPileKey } from "../../utils/get-card-pile-key.ts";

// Canonical Castle pile order for 2-player games (bottom -> top).
const castleOrderTwoPlayers: CardKey[] = [
  "kings-castle",
  "grand-castle",
  "sprawling-castle",
  "opulent-castle",
  "haunted-castle",
  "small-castle",
  "crumbling-castle",
  "humble-castle",
];

// Canonical Castle pile order for 3+ players (bottom -> top), doubling select Castles.
const castleOrderThreePlus: CardKey[] = [
  "kings-castle",
  "kings-castle",
  "grand-castle",
  "sprawling-castle",
  "opulent-castle",
  "opulent-castle",
  "haunted-castle",
  "small-castle",
  "small-castle",
  "crumbling-castle",
  "humble-castle",
  "humble-castle",
];

// Canonical Catapult/Rocks split pile order (bottom -> top).
const catapultRocksOrder: CardKey[] = [
  "rocks",
  "rocks",
  "rocks",
  "rocks",
  "rocks",
  "catapult",
  "catapult",
  "catapult",
  "catapult",
  "catapult",
];

// Canonical encampment/plunder split pile order (bottom -> top).
const encampmentPlunder: CardKey[] = [
  "plunder",
  "plunder",
  "plunder",
  "plunder",
  "plunder",
  "encampment",
  "encampment",
  "encampment",
  "encampment",
  "encampment",
];

// Canonical gladiator/fortune split pile order (bottom -> top).
const gladiatorFortuneOrder: CardKey[] = [
  "fortune",
  "fortune",
  "fortune",
  "fortune",
  "fortune",
  "gladiator",
  "gladiator",
  "gladiator",
  "gladiator",
  "gladiator",
];

const configurator: ExpansionConfiguratorFactory = () => {
  return async (args) => {
    // Locate the Castles split pile in the kingdom supply, if present.
    const castlesSupply = args.config.kingdomSupply
      .find((supply) =>
        supply.cards.some((card) => getCardPileKey(card) === "castles")
      );

    if (!castlesSupply) {
      console.info(`[empires configurator] no castles pile in kingdom supply`);
    } else {
      // Choose the canonical order based on player count.
      const playerCount = args.config.players.length;
      const desiredOrder = playerCount > 2
        ? castleOrderThreePlus
        : castleOrderTwoPlayers;
      const currentOrder = castlesSupply.cards.map((card) => card.cardKey);

      const orderMatches = currentOrder.length === desiredOrder.length &&
        currentOrder.every((key, index) => key === desiredOrder[index]);

      if (orderMatches) {
        console.info(
          `[empires configurator] castles pile already configured for ${playerCount} players`,
        );
      } else {
        // Replace the pile with the canonical ordering, cloning card templates for safety.
        const nextCastleCards = [];
        for (const cardKey of desiredOrder) {
          const cardTemplate = args.cardLibrary[cardKey];
          if (!cardTemplate) {
            console.warn(
              `[empires configurator] missing card template for ${cardKey}`,
            );
            continue;
          }
          nextCastleCards.push(structuredClone(cardTemplate));
        }
        castlesSupply.cards = nextCastleCards;

        console.log(
          `[empires configurator] configured castles pile for ${playerCount} players`,
        );
      }
    }

    configureCatapultRockPile(args);
    configureEncampmentPlunderPile(args);
    configureGladiatorFortune(args);

    return args.config;
  };
};

const configureCatapultRockPile = (args: ExpansionConfiguratorContext) => {
  // Locate the Catapult/Rocks split pile in the kingdom supply, if present.
  const catapultRocksSupply = args.config.kingdomSupply
    .find((supply) =>
      supply.cards.some((card) => getCardPileKey(card) === "catapult/rocks")
    );

  if (!catapultRocksSupply) {
    console.info(
      `[empires configurator] no catapult/rocks pile in kingdom supply`,
    );
    return args.config;
  }

  const currentCatapultRocksOrder = catapultRocksSupply.cards.map((card) =>
    card.cardKey
  );
  const catapultRocksMatches =
    currentCatapultRocksOrder.length === catapultRocksOrder.length &&
    currentCatapultRocksOrder.every((key, index) =>
      key === catapultRocksOrder[index]
    );

  if (catapultRocksMatches) {
    console.info(
      `[empires configurator] catapult/rocks pile already configured`,
    );
    return args.config;
  }

  // Replace the pile with the canonical Catapult/Rocks ordering.
  const nextCatapultRocksCards = [];
  for (const cardKey of catapultRocksOrder) {
    const cardTemplate = args.cardLibrary[cardKey];
    if (!cardTemplate) {
      console.warn(
        `[empires configurator] missing card template for ${cardKey}`,
      );
      continue;
    }
    nextCatapultRocksCards.push(structuredClone(cardTemplate));
  }
  catapultRocksSupply.cards = nextCatapultRocksCards;

  console.log(`[empires configurator] configured catapult/rocks split pile`);
};

const configureEncampmentPlunderPile = (args: ExpansionConfiguratorContext) => {
  // Locate the encampment/plunder split pile in the kingdom supply, if present.
  const encampmentPlunderSupply = args.config.kingdomSupply
    .find((supply) =>
      supply.cards.some((card) => getCardPileKey(card) === "encampment/plunder")
    );

  if (!encampmentPlunderSupply) {
    console.info(
      `[empires configurator] no encampment/plunder pile in kingdom supply`,
    );
    return args.config;
  }

  const currentEncampmentPlunderOrder = encampmentPlunderSupply.cards.map(
    (card) => card.cardKey
  );
  const encampmentPlunderMatches =
    currentEncampmentPlunderOrder.length === encampmentPlunder.length &&
    currentEncampmentPlunderOrder.every((key, index) =>
      key === encampmentPlunder[index]
    );

  if (encampmentPlunderMatches) {
    console.info(
      `[empires configurator] encampment/plunder pile already configured`,
    );
    return args.config;
  }

  // Replace the pile with the canonical Catapult/Rocks ordering.
  const nextEncampmentPlunderCards = [];
  for (const cardKey of encampmentPlunder) {
    const cardTemplate = args.cardLibrary[cardKey];
    if (!cardTemplate) {
      console.warn(
        `[empires configurator] missing card template for ${cardKey}`,
      );
      continue;
    }
    nextEncampmentPlunderCards.push(structuredClone(cardTemplate));
  }
  encampmentPlunderSupply.cards = nextEncampmentPlunderCards;

  console.log(
    `[empires configurator] configured encampment/plunder split pile`,
  );
};

const configureGladiatorFortune = (args: ExpansionConfiguratorContext) => {
  // Locate the gladiator/fortune split pile in the kingdom supply, if present.
  const gladiatorFortuneSupply = args.config.kingdomSupply
    .find((supply) =>
      supply.cards.some((card) => getCardPileKey(card) === "gladiator/fortune")
    );

  if (!gladiatorFortuneSupply) {
    console.info(
      `[empires configurator] no gladiator/fortune pile in kingdom supply`,
    );
    return args.config;
  }

  const currentGladiatorFortuneOrder = gladiatorFortuneSupply.cards.map(
    (card) => card.cardKey
  );
  const gladiatorFortuneMatches =
    currentGladiatorFortuneOrder.length === gladiatorFortuneOrder.length &&
    currentGladiatorFortuneOrder.every((key, index) =>
      key === gladiatorFortuneOrder[index]
    );

  if (gladiatorFortuneMatches) {
    console.info(
      `[empires configurator] gladiator/fortune pile already configured`,
    );
    return args.config;
  }

  // Replace the pile with the canonical Catapult/Rocks ordering.
  const nextGladiatorFortuneCards = [];
  for (const cardKey of gladiatorFortuneOrder) {
    const cardTemplate = args.cardLibrary[cardKey];
    if (!cardTemplate) {
      console.warn(
        `[empires configurator] missing card template for ${cardKey}`,
      );
      continue;
    }
    nextGladiatorFortuneCards.push(structuredClone(cardTemplate));
  }
  gladiatorFortuneSupply.cards = nextGladiatorFortuneCards;

  console.log(`[empires configurator] configured gladiator/fortune split pile`);
};

// Ensure victory tokens contribute to score in Empires games.
export default configurator;
