import { compareCardCosts } from '@shared/compare-card-cost.ts';
import { findWayInMatch } from '@shared/find-card-like-in-match.ts';
import {
  BaseCardMetadata,
  Card,
  CardNoId,
  CardKey,
  ComputedMatchConfiguration,
  Match,
  PlayerId,
  Prophecy,
  Supply,
} from 'shared/types/index.ts';
import { ExpansionConfiguratorContext, ExpansionConfiguratorFactory, GameEventRegistrar } from '@server-types/index.ts';
import { uniqueByProp } from '../../core/match-configurator.ts';
import { baseV2TokenIds } from '../base-v2/token-ids-base-v2.ts';
import { getConfiguredCardPileLocation } from '../../utils/get-configured-card-pile-location.ts';
import { getConfiguredSupplyPileKeys } from '../../utils/get-configured-supply-pile-keys.ts';
import { getAvailableKingdomRandomizerGroups } from '../../utils/get-available-kingdom-randomizer-groups.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getCurrentTurnHistoryIndex } from '../../utils/get-current-turn-history-index.ts';
import { getDefaultKingdomSupplySize } from '../../utils/get-default-kingdom-supply-size.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { isCardStillAtGainedLocation } from '../../utils/is-card-still-at-gained-location.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';
import { returnCardToConfiguredPileTop } from '../../utils/return-card-to-configured-pile-top.ts';
import { registerRisingSunTokenDefinitions } from './token-definitions-rising-sun.ts';
import { risingSunTokenIds } from './token-ids-rising-sun.ts';

const SUN_TOKEN_COUNT_BY_PLAYER_COUNT: Record<number, number> = {
  2: 5,
  3: 8,
  4: 10,
  5: 12,
  6: 13,
};

const APPROACHING_ARMY_PROPHECY_KEY: CardKey = 'approaching-army';
const APPROACHING_ARMY_SETUP_TAG = 'rising-sun:approaching-army-extra-pile';
const BIDING_TIME_PROPHECY_KEY: CardKey = 'biding-time';
const BUREAUCRACY_PROPHECY_KEY: CardKey = 'bureaucracy';
const ENLIGHTENMENT_PROPHECY_KEY: CardKey = 'enlightenment';
const FLOURISHING_TRADE_PROPHECY_KEY: CardKey = 'flourishing-trade';
const HARSH_WINTER_PROPHECY_KEY: CardKey = 'harsh-winter';
const GOOD_HARVEST_PROPHECY_KEY: CardKey = 'good-harvest';
const GREAT_LEADER_PROPHECY_KEY: CardKey = 'great-leader';
const GROWTH_PROPHECY_KEY: CardKey = 'growth';
const KIND_EMPEROR_PROPHECY_KEY: CardKey = 'kind-emperor';
const PANIC_PROPHECY_KEY: CardKey = 'panic';
const PROGRESS_PROPHECY_KEY: CardKey = 'progress';
const RAPID_EXPANSION_PROPHECY_KEY: CardKey = 'rapid-expansion';
const SICKNESS_PROPHECY_KEY: CardKey = 'sickness';
const RIVERBOAT_CARD_KEY: CardKey = 'riverboat';
const RIVERBOAT_RUNTIME_SET_ASIDE_PREFIX = 'riverboat-set-aside:';

// Returns true when at least one selected kingdom pile contains an Omen card.
const hasOmenInKingdom = (config: ComputedMatchConfiguration): boolean => {
  return config.kingdomSupply.some(supply =>
    supply.cards.some(card => {
      const metadata = card.metadata as BaseCardMetadata | undefined;
      if (metadata?.base?.isSetupProxyKingdomPile === true) {
        return false;
      }
      return card.type.includes('OMEN');
    }),
  );
};

// Resolves expansion data selected in the current match configuration.
const getConfiguredExpansionData = (args: ExpansionConfiguratorContext): (typeof args.expansionData)[] => {
  return args.config.expansions.reduce(
    (expansions, configuredExpansion) => {
      const expansionData = args.expansionCatalog[configuredExpansion.name];
      if (!expansionData) {
        args.loggerService.warn(`[rising-sun configurator] expansion ${configuredExpansion.name} not found`);
        return expansions;
      }
      expansions.push(expansionData);
      return expansions;
    },
    [] as (typeof args.expansionData)[],
  );
};

// Returns true when the configured prophecy matches the provided key.
const isConfiguredProphecyKey = (config: ComputedMatchConfiguration, prophecyKey: CardKey): boolean => {
  return config.prophecies?.[0]?.cardKey === prophecyKey;
};

// Returns true when a configured kingdom pile was created by Approaching Army setup.
const isApproachingArmySyntheticPile = (supply: Supply): boolean => {
  if (supply.cards.length < 1) {
    return false;
  }
  return supply.cards.every(card => card.tags?.includes(APPROACHING_ARMY_SETUP_TAG));
};

// Adds/removes the extra Attack pile required by Approaching Army setup.
const configureApproachingArmySetupPile = (args: ExpansionConfiguratorContext): void => {
  const shouldHaveExtraAttackPile = isConfiguredProphecyKey(args.config, APPROACHING_ARMY_PROPHECY_KEY);
  const existingSyntheticPiles = args.config.kingdomSupply.filter(supply => isApproachingArmySyntheticPile(supply));

  if (!shouldHaveExtraAttackPile) {
    if (existingSyntheticPiles.length > 0) {
      args.loggerService.info(
        `[rising-sun configurator] removing ${existingSyntheticPiles.length} Approaching Army attack setup pile(s)`,
      );
      args.config.kingdomSupply = args.config.kingdomSupply.filter(supply => !isApproachingArmySyntheticPile(supply));
    }
    return;
  }

  if (existingSyntheticPiles.length > 1) {
    args.loggerService.warn(
      `[rising-sun configurator] found ${existingSyntheticPiles.length} Approaching Army setup piles; trimming to one`,
    );
    let keptFirst = false;
    args.config.kingdomSupply = args.config.kingdomSupply.filter(supply => {
      if (!isApproachingArmySyntheticPile(supply)) {
        return true;
      }
      if (!keptFirst) {
        keptFirst = true;
        return true;
      }
      return false;
    });
    return;
  }

  if (existingSyntheticPiles.length === 1) {
    args.loggerService.debug('[rising-sun configurator] Approaching Army setup pile already configured');
    return;
  }

  const selectedExpansions = getConfiguredExpansionData(args);

  const existingPileKeys = Array.from(
    new Set(
      args.config.kingdomSupply
        .filter(supply => !isApproachingArmySyntheticPile(supply))
        .flatMap(supply => supply.cards.map(card => getCardPileKey(card))),
    ),
  );
  const bannedPileKeys = args.config.bannedKingdoms.map(card => getCardPileKey(card));

  const availableAttackGroups = getAvailableKingdomRandomizerGroups({
    expansions: selectedExpansions,
    excludedPileKeys: existingPileKeys,
    bannedPileKeys,
    // Approaching Army requires the randomizer pile to be an Attack pile.
    cardFilter: card => (card.randomizerData?.type ?? card.type).includes('ATTACK'),
  });

  if (availableAttackGroups.length < 1) {
    args.loggerService.warn('[rising-sun configurator] no available Attack pile for Approaching Army setup');
    return;
  }

  const selectedGroup = availableAttackGroups[args.rngService.nextIndex(availableAttackGroups.length)];
  const selectedCard = structuredClone(selectedGroup.cards[0]);
  if (!selectedCard) {
    args.loggerService.warn('[rising-sun configurator] selected Approaching Army attack group has no cards');
    return;
  }

  selectedCard.tags = Array.from(new Set([...(selectedCard.tags ?? []), APPROACHING_ARMY_SETUP_TAG]));

  args.config.kingdomSupply.push({
    name: selectedCard.kingdom,
    cards: new Array(getDefaultKingdomSupplySize(selectedCard, args.config)).fill(selectedCard),
  });

  args.loggerService.info(`[rising-sun configurator] Approaching Army added Attack pile ${selectedGroup.pileKey}`);
};

type RiverboatSelectionMetadata = {
  setAsideCardKey?: CardKey;
  setAsideCardExpansion?: string;
  setAsidePileKey?: string;
  proxyPileKey?: string;
  runtimeSetAsidePileKey?: string;
};

type RiverboatCardMetadata = BaseCardMetadata & {
  risingSun?: {
    riverboat?: RiverboatSelectionMetadata & {
      setupProxy?: true;
      runtimeSetAsideCard?: true;
    };
  };
};

// Reads and creates Riverboat metadata on kingdom card entries.
const getRiverboatMetadata = (card: CardNoId): RiverboatSelectionMetadata => {
  const metadata = (card.metadata as RiverboatCardMetadata | undefined) ?? {};
  metadata.risingSun ??= {};
  metadata.risingSun.riverboat ??= {};
  card.metadata = metadata;
  return metadata.risingSun.riverboat;
};

// Synchronizes Riverboat setup metadata across all configured Riverboat cards.
const copyRiverboatSelectionMetadataToConfiguredRiverboats = (
  args: ExpansionConfiguratorContext,
  metadata: RiverboatSelectionMetadata,
): void => {
  for (const supply of args.config.kingdomSupply) {
    for (const card of supply.cards) {
      if (card.cardKey !== RIVERBOAT_CARD_KEY) {
        continue;
      }
      const cardMetadata = getRiverboatMetadata(card);
      cardMetadata.setAsideCardKey = metadata.setAsideCardKey;
      cardMetadata.setAsideCardExpansion = metadata.setAsideCardExpansion;
      cardMetadata.setAsidePileKey = metadata.setAsidePileKey;
      cardMetadata.proxyPileKey = metadata.proxyPileKey;
      cardMetadata.runtimeSetAsidePileKey = metadata.runtimeSetAsidePileKey;
    }
  }
};

// Clears Riverboat setup metadata from configured Riverboat cards.
const clearRiverboatSelectionMetadata = (args: ExpansionConfiguratorContext): void => {
  for (const supply of args.config.kingdomSupply) {
    for (const card of supply.cards) {
      if (card.cardKey !== RIVERBOAT_CARD_KEY) {
        continue;
      }
      const cardMetadata = getRiverboatMetadata(card);
      cardMetadata.setAsideCardKey = undefined;
      cardMetadata.setAsideCardExpansion = undefined;
      cardMetadata.setAsidePileKey = undefined;
      cardMetadata.proxyPileKey = undefined;
      cardMetadata.runtimeSetAsidePileKey = undefined;
    }
  }
};

// Returns true when a card is a legal Riverboat setup candidate.
const isRiverboatCandidate = (card: CardNoId): boolean => {
  const resolvedType = card.randomizerData?.type ?? card.type;
  const resolvedCost = card.randomizerData?.cost ?? card.cost;
  const treasureCost = resolvedCost.treasure ?? 0;
  return (
    resolvedType.includes('ACTION') &&
    !resolvedType.includes('DURATION') &&
    (resolvedCost.potion ?? 0) === 0 &&
    (resolvedCost.debt ?? 0) === 0 &&
    treasureCost === 5
  );
};

// Returns true when a supply pile is a synthetic Riverboat setup proxy.
const isRiverboatSetupProxySupply = (supply: Supply, expectedPileKey?: string): boolean => {
  if (supply.cards.length < 1) {
    return false;
  }
  return supply.cards.every(card => {
    const metadata = card.metadata as RiverboatCardMetadata | undefined;
    if (metadata?.base?.isSetupProxyKingdomPile !== true) {
      return false;
    }
    const riverboat = metadata?.risingSun?.riverboat;
    if (!riverboat || riverboat.setupProxy !== true) {
      return false;
    }
    if (!expectedPileKey) {
      return true;
    }
    return riverboat.proxyPileKey === expectedPileKey;
  });
};

// Returns true when a non-supply pile is the runtime set-aside source for Riverboat.
const isRiverboatRuntimeSetAsideSupply = (supply: Supply, expectedPileKey?: string): boolean => {
  if (supply.cards.length < 1) {
    return false;
  }
  return supply.cards.every(card => {
    const metadata = card.metadata as RiverboatCardMetadata | undefined;
    const riverboat = metadata?.risingSun?.riverboat;
    if (!riverboat || riverboat.runtimeSetAsideCard !== true) {
      return false;
    }
    if (!expectedPileKey) {
      return true;
    }
    return riverboat.runtimeSetAsidePileKey === expectedPileKey;
  });
};

// Removes stale synthetic setup/runtime piles created for Riverboat setup.
const cleanupRiverboatSyntheticPiles = (
  args: ExpansionConfiguratorContext,
  keep?: { proxyPileKey?: string; runtimeSetAsidePileKey?: string },
): void => {
  const config = args.config;
  const nextKingdomSupply = config.kingdomSupply.filter(
    supply =>
      !isRiverboatSetupProxySupply(supply) ||
      (keep?.proxyPileKey !== undefined && isRiverboatSetupProxySupply(supply, keep.proxyPileKey)),
  );
  const removedSetupProxyCount = config.kingdomSupply.length - nextKingdomSupply.length;
  if (removedSetupProxyCount > 0) {
    args.loggerService.info(
      `[rising-sun configurator] removed ${removedSetupProxyCount} stale Riverboat setup proxy pile(s)`,
    );
  }
  config.kingdomSupply = nextKingdomSupply;

  const existingNonSupply = config.nonSupply;
  if (!existingNonSupply) {
    return;
  }

  const nextNonSupply = existingNonSupply.filter(
    supply =>
      !isRiverboatRuntimeSetAsideSupply(supply) ||
      (keep?.runtimeSetAsidePileKey !== undefined &&
        isRiverboatRuntimeSetAsideSupply(supply, keep.runtimeSetAsidePileKey)),
  );
  const removedRuntimeSetAsideCount = existingNonSupply.length - nextNonSupply.length;
  if (removedRuntimeSetAsideCount > 0) {
    args.loggerService.info(
      `[rising-sun configurator] removed ${removedRuntimeSetAsideCount} stale Riverboat runtime set-aside pile(s)`,
    );
  }
  config.nonSupply = nextNonSupply;
};

// Resolves the selected Riverboat set-aside card from saved metadata.
const resolveRiverboatSelectedCard = (args: ExpansionConfiguratorContext, card: CardNoId): CardNoId | null => {
  const metadata = getRiverboatMetadata(card);
  const setAsideCardExpansion = metadata.setAsideCardExpansion;
  const setAsideCardKey = metadata.setAsideCardKey;

  if (!setAsideCardExpansion || !setAsideCardKey) {
    return null;
  }

  const selectedCard = args.expansionCatalog[setAsideCardExpansion]?.cardData.kingdomSupply[setAsideCardKey];
  if (!selectedCard) {
    args.loggerService.warn(
      `[rising-sun configurator] unable to resolve Riverboat set-aside card ${setAsideCardExpansion}:${setAsideCardKey}`,
    );
    return null;
  }
  return selectedCard;
};

// Adds/updates Riverboat setup metadata, setup proxy pile, and runtime set-aside card source.
const configureRiverboatSetAsideCard = (args: ExpansionConfiguratorContext): void => {
  const config = args.config;
  const riverboatCards = config.kingdomSupply
    .flatMap(supply => supply.cards)
    .filter(card => card.cardKey === RIVERBOAT_CARD_KEY);

  if (riverboatCards.length < 1) {
    cleanupRiverboatSyntheticPiles(args);
    return;
  }

  const riverboatCard = riverboatCards[0];
  if (!riverboatCard) {
    cleanupRiverboatSyntheticPiles(args);
    return;
  }

  const riverboatMetadata = getRiverboatMetadata(riverboatCard);
  const usedPileKeys = new Set(
    config.kingdomSupply
      .filter(supply => !isRiverboatSetupProxySupply(supply))
      .flatMap(supply => supply.cards.map(card => getCardPileKey(card))),
  );
  const bannedPileKeys = config.bannedKingdoms.map(card => getCardPileKey(card));

  let selectedCard = resolveRiverboatSelectedCard(args, riverboatCard);
  const currentSelectionValid =
    !!selectedCard &&
    isRiverboatCandidate(selectedCard) &&
    !!riverboatMetadata.setAsidePileKey &&
    !usedPileKeys.has(riverboatMetadata.setAsidePileKey);

  if (!currentSelectionValid) {
    const selectedExpansions = getConfiguredExpansionData(args);
    const availableGroups = getAvailableKingdomRandomizerGroups({
      expansions: selectedExpansions,
      excludedPileKeys: Array.from(usedPileKeys),
      bannedPileKeys,
      cardFilter: candidateCard => isRiverboatCandidate(candidateCard),
    });

    if (availableGroups.length < 1) {
      args.loggerService.warn('[rising-sun configurator] no legal Riverboat set-aside candidates available');
      clearRiverboatSelectionMetadata(args);
      cleanupRiverboatSyntheticPiles(args);
      return;
    }

    const chosenGroup = availableGroups[args.rngService.nextIndex(availableGroups.length)];
    const chosenCards = chosenGroup.cards.filter(candidateCard => isRiverboatCandidate(candidateCard));
    const chosenCard = chosenCards[args.rngService.nextIndex(chosenCards.length)];

    if (!chosenCard) {
      args.loggerService.warn('[rising-sun configurator] selected Riverboat candidate group has no legal card');
      clearRiverboatSelectionMetadata(args);
      cleanupRiverboatSyntheticPiles(args);
      return;
    }

    const selectedRiverboatCard = structuredClone(chosenCard);
    riverboatMetadata.setAsideCardKey = selectedRiverboatCard.cardKey;
    riverboatMetadata.setAsideCardExpansion = selectedRiverboatCard.expansionName;
    riverboatMetadata.setAsidePileKey = chosenGroup.pileKey;
    riverboatMetadata.proxyPileKey = chosenGroup.pileKey;
    riverboatMetadata.runtimeSetAsidePileKey = `${RIVERBOAT_RUNTIME_SET_ASIDE_PREFIX}${chosenGroup.pileKey}:${selectedRiverboatCard.cardKey}`;
    args.loggerService.info(
      `[rising-sun configurator] Riverboat selected set-aside card ${selectedRiverboatCard.cardKey} (${chosenGroup.pileKey})`,
    );
    selectedCard = selectedRiverboatCard;
  }

  if (
    !selectedCard ||
    !riverboatMetadata.proxyPileKey ||
    !riverboatMetadata.runtimeSetAsidePileKey ||
    !riverboatMetadata.setAsideCardKey ||
    !riverboatMetadata.setAsideCardExpansion ||
    !riverboatMetadata.setAsidePileKey
  ) {
    args.loggerService.warn('[rising-sun configurator] Riverboat metadata is incomplete after selection');
    clearRiverboatSelectionMetadata(args);
    cleanupRiverboatSyntheticPiles(args);
    return;
  }

  copyRiverboatSelectionMetadataToConfiguredRiverboats(args, riverboatMetadata);
  cleanupRiverboatSyntheticPiles(args, {
    proxyPileKey: riverboatMetadata.proxyPileKey,
    runtimeSetAsidePileKey: riverboatMetadata.runtimeSetAsidePileKey,
  });

  const hasSetupProxy = config.kingdomSupply.some(supply =>
    isRiverboatSetupProxySupply(supply, riverboatMetadata.proxyPileKey),
  );
  if (!hasSetupProxy) {
    const proxyCard = structuredClone(selectedCard);
    const proxyMetadata = (proxyCard.metadata as RiverboatCardMetadata | undefined) ?? {};
    proxyMetadata.base ??= {};
    proxyMetadata.base.isSetupProxyKingdomPile = true;
    proxyMetadata.risingSun ??= {};
    proxyMetadata.risingSun.riverboat ??= {};
    proxyMetadata.risingSun.riverboat.setupProxy = true;
    proxyMetadata.risingSun.riverboat.proxyPileKey = riverboatMetadata.proxyPileKey;
    proxyMetadata.risingSun.riverboat.setAsideCardKey = riverboatMetadata.setAsideCardKey;
    proxyMetadata.risingSun.riverboat.setAsideCardExpansion = riverboatMetadata.setAsideCardExpansion;
    proxyMetadata.risingSun.riverboat.setAsidePileKey = riverboatMetadata.setAsidePileKey;
    proxyMetadata.risingSun.riverboat.runtimeSetAsidePileKey = riverboatMetadata.runtimeSetAsidePileKey;
    proxyCard.metadata = proxyMetadata;
    proxyCard.kingdomSelectable = false;

    config.kingdomSupply.push({
      // Keep normal pile naming so setup-dependent configurators can detect this candidate naturally.
      name: proxyCard.kingdom,
      cards: new Array(getDefaultKingdomSupplySize(proxyCard, config)).fill(proxyCard),
    });
    args.loggerService.info(`[rising-sun configurator] added Riverboat setup proxy pile for ${proxyCard.cardKey}`);
  }

  const hasRuntimeSetAsidePile = (config.nonSupply ?? []).some(supply =>
    isRiverboatRuntimeSetAsideSupply(supply, riverboatMetadata.runtimeSetAsidePileKey),
  );
  if (hasRuntimeSetAsidePile) {
    return;
  }

  const runtimeSetAsideCard = structuredClone(selectedCard);
  runtimeSetAsideCard.kingdom = riverboatMetadata.runtimeSetAsidePileKey;
  runtimeSetAsideCard.partOfSupply = false;
  runtimeSetAsideCard.kingdomSelectable = false;
  const runtimeMetadata = (runtimeSetAsideCard.metadata as RiverboatCardMetadata | undefined) ?? {};
  runtimeMetadata.base ??= {};
  runtimeMetadata.risingSun ??= {};
  runtimeMetadata.risingSun.riverboat ??= {};
  runtimeMetadata.risingSun.riverboat.runtimeSetAsideCard = true;
  runtimeMetadata.risingSun.riverboat.runtimeSetAsidePileKey = riverboatMetadata.runtimeSetAsidePileKey;
  runtimeMetadata.risingSun.riverboat.setAsideCardKey = riverboatMetadata.setAsideCardKey;
  runtimeMetadata.risingSun.riverboat.setAsideCardExpansion = riverboatMetadata.setAsideCardExpansion;
  runtimeMetadata.risingSun.riverboat.setAsidePileKey = riverboatMetadata.setAsidePileKey;
  runtimeSetAsideCard.metadata = runtimeMetadata;

  config.nonSupply ??= [];
  config.nonSupply.push({
    name: riverboatMetadata.runtimeSetAsidePileKey,
    cards: [runtimeSetAsideCard],
  });
  args.loggerService.info(
    `[rising-sun configurator] added Riverboat runtime set-aside source for ${runtimeSetAsideCard.cardKey}`,
  );
};

// Returns the selected runtime prophecy, if present.
const getRuntimeProphecy = (match: Match): Prophecy | undefined => {
  return match.prophecies?.[0];
};

// Returns true when the selected prophecy is active (all Sun counters removed).
const isProphecyActive = (match: Match, prophecyKey: CardKey): boolean => {
  const activeProphecy = getRuntimeProphecy(match);
  if (!activeProphecy || activeProphecy.cardKey !== prophecyKey) {
    return false;
  }

  return !Object.values(match.tokens ?? {}).some(
    token =>
      token.tokenId === risingSunTokenIds.sun &&
      token.location.type === 'cardLike' &&
      token.location.cardLikeId === activeProphecy.id,
  );
};

// Applies Enlightenment's global type mutation so Treasures are also Actions for all purposes.
const applyEnlightenmentTreasureActionTypes = (args: Pick<RisingSunGameEventContext, 'cardLibrary'>): number => {
  let addedCount = 0;
  // Iterate in id order to keep type mutation deterministic.
  const cards = args.cardLibrary.getAllCardsAsArray().sort((a, b) => a.id - b.id);
  for (const card of cards) {
    if (!card.type.includes('TREASURE')) {
      continue;
    }
    if (card.type.includes('ACTION')) {
      continue;
    }
    card.type.push('ACTION');
    addedCount++;
  }
  return addedCount;
};

// Applies Flourishing Trade's permanent global cost reduction to all cards in the match library.
const registerFlourishingTradeCostReductionRules = (
  args: Pick<RisingSunGameEventContext, 'cardLibrary' | 'cardPriceController'>,
): number => {
  let registeredCount = 0;
  // Iterate in id order to keep rule registration deterministic.
  const cards = args.cardLibrary.getAllCardsAsArray().sort((a, b) => a.id - b.id);
  for (const card of cards) {
    args.cardPriceController.registerRule(card, () => {
      return { restricted: false, cost: { treasure: -1 } };
    });
    registeredCount++;
  }
  return registeredCount;
};

type RisingSunGameEventContext = Parameters<NonNullable<Parameters<GameEventRegistrar>[1]>>[0];

// Registers Approaching Army: after you play an Attack, +$1.
const registerApproachingArmyReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  for (const player of args.match.players) {
    args.reactionManager.registerReactionTemplate(prophecy, 'afterCardPlayed', {
      playerId: player.id,
      compulsory: true,
      condition: async ({ trigger, cardLibrary, match }) => {
        if (!isProphecyActive(match, APPROACHING_ARMY_PROPHECY_KEY)) {
          return false;
        }
        const playedCard = cardLibrary.getCard(trigger.args.cardId);
        return playedCard.type.includes('ATTACK');
      },
      triggeredEffectFn: async ({ trigger, actionService, loggerService }) => {
        loggerService.debug(
          `[rising-sun prophecy:approaching-army] player ${trigger.args.playerId} played an Attack; gaining +$1`,
        );
        await actionService.run('gainTreasure', { count: 1 });
      },
    });
  }
};

// Registers Biding Time: at cleanup start set aside hand; at next turn start put those cards into hand.
const registerBidingTimeReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(prophecy, 'startTurnPhase', {
      playerId,
      compulsory: true,
      condition: async ({ trigger, match }) => {
        if (!isProphecyActive(match, BIDING_TIME_PROPHECY_KEY)) {
          return false;
        }

        if (getTurnPhase(trigger.args.phaseIndex) !== 'cleanup') {
          return false;
        }

        return getCurrentPlayer(match).id === playerId;
      },
      triggeredEffectFn: async ({ cardSourceController, actionService, loggerService }) => {
        // Capture the current hand snapshot so card movement during resolution does not alter selection.
        const hand = [...cardSourceController.getSource('playerHand', playerId)];
        if (hand.length < 1) {
          loggerService.debug(`[rising-sun prophecy:biding-time] player ${playerId} has no hand cards to set aside`);
          return;
        }

        loggerService.info(
          `[rising-sun prophecy:biding-time] setting aside ${hand.length} hand card(s) for player ${playerId}`,
        );

        for (const cardId of hand) {
          await actionService.run('moveCard', {
            cardId,
            toPlayerId: playerId,
            to: { location: 'set-aside' },
            facing: 'back',
            setAsideSource: {
              ownerPlayerId: playerId,
              sourceKind: 'prophecy',
              sourceCardLikeId: prophecy.id,
              sourceCardKey: prophecy.cardKey,
              sourceLabel: prophecy.cardName,
            },
          });
        }
      },
    });

    args.reactionManager.registerReactionTemplate(prophecy, 'startTurn', {
      playerId,
      compulsory: true,
      condition: async ({ trigger, match }) => {
        return trigger.args.playerId === playerId && isProphecyActive(match, BIDING_TIME_PROPHECY_KEY);
      },
      triggeredEffectFn: async ({ cardSourceController, actionService, loggerService, match }) => {
        const setAside = cardSourceController.getSource('set-aside', playerId);
        const bidingTimeCards = setAside.filter(cardId => {
          const source = match.setAsideSourceById?.[cardId];
          return (
            source?.ownerPlayerId === playerId &&
            source.sourceKind === 'prophecy' &&
            source.sourceCardLikeId === prophecy.id
          );
        });

        if (bidingTimeCards.length < 1) {
          loggerService.debug(`[rising-sun prophecy:biding-time] player ${playerId} has no set-aside cards to return`);
          return;
        }

        loggerService.info(
          `[rising-sun prophecy:biding-time] returning ${bidingTimeCards.length} set-aside card(s) to hand for player ${playerId}`,
        );

        for (const cardId of bidingTimeCards) {
          const currentSetAside = cardSourceController.getSource('set-aside', playerId);
          if (!currentSetAside.includes(cardId)) {
            loggerService.debug(
              `[rising-sun prophecy:biding-time] set-aside card ${cardId} moved before return-to-hand step`,
            );
            continue;
          }

          await actionService.run('moveCard', {
            cardId,
            toPlayerId: playerId,
            to: { location: 'playerHand' },
          });
        }
      },
    });
  }
};

// Registers Great Leader: after each Action you play, +1 Action.
const registerGreatLeaderReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  for (const player of args.match.players) {
    args.reactionManager.registerReactionTemplate(prophecy, 'afterCardPlayed', {
      playerId: player.id,
      compulsory: true,
      condition: async ({ trigger, cardLibrary, match }) => {
        if (!isProphecyActive(match, GREAT_LEADER_PROPHECY_KEY)) {
          return false;
        }
        const playedCard = cardLibrary.getCard(trigger.args.cardId);
        return playedCard.type.includes('ACTION');
      },
      triggeredEffectFn: async ({ trigger, actionService, loggerService }) => {
        loggerService.debug(
          `[rising-sun prophecy:great-leader] player ${trigger.args.playerId} played an Action; gaining +1 Action`,
        );
        await actionService.run('gainAction', { count: 1 });
      },
    });
  }
};

// Resolves Kind Emperor's mandatory gain by choosing a top-of-supply Action and gaining it to hand.
const resolveKindEmperorGainToHand = async (args: {
  playerId: PlayerId;
  match: Match;
  findCardService: RisingSunGameEventContext['findCardService'];
  actionService: RisingSunGameEventContext['actionService'];
  cardLibrary: RisingSunGameEventContext['cardLibrary'];
  loggerService: RisingSunGameEventContext['loggerService'];
}): Promise<void> => {
  const gainableActionCards: Card[] = [];
  for (const pileKey of getConfiguredSupplyPileKeys(args.match)) {
    const topCard = args.findCardService.findTopSupplyCardForPileKey({ pileKey });
    if (!topCard) {
      continue;
    }
    if (!topCard.type.includes('ACTION')) {
      continue;
    }
    gainableActionCards.push(topCard);
  }

  if (gainableActionCards.length < 1) {
    args.loggerService.debug(
      `[rising-sun prophecy:kind-emperor] no top-of-pile Action cards available for player ${args.playerId}`,
    );
    return;
  }

  args.loggerService.debug(
    `[rising-sun prophecy:kind-emperor] player ${args.playerId} has ${gainableActionCards.length} top-of-pile Action candidate(s)`,
  );
  const selectedGainId = await args.actionService.run('selectSingleCard', {
    playerId: args.playerId,
    prompt: 'Gain an Action card',
    restrict: gainableActionCards.map(card => card.id),
    count: 1,
  });

  if (!selectedGainId) {
    args.loggerService.warn(
      `[rising-sun prophecy:kind-emperor] no Action selected for mandatory gain by player ${args.playerId}; skipping gain`,
    );
    return;
  }

  const selectedCard = args.cardLibrary.getCard(selectedGainId);
  args.loggerService.info(
    `[rising-sun prophecy:kind-emperor] player ${args.playerId} selected ${selectedCard.cardKey}; gaining to hand`,
  );
  await args.actionService.run('gainCard', {
    playerId: args.playerId,
    cardId: selectedGainId,
    to: { location: 'playerHand' },
  });
};

// Registers Kind Emperor: at each start of turn, and on final Sun removal, gain an Action card to hand.
const registerKindEmperorReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  args.reactionManager.registerGlobalSystemTemplate(
    prophecy,
    'tokenChanged',
    {
      compulsory: true,
      autoResolve: true,
      allowMultipleInstances: false,
      condition: ({ trigger, match }) => {
        if (trigger.args.tokenId !== risingSunTokenIds.sun) {
          return false;
        }
        if (trigger.args.locationBefore.type !== 'cardLike') {
          return false;
        }
        if (trigger.args.locationBefore.cardLikeId !== prophecy.id) {
          return false;
        }
        if (prophecy.cardKey !== KIND_EMPEROR_PROPHECY_KEY) {
          return false;
        }
        // Only trigger when this token change activated the prophecy.
        return isProphecyActive(match, KIND_EMPEROR_PROPHECY_KEY);
      },
      triggeredEffectFn: async ({ trigger, match, findCardService, actionService, cardLibrary, loggerService }) => {
        let beneficiaryPlayerId = getCurrentPlayer(match).id;
        if (trigger.args.source !== undefined) {
          const sourceCardInPlay = findCardService.getCardsInPlay().find(card => card.id === trigger.args.source);
          if (sourceCardInPlay?.owner !== undefined && sourceCardInPlay.owner !== null) {
            beneficiaryPlayerId = sourceCardInPlay.owner;
          }
        }

        loggerService.info(
          `[rising-sun prophecy:kind-emperor] final Sun removed; resolving immediate gain for player ${beneficiaryPlayerId}`,
        );
        await resolveKindEmperorGainToHand({
          playerId: beneficiaryPlayerId,
          match,
          findCardService,
          actionService,
          cardLibrary,
          loggerService,
        });
      },
    },
    {
      idSuffix: 'kind-emperor:token-activation',
    },
  );

  for (const player of args.match.players) {
    const playerId = player.id;
    args.reactionManager.registerReactionTemplate(prophecy, 'startTurn', {
      playerId,
      compulsory: true,
      condition: async ({ trigger, match }) => {
        return trigger.args.playerId === playerId && isProphecyActive(match, KIND_EMPEROR_PROPHECY_KEY);
      },
      triggeredEffectFn: async ({ match, findCardService, actionService, cardLibrary, loggerService }) => {
        loggerService.info(
          `[rising-sun prophecy:kind-emperor] start of turn for player ${playerId}; resolving Action gain`,
        );
        await resolveKindEmperorGainToHand({
          playerId,
          match,
          findCardService,
          actionService,
          cardLibrary,
          loggerService,
        });
      },
    });
  }
};

// Registers Enlightenment: Treasures are Actions, and in Action phase Treasure play becomes +1 Card and +1 Action.
const registerEnlightenmentReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  args.reactionManager.registerGlobalSystemTemplate(
    prophecy,
    'tokenChanged',
    {
      compulsory: true,
      autoResolve: true,
      allowMultipleInstances: false,
      condition: ({ trigger, match }) => {
        if (trigger.args.tokenId !== risingSunTokenIds.sun) {
          return false;
        }
        if (trigger.args.locationBefore.type !== 'cardLike') {
          return false;
        }
        if (trigger.args.locationBefore.cardLikeId !== prophecy.id) {
          return false;
        }
        if (prophecy.cardKey !== ENLIGHTENMENT_PROPHECY_KEY) {
          return false;
        }
        // Only activate once the prophecy actually becomes active.
        return isProphecyActive(match, ENLIGHTENMENT_PROPHECY_KEY);
      },
      triggeredEffectFn: async ({ loggerService, cardLibrary }) => {
        const addedCount = applyEnlightenmentTreasureActionTypes({ cardLibrary });
        loggerService.info(
          `[rising-sun prophecy:enlightenment] prophecy activated; added ACTION type to ${addedCount} Treasure card(s)`,
        );
      },
    },
    {
      idSuffix: 'enlightenment:token-activation',
    },
  );

  if (isProphecyActive(args.match, ENLIGHTENMENT_PROPHECY_KEY)) {
    const addedCount = applyEnlightenmentTreasureActionTypes({ cardLibrary: args.cardLibrary });
    args.loggerService.info(
      `[rising-sun prophecy:enlightenment] prophecy already active at registration; added ACTION type to ${addedCount} Treasure card(s)`,
    );
  }

  for (const player of args.match.players) {
    args.reactionManager.registerReactionTemplate(prophecy, 'beforePlayedCardEffect', {
      playerId: player.id,
      compulsory: true,
      condition: async ({ trigger, cardLibrary, match }) => {
        if (trigger.args.playerId !== player.id) {
          return false;
        }
        if (trigger.args.skipPlayEffect) {
          return false;
        }
        if (!isProphecyActive(match, ENLIGHTENMENT_PROPHECY_KEY)) {
          return false;
        }
        if (getTurnPhase(match.turnPhaseIndex) !== 'action') {
          return false;
        }

        const playedCard = cardLibrary.getCard(trigger.args.cardId);
        if (!playedCard.type.includes('TREASURE')) {
          return false;
        }

        if (trigger.args.wayId === null) {
          return true;
        }

        const selectedWay = findWayInMatch(match, trigger.args.wayId);
        return selectedWay?.cardKey === 'way-of-the-chameleon';
      },
      triggeredEffectFn: async ({ trigger, actionService, loggerService }) => {
        if (trigger.args.wayId !== null) {
          const selectedChoice = await args.promptService.requestAction({
            playerId: trigger.args.playerId,
            prompt: 'Choose how this Treasure resolves',
            actionButtons: [
              { action: 1, label: 'WAY OF THE CHAMELEON' },
              { action: 2, label: 'ENLIGHTENMENT' },
            ],
          });

          if (selectedChoice !== 2) {
            loggerService.info(
              `[rising-sun prophecy:enlightenment] player ${trigger.args.playerId} chose Way of the Chameleon resolution`,
            );
            return;
          }
        }

        trigger.args.skipPlayEffect = true;
        loggerService.info(
          `[rising-sun prophecy:enlightenment] replacing Treasure instructions for player ${trigger.args.playerId} with +1 Card and +1 Action`,
        );
        await actionService.run('drawCard', {
          playerId: trigger.args.playerId,
          count: 1,
        });
        await actionService.run('gainAction', {
          count: 1,
        });
      },
    });
  }
};

// Registers Flourishing Trade: cards cost $1 less globally, and buy-phase entry converts remaining Actions into Buys.
const registerFlourishingTradeReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  // Prevent duplicate persistent registration when prophecy is already active and also later receives tokenChanged events.
  let costRulesRegistered = false;

  // Applies the global reduction once while preserving deterministic card ordering and consistent logging.
  const applyCostReductionOnce = (
    applyArgs: Pick<RisingSunGameEventContext, 'cardLibrary' | 'cardPriceController' | 'loggerService'>,
    reason: 'token-activation' | 'already-active',
  ): void => {
    if (costRulesRegistered) {
      applyArgs.loggerService.debug(
        `[rising-sun prophecy:flourishing-trade] cost reduction already registered; skipping duplicate apply (${reason})`,
      );
      return;
    }

    const registeredCount = registerFlourishingTradeCostReductionRules({
      cardLibrary: applyArgs.cardLibrary,
      cardPriceController: applyArgs.cardPriceController,
    });
    costRulesRegistered = true;
    applyArgs.loggerService.info(
      `[rising-sun prophecy:flourishing-trade] registered permanent -$1 cost reduction for ${registeredCount} card(s) via ${reason}`,
    );
  };

  args.reactionManager.registerGlobalSystemTemplate(
    prophecy,
    'tokenChanged',
    {
      compulsory: true,
      autoResolve: true,
      allowMultipleInstances: false,
      condition: ({ trigger, match }) => {
        if (trigger.args.tokenId !== risingSunTokenIds.sun) {
          return false;
        }
        if (trigger.args.locationBefore.type !== 'cardLike') {
          return false;
        }
        if (trigger.args.locationBefore.cardLikeId !== prophecy.id) {
          return false;
        }
        if (prophecy.cardKey !== FLOURISHING_TRADE_PROPHECY_KEY) {
          return false;
        }
        // Only activate once the prophecy actually becomes active.
        return isProphecyActive(match, FLOURISHING_TRADE_PROPHECY_KEY);
      },
      triggeredEffectFn: async ({ loggerService, cardLibrary, cardPriceController }) => {
        applyCostReductionOnce(
          {
            loggerService,
            cardLibrary,
            cardPriceController,
          },
          'token-activation',
        );
      },
    },
    {
      idSuffix: 'flourishing-trade:token-activation',
    },
  );

  if (isProphecyActive(args.match, FLOURISHING_TRADE_PROPHECY_KEY)) {
    applyCostReductionOnce(
      {
        loggerService: args.loggerService,
        cardLibrary: args.cardLibrary,
        cardPriceController: args.cardPriceController,
      },
      'already-active',
    );
  }

  for (const player of args.match.players) {
    const playerId = player.id;
    args.reactionManager.registerReactionTemplate(prophecy, 'startTurnPhase', {
      playerId,
      compulsory: true,
      condition: async ({ trigger, match }) => {
        if (!isProphecyActive(match, FLOURISHING_TRADE_PROPHECY_KEY)) {
          return false;
        }
        if (getCurrentPlayer(match).id !== playerId) {
          return false;
        }
        return getTurnPhase(trigger.args.phaseIndex) === 'buy';
      },
      triggeredEffectFn: async ({ match, actionService, loggerService }) => {
        const actionsToConvert = Math.max(0, match.playerActions);
        if (actionsToConvert < 1) {
          loggerService.debug(
            `[rising-sun prophecy:flourishing-trade] player ${playerId} entered buy phase with no actions to convert`,
          );
          return;
        }

        loggerService.info(
          `[rising-sun prophecy:flourishing-trade] player ${playerId} entered buy phase; converting ${actionsToConvert} action(s) into buy(s)`,
        );
        await actionService.run('convertActionsToBuys', {
          playerId,
          count: actionsToConvert,
        });
      },
    });
  }
};

// Registers Harsh Winter: on your turn, gains either place 2 debt on gained-card pile or take all debt from that pile.
const registerHarshWinterReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  for (const player of args.match.players) {
    const playerId = player.id;
    args.reactionManager.registerReactionTemplate(prophecy, 'cardGained', {
      playerId,
      compulsory: true,
      condition: async ({ trigger, match, cardLibrary }) => {
        if (trigger.args.playerId !== playerId) {
          return false;
        }
        if (!isProphecyActive(match, HARSH_WINTER_PROPHECY_KEY)) {
          return false;
        }
        if (getCurrentPlayer(match).id !== playerId) {
          return false;
        }

        const gainedCard = cardLibrary.getCard(trigger.args.cardId);
        return getConfiguredCardPileLocation(match, gainedCard) !== undefined;
      },
      triggeredEffectFn: async ({ trigger, match, cardLibrary, actionService, loggerService }) => {
        const gainedCard = cardLibrary.getCard(trigger.args.cardId);
        const pileLocation = getConfiguredCardPileLocation(match, gainedCard);
        if (!pileLocation) {
          loggerService.warn(
            `[rising-sun prophecy:harsh-winter] gained card ${gainedCard.cardKey} had no configured pile at resolve-time`,
          );
          return;
        }

        const pileDebtTokens = Object.values(match.tokens ?? {})
          .filter(
            token =>
              token.tokenId === baseV2TokenIds.debt &&
              token.location.type === 'supplyPile' &&
              token.location.cardKey === pileLocation.pileName,
          )
          .sort((left, right) => left.id.localeCompare(right.id));

        if (pileDebtTokens.length > 0) {
          const debtToTake = pileDebtTokens.reduce((sum, token) => sum + Math.max(1, token.counters ?? 1), 0);
          loggerService.info(
            `[rising-sun prophecy:harsh-winter] player ${trigger.args.playerId} gained from ${pileLocation.pileName}; taking ${debtToTake} debt from pile`,
          );

          for (const token of pileDebtTokens) {
            await actionService.run('removeToken', {
              tokenInstanceId: token.id,
            });
          }

          await actionService.run('gainDebt', {
            playerId: trigger.args.playerId,
            count: debtToTake,
          });
          return;
        }

        loggerService.info(
          `[rising-sun prophecy:harsh-winter] player ${trigger.args.playerId} gained from ${pileLocation.pileName}; placing 2 debt on pile`,
        );
        await actionService.run('placeToken', {
          tokenId: baseV2TokenIds.debt,
          counters: 2,
          location: { type: 'supplyPile', cardKey: pileLocation.pileName },
        });
      },
    });
  }
};

// Registers Good Harvest: first time each differently named Treasure is played each turn, +1 Buy and +$1.
const registerGoodHarvestReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  // Track already-triggered Treasure names per player-turn.
  const playedTreasureKeysByPlayer = new Map<PlayerId, Set<CardKey>>();

  for (const player of args.match.players) {
    const playerId = player.id;
    args.reactionManager.registerReactionTemplate(prophecy, 'startTurn', {
      playerId,
      compulsory: true,
      condition: async ({ trigger }) => trigger.args.playerId === playerId,
      triggeredEffectFn: async ({ loggerService }) => {
        loggerService.debug(`[rising-sun prophecy:good-harvest] resetting played Treasure set for player ${playerId}`);
        playedTreasureKeysByPlayer.set(playerId, new Set<CardKey>());
      },
    });

    args.reactionManager.registerReactionTemplate(prophecy, 'beforePlayedCardEffect', {
      playerId,
      compulsory: true,
      condition: async ({ trigger, cardLibrary, match }) => {
        if (trigger.args.playerId !== playerId || !isProphecyActive(match, GOOD_HARVEST_PROPHECY_KEY)) {
          return false;
        }

        const playedCard = cardLibrary.getCard(trigger.args.cardId);
        if (!playedCard.type.includes('TREASURE')) {
          return false;
        }

        const playedTreasureKeys = playedTreasureKeysByPlayer.get(playerId) ?? new Set<CardKey>();
        return !playedTreasureKeys.has(playedCard.cardKey);
      },
      triggeredEffectFn: async ({ trigger, cardLibrary, actionService, loggerService }) => {
        const playedCard = cardLibrary.getCard(trigger.args.cardId);
        const playedTreasureKeys = playedTreasureKeysByPlayer.get(playerId) ?? new Set<CardKey>();
        playedTreasureKeys.add(playedCard.cardKey);
        playedTreasureKeysByPlayer.set(playerId, playedTreasureKeys);

        loggerService.debug(
          `[rising-sun prophecy:good-harvest] first ${playedCard.cardKey} for player ${playerId}; gaining +1 Buy and +$1`,
        );
        await actionService.run('gainBuy', { count: 1 });
        await actionService.run('gainTreasure', { count: 1 });
      },
    });
  }
};

// Registers Bureaucracy: when you gain a card that doesn't cost $0, gain a Copper.
const registerBureaucracyReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  for (const player of args.match.players) {
    const playerId = player.id;
    args.reactionManager.registerReactionTemplate(prophecy, 'cardGained', {
      playerId,
      compulsory: true,
      condition: async ({ trigger, match, cardLibrary, cardPriceController }) => {
        if (trigger.args.playerId !== playerId || !isProphecyActive(match, BUREAUCRACY_PROPHECY_KEY)) {
          return false;
        }

        const gainedCard = cardLibrary.getCard(trigger.args.cardId);
        const gainedCardCost = cardPriceController.applyRules(gainedCard, { playerId }).cost;
        return compareCardCosts(gainedCardCost, { treasure: 0 }) !== 0;
      },
      triggeredEffectFn: async ({ trigger, supplyGainService, loggerService }) => {
        loggerService.debug(
          `[rising-sun prophecy:bureaucracy] player ${trigger.args.playerId} gained non-zero-cost card; gaining Copper`,
        );
        const gainedCopperId = await supplyGainService.gainTopSupplyCardForPileKey({
          playerId: trigger.args.playerId,
          pileKey: 'copper',
          from: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'rising-sun prophecy:bureaucracy',
        });

        if (!gainedCopperId) {
          loggerService.debug('[rising-sun prophecy:bureaucracy] no Copper remained to gain');
        }
      },
    });
  }
};

// Registers Growth: when you gain a Treasure, gain a cheaper card.
const registerGrowthReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  for (const player of args.match.players) {
    const playerId = player.id;
    args.reactionManager.registerReactionTemplate(prophecy, 'cardGained', {
      playerId,
      compulsory: true,
      condition: async ({ trigger, match, cardLibrary }) => {
        if (trigger.args.playerId !== playerId || !isProphecyActive(match, GROWTH_PROPHECY_KEY)) {
          return false;
        }

        const gainedCard = cardLibrary.getCard(trigger.args.cardId);
        return gainedCard.type.includes('TREASURE');
      },
      triggeredEffectFn: async ({
        trigger,
        cardLibrary,
        findCardService,
        cardPriceController,
        actionService,
        loggerService,
        match,
      }) => {
        const gainedCard = cardLibrary.getCard(trigger.args.cardId);
        const gainedCardCost = cardPriceController.applyRules(gainedCard, { playerId }).cost;

        // Build the current top card candidates for each configured Supply pile.
        const gainableCards = getConfiguredSupplyPileKeys(match)
          .map(pileKey => findCardService.findTopSupplyCardForPileKey({ pileKey }))
          .filter((candidate): candidate is Card => {
            if (!candidate) {
              return false;
            }
            const candidateCost = cardPriceController.applyRules(candidate, { playerId }).cost;
            return compareCardCosts(candidateCost, gainedCardCost) === -1;
          });

        if (gainableCards.length < 1) {
          loggerService.debug(
            `[rising-sun prophecy:growth] no cheaper Supply card available after gaining ${gainedCard.cardKey}`,
          );
          return;
        }

        const selectedGainId = await actionService.run('selectSingleCard', {
          playerId,
          prompt: 'Gain a cheaper card',
          restrict: gainableCards.map(card => card.id),
          count: 1,
        });

        if (!selectedGainId) {
          loggerService.warn('[rising-sun prophecy:growth] no card selected for mandatory cheaper gain');
          return;
        }

        const selectedGainCard = cardLibrary.getCard(selectedGainId);
        loggerService.debug(
          `[rising-sun prophecy:growth] player ${playerId} gained ${selectedGainCard.cardKey} after gaining Treasure`,
        );

        await actionService.run(
          'gainCard',
          {
            playerId,
            cardId: selectedGainCard.id,
            to: { location: 'playerDiscard' },
          },
          {
            source: trigger.args.cardId,
          },
        );
      },
    });
  }
};

// Registers Panic: Treasures grant +2 Buys when played and return to their pile when discarded from play.
const registerPanicReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  for (const player of args.match.players) {
    const playerId = player.id;

    args.reactionManager.registerReactionTemplate(prophecy, 'cardPlayed', {
      playerId,
      compulsory: true,
      condition: async ({ trigger, cardLibrary, match }) => {
        if (trigger.args.playerId !== playerId || !isProphecyActive(match, PANIC_PROPHECY_KEY)) {
          return false;
        }
        const playedCard = cardLibrary.getCard(trigger.args.cardId);
        return playedCard.type.includes('TREASURE');
      },
      triggeredEffectFn: async ({ trigger, actionService, loggerService }) => {
        loggerService.debug(`[rising-sun prophecy:panic] player ${trigger.args.playerId} played Treasure; +2 Buys`);
        await actionService.run('gainBuy', { count: 2 });
      },
    });

    args.reactionManager.registerReactionTemplate(prophecy, 'discardCard', {
      playerId,
      compulsory: true,
      condition: async ({ trigger, cardLibrary, match }) => {
        if (trigger.args.playerId !== playerId || !isProphecyActive(match, PANIC_PROPHECY_KEY)) {
          return false;
        }

        if (!isLocationInPlay(trigger.args.previousLocation.location)) {
          return false;
        }

        const discardedCard = cardLibrary.getCard(trigger.args.cardId);
        return discardedCard.type.includes('TREASURE');
      },
      triggeredEffectFn: async ({ trigger, cardLibrary, actionService, loggerService, match }) => {
        const discardedCard = cardLibrary.getCard(trigger.args.cardId);
        const returned = await returnCardToConfiguredPileTop({
          actionService,
          loggerService,
          match,
          card: discardedCard,
          logTag: 'rising-sun prophecy:panic',
        });

        if (!returned) {
          loggerService.debug(
            `[rising-sun prophecy:panic] no configured pile found for ${discardedCard.cardKey}; card stays discarded`,
          );
        }
      },
    });
  }
};

// Registers Progress: when you gain a card, put it onto your deck.
const registerProgressReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  for (const player of args.match.players) {
    const playerId = player.id;
    args.reactionManager.registerReactionTemplate(prophecy, 'cardGained', {
      playerId,
      compulsory: true,
      condition: async ({ trigger, match, cardSourceController }) => {
        if (trigger.args.playerId !== playerId || !isProphecyActive(match, PROGRESS_PROPHECY_KEY)) {
          return false;
        }

        // Respect stop-moving interactions; only move if the gained card is still at the original gain location.
        return isCardStillAtGainedLocation(cardSourceController, trigger.args.cardId, trigger.args.gainedLocation);
      },
      triggeredEffectFn: async ({ trigger, actionService, loggerService }) => {
        loggerService.debug(
          `[rising-sun prophecy:progress] moving gained card ${trigger.args.cardId} to top of deck for player ${playerId}`,
        );
        await actionService.run('moveCard', {
          cardId: trigger.args.cardId,
          toPlayerId: playerId,
          to: { location: 'playerDeck' },
        });
      },
    });
  }
};

// Registers Rapid Expansion: when you gain an Action or Treasure, set it aside and play it at the start of your next turn.
const registerRapidExpansionReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  for (const player of args.match.players) {
    const playerId = player.id;
    args.reactionManager.registerReactionTemplate(prophecy, 'cardGained', {
      playerId,
      compulsory: true,
      condition: async ({ trigger, match, cardLibrary }) => {
        if (trigger.args.playerId !== playerId || !isProphecyActive(match, RAPID_EXPANSION_PROPHECY_KEY)) {
          return false;
        }

        const gainedCard = cardLibrary.getCard(trigger.args.cardId);
        return gainedCard.type.includes('ACTION') || gainedCard.type.includes('TREASURE');
      },
      triggeredEffectFn: async ({
        trigger,
        actionService,
        loggerService,
        cardSourceController,
        cardLibrary,
        reactionManager,
      }) => {
        const gainedCardId = trigger.args.cardId;
        const gainedCard = cardLibrary.getCard(gainedCardId);
        if (!isCardStillAtGainedLocation(cardSourceController, gainedCardId, trigger.args.gainedLocation)) {
          loggerService.debug(
            `[rising-sun prophecy:rapid-expansion] gained card ${gainedCardId} moved before set-aside redirect`,
          );
          return;
        }

        loggerService.info(
          `[rising-sun prophecy:rapid-expansion] setting aside gained ${gainedCard.cardKey} (${gainedCardId}) for player ${playerId}`,
        );
        await actionService.run('moveCard', {
          cardId: gainedCardId,
          toPlayerId: playerId,
          to: { location: 'set-aside' },
          setAsideSource: {
            ownerPlayerId: playerId,
            sourceKind: 'prophecy',
            sourceCardLikeId: prophecy.id,
            sourceCardKey: prophecy.cardKey,
            sourceLabel: prophecy.cardName,
          },
        });

        // Register one start-turn reaction per queued card so the player can order each play.
        reactionManager.registerReactionTemplate(
          prophecy,
          'startTurn',
          {
            playerId,
            once: true,
            compulsory: true,
            allowMultipleInstances: true,
            sourceId: gainedCardId,
            sourceKey: gainedCard.cardKey,
            sourceName: gainedCard.cardName,
            sourceType: 'card',
            condition: async ({
              trigger: startTurnTrigger,
              match,
              cardSourceController: startTurnCardSourceController,
            }) => {
              if (
                startTurnTrigger.args.playerId !== playerId ||
                !isProphecyActive(match, RAPID_EXPANSION_PROPHECY_KEY)
              ) {
                return false;
              }

              // Prevent immediate replay during the same startTurn trigger chain if this card was just gained.
              const currentTurnHistoryIndex = getCurrentTurnHistoryIndex({ match }, { fallbackToZero: false });
              const gainTurnHistoryIndex = match.stats.cardsGained[gainedCardId]?.turnHistoryIndex;
              if (
                currentTurnHistoryIndex !== undefined &&
                gainTurnHistoryIndex !== undefined &&
                gainTurnHistoryIndex === currentTurnHistoryIndex
              ) {
                return false;
              }

              const setAside = startTurnCardSourceController.getSource('set-aside', playerId);
              if (!setAside.includes(gainedCardId)) {
                return false;
              }

              const source = match.setAsideSourceById?.[gainedCardId];
              return (
                source?.ownerPlayerId === playerId &&
                source.sourceKind === 'prophecy' &&
                source.sourceCardLikeId === prophecy.id
              );
            },
            triggeredEffectFn: async ({
              actionService,
              loggerService,
              cardSourceController: startTurnCardSourceController,
            }) => {
              const setAside = startTurnCardSourceController.getSource('set-aside', playerId);
              if (!setAside.includes(gainedCardId)) {
                loggerService.debug(
                  `[rising-sun prophecy:rapid-expansion] queued card ${gainedCardId} moved before start-turn play`,
                );
                return;
              }

              loggerService.info(
                `[rising-sun prophecy:rapid-expansion] player ${playerId} playing set-aside ${gainedCard.cardKey} (${gainedCardId})`,
              );
              await actionService.run('playCard', {
                playerId,
                cardId: gainedCardId,
                overrides: { actionCost: 0 },
              });
            },
          },
          {
            idSuffix: `rapid-expansion:${playerId}:${gainedCardId}:startTurn`,
          },
        );

        loggerService.debug(
          `[rising-sun prophecy:rapid-expansion] registered deferred start-turn play for card ${gainedCardId} and player ${playerId}`,
        );
      },
    });
  }
};

// Registers Sickness: at start of turn choose to gain Curse to deck or discard 3 cards.
const registerSicknessReactions = (args: RisingSunGameEventContext, prophecy: Prophecy): void => {
  for (const player of args.match.players) {
    const playerId = player.id;
    args.reactionManager.registerReactionTemplate(prophecy, 'startTurn', {
      playerId,
      compulsory: true,
      condition: async ({ trigger, match }) => {
        return trigger.args.playerId === playerId && isProphecyActive(match, SICKNESS_PROPHECY_KEY);
      },
      triggeredEffectFn: async ({
        trigger,
        promptService,
        supplyGainService,
        cardSourceController,
        actionService,
        loggerService,
      }) => {
        const option = await promptService.requestAction({
          playerId,
          prompt: 'Choose one',
          actionButtons: [
            { label: 'Gain Curse to deck', action: 1 },
            { label: 'Discard 3 cards', action: 2 },
          ],
        });

        if (option === 1) {
          const gainedCurseId = await supplyGainService.gainTopSupplyCardForPileKey({
            playerId,
            pileKey: 'curse',
            from: 'basicSupply',
            to: { location: 'playerDeck' },
            logTag: 'rising-sun prophecy:sickness',
          });

          if (!gainedCurseId) {
            loggerService.debug('[rising-sun prophecy:sickness] Curse pile empty; no Curse gained');
          }
          return;
        }

        const hand = cardSourceController.getSource('playerHand', playerId);
        const discardCount = Math.min(3, hand.length);
        if (discardCount < 1) {
          loggerService.debug('[rising-sun prophecy:sickness] player has no cards in hand to discard');
          return;
        }

        const selectedCardIds = await actionService.run('selectCard', {
          playerId,
          prompt: `Discard ${discardCount} card(s)`,
          restrict: hand,
          count: { kind: 'exact', count: discardCount },
        });

        const cardsToDiscard = selectedCardIds.length === discardCount ? selectedCardIds : hand.slice(-discardCount);
        if (selectedCardIds.length !== discardCount) {
          loggerService.warn(
            `[rising-sun prophecy:sickness] expected ${discardCount} selections but got ${selectedCardIds.length}; using deterministic fallback`,
          );
        }

        for (const cardId of cardsToDiscard) {
          await actionService.run('discardCard', {
            cardId,
            playerId,
          });
        }
      },
    });
  }
};

// Registers runtime behavior for the selected prophecy at game start.
const registerSelectedProphecyReactions = (args: RisingSunGameEventContext): void => {
  const prophecy = getRuntimeProphecy(args.match);
  if (!prophecy) {
    args.loggerService.warn('[rising-sun onGameStart] no prophecy found while registering runtime reactions');
    return;
  }

  args.loggerService.info(`[rising-sun onGameStart] registering runtime reactions for prophecy ${prophecy.cardKey}`);

  switch (prophecy.cardKey) {
    case APPROACHING_ARMY_PROPHECY_KEY:
      registerApproachingArmyReactions(args, prophecy);
      break;
    case BIDING_TIME_PROPHECY_KEY:
      registerBidingTimeReactions(args, prophecy);
      break;
    case BUREAUCRACY_PROPHECY_KEY:
      registerBureaucracyReactions(args, prophecy);
      break;
    case ENLIGHTENMENT_PROPHECY_KEY:
      registerEnlightenmentReactions(args, prophecy);
      break;
    case FLOURISHING_TRADE_PROPHECY_KEY:
      registerFlourishingTradeReactions(args, prophecy);
      break;
    case HARSH_WINTER_PROPHECY_KEY:
      registerHarshWinterReactions(args, prophecy);
      break;
    case GOOD_HARVEST_PROPHECY_KEY:
      registerGoodHarvestReactions(args, prophecy);
      break;
    case GREAT_LEADER_PROPHECY_KEY:
      registerGreatLeaderReactions(args, prophecy);
      break;
    case GROWTH_PROPHECY_KEY:
      registerGrowthReactions(args, prophecy);
      break;
    case KIND_EMPEROR_PROPHECY_KEY:
      registerKindEmperorReactions(args, prophecy);
      break;
    case PANIC_PROPHECY_KEY:
      registerPanicReactions(args, prophecy);
      break;
    case PROGRESS_PROPHECY_KEY:
      registerProgressReactions(args, prophecy);
      break;
    case RAPID_EXPANSION_PROPHECY_KEY:
      registerRapidExpansionReactions(args, prophecy);
      break;
    case SICKNESS_PROPHECY_KEY:
      registerSicknessReactions(args, prophecy);
      break;
    default:
      args.loggerService.info(
        `[rising-sun onGameStart] prophecy ${prophecy.cardKey} has no runtime implementation in this pass`,
      );
      break;
  }
};

const configurator: ExpansionConfiguratorFactory = () => {
  // Ensures Rising Sun token definitions are only registered once per match scope.
  let tokenDefinitionsRegistered = false;

  return async args => {
    if (!tokenDefinitionsRegistered) {
      registerRisingSunTokenDefinitions(args.expansionRegistration.registerTokenDefinition);
      tokenDefinitionsRegistered = true;
      args.loggerService.debug('[rising-sun configurator] registered sun token definitions');
    }

    // Riverboat setup does not depend on omen/prophecy state and should be stable across recomputations.
    configureRiverboatSetAsideCard(args);

    const hasOmen = hasOmenInKingdom(args.config);
    if (!hasOmen) {
      if ((args.config.prophecies ?? []).length > 0) {
        args.loggerService.info('[rising-sun configurator] no Omen cards in kingdom; clearing configured prophecy');
      }
      args.config.prophecies = [];
      configureApproachingArmySetupPile(args);
      return args.config;
    }

    const configuredProphecies = uniqueByProp(args.config.prophecies ?? [], 'cardKey');
    const candidateProphecies = uniqueByProp(
      args.config.expansions.flatMap(expansion =>
        Object.values(args.expansionCatalog[expansion.name]?.prophecies ?? {}),
      ),
      'cardKey',
    );
    const candidateByKey = new Set(candidateProphecies.map(prophecy => prophecy.cardKey));
    const supportedConfiguredProphecies = configuredProphecies.filter(prophecy => candidateByKey.has(prophecy.cardKey));

    if (supportedConfiguredProphecies.length !== configuredProphecies.length) {
      const removed = configuredProphecies
        .filter(prophecy => !candidateByKey.has(prophecy.cardKey))
        .map(prophecy => prophecy.cardKey);
      args.loggerService.warn(
        `[rising-sun configurator] removing unsupported prophecy selection(s): ${removed.join(', ')}`,
      );
    }

    if (configuredProphecies.length > 1) {
      args.loggerService.warn(
        `[rising-sun configurator] ${configuredProphecies.length} prophecies configured; trimming to one deterministic prophecy`,
      );
    }

    if (supportedConfiguredProphecies.length > 0) {
      args.config.prophecies = [supportedConfiguredProphecies[0]];
      args.loggerService.info(
        `[rising-sun configurator] using preselected prophecy ${supportedConfiguredProphecies[0].cardKey}`,
      );
      configureApproachingArmySetupPile(args);
      return args.config;
    }

    if (candidateProphecies.length < 1) {
      args.loggerService.warn(
        '[rising-sun configurator] Omen present but no prophecy data available in loaded expansions',
      );
      args.config.prophecies = [];
      configureApproachingArmySetupPile(args);
      return args.config;
    }

    const selectedProphecy = structuredClone(
      candidateProphecies[args.rngService.nextIndex(candidateProphecies.length)],
    );
    args.config.prophecies = [selectedProphecy];
    args.loggerService.info(`[rising-sun configurator] randomly selected prophecy ${selectedProphecy.cardKey}`);
    configureApproachingArmySetupPile(args);
    return args.config;
  };
};

export default configurator;

// Seeds Riverboat set-aside state and Sun tokens at game start.
export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  const hasOmen = hasOmenInKingdom(config);
  const hasRiverboat = config.kingdomSupply.some(supply =>
    supply.cards.some(card => card.cardKey === RIVERBOAT_CARD_KEY),
  );

  if (!hasOmen && !hasRiverboat) {
    return;
  }

  registrar('onGameStartSetup', async args => {
    if (hasRiverboat) {
      const riverboatCard = args.findCardService.findCards({
        all: [{ location: 'kingdomSupply' }, { cardKeys: RIVERBOAT_CARD_KEY }],
      })[0];

      if (!riverboatCard) {
        args.loggerService.warn('[rising-sun onGameStart] Riverboat configured but no runtime Riverboat card found');
      } else {
        const riverboatMetadata = (riverboatCard.metadata as RiverboatCardMetadata | undefined)?.risingSun?.riverboat;
        const runtimeSetAsidePileKey = riverboatMetadata?.runtimeSetAsidePileKey;
        if (!runtimeSetAsidePileKey) {
          args.loggerService.warn('[rising-sun onGameStart] Riverboat metadata missing runtime set-aside pile key');
        } else {
          const runtimeSetAsideCard = args.findCardService.findTopNonSupplyCardForPileName({
            pileName: runtimeSetAsidePileKey,
          });

          if (runtimeSetAsideCard) {
            args.loggerService.info(
              `[rising-sun onGameStart] moving Riverboat set-aside card ${runtimeSetAsideCard.cardKey} to shared set-aside`,
            );
            await args.actionService.run('moveCard', {
              cardId: runtimeSetAsideCard.id,
              to: { location: 'set-aside' },
              setAsideSource: {
                sourceKind: 'card',
                sourceCardId: riverboatCard.id,
                sourceCardKey: riverboatCard.cardKey,
                sourceLabel: riverboatCard.cardName,
              },
            });

            // Riverboat set-aside card must stay set aside even when played.
            const movedSetAsideCard = args.cardLibrary.getCard(runtimeSetAsideCard.id);
            const movedMetadata = (movedSetAsideCard.metadata as RiverboatCardMetadata | undefined) ?? {};
            movedMetadata.base ??= {};
            movedMetadata.base.immovable = true;
            movedMetadata.risingSun ??= {};
            movedMetadata.risingSun.riverboat ??= {};
            movedMetadata.risingSun.riverboat.runtimeSetAsideCard = true;
            movedMetadata.risingSun.riverboat.runtimeSetAsidePileKey = runtimeSetAsidePileKey;
            movedSetAsideCard.metadata = movedMetadata;
          } else {
            const existingSetAsideCard = args.cardSourceController
              .getSource('set-aside')
              .map(cardId => args.cardLibrary.getCard(cardId))
              .find(card => card.kingdom === runtimeSetAsidePileKey);

            if (!existingSetAsideCard) {
              args.loggerService.warn(
                `[rising-sun onGameStart] no runtime Riverboat set-aside card found for pile ${runtimeSetAsidePileKey}`,
              );
            } else {
              const existingMetadata = (existingSetAsideCard.metadata as RiverboatCardMetadata | undefined) ?? {};
              existingMetadata.base ??= {};
              existingMetadata.base.immovable = true;
              existingMetadata.risingSun ??= {};
              existingMetadata.risingSun.riverboat ??= {};
              existingMetadata.risingSun.riverboat.runtimeSetAsideCard = true;
              existingMetadata.risingSun.riverboat.runtimeSetAsidePileKey = runtimeSetAsidePileKey;
              existingSetAsideCard.metadata = existingMetadata;
              args.loggerService.debug('[rising-sun onGameStart] Riverboat set-aside card already initialized');
            }
          }
        }
      }
    }

    if (!hasOmen) {
      return;
    }

    const prophecy = args.match.prophecies?.[0];
    if (!prophecy) {
      args.loggerService.warn('[rising-sun onGameStart] Omen present but no active prophecy instance was created');
      return;
    }

    const playerCount = args.match.players.length;
    const startingSunTokens = SUN_TOKEN_COUNT_BY_PLAYER_COUNT[playerCount] ?? SUN_TOKEN_COUNT_BY_PLAYER_COUNT[6];

    args.loggerService.info(
      `[rising-sun onGameStart] placing ${startingSunTokens} Sun token counter(s) on prophecy ${prophecy.cardKey}`,
    );
    await args.actionService.run('placeToken', {
      tokenId: risingSunTokenIds.sun,
      counters: startingSunTokens,
      location: { type: 'cardLike', cardLikeId: prophecy.id },
    });
    args.loggerService.debug(
      `[rising-sun onGameStart] prophecy=${prophecy.cardKey} cardLikeId=${prophecy.id} counters=${startingSunTokens}`,
    );
  });

  if (!hasOmen) {
    return;
  }

  // Register runtime trigger behavior once match setup has finished creating prophecy instances.
  registrar('onGameStart', async args => {
    registerSelectedProphecyReactions(args);
  });
};
