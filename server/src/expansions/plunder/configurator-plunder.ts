import {
  ExpansionConfiguratorContext,
  ExpansionConfiguratorFactory,
  GameEventRegistrar,
} from '@server-types/index.ts';
import { CardKey, ComputedMatchConfiguration } from 'shared/types/index.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';

const LOOT_PILE_NAME = 'loot';
const CHEAP_TRAIT_CARD_KEY: CardKey = 'cheap';

// Canonical Loot card keys (15 cards, configured as 2 copies each).
const LOOT_CARD_KEYS: CardKey[] = [
  'amphora',
  'doubloons',
  'endless-chalice',
  'figurehead',
  'hammer',
  'insignia',
  'jewels',
  'orb',
  'prize-goat',
  'puzzle-box',
  'sextant',
  'shield',
  'spell-scroll',
  'staff',
  'sword',
];

// Kingdom piles that explicitly reference "gain a Loot".
const LOOT_SOURCE_KINGDOM_PILES = new Set<CardKey>([
  'cutthroat',
  'jewelled-egg',
  'pickaxe',
  'sack-of-loot',
  'search',
  'wealthy-village',
]);

// Events that explicitly reference "gain a Loot".
const LOOT_SOURCE_EVENTS = new Set<CardKey>([
  'foray',
  'invasion',
  'looting',
  'peril',
  'prosper',
]);

// Traits that explicitly reference "gain a Loot".
const LOOT_SOURCE_TRAITS = new Set<CardKey>(['cursed']);

// Returns true when the current setup contains any card-like that requires Loot.
const shouldConfigureLootPile = (config: ExpansionConfiguratorContext['config']): boolean => {
  const hasLootKingdomSource = config.kingdomSupply.some((supply) =>
    supply.cards.some((card) => LOOT_SOURCE_KINGDOM_PILES.has(getCardPileKey(card)))
  );
  if (hasLootKingdomSource) {
    return true;
  }

  const hasLootEventSource = (config.events ?? []).some((event) => LOOT_SOURCE_EVENTS.has(event.cardKey));
  if (hasLootEventSource) {
    return true;
  }

  return (config.traits ?? []).some((trait) => LOOT_SOURCE_TRAITS.has(trait.cardKey));
};

// Builds the canonical shuffled Loot stack with all cards face down.
const buildShuffledLootCards = (
  args: ExpansionConfiguratorContext,
) => {
  const cards = LOOT_CARD_KEYS.flatMap((lootCardKey) => {
    const baseCard = structuredClone(args.expansionData.cardData.kingdomSupply[lootCardKey]);
    if (!baseCard) {
      args.loggerService.warn(`[plunder configurator] missing Loot card data for ${lootCardKey}`);
      return [];
    }

    const pileCard = {
      ...baseCard,
      kingdom: LOOT_PILE_NAME,
      partOfSupply: false,
      kingdomSelectable: false,
      facing: 'back' as const,
      tags: Array.from(new Set([...(baseCard.tags ?? []), LOOT_PILE_NAME])),
    };
    return [structuredClone(pileCard), structuredClone(pileCard)];
  });

  return fisherYatesShuffle(cards, false, () => args.rngService.nextFloat());
};

const configurator: ExpansionConfiguratorFactory = () => {
  return async (args) => {
    const hasLootPile = args.config.nonSupply?.some((supply) => supply.name === LOOT_PILE_NAME) ?? false;
    const shouldUseLoot = shouldConfigureLootPile(args.config);

    if (!shouldUseLoot) {
      if (hasLootPile) {
        args.loggerService.info('[plunder configurator] removing Loot pile (no selected Loot source remains)');
        args.config.nonSupply = args.config.nonSupply?.filter((supply) => supply.name !== LOOT_PILE_NAME);
      }
      return args.config;
    }

    if (hasLootPile) {
      args.loggerService.debug('[plunder configurator] Loot pile already configured');
      return args.config;
    }

    args.config.nonSupply ??= [];
    const shuffledLootCards = buildShuffledLootCards(args);
    if (shuffledLootCards.length < 1) {
      args.loggerService.warn('[plunder configurator] no Loot cards available; skipping Loot pile configuration');
      return args.config;
    }

    args.config.nonSupply.push({
      name: LOOT_PILE_NAME,
      cards: shuffledLootCards,
    });
    args.loggerService.info(`[plunder configurator] configured Loot pile with ${shuffledLootCards.length} cards`);

    return args.config;
  };
};

// Registers game-start hooks for Plunder traits that need global runtime behavior.
export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  // Skip registration when Cheap is not configured in this match setup.
  const hasCheapTrait = (config.traits ?? []).some((trait) => trait.cardKey === CHEAP_TRAIT_CARD_KEY);
  if (!hasCheapTrait) {
    return;
  }

  registrar('onGameStart', async (args) => {
    // Resolve runtime Cheap traits from match state so we use assigned pile keys.
    const cheapTraits = (args.match.traits ?? []).filter((trait) => trait.cardKey === CHEAP_TRAIT_CARD_KEY);
    if (cheapTraits.length < 1) {
      args.loggerService.warn('[plunder cheap trait] no runtime Cheap traits found at game start');
      return;
    }

    args.loggerService.info(`[plunder cheap trait] registering cost reduction for ${cheapTraits.length} Cheap trait(s)`);
    for (const cheapTrait of cheapTraits) {
      const pileKey = cheapTrait.pileKey;
      if (!pileKey) {
        args.loggerService.warn(`[plunder cheap trait] Cheap trait ${cheapTrait.id} has no assigned pile key`);
        continue;
      }

      // Collect all cards in the affected kingdom pile (split-pile safe via pile key matching).
      const pileCards = args.findCardService.findCards([{ location: 'kingdomSupply' }]).filter((card) =>
        getCardPileKey(card) === pileKey
      );
      if (pileCards.length < 1) {
        args.loggerService.warn(`[plunder cheap trait] no cards found in target pile '${pileKey}'`);
        continue;
      }

      args.loggerService.debug(
        `[plunder cheap trait] applying -$1 cost rule to pile '${pileKey}' (${pileCards.length} card(s))`,
      );
      for (const pileCard of pileCards) {
        // Cheap only reduces treasure cost and remains active for the full game.
        args.cardPriceController.registerRule(pileCard, () => ({
          restricted: false,
          cost: { treasure: -1 },
        }));
      }
    }
  });
};

export default configurator;
