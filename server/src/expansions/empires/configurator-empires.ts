import { CardKey, ComputedMatchConfiguration } from "shared/shared-types.ts";
import {
  ExpansionConfiguratorContext,
  ExpansionConfiguratorFactory,
  GameEventRegistrar,
} from "../../types.ts";
import { configureSplitPile } from "../../utils/configure-split-pile.ts";
import { getCardPileKey } from "../../utils/get-card-pile-key.ts";
import { prosperityTokenIds } from "../prosperity/token-prosperity-ids.ts";

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

// Register Aqueduct landmark effects when included in the match configuration.
export const registerGameEvents: (
  registrar: GameEventRegistrar,
  config: ComputedMatchConfiguration,
) => void = (registrar, config) => {
  // Aqueduct is always-on and only needs handlers when selected.
  const hasAqueduct = (config.landmarks ?? []).some(
    (landmark) => landmark.cardKey === 'aqueduct',
  );
  if (!hasAqueduct) return;

  console.info(`[empires configurator] setting up aqueduct landmark handlers`);

  registrar('onGameStart', async (args) => {
    // Aqueduct setup: put 8 VP tokens on Silver and Gold piles.
    console.info(`[aqueduct onGameStart] placing VP tokens on Silver and Gold piles`);
    const victoryTokenId = prosperityTokenIds.victory;
    const targetPiles: CardKey[] = ['silver', 'gold'];

    for (const pileKey of targetPiles) {
      for (let i = 0; i < 8; i += 1) {
        await args.runGameActionDelegate('placeToken', {
          tokenId: victoryTokenId,
          location: { type: 'supplyPile', cardKey: pileKey },
        });
      }
    }
  });

  registrar('onCardGained', async (args, eventArgs) => {
    // Aqueduct triggers on any Treasure/Victory gain.
    const gainedCard = args.cardLibrary.getCard(eventArgs.cardId);
    const isTreasure = gainedCard.type.includes('TREASURE');
    const isVictory = gainedCard.type.includes('VICTORY');

    if (!isTreasure && !isVictory) return;

    const victoryTokenId = prosperityTokenIds.victory;
    const pileKey = getCardPileKey(gainedCard);

    // Finds victory tokens on a supply pile keyed by cardKey.
    const getTokensOnPile = (cardKey: CardKey) =>
      Object.values(args.match.tokens).filter((token) =>
        token.tokenId === victoryTokenId &&
        token.location.type === 'supplyPile' &&
        token.location.cardKey === cardKey
      );

    // Moves one victory token from the gained card's pile to Aqueduct.
    const moveTokenToAqueduct = async (): Promise<boolean> => {
      const tokensOnPile = getTokensOnPile(pileKey).sort((a, b) =>
        a.id.localeCompare(b.id)
      );
      const token = tokensOnPile[0];
      if (!token) {
        console.debug(`[aqueduct onCardGained] no victory tokens on ${pileKey} pile`);
        return false;
      }

      console.debug(`[aqueduct onCardGained] moving 1 VP from ${pileKey} to Aqueduct`);
      await args.runGameActionDelegate('moveToken', {
        tokenInstanceId: token.id,
        location: { type: 'supplyPile', cardKey: 'aqueduct' },
      });
      return true;
    };

    // Moves all victory tokens from Aqueduct to the gaining player.
    const claimAqueductTokens = async (): Promise<void> => {
      const tokensOnAqueduct = getTokensOnPile('aqueduct').sort((a, b) =>
        a.id.localeCompare(b.id)
      );
      if (!tokensOnAqueduct.length) {
        console.debug(`[aqueduct onCardGained] no victory tokens on Aqueduct`);
        return;
      }

      console.info(
        `[aqueduct onCardGained] moving ${tokensOnAqueduct.length} VP token(s) to player ${eventArgs.playerId}`,
      );
      for (const token of tokensOnAqueduct) {
        await args.runGameActionDelegate('moveToken', {
          tokenInstanceId: token.id,
          location: { type: 'player', playerId: eventArgs.playerId },
          ownerId: eventArgs.playerId,
        });
      }
    };

    // Resolve Treasure portion first, then Victory portion if both apply.
    if (isTreasure) {
      await moveTokenToAqueduct();
    }
    if (isVictory) {
      await claimAqueductTokens();
    }
  });
};

// Ensure victory tokens contribute to score in Empires games.
export default configurator;
