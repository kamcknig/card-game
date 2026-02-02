import {CardKey, ComputedMatchConfiguration} from 'shared/shared-types.ts';
import {
  ExpansionConfiguratorContext,
  ExpansionConfiguratorFactory,
  GameEventRegistrar,
  PlayerScoreDecoratorRegistrar,
} from '../../types.ts';
import {configureSplitPile} from '../../utils/configure-split-pile.ts';
import {getCardPileKey} from '../../utils/get-card-pile-key.ts';
import {configureAqueduct} from './configure-aqueduct.ts';
import {configureArena} from './configure-arena.ts';

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

// Canonical patrician/emporium split pile order (bottom -> top).
const patricianEmporiumOrder: CardKey[] = [
  'emporium',
  'emporium',
  'emporium',
  'emporium',
  'emporium',
  'patrician',
  'patrician',
  'patrician',
  'patrician',
  'patrician',
];

// Canonical settlers/bustling-village split pile order (bottom -> top).
const settlersBustlingVillageOrder: CardKey[] = [
  'bustling-village',
  'bustling-village',
  'bustling-village',
  'bustling-village',
  'bustling-village',
  'settlers',
  'settlers',
  'settlers',
  'settlers',
  'settlers',
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
    configurePatricianEmporium(args);
    configureSettlersBustlingVillage(args);

    return args.config;
  };
};

const configureCatapultRockPile = (args: ExpansionConfiguratorContext) => {
  // Locate the Catapult/Rocks split pile in the kingdom supply, if present.
  // Use the shared split pile configurator for canonical ordering.
  configureSplitPile(args, {
    pileKey: 'catapult/rocks',
    desiredOrder: catapultRocksOrder,
    logLabel: 'catapult/rocks',
  });
};

const configureEncampmentPlunderPile = (args: ExpansionConfiguratorContext) => {
  // Locate the encampment/plunder split pile in the kingdom supply, if present.
  // Use the shared split pile configurator for canonical ordering.
  configureSplitPile(args, {
    pileKey: 'encampment/plunder',
    desiredOrder: encampmentPlunder,
    logLabel: 'encampment/plunder',
  });
};

const configureGladiatorFortune = (args: ExpansionConfiguratorContext) => {
  // Locate the gladiator/fortune split pile in the kingdom supply, if present.
  // Use the shared split pile configurator for canonical ordering.
  configureSplitPile(args, {
    pileKey: 'gladiator/fortune',
    desiredOrder: gladiatorFortuneOrder,
    logLabel: 'gladiator/fortune',
  });
};

const configurePatricianEmporium = (args: ExpansionConfiguratorContext) => {
  // Locate the patrician/emporium split pile in the kingdom supply, if present.
  // Use the shared split pile configurator for canonical ordering.
  configureSplitPile(args, {
    pileKey: 'patrician/emporium',
    desiredOrder: patricianEmporiumOrder,
    logLabel: 'patrician/emporium',
  });
};

const configureSettlersBustlingVillage = (
  args: ExpansionConfiguratorContext,
) => {
  // Locate the settlers/bustling-village split pile in the kingdom supply, if present.
  // Use the shared split pile configurator for canonical ordering.
  configureSplitPile(args, {
    pileKey: 'settlers/bustling-village',
    desiredOrder: settlersBustlingVillageOrder,
    logLabel: 'settlers/bustling-village',
  });
};

// Register Empires landmark effects when included in the match configuration.
export const registerGameEvents: (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => void = (registrar, config) => {
  // Determine which Empires landmarks are in this match.
  configureAqueduct(registrar, config);
  configureArena(registrar, config);
};

export const registerScoringFunctions = (
  registrar: PlayerScoreDecoratorRegistrar,
) => {
  // Register Empires landmark scoring adjustments (e.g., Bandit Fort).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Bandit Fort penalties when the landmark is active.
    const hasBanditFort = (match.landmarks ?? []).some(
      (landmark) => landmark.cardKey === 'bandit-fort',
    );
    if (!hasBanditFort) return;

    // Count Silver and Gold cards owned by the player.
    const playerCards = cardLibrary.getCardsByOwner(playerId);
    let silverCount = 0;
    let goldCount = 0;
    for (const card of playerCards) {
      if (card.cardKey === 'silver') {
        silverCount += 1;
      } else if (card.cardKey === 'gold') {
        goldCount += 1;
      }
    }

    const totalTreasures = silverCount + goldCount;
    const penalty = totalTreasures * -2;
    console.debug(
      `[bandit fort scoring] player ${playerId} silver ${silverCount} gold ${goldCount} penalty ${penalty}`,
    );
    if (penalty === 0) return;

    match.scores[playerId] = (match.scores[playerId] ?? 0) + penalty;
  });
};

// Ensure victory tokens contribute to score in Empires games.
export default configurator;
