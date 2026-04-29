import { BaseCardMetadata, CardNoId, ComputedMatchConfiguration, Supply, WayNoId } from 'shared/types/index.ts';
import { ExpansionConfiguratorContext, ExpansionConfiguratorFactory, GameEventRegistrar } from '@server-types/index.ts';
import { addMatToMatchConfig } from '../../utils/add-mat-to-match-config.ts';
import { getAvailableKingdomRandomizerGroups } from '../../utils/get-available-kingdom-randomizer-groups.ts';
import { getDefaultKingdomSupplySize } from '../../utils/get-default-kingdom-supply-size.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { ExpansionData } from '../expansion-library.ts';

// Menagerie cards that require the Horse non-supply pile to be configured.
const horseSourcePiles = new Set(['cavalry', 'groom', 'hostelry', 'livery', 'paddock', 'scrap', 'sleigh', 'supplies']);

// Menagerie events that require the Horse non-supply pile.
const horseSourceEvents = new Set(['bargain', 'demand', 'ride', 'stampede']);

// Menagerie events that require the Exile mat.
const exileMatEvents = new Set(['banish', 'enclave', 'invest', 'transport']);

const WAY_OF_THE_MOUSE_CARD_KEY = 'way-of-the-mouse';
const WAY_OF_THE_MOUSE_RUNTIME_SET_ASIDE_PREFIX = 'way-of-the-mouse-set-aside:';

type WayOfTheMouseWayMetadata = {
  setAsideCardKey?: string;
  setAsideCardExpansion?: string;
  setAsidePileKey?: string;
  proxyPileKey?: string;
  runtimeSetAsidePileKey?: string;
};

type WayOfTheMouseWayCardLikeMetadata = {
  menagerie?: {
    wayOfTheMouse?: WayOfTheMouseWayMetadata;
  };
};

type WayOfTheMouseCardMetadata = BaseCardMetadata & {
  menagerie?: {
    wayOfTheMouse?: {
      setupProxy?: true;
      proxyPileKey?: string;
      runtimeSetAsideCard?: true;
      runtimeSetAsidePileKey?: string;
      selectedPileKey?: string;
    };
  };
};

// Reads and creates Way of the Mouse metadata on the selected Way entry.
const getWayOfTheMouseMetadata = (way: WayNoId): WayOfTheMouseWayMetadata => {
  const metadata = (way.metadata as WayOfTheMouseWayCardLikeMetadata | undefined) ?? {};
  metadata.menagerie ??= {};
  metadata.menagerie.wayOfTheMouse ??= {};
  way.metadata = metadata;
  return metadata.menagerie.wayOfTheMouse;
};

// Returns true when a card is a legal Way of the Mouse set-aside candidate.
const isWayOfTheMouseCandidate = (card: CardNoId): boolean => {
  const resolvedType = card.randomizerData?.type ?? card.type;
  const resolvedCost = card.randomizerData?.cost ?? card.cost;
  const treasureCost = resolvedCost.treasure ?? 0;
  return (
    resolvedType.includes('ACTION') &&
    !resolvedType.includes('DURATION') &&
    (resolvedCost.potion ?? 0) === 0 &&
    (resolvedCost.debt ?? 0) === 0 &&
    (treasureCost === 2 || treasureCost === 3)
  );
};

// Returns true when a supply is a synthetic Way of the Mouse setup proxy.
const isWayOfTheMouseSetupProxySupply = (supply: Supply, expectedPileKey?: string): boolean => {
  if (supply.cards.length < 1) {
    return false;
  }
  return supply.cards.every(card => {
    const metadata = card.metadata as WayOfTheMouseCardMetadata | undefined;
    if (metadata?.base?.isSetupProxyKingdomPile !== true) {
      return false;
    }
    const wayOfTheMouse = metadata?.menagerie?.wayOfTheMouse;
    if (!wayOfTheMouse) {
      return false;
    }
    if (!expectedPileKey) {
      return true;
    }
    return wayOfTheMouse.proxyPileKey === expectedPileKey;
  });
};

// Returns true when a non-supply pile is the runtime set-aside card source for Way of the Mouse.
const isWayOfTheMouseRuntimeSetAsideSupply = (supply: Supply, expectedPileKey?: string): boolean => {
  if (supply.cards.length < 1) {
    return false;
  }
  return supply.cards.every(card => {
    const metadata = card.metadata as WayOfTheMouseCardMetadata | undefined;
    const wayOfTheMouse = metadata?.menagerie?.wayOfTheMouse;
    if (!wayOfTheMouse || wayOfTheMouse.runtimeSetAsideCard !== true) {
      return false;
    }
    if (!expectedPileKey) {
      return true;
    }
    return wayOfTheMouse.runtimeSetAsidePileKey === expectedPileKey;
  });
};

// Removes setup/runtime synthetic piles created for Way of the Mouse.
const cleanupWayOfTheMouseSyntheticPiles = (
  args: ExpansionConfiguratorContext,
  keep?: { proxyPileKey?: string },
): void => {
  const config = args.config;
  const nextKingdomSupply = config.kingdomSupply.filter(
    supply =>
      !isWayOfTheMouseSetupProxySupply(supply) ||
      (keep?.proxyPileKey !== undefined && isWayOfTheMouseSetupProxySupply(supply, keep.proxyPileKey)),
  );
  const removedSetupProxyCount = config.kingdomSupply.length - nextKingdomSupply.length;
  if (removedSetupProxyCount > 0) {
    args.loggerService.info(
      `[menagerie configurator] removed ${removedSetupProxyCount} stale Way of the Mouse setup proxy pile(s)`,
    );
  }
  config.kingdomSupply = nextKingdomSupply;

  const existingNonSupply = config.nonSupply;
  if (!existingNonSupply) {
    return;
  }
  // Way of the Mouse runtime set-aside card should never exist as a non-supply pile.
  const nextNonSupply = existingNonSupply.filter(supply => !isWayOfTheMouseRuntimeSetAsideSupply(supply));
  const removedRuntimeSetAsideCount = existingNonSupply.length - nextNonSupply.length;
  if (removedRuntimeSetAsideCount > 0) {
    args.loggerService.info(
      `[menagerie configurator] removed ${removedRuntimeSetAsideCount} stale Way of the Mouse runtime set-aside pile(s)`,
    );
  }
  config.nonSupply = nextNonSupply;
};

// Resolves the selected expansion data used for kingdoms-randomizer candidate discovery.
const getConfiguredExpansionData = (args: ExpansionConfiguratorContext): ExpansionData[] => {
  return args.config.expansions.reduce((expansions, configuredExpansion) => {
    const expansionData = args.expansionCatalog[configuredExpansion.name];
    if (!expansionData) {
      args.loggerService.warn(`[menagerie configurator] expansion ${configuredExpansion.name} not found`);
      return expansions;
    }
    expansions.push(expansionData);
    return expansions;
  }, [] as ExpansionData[]);
};

// Resolves the currently selected Way of the Mouse set-aside card from metadata.
const resolveWayOfTheMouseSelectedCard = (args: ExpansionConfiguratorContext, way: WayNoId): CardNoId | null => {
  const metadata = getWayOfTheMouseMetadata(way);
  const setAsideCardExpansion = metadata.setAsideCardExpansion;
  const setAsideCardKey = metadata.setAsideCardKey;

  if (!setAsideCardExpansion || !setAsideCardKey) {
    return null;
  }

  const card = args.expansionCatalog[setAsideCardExpansion]?.cardData.kingdomSupply[setAsideCardKey];
  if (!card) {
    args.loggerService.warn(
      `[menagerie configurator] unable to resolve Way of the Mouse set-aside card ${setAsideCardExpansion}:${setAsideCardKey}`,
    );
    return null;
  }
  return card;
};

// Adds or validates Way of the Mouse setup state: selected card, setup proxy pile, and runtime set-aside metadata.
const configureWayOfTheMouse = (args: ExpansionConfiguratorContext): void => {
  const config = args.config;
  const wayOfTheMouse = config.ways.find(way => way.cardKey === WAY_OF_THE_MOUSE_CARD_KEY);
  if (!wayOfTheMouse) {
    cleanupWayOfTheMouseSyntheticPiles(args);
    return;
  }

  const wayMetadata = getWayOfTheMouseMetadata(wayOfTheMouse);
  const usedPileKeys = new Set(
    config.kingdomSupply
      .filter(supply => !isWayOfTheMouseSetupProxySupply(supply))
      .flatMap(supply => supply.cards.map(card => getCardPileKey(card))),
  );
  const bannedPileKeys = config.bannedKingdoms.map(card => getCardPileKey(card));
  let selectedCard = resolveWayOfTheMouseSelectedCard(args, wayOfTheMouse);

  const currentSelectionValid =
    !!selectedCard &&
    isWayOfTheMouseCandidate(selectedCard) &&
    !!wayMetadata.setAsidePileKey &&
    !usedPileKeys.has(wayMetadata.setAsidePileKey);

  if (!currentSelectionValid) {
    const selectedExpansions = getConfiguredExpansionData(args);
    const availableGroups = getAvailableKingdomRandomizerGroups({
      expansions: selectedExpansions,
      excludedPileKeys: Array.from(usedPileKeys),
      bannedPileKeys,
      cardFilter: card => isWayOfTheMouseCandidate(card),
    });

    if (availableGroups.length < 1) {
      args.loggerService.warn(
        '[menagerie configurator] no legal Way of the Mouse set-aside candidates; removing Way of the Mouse',
      );
      config.ways = config.ways.filter(way => way.cardKey !== WAY_OF_THE_MOUSE_CARD_KEY);
      cleanupWayOfTheMouseSyntheticPiles(args);
      return;
    }

    const chosenGroup = availableGroups[args.rngService.nextIndex(availableGroups.length)];
    const chosenCard = structuredClone(chosenGroup.cards[0]);
    if (!chosenCard) {
      args.loggerService.warn('[menagerie configurator] selected Way of the Mouse candidate group has no cards');
      config.ways = config.ways.filter(way => way.cardKey !== WAY_OF_THE_MOUSE_CARD_KEY);
      cleanupWayOfTheMouseSyntheticPiles(args);
      return;
    }

    wayMetadata.setAsideCardKey = chosenCard.cardKey;
    wayMetadata.setAsideCardExpansion = chosenCard.expansionName;
    wayMetadata.setAsidePileKey = chosenGroup.pileKey;
    wayMetadata.proxyPileKey = chosenGroup.pileKey;
    wayMetadata.runtimeSetAsidePileKey = `${WAY_OF_THE_MOUSE_RUNTIME_SET_ASIDE_PREFIX}${chosenGroup.pileKey}`;
    args.loggerService.info(
      `[menagerie configurator] Way of the Mouse selected set-aside card ${chosenCard.cardKey} (${chosenGroup.pileKey})`,
    );
    selectedCard = chosenCard;
  }

  if (!selectedCard || !wayMetadata.proxyPileKey || !wayMetadata.runtimeSetAsidePileKey) {
    args.loggerService.warn('[menagerie configurator] Way of the Mouse metadata is incomplete after selection');
    config.ways = config.ways.filter(way => way.cardKey !== WAY_OF_THE_MOUSE_CARD_KEY);
    cleanupWayOfTheMouseSyntheticPiles(args);
    return;
  }

  cleanupWayOfTheMouseSyntheticPiles(args, {
    proxyPileKey: wayMetadata.proxyPileKey,
  });

  const hasSetupProxy = config.kingdomSupply.some(supply =>
    isWayOfTheMouseSetupProxySupply(supply, wayMetadata.proxyPileKey),
  );
  if (!hasSetupProxy) {
    const proxyCard = structuredClone(selectedCard);
    const proxyMetadata = (proxyCard.metadata as WayOfTheMouseCardMetadata | undefined) ?? {};
    proxyMetadata.menagerie ??= {};
    proxyMetadata.menagerie.wayOfTheMouse ??= {};
    proxyMetadata.menagerie.wayOfTheMouse.setupProxy = true;
    proxyMetadata.menagerie.wayOfTheMouse.proxyPileKey = wayMetadata.proxyPileKey;
    proxyMetadata.menagerie.wayOfTheMouse.selectedPileKey = wayMetadata.setAsidePileKey;
    proxyMetadata.base ??= {};
    proxyMetadata.base.isSetupProxyKingdomPile = true;
    proxyCard.metadata = proxyMetadata;
    proxyCard.kingdomSelectable = false;

    config.kingdomSupply.push({
      // Use the normal pile name so existing expansion configurators detect setup dependencies naturally.
      name: proxyCard.kingdom,
      cards: new Array(getDefaultKingdomSupplySize(proxyCard, config)).fill(proxyCard),
    });
    args.loggerService.info(
      `[menagerie configurator] added Way of the Mouse setup proxy kingdom pile for ${proxyCard.cardKey}`,
    );
  }

  // Runtime set-aside card is created directly into shared set-aside during match setup.
};

// Ensures the Horse pile is present only when required by selected kingdoms cards.
const configureHorsePile = (configuratorArgs: ExpansionConfiguratorContext) => {
  const config = configuratorArgs.config;
  const hasHorseSource =
    config.kingdomSupply.some(supply => horseSourcePiles.has(supply.name)) ||
    config.events.some(event => horseSourceEvents.has(event.cardKey));
  const hasHorsePile = config.nonSupply?.some(supply => supply.name === 'horse') ?? false;

  if (!hasHorseSource) {
    if (!hasHorsePile) {
      return;
    }
    configuratorArgs.loggerService.info(
      '[menagerie configurator] removing Horse pile because no Horse source cards are present',
    );
    config.nonSupply = (config.nonSupply ?? []).filter(supply => supply.name !== 'horse');
    return;
  }

  if (hasHorsePile) {
    return;
  }

  const baseHorse = structuredClone(configuratorArgs.expansionCatalog['menagerie']?.cardData.kingdomSupply['horse']);
  if (!baseHorse) {
    configuratorArgs.loggerService.warn('[menagerie configurator] horse card data not found');
    return;
  }

  config.nonSupply ??= [];
  config.nonSupply.push({
    name: 'horse',
    cards: new Array(30).fill({
      ...baseHorse,
      partOfSupply: false,
      kingdomSelectable: false,
      tags: ['horse'],
    }),
  });
  configuratorArgs.loggerService.info('[menagerie configurator] added Horse non-supply pile');
};

const configurator: ExpansionConfiguratorFactory = () => {
  return async args => {
    // Menagerie Exile mat is needed when selected Kingdom cards or Events use Exile.
    const requiresExileMat =
      args.config.kingdomSupply.some(supply => supply.cards.some(card => card.mat === 'exile')) ||
      args.config.events.some(event => exileMatEvents.has(event.cardKey));

    if (!requiresExileMat) {
      configureWayOfTheMouse(args);
      configureHorsePile(args);
      return args.config;
    }

    // Avoid duplicate zone registration across configurator re-runs.
    const exileZoneAlreadyRegisteredForAllPlayers = args.config.players.every(player => {
      try {
        args.cardSourceController.getSource('exile', player.id);
        return true;
      } catch {
        return false;
      }
    });

    if (exileZoneAlreadyRegisteredForAllPlayers) {
      args.loggerService.debug('[menagerie configurator] exile mat already configured for all players');
      configureWayOfTheMouse(args);
      configureHorsePile(args);
      return args.config;
    }

    args.loggerService.info('[menagerie configurator] adding exile mat zones for all players');
    addMatToMatchConfig('exile', args.config, args);
    configureWayOfTheMouse(args);
    configureHorsePile(args);
    return args.config;
  };
};

export default configurator;

// Registers Menagerie game-start hooks that provide dynamic cost rules.
export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  const hasFisherman = config.kingdomSupply.some(supply => supply.name === 'fisherman');
  const hasDestrier = config.kingdomSupply.some(supply => supply.name === 'destrier');
  const hasWayfarer = config.kingdomSupply.some(supply => supply.name === 'wayfarer');

  if (!hasFisherman && !hasDestrier && !hasWayfarer) {
    return;
  }

  registrar('onGameStartSetup', async args => {
    if (hasFisherman) {
      args.loggerService.info('[menagerie configurator] registering Fisherman cost rules');
      const fishermanCards = args.findCardService.findCards({
        all: [{ location: 'kingdomSupply' }, { cardKeys: 'fisherman' }],
      });

      for (const fishermanCard of fishermanCards) {
        args.cardPriceController.registerRule(fishermanCard, (_card, context) => {
          const currentTurnPlayer = context.match.players[context.match.currentPlayerTurnIndex];
          if (!currentTurnPlayer || currentTurnPlayer.id !== context.playerId) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          const discardPile = args.cardSourceController.getSource('playerDiscard', context.playerId);
          if (discardPile.length > 0) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          return { restricted: false, cost: { treasure: -3 } };
        });
      }
    }

    if (hasDestrier) {
      args.loggerService.info('[menagerie configurator] registering Destrier cost rules');
      const destrierCards = args.findCardService.findCards({
        all: [{ location: 'kingdomSupply' }, { cardKeys: 'destrier' }],
      });

      for (const destrierCard of destrierCards) {
        args.cardPriceController.registerRule(destrierCard, (_card, context) => {
          const currentTurnPlayer = context.match.players[context.match.currentPlayerTurnIndex];
          if (!currentTurnPlayer || currentTurnPlayer.id !== context.playerId) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          const currentTurnHistoryIndex = context.match.stats.turns.length - 1;
          if (currentTurnHistoryIndex < 0) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          const gainedCardIds = context.match.stats.cardsGainedByTurn[currentTurnHistoryIndex] ?? [];
          const gainedCardCount = gainedCardIds.filter(gainedCardId => {
            const gainStats = context.match.stats.cardsGained[gainedCardId];
            return gainStats?.turnHistoryIndex === currentTurnHistoryIndex && gainStats.playerId === context.playerId;
          }).length;

          if (gainedCardCount < 1) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          return { restricted: false, cost: { treasure: -gainedCardCount } };
        });
      }
    }

    if (hasWayfarer) {
      args.loggerService.info('[menagerie configurator] registering Wayfarer cost rules');
      const wayfarerCards = args.findCardService.findCards({
        all: [{ location: 'kingdomSupply' }, { cardKeys: 'wayfarer' }],
      });

      for (const wayfarerCard of wayfarerCards) {
        args.cardPriceController.registerRule(wayfarerCard, (_card, context) => {
          const currentTurnHistoryIndex = context.match.stats.turns.length - 1;
          if (currentTurnHistoryIndex < 0) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          const gainedCardIds = context.match.stats.cardsGainedByTurn[currentTurnHistoryIndex] ?? [];
          let lastOtherGainedCardId: number | undefined;

          // Scan backward to find the last non-Wayfarer card gained this turn.
          for (let gainIndex = gainedCardIds.length - 1; gainIndex >= 0; gainIndex--) {
            const gainedCardId = gainedCardIds[gainIndex];
            const gainStats = context.match.stats.cardsGained[gainedCardId];
            if (gainStats?.turnHistoryIndex !== currentTurnHistoryIndex) {
              continue;
            }

            const gainedCard = args.cardLibrary.getCard(gainedCardId);
            if (gainedCard.cardKey === 'wayfarer') {
              continue;
            }

            lastOtherGainedCardId = gainedCardId;
            break;
          }

          if (lastOtherGainedCardId === undefined) {
            return { restricted: false, cost: { treasure: 0 } };
          }

          const lastOtherGainedCard = args.cardLibrary.getCard(lastOtherGainedCardId);
          const { cost: lastGainedCardCost } = args.cardPriceController.applyRules(lastOtherGainedCard, {
            playerId: context.playerId,
          });

          // Adjust Wayfarer by the delta from its printed cost to the tracked gained-card cost.
          return {
            restricted: false,
            cost: {
              treasure: lastGainedCardCost.treasure - (wayfarerCard.cost.treasure ?? 0),
              potion: (lastGainedCardCost.potion ?? 0) - (wayfarerCard.cost.potion ?? 0),
              debt: (lastGainedCardCost.debt ?? 0) - (wayfarerCard.cost.debt ?? 0),
            },
          };
        });
      }
    }
  });
};
