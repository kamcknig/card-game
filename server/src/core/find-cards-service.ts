import { castArray } from 'es-toolkit/compat';
import { Card, CardId, CardKey, CardLocation, PlayerId } from 'shared/types/index.ts';
import { validateCostSpec } from '@shared/validate-cost-spec.ts';
import {
  FindCardService,
  FindCardsFn,
  isCardDataFindCardsFilter,
  isCostFindCardsFilter,
  isSourceFindCardsFilter,
  NonLocationFilters,
  SourceFindCardsFilter,
} from '@server-types/index.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { CardSourceController } from './card-source-controller.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { getCardPileKey } from '../utils/get-card-pile-key.ts';

export class FindCardsService implements FindCardService {
  constructor(
    private readonly cardSourceController: CardSourceController,
    private readonly cardPriceController: CardPriceRulesController,
    private readonly cardLibrary: MatchCardLibrary,
  ) {}

  // Public card lookup entrypoint injected throughout runtime systems.
  public readonly findCards: FindCardsFn = (filters) => {
    let cardIds: CardId[] = [];
    let locationFilter: SourceFindCardsFilter | undefined = undefined;
    let otherFilters: NonLocationFilters[] = [];

    if (!Array.isArray(filters)) {
      if (isSourceFindCardsFilter(filters)) {
        locationFilter = filters;
      } else {
        otherFilters = [filters];
      }
    } else {
      if (isSourceFindCardsFilter(filters[0])) {
        locationFilter = filters.shift() as SourceFindCardsFilter;
        otherFilters = [...filters as NonLocationFilters[]];
      } else {
        otherFilters = [...filters as NonLocationFilters[]];
      }
    }

    if (locationFilter) {
      locationFilter.location = castArray(locationFilter.location);
      cardIds = this.findCardsByLocation(locationFilter.location, locationFilter.playerId);
    } else {
      cardIds = this.cardLibrary.getAllCardsAsArray().map((card) => card.id);
    }

    let sourceCards = cardIds.map(this.cardLibrary.getCard);

    for (const otherFilter of otherFilters) {
      sourceCards = this.applyFilter(sourceCards, otherFilter);
    }

    return sourceCards;
  };

  // Returns all cards currently considered "in play" for effect logic.
  public getCardsInPlay(): Card[] {
    return this.findCards({ location: ['playArea', 'activeDuration'] });
  }

  // Returns count of non-empty basic/kingdom supply piles.
  public getRemainingSupplyCount(): number {
    const remainingSupplyPileKeys = this.findCards({ location: ['kingdomSupply', 'basicSupply'] })
      .map((card) => getCardPileKey(card))
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
      ? (Array.isArray(args.from) ? args.from : [args.from])
      : ['basicSupply', 'kingdomSupply'];

    return this.findCards([{ location: supplyLocations }])
      .filter((card) => getCardPileKey(card) === args.pileKey)
      .slice(-1)[0];
  }

  // Resolves card IDs from source locations with optional player-scoped zones.
  private findCardsByLocation(locations: CardLocation[], playerId?: PlayerId) {
    let cardIds: CardId[] = [];

    for (const location of locations) {
      let source = this.cardSourceController.getSource(location, playerId);
      if (!source) {
        source = this.cardSourceController.getSource(location);
      }

      if (source) {
        cardIds = cardIds.concat(source);
      }
    }

    return cardIds;
  }

  // Applies a single find-cards filter to the current candidate set.
  private applyFilter(sourceCards: Card[], otherFilter: NonLocationFilters): Card[] {
    if (isCardDataFindCardsFilter(otherFilter)) {
      if (otherFilter.tags) {
        sourceCards = sourceCards.filter((card) => card.tags?.some((t) => otherFilter.tags!.includes(t)));
      }

      if (otherFilter.kingdom) {
        sourceCards = sourceCards.filter((card) => card.kingdom === otherFilter.kingdom);
      }

      if (otherFilter.cardKeys) {
        sourceCards = sourceCards.filter((card) => otherFilter.cardKeys!.includes(card.cardKey));
      }

      if (otherFilter.owner) {
        sourceCards = sourceCards.filter((card) => card.owner === otherFilter.owner);
      }

      if (otherFilter.cardType) {
        sourceCards = sourceCards.filter((card) => card.type.some((t) => otherFilter.cardType!.includes(t)));
      }

      return sourceCards;
    }

    if (isCostFindCardsFilter(otherFilter)) {
      return sourceCards.filter((card) => {
        const { cost: effectiveCost } = this.cardPriceController.applyRules(card, {
          playerId: otherFilter.playerId,
        });
        return validateCostSpec(otherFilter, effectiveCost);
      });
    }

    return sourceCards;
  }
}
