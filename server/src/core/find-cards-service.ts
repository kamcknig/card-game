import { castArray } from 'es-toolkit/compat';
import {
  Card,
  CardDataFindCardsFilter,
  CardFilterExpr,
  CardId,
  CardKey,
  CardLocation,
  CostFindCardsFilter,
  PlayerId,
  SourceFindCardsFilter,
} from 'shared/types/index.ts';
import { validateCostSpec } from '@shared/validate-cost-spec.ts';
import { FindCardService, FindCardsFn } from '@server-types/index.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { CardSourceController } from './card-source-controller.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { LoggerService } from './logger-service.ts';
import { getCardPileKey } from '../utils/get-card-pile-key.ts';

type SourceSnapshot = {
  location?: CardLocation;
  playerId?: PlayerId;
};

type CardFilterLeaf = Exclude<
  CardFilterExpr,
  | { all: CardFilterExpr[] }
  | { any: CardFilterExpr[] }
  | {
      not: CardFilterExpr;
    }
>;

export class FindCardsService implements FindCardService {
  constructor(
    private readonly cardSourceController: CardSourceController,
    private readonly cardPriceController: CardPriceRulesController,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Resolves cards matching a {@link CardFilterExpr}.
   *
   * Supported filter leaves:
   * - Source filter: `{ location, playerId? }`
   * - Card-data filter: `{ cardIds?, tags?, cardKeys?, cardType?, excludedCardType?, owner?, kingdom? }`
   * - Cost filter: `{ kind: 'exact' | 'upTo', amount, playerId, from? }`
   *
   * Supported logical combinators:
   * - `all`: every child expression must match
   * - `any`: at least one child expression must match
   * - `not`: child expression must not match
   *
   * Notes:
   * - Results are deterministic and preserve source/library ordering.
   * - `location` + `playerId` constraints are evaluated against current card source.
   * - `cardType` matches cards with at least one included type.
   * - `excludedCardType` rejects cards with any excluded type.
   * - Cost checks use effective cost after card-price rules for the provided `playerId`.
   *
   * @example
   * // Cards in hand for one player
   * findCards({ location: 'playerHand', playerId });
   *
   * @example
   * // Non-Duration Actions in hand
   * findCards({
   *   all: [
   *     { location: 'playerHand', playerId },
   *     { cardType: ['ACTION'] },
   *     { excludedCardType: ['DURATION'] },
   *   ],
   * });
   *
   * @example
   * // Supply cards costing up to $4 for this player
   * findCards({
   *   all: [
   *     { location: ['basicSupply', 'kingdomSupply'] },
   *     { kind: 'upTo', amount: { treasure: 4 }, playerId },
   *   ],
   * });
   *
   * @example
   * // Action or Treasure, but not Command
   * findCards({
   *   all: [
   *     { any: [{ cardType: ['ACTION'] }, { cardType: ['TREASURE'] }] },
   *     { not: { cardType: ['COMMAND'] } },
   *   ],
   * });
   */
  public readonly findCards: FindCardsFn = filter => {
    const seedCardIds = this.resolveSeedCardIds(filter);
    const sourceCardIds = seedCardIds ?? this.cardLibrary.getAllCardsAsArray().map(card => card.id);
    const sourceCards = sourceCardIds.map(cardId => this.cardLibrary.getCard(cardId));
    return sourceCards.filter(card => this.matchesFilterExpression(card, filter));
  };

  // Evaluates whether a card matches the supplied filter expression.
  public matchesFilter(args: {
    cardId: CardId | Card;
    filter: CardFilterExpr;
    sourceOverride?: { location?: CardLocation; playerId?: PlayerId };
  }): boolean {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    return this.matchesFilterExpression(card, args.filter, args.sourceOverride);
  }

  // Returns all cards currently considered "in play" for effect logic.
  public getCardsInPlay(): Card[] {
    return this.findCards({ location: ['playArea', 'activeDuration'] });
  }

  // Returns count of non-empty basic/kingdom supply piles.
  public getRemainingSupplyCount(): number {
    const remainingSupplyPileKeys = this.findCards({ location: ['kingdomSupply', 'basicSupply'] })
      .map(card => getCardPileKey(card))
      .reduce((prev, pileKey) => {
        if (prev.includes(pileKey)) {
          return prev;
        }
        return prev.concat(pileKey);
      }, [] as string[]);

    return remainingSupplyPileKeys.length;
  }

  // Finds the current top card in supply for a given pile key.
  public findTopSupplyCardForPileKey(args: {
    pileKey: CardKey;
    from?: ('basicSupply' | 'kingdomSupply') | ('basicSupply' | 'kingdomSupply')[];
  }): Card | undefined {
    const supplyLocations = args.from
      ? Array.isArray(args.from)
        ? args.from
        : [args.from]
      : ['basicSupply', 'kingdomSupply'];

    return this.findCards({ location: supplyLocations })
      .filter(card => getCardPileKey(card) === args.pileKey)
      .slice(-1)[0];
  }

  // Finds the current top card in a named non-supply pile (using kingdom as pile name).
  public findTopNonSupplyCardForPileName(args: { pileName: string }): Card | undefined {
    return this.findCards({ location: 'nonSupplyCards' })
      .filter(card => card.kingdom === args.pileName)
      .slice(-1)[0];
  }

  // Returns an initial source-id seed when expression includes a direct location clause.
  private resolveSeedCardIds(filter: CardFilterExpr): CardId[] | undefined {
    if (this.isAllFilter(filter)) {
      for (const child of filter.all) {
        const childSeed = this.resolveSeedCardIds(child);
        if (childSeed) {
          return childSeed;
        }
      }
      return undefined;
    }

    if (this.isAnyFilter(filter) || this.isNotFilter(filter)) {
      return undefined;
    }

    if (!this.isSourceFilter(filter)) {
      return undefined;
    }

    return this.findCardsByLocation(castArray(filter.location), filter.playerId);
  }

  // Resolves card IDs from source locations with optional player-scoped zones.
  // Treats unregistered zones as empty so optional zones (e.g., the tavern mat when no card
  // requires it) yield no results rather than throwing during a query. Logs a warning when a
  // queried zone is missing so the underlying configuration bug is still surfaced.
  private findCardsByLocation(locations: CardLocation[], playerId?: PlayerId): CardId[] {
    let cardIds: CardId[] = [];

    for (const location of locations) {
      let source: CardId[] | undefined;
      const hasPlayerZone = playerId !== undefined && this.cardSourceController.hasSource(location, playerId);
      const hasGlobalZone = this.cardSourceController.hasSource(location);

      // Prefer the player-scoped zone, then fall back to the global zone if registered.
      if (hasPlayerZone) {
        source = this.cardSourceController.getSource(location, playerId);
      } else if (hasGlobalZone) {
        source = this.cardSourceController.getSource(location);
      } else {
        // Surface configuration bugs (e.g., a card querying a mat that was never registered)
        // without crashing the match.
        const playerSuffix = playerId !== undefined ? ` for playerId=${playerId}` : '';
        this.loggerService.warn(
          `[find cards] requested zone '${location}'${playerSuffix} is not registered; treating as empty`,
        );
      }

      if (source) {
        cardIds = cardIds.concat(source);
      }
    }

    return cardIds;
  }

  // Evaluates a filter expression against one card.
  private matchesFilterExpression(
    card: Card,
    filter: CardFilterExpr,
    sourceOverride?: { location?: CardLocation; playerId?: PlayerId },
  ): boolean {
    if (this.isAllFilter(filter)) {
      return filter.all.every(child => this.matchesFilterExpression(card, child, sourceOverride));
    }

    if (this.isAnyFilter(filter)) {
      return filter.any.some(child => this.matchesFilterExpression(card, child, sourceOverride));
    }

    if (this.isNotFilter(filter)) {
      return !this.matchesFilterExpression(card, filter.not, sourceOverride);
    }

    if (this.isSourceFilter(filter)) {
      const source = this.resolveCardSourceSnapshot(card.id, sourceOverride);
      if (!source.location) {
        return false;
      }
      const locations = castArray(filter.location);
      if (!locations.includes(source.location)) {
        return false;
      }
      if (filter.playerId !== undefined && source.playerId !== filter.playerId) {
        return false;
      }
    }

    if (this.isCostFilter(filter)) {
      const { cost: effectiveCost } = this.cardPriceController.applyRules(card, {
        playerId: filter.playerId,
      });
      if (!validateCostSpec(filter, effectiveCost)) {
        return false;
      }
    }

    if (this.isCardDataFilter(filter)) {
      const cardIds = filter.cardIds ? castArray(filter.cardIds) : undefined;
      if (cardIds && !cardIds.includes(card.id)) {
        return false;
      }

      const tags = filter.tags ? castArray(filter.tags) : undefined;
      if (tags && !card.tags?.some(tag => tags.includes(tag))) {
        return false;
      }

      const kingdoms = filter.kingdom ? castArray(filter.kingdom) : undefined;
      if (kingdoms && !kingdoms.includes(card.kingdom)) {
        return false;
      }

      const cardKeys = filter.cardKeys ? castArray(filter.cardKeys) : undefined;
      if (cardKeys && !cardKeys.includes(card.cardKey)) {
        return false;
      }

      if (filter.owner !== undefined && filter.owner !== card.owner) {
        return false;
      }

      const cardTypes = filter.cardType ? castArray(filter.cardType) : undefined;
      if (cardTypes && !card.type.some(cardType => cardTypes.includes(cardType))) {
        return false;
      }

      const excludedCardTypes = filter.excludedCardType ? castArray(filter.excludedCardType) : undefined;
      if (excludedCardTypes && card.type.some(cardType => excludedCardTypes.includes(cardType))) {
        return false;
      }
    }

    return true;
  }

  // Resolves current card source, then applies optional caller overrides for "as if" checks.
  private resolveCardSourceSnapshot(
    cardId: CardId,
    sourceOverride?: { location?: CardLocation; playerId?: PlayerId },
  ): SourceSnapshot {
    let resolvedSource: SourceSnapshot = {};

    try {
      const source = this.cardSourceController.findCardSource(cardId);
      resolvedSource = {
        location: source.sourceKey,
        playerId: source.playerId,
      };
    } catch {
      // Keep unresolved source snapshot so source-filter checks fail cleanly.
    }

    if (!sourceOverride) {
      return resolvedSource;
    }

    return {
      location: sourceOverride.location ?? resolvedSource.location,
      playerId: sourceOverride.playerId ?? resolvedSource.playerId,
    };
  }

  // Narrows logical conjunction expressions.
  private isAllFilter(filter: CardFilterExpr): filter is { all: CardFilterExpr[] } {
    return typeof filter === 'object' && filter !== null && 'all' in filter;
  }

  // Narrows logical disjunction expressions.
  private isAnyFilter(filter: CardFilterExpr): filter is { any: CardFilterExpr[] } {
    return typeof filter === 'object' && filter !== null && 'any' in filter;
  }

  // Narrows logical negation expressions.
  private isNotFilter(filter: CardFilterExpr): filter is { not: CardFilterExpr } {
    return typeof filter === 'object' && filter !== null && 'not' in filter;
  }

  // Narrows leaf expressions that constrain by source location/player.
  private isSourceFilter(filter: CardFilterLeaf): filter is SourceFindCardsFilter {
    return typeof filter === 'object' && filter !== null && 'location' in filter;
  }

  // Narrows leaf expressions that constrain by effective card cost.
  private isCostFilter(filter: CardFilterLeaf): filter is CostFindCardsFilter {
    return (
      typeof filter === 'object' && filter !== null && 'kind' in filter && 'amount' in filter && 'playerId' in filter
    );
  }

  // Narrows leaf expressions that constrain by card metadata (type, key, tags, etc.).
  private isCardDataFilter(filter: CardFilterLeaf): filter is CardDataFindCardsFilter {
    return !this.isSourceFilter(filter) && !this.isCostFilter(filter);
  }
}
