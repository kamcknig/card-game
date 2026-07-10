import {
  CardAlternateBuyOption,
  CardEffectFactoryMap,
  CardEffectFunctionMap,
  CardExpansionActionConditionMap,
} from '@server-types/index.ts';
import { CardKey } from 'shared/types/index.ts';

// The distinct kinds of effect factory pools this registry materializes.
// 'card' is the base supply-card pool; the rest are landscape kinds.
export type ExpansionEffectKind = 'card' | 'event' | 'project' | 'landmark' | 'way';

// Stores expansion-registered factories/conditions and provides materialized runtime maps per match.
export class ExpansionEffectRegistryService {
  // One factory pool per effect kind. Every kind is pre-seeded with an empty
  // map so `factoriesFor()` never needs to lazily create one.
  private readonly _effectFactoriesByKind: Record<ExpansionEffectKind, CardEffectFactoryMap> = {
    card: {},
    event: {},
    project: {},
    landmark: {},
    way: {},
  };
  private readonly _cardActionConditions: Record<CardKey, CardExpansionActionConditionMap> = {};
  private readonly _cardAlternateBuyOptions: Record<CardKey, CardAlternateBuyOption[]> = {};

  // Registers an effect factory for the given kind/key.
  public register(kind: ExpansionEffectKind, cardKey: CardKey, factory: CardEffectFactoryMap[CardKey]): void {
    this.factoriesFor(kind)[cardKey] = factory;
  }

  // Returns true when an effect factory already exists for this kind/key.
  public has(kind: ExpansionEffectKind, cardKey: CardKey): boolean {
    return this.factoriesFor(kind)[cardKey] !== undefined;
  }

  // Builds a fresh per-match map of effect functions for the given kind.
  public createFunctionMap(kind: ExpansionEffectKind): CardEffectFunctionMap {
    return this.materializeEffectMap(this.factoriesFor(kind));
  }

  // Registers a card effect factory by key. Thin delegate kept so existing
  // call sites do not need to change.
  public registerCardEffectFactory(cardKey: CardKey, factory: CardEffectFactoryMap[CardKey]): void {
    this.register('card', cardKey, factory);
  }

  // Registers an event effect factory by key. Thin delegate.
  public registerEventEffectFactory(cardKey: CardKey, factory: CardEffectFactoryMap[CardKey]): void {
    this.register('event', cardKey, factory);
  }

  // Returns true when an event effect factory already exists for this key. Thin delegate.
  public hasEventEffectFactory(cardKey: CardKey): boolean {
    return this.has('event', cardKey);
  }

  // Registers a landmark effect factory by key. Thin delegate.
  public registerLandmarkEffectFactory(cardKey: CardKey, factory: CardEffectFactoryMap[CardKey]): void {
    this.register('landmark', cardKey, factory);
  }

  // Returns true when a landmark effect factory already exists for this key. Thin delegate.
  public hasLandmarkEffectFactory(cardKey: CardKey): boolean {
    return this.has('landmark', cardKey);
  }

  // Registers a project effect factory by key. Thin delegate.
  public registerProjectEffectFactory(cardKey: CardKey, factory: CardEffectFactoryMap[CardKey]): void {
    this.register('project', cardKey, factory);
  }

  // Returns true when a project effect factory already exists for this key. Thin delegate.
  public hasProjectEffectFactory(cardKey: CardKey): boolean {
    return this.has('project', cardKey);
  }

  // Registers a way effect factory by key. Thin delegate.
  public registerWayEffectFactory(cardKey: CardKey, factory: CardEffectFactoryMap[CardKey]): void {
    this.register('way', cardKey, factory);
  }

  // Returns true when a way effect factory already exists for this key. Thin delegate.
  public hasWayEffectFactory(cardKey: CardKey): boolean {
    return this.has('way', cardKey);
  }

  // Registers buy action conditions for a card key.
  public registerCardActionConditions(cardKey: CardKey, conditions: CardExpansionActionConditionMap): void {
    this._cardActionConditions[cardKey] = conditions;
  }

  // Registers alternate buy options for a card key.
  public registerCardAlternateBuyOptions(cardKey: CardKey, options: CardAlternateBuyOption[]): void {
    this._cardAlternateBuyOptions[cardKey] = options;
  }

  // Returns buy action conditions for a card key, if any.
  public getCardActionConditions(cardKey: CardKey): CardExpansionActionConditionMap | undefined {
    return this._cardActionConditions[cardKey];
  }

  // Returns alternate buy options for a card key.
  public getCardAlternateBuyOptions(cardKey: CardKey): CardAlternateBuyOption[] {
    return this._cardAlternateBuyOptions[cardKey] ?? [];
  }

  // Builds a fresh per-match map of card effect functions. Thin delegate.
  public createCardEffectFunctionMap(): CardEffectFunctionMap {
    return this.createFunctionMap('card');
  }

  // Builds a fresh per-match map of event effect functions. Thin delegate.
  public createEventEffectFunctionMap(): CardEffectFunctionMap {
    return this.createFunctionMap('event');
  }

  // Builds a fresh per-match map of project effect functions. Thin delegate.
  public createProjectEffectFunctionMap(): CardEffectFunctionMap {
    return this.createFunctionMap('project');
  }

  // Builds a fresh per-match map of landmark effect functions. Thin delegate.
  public createLandmarkEffectFunctionMap(): CardEffectFunctionMap {
    return this.createFunctionMap('landmark');
  }

  // Builds a fresh per-match map of way effect functions. Thin delegate.
  public createWayEffectFunctionMap(): CardEffectFunctionMap {
    return this.createFunctionMap('way');
  }

  // Returns the factory pool for a given effect kind.
  private factoriesFor(kind: ExpansionEffectKind): CardEffectFactoryMap {
    return this._effectFactoriesByKind[kind];
  }

  // Instantiates effect functions from registered factories.
  private materializeEffectMap(factories: CardEffectFactoryMap): CardEffectFunctionMap {
    return Object.keys(factories).reduce((acc, nextKey) => {
      acc[nextKey] = factories[nextKey]();
      return acc;
    }, {} as CardEffectFunctionMap);
  }
}
