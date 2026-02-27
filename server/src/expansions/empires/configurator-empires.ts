import { CardKey, ComputedMatchConfiguration, PlayerId } from 'shared/types/index.ts';
import {
  ExpansionConfiguratorContext,
  ExpansionConfiguratorFactory,
  GameEventRegistrar,
  PlayerScoreDecoratorRegistrar,
} from '@server-types/index.ts';
import { configureSplitPile } from '../../utils/configure-split-pile.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { getConfiguredSupplyPileKeys } from '../../utils/get-configured-supply-pile-keys.ts';
import { configureAqueduct } from './configure-aqueduct.ts';
import { configureArena } from './configure-arena.ts';
import { configureBattlefield } from './configure-battlefield.ts';
import { configureBasilica } from './configure-basilica.ts';
import { configureBaths } from './configure-baths.ts';
import { configureColonnade } from './configure-colonnade.ts';
import { configureDefiledShrine } from './configure-defiled-shrine.ts';
import { configureLabyrinth } from './configure-labyrinth.ts';
import { configureMountainPass } from './configure-mountain-pass.ts';
import { configureObelisk, ObeliskMetadata } from './configure-obelisk.ts';
import { configureTomb } from './configure-tomb.ts';

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

// Canonical Catapult/Rocks split pile order (bottom -> top).
const catapultRocksOrder: CardKey[] = [
  'rocks',
  'rocks',
  'rocks',
  'rocks',
  'rocks',
  'catapult',
  'catapult',
  'catapult',
  'catapult',
  'catapult',
];

// Canonical encampment/plunder split pile order (bottom -> top).
const encampmentPlunder: CardKey[] = [
  'plunder',
  'plunder',
  'plunder',
  'plunder',
  'plunder',
  'encampment',
  'encampment',
  'encampment',
  'encampment',
  'encampment',
];

// Canonical gladiator/fortune split pile order (bottom -> top).
const gladiatorFortuneOrder: CardKey[] = [
  'fortune',
  'fortune',
  'fortune',
  'fortune',
  'fortune',
  'gladiator',
  'gladiator',
  'gladiator',
  'gladiator',
  'gladiator',
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
  return async args => {
    // Locate the Castles split pile in the kingdom supply, if present.
    const castlesSupply = args.config.kingdomSupply.find(supply =>
      supply.cards.some(card => getCardPileKey(card) === 'castles'),
    );

    if (!castlesSupply) {
      args.loggerService.info(`[empires configurator] no castles pile in kingdom supply`);
    } else {
      // Choose the canonical order based on player count.
      const playerCount = args.config.players.length;
      const desiredOrder = playerCount > 2 ? castleOrderThreePlus : castleOrderTwoPlayers;
      const currentOrder = castlesSupply.cards.map(card => card.cardKey);

      const orderMatches =
        currentOrder.length === desiredOrder.length && currentOrder.every((key, index) => key === desiredOrder[index]);

      if (orderMatches) {
        args.loggerService.info(`[empires configurator] castles pile already configured for ${playerCount} players`);
      } else {
        // Replace the pile with the canonical ordering, cloning card templates for safety.
        const nextCastleCards = [];
        for (const cardKey of desiredOrder) {
          const cardTemplate = args.cardLibrary[cardKey];
          if (!cardTemplate) {
            args.loggerService.warn(`[empires configurator] missing card template for ${cardKey}`);
            continue;
          }
          nextCastleCards.push(structuredClone(cardTemplate));
        }
        castlesSupply.cards = nextCastleCards;

        args.loggerService.log(`[empires configurator] configured castles pile for ${playerCount} players`);
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

const configureSettlersBustlingVillage = (args: ExpansionConfiguratorContext) => {
  // Locate the settlers/bustling-village split pile in the kingdom supply, if present.
  // Use the shared split pile configurator for canonical ordering.
  configureSplitPile(args, {
    pileKey: 'settlers/bustling-village',
    desiredOrder: settlersBustlingVillageOrder,
    logLabel: 'settlers/bustling-village',
  });
};

// Register Empires landmark effects when included in the match configuration.
export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
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
  configureObelisk(registrar, config);
  // Register the Tomb landmark on-trash VP bonus.
  configureTomb(registrar, config);
};

export const registerScoringFunctions = (registrar: PlayerScoreDecoratorRegistrar) => {
  // Register Empires landmark scoring adjustments (e.g., Bandit Fort).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Bandit Fort penalties when the landmark is active.
    const hasBanditFort = (match.landmarks ?? []).some(landmark => landmark.cardKey === 'bandit-fort');
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
    if (penalty === 0) return;

    match.scores[playerId] = (match.scores[playerId] ?? 0) + penalty;
  });

  // Register Empires landmark scoring bonuses (e.g., Fountain).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Fountain bonuses when the landmark is active.
    const hasFountain = (match.landmarks ?? []).some(landmark => landmark.cardKey === 'fountain');
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

    if (copperCount < 10) return;

    const bonus = 15;
    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });

  // Register Empires landmark scoring bonuses (e.g., Keep).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Keep bonuses when the landmark is active.
    const hasKeep = (match.landmarks ?? []).some(landmark => landmark.cardKey === 'keep');
    if (!hasKeep) return;

    // Collect every Treasure card key that exists in this match.
    const treasureKeys = new Set<CardKey>();
    const allCards = cardLibrary.getAllCardsAsArray();
    for (const card of allCards) {
      if (!card.type.includes('TREASURE')) continue;
      treasureKeys.add(card.cardKey);
    }

    if (treasureKeys.size === 0) {
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
        continue;
      }

      const playerCount = currentPlayerCounts[treasureKey] ?? 0;
      // Keep only scores treasures the player has at least one copy of.
      if (playerCount === 0) {
        continue;
      }
      if (playerCount !== maxCount) {
        continue;
      }

      bonus += 5;
    }

    if (bonus === 0) return;

    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });

  // Register Empires landmark scoring bonuses (e.g., Museum).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Museum bonuses when the landmark is active.
    const hasMuseum = (match.landmarks ?? []).some(landmark => landmark.cardKey === 'museum');
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
    if (bonus === 0) return;

    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });

  // Register Empires landmark scoring bonuses (e.g., Orchard).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Orchard bonuses when the landmark is active.
    const hasOrchard = (match.landmarks ?? []).some(landmark => landmark.cardKey === 'orchard');
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
    }

    const bonus = qualifyingActions * 4;
    if (bonus === 0) return;

    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });

  // Register Empires landmark scoring bonuses (e.g., Palace).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Palace bonuses when the landmark is active.
    const hasPalace = (match.landmarks ?? []).some(landmark => landmark.cardKey === 'palace');
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
    if (bonus === 0) return;

    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });

  // Register Empires landmark scoring bonuses (e.g., Tower).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Tower bonuses when the landmark is active.
    const hasTower = (match.landmarks ?? []).some(landmark => landmark.cardKey === 'tower');
    if (!hasTower) return;

    // Collect all supply pile keys in the match.
    const supplyPileKeys = new Set<CardKey>(getConfiguredSupplyPileKeys(match));

    if (!supplyPileKeys.size) {
      return;
    }

    // Count remaining cards in each supply pile based on current supply sources.
    const remainingCounts = new Map<CardKey, number>();
    const supplyCardIds = [...(match.cardSources.basicSupply ?? []), ...(match.cardSources.kingdomSupply ?? [])];
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
    if (bonus === 0) return;

    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });

  // Register Empires landmark scoring bonuses (e.g., Triumphal Arch).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Triumphal Arch bonuses when the landmark is active.
    const hasTriumphalArch = (match.landmarks ?? []).some(landmark => landmark.cardKey === 'triumphal-arch');
    if (!hasTriumphalArch) return;

    // Count Action cards by name for the player.
    const playerCards = cardLibrary.getCardsByOwner(playerId);
    const actionCounts = new Map<CardKey, number>();
    for (const card of playerCards) {
      if (!card.type.includes('ACTION')) continue;

      let count = actionCounts.get(card.cardKey) ?? 0;
      count++;
      actionCounts.set(card.cardKey, count);
    }

    if (actionCounts.size < 2) {
      return;
    }

    // Triumphal Arch awards 3 VP per copy of the 2nd most common Action.
    const sortedCounts = Array.from(actionCounts.values()).sort((a, b) => b - a);
    const secondMostCount = sortedCounts[1] ?? 0;
    const bonus = secondMostCount * 3;
    if (bonus === 0) return;

    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });

  // Register Empires landmark scoring penalties (e.g., Wall).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Wall penalties when the landmark is active.
    const hasWall = (match.landmarks ?? []).some(landmark => landmark.cardKey === 'wall');
    if (!hasWall) return;

    // Count all cards owned by the player (Wall cares about total deck size).
    const playerCards = cardLibrary.getCardsByOwner(playerId);
    const totalCards = playerCards.length;
    const excessCards = Math.max(0, totalCards - 15);
    const penalty = excessCards * -1;
    if (penalty === 0) return;

    match.scores[playerId] = (match.scores[playerId] ?? 0) + penalty;
  });

  // Register Empires landmark scoring penalties (e.g., Wolf Den).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Wolf Den penalties when the landmark is active.
    const hasWolfDen = (match.landmarks ?? []).some(landmark => landmark.cardKey === 'wolf-den');
    if (!hasWolfDen) return;

    // Count all cards owned by the player by name.
    const playerCards = cardLibrary.getCardsByOwner(playerId);
    const cardCounts = new Map<CardKey, number>();
    for (const card of playerCards) {
      let count = cardCounts.get(card.cardKey) ?? 0;
      count++;
      cardCounts.set(card.cardKey, count);
    }

    // Wolf Den penalizes each card name you have exactly one copy of.
    let singletons = 0;
    for (const count of cardCounts.values()) {
      if (count !== 1) continue;
      singletons++;
    }

    const penalty = singletons * -3;
    if (penalty === 0) return;

    match.scores[playerId] = (match.scores[playerId] ?? 0) + penalty;
  });

  // Register Empires landmark scoring bonuses (e.g., Obelisk).
  registrar((playerId, match, cardLibrary) => {
    // Only apply Obelisk bonuses when the landmark is active.
    const obeliskLandmark = (match.landmarks ?? []).find(landmark => landmark.cardKey === 'obelisk');
    if (!obeliskLandmark) return;

    const metadata = obeliskLandmark.metadata as ObeliskMetadata;
    const chosenPileKey = metadata?.chosenPileKey;
    if (!chosenPileKey) {
      return;
    }

    // Resolve the chosen pile's card keys from the match configuration.
    const supplyPiles = [...(match.config.basicSupply ?? []), ...(match.config.kingdomSupply ?? [])];
    const chosenPile = supplyPiles.find(supply => supply.name === chosenPileKey);
    if (!chosenPile) {
      return;
    }

    const chosenKeySet = new Set<CardKey>(chosenPile.cards.map(card => card.cardKey));
    const playerCards = cardLibrary.getCardsByOwner(playerId);
    let qualifyingCards = 0;
    for (const card of playerCards) {
      if (!chosenKeySet.has(card.cardKey)) continue;
      qualifyingCards++;
    }

    const bonus = qualifyingCards * 2;
    if (bonus === 0) return;

    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });
};

// Ensure victory tokens contribute to score in Empires games.
export default configurator;
