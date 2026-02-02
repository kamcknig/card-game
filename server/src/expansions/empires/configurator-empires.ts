import {CardKey, ComputedMatchConfiguration, PlayerId} from 'shared/shared-types';
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
import {configureBattlefield} from './configure-battlefield.ts';
import {configureBasilica} from './configure-basilica.ts';
import {configureBaths} from './configure-baths.ts';
import {configureColonnade} from './configure-colonnade.ts';
import {configureDefiledShrine} from './configure-defiled-shrine.ts';
import {configureLabyrinth} from './configure-labyrinth.ts';
import {configureMountainPass} from './configure-mountain-pass.ts';
import {configureTomb} from './configure-tomb.ts';

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
  configureBattlefield(registrar, config);
  configureBasilica(registrar, config);
  configureBaths(registrar, config);
  configureColonnade(registrar, config);
  configureDefiledShrine(registrar, config);
  configureLabyrinth(registrar, config);
  configureMountainPass(registrar, config);
  // Register the Tomb landmark on-trash VP bonus.
  configureTomb(registrar, config);
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
        silverCount++;
      } else if (card.cardKey === 'gold') {
        goldCount++;
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

  // Register Empires landmark scoring bonuses (e.g., Fountain).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Fountain bonuses when the landmark is active.
    const hasFountain = (match.landmarks ?? []).some(
      (landmark) => landmark.cardKey === 'fountain',
    );
    if (!hasFountain) return;

    // Count Copper cards owned by the player for the Fountain threshold.
    const playerCards = cardLibrary.getCardsByOwner(playerId);
    let copperCount = 0;
    // Count up to the Fountain threshold and stop early once it is met.
    for (const card of playerCards) {
      if (card.cardKey !== 'copper') continue;

      copperCount++;
      // Stop once the Fountain threshold is reached to avoid extra iteration.
      if (copperCount >= 10) break;
    }

    console.debug(
      `[fountain scoring] player ${playerId} copper ${copperCount}`,
    );

    if (copperCount < 10) return;

    const bonus = 15;
    console.info(
      `[fountain scoring] player ${playerId} qualifies, adding ${bonus} VP`,
    );
    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });

  // Register Empires landmark scoring bonuses (e.g., Keep).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Keep bonuses when the landmark is active.
    const hasKeep = (match.landmarks ?? []).some(
      (landmark) => landmark.cardKey === 'keep',
    );
    if (!hasKeep) return;

    // Collect every Treasure card key that exists in this match.
    const treasureKeys = new Set<CardKey>();
    const allCards = cardLibrary.getAllCardsAsArray();
    for (const card of allCards) {
      if (!card.type.includes('TREASURE')) continue;
      treasureKeys.add(card.cardKey);
    }

    if (treasureKeys.size === 0) {
      console.debug('[keep scoring] no treasure cards in game, skipping');
      return;
    }

    // Build per-player Treasure counts for each treasure key in the match.
    const playerTreasureCounts = new Map<PlayerId, Record<CardKey, number>>();
    for (const player of match.players) {
      const playerCards = cardLibrary.getCardsByOwner(player.id);
      const counts: Record<CardKey, number> = {};
      for (const card of playerCards) {
        if (!card.type.includes('TREASURE')) continue;

        let count = counts[card.cardKey] ?? 0;
        count++;
        counts[card.cardKey] = count;
      }
      playerTreasureCounts.set(player.id, counts);
    }

    const currentPlayerCounts = playerTreasureCounts.get(playerId) ?? {};
    let bonus = 0;

    // Award 5 VP per Treasure where the player is tied for most (including ties at 0).
    for (const treasureKey of treasureKeys) {
      let maxCount = 0;
      for (const player of match.players) {
        const counts = playerTreasureCounts.get(player.id);
        const count = counts?.[treasureKey] ?? 0;
        if (count > maxCount) {
          maxCount = count;
        }
      }

      if (maxCount === 0) {
        console.debug(
          `[keep scoring] no players have ${treasureKey}, skipping`,
        );
        continue;
      }

      const playerCount = currentPlayerCounts[treasureKey] ?? 0;
      // Keep only scores treasures the player has at least one copy of.
      if (playerCount === 0) {
        console.debug(
          `[keep scoring] player ${playerId} has none of ${treasureKey}, skipping`,
        );
        continue;
      }
      if (playerCount !== maxCount) {
        console.debug(
          `[keep scoring] player ${playerId} does not qualify for ${treasureKey} (player ${playerCount}, max ${maxCount})`,
        );
        continue;
      }

      bonus += 5;
      console.debug(
        `[keep scoring] player ${playerId} qualifies for ${treasureKey} (player ${playerCount}, max ${maxCount})`,
      );
    }

    if (bonus === 0) return;

    console.info(`[keep scoring] player ${playerId} earns ${bonus} VP`);
    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });

  // Register Empires landmark scoring bonuses (e.g., Museum).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Museum bonuses when the landmark is active.
    const hasMuseum = (match.landmarks ?? []).some(
      (landmark) => landmark.cardKey === 'museum',
    );
    if (!hasMuseum) return;

    // Track unique card names owned by the player.
    const playerCards = cardLibrary.getCardsByOwner(playerId);
    const uniqueCardKeys = new Set<CardKey>();
    for (const card of playerCards) {
      uniqueCardKeys.add(card.cardKey);
    }

    // Museum awards 2 VP per differently named card.
    const uniqueCount = uniqueCardKeys.size;
    const bonus = uniqueCount * 2;
    console.debug(
      `[museum scoring] player ${playerId} unique ${uniqueCount} bonus ${bonus}`,
    );
    if (bonus === 0) return;

    console.info(`[museum scoring] player ${playerId} earns ${bonus} VP`);
    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });

  // Register Empires landmark scoring bonuses (e.g., Orchard).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Orchard bonuses when the landmark is active.
    const hasOrchard = (match.landmarks ?? []).some(
      (landmark) => landmark.cardKey === 'orchard',
    );
    if (!hasOrchard) return;

    // Count Action cards by name for the player.
    const playerCards = cardLibrary.getCardsByOwner(playerId);
    const actionCounts = new Map<CardKey, number>();
    for (const card of playerCards) {
      if (!card.type.includes('ACTION')) continue;

      let count = actionCounts.get(card.cardKey) ?? 0;
      count++;
      actionCounts.set(card.cardKey, count);
    }

    // Orchard awards 4 VP per differently named Action card with 3+ copies.
    let qualifyingActions = 0;
    for (const [cardKey, count] of actionCounts.entries()) {
      if (count < 3) continue;

      qualifyingActions++;
      console.debug(
        `[orchard scoring] player ${playerId} qualifies for ${cardKey} (${count})`,
      );
    }

    const bonus = qualifyingActions * 4;
    console.debug(
      `[orchard scoring] player ${playerId} qualifying ${qualifyingActions} bonus ${bonus}`,
    );
    if (bonus === 0) return;

    console.info(`[orchard scoring] player ${playerId} earns ${bonus} VP`);
    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });

  // Register Empires landmark scoring bonuses (e.g., Palace).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Palace bonuses when the landmark is active.
    const hasPalace = (match.landmarks ?? []).some(
      (landmark) => landmark.cardKey === 'palace',
    );
    if (!hasPalace) return;

    // Count basic Treasures (Copper, Silver, Gold) owned by the player.
    const playerCards = cardLibrary.getCardsByOwner(playerId);
    let copperCount = 0;
    let silverCount = 0;
    let goldCount = 0;
    for (const card of playerCards) {
      if (card.cardKey === 'copper') {
        copperCount++;
      } else if (card.cardKey === 'silver') {
        silverCount++;
      } else if (card.cardKey === 'gold') {
        goldCount++;
      }
    }

    // Palace awards 3 VP per complete set of Copper, Silver, and Gold.
    const setCount = Math.min(copperCount, silverCount, goldCount);
    const bonus = setCount * 3;
    console.debug(
      `[palace scoring] player ${playerId} copper ${copperCount} silver ${silverCount} gold ${goldCount} sets ${setCount} bonus ${bonus}`,
    );
    if (bonus === 0) return;

    console.info(`[palace scoring] player ${playerId} earns ${bonus} VP`);
    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });

  // Register Empires landmark scoring bonuses (e.g., Tower).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Tower bonuses when the landmark is active.
    const hasTower = (match.landmarks ?? []).some(
      (landmark) => landmark.cardKey === 'tower',
    );
    if (!hasTower) return;

    // Collect all supply pile keys in the match.
    const supplyPiles = [
      ...(match.config.basicSupply ?? []),
      ...(match.config.kingdomSupply ?? []),
    ];
    const supplyPileKeys = new Set<CardKey>();
    for (const supply of supplyPiles) {
      supplyPileKeys.add(supply.name as CardKey);
    }

    if (!supplyPileKeys.size) {
      console.debug('[tower scoring] no supply piles in match, skipping');
      return;
    }

    // Count remaining cards in each supply pile based on current supply sources.
    const remainingCounts = new Map<CardKey, number>();
    const supplyCardIds = [
      ...(match.cardSources.basicSupply ?? []),
      ...(match.cardSources.kingdomSupply ?? []),
    ];
    for (const cardId of supplyCardIds) {
      const supplyCard = cardLibrary.getCard(cardId);
      const pileKey = getCardPileKey(supplyCard);
      let count = remainingCounts.get(pileKey) ?? 0;
      count++;
      remainingCounts.set(pileKey, count);
    }

    // Identify which supply piles are empty.
    const emptyPileKeys = new Set<CardKey>();
    for (const pileKey of supplyPileKeys) {
      const remaining = remainingCounts.get(pileKey) ?? 0;
      if (remaining === 0) {
        emptyPileKeys.add(pileKey);
      }
    }

    if (!emptyPileKeys.size) {
      console.debug('[tower scoring] no empty supply piles, skipping');
      return;
    }

    // Count non-Victory cards owned by the player from empty supply piles.
    const playerCards = cardLibrary.getCardsByOwner(playerId);
    let qualifyingCards = 0;
    for (const card of playerCards) {
      if (!card.partOfSupply) continue;
      if (card.type.includes('VICTORY')) continue;

      const pileKey = getCardPileKey(card);
      if (!emptyPileKeys.has(pileKey)) continue;

      qualifyingCards++;
    }

    const bonus = qualifyingCards;
    console.debug(
      `[tower scoring] player ${playerId} qualifying ${qualifyingCards} bonus ${bonus}`,
    );
    if (bonus === 0) return;

    console.info(`[tower scoring] player ${playerId} earns ${bonus} VP`);
    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });
};

// Ensure victory tokens contribute to score in Empires games.
export default configurator;
