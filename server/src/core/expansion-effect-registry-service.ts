import {
  CardAlternateBuyOption,
  CardEffectFactoryMap,
  CardEffectFunctionMap,
  CardExpansionActionConditionMap,
} from '@server-types/index.ts';
import { CardKey } from 'shared/types/index.ts';

// Stores expansion-registered factories/conditions and provides materialized runtime maps per match.
export class ExpansionEffectRegistryService {
  private readonly _cardEffectFactories: CardEffectFactoryMap = {};
  private readonly _eventEffectFactories: CardEffectFactoryMap = {};
  private readonly _projectEffectFactories: CardEffectFactoryMap = {};
  private readonly _landmarkEffectFactories: CardEffectFactoryMap = {};
  private readonly _wayEffectFactories: CardEffectFactoryMap = {};
  private readonly _cardActionConditions: Record<CardKey, CardExpansionActionConditionMap> = {};
  private readonly _cardAlternateBuyOptions: Record<CardKey, CardAlternateBuyOption[]> = {};

  // Registers a card effect factory by key.
  public registerCardEffectFactory(cardKey: CardKey, factory: CardEffectFactoryMap[CardKey]): void {
    this._cardEffectFactories[cardKey] = factory;
  }

  // Registers an event effect factory by key.
  public registerEventEffectFactory(cardKey: CardKey, factory: CardEffectFactoryMap[CardKey]): void {
    this._eventEffectFactories[cardKey] = factory;
  }

  // Returns true when an event effect factory already exists for this key.
  public hasEventEffectFactory(cardKey: CardKey): boolean {
    return this._eventEffectFactories[cardKey] !== undefined;
  }

  // Registers a landmark effect factory by key.
  public registerLandmarkEffectFactory(cardKey: CardKey, factory: CardEffectFactoryMap[CardKey]): void {
    this._landmarkEffectFactories[cardKey] = factory;
  }

  // Returns true when a landmark effect factory already exists for this key.
  public hasLandmarkEffectFactory(cardKey: CardKey): boolean {
    return this._landmarkEffectFactories[cardKey] !== undefined;
  }

  // Registers a project effect factory by key.
  public registerProjectEffectFactory(cardKey: CardKey, factory: CardEffectFactoryMap[CardKey]): void {
    this._projectEffectFactories[cardKey] = factory;
  }

  // Returns true when a project effect factory already exists for this key.
  public hasProjectEffectFactory(cardKey: CardKey): boolean {
    return this._projectEffectFactories[cardKey] !== undefined;
  }

  // Registers a way effect factory by key.
  public registerWayEffectFactory(cardKey: CardKey, factory: CardEffectFactoryMap[CardKey]): void {
    this._wayEffectFactories[cardKey] = factory;
  }

  // Returns true when a way effect factory already exists for this key.
  public hasWayEffectFactory(cardKey: CardKey): boolean {
    return this._wayEffectFactories[cardKey] !== undefined;
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

  // Builds a fresh per-match map of card effect functions.
  public createCardEffectFunctionMap(): CardEffectFunctionMap {
    return this.materializeEffectMap(this._cardEffectFactories);
  }

  // Builds a fresh per-match map of event effect functions.
  public createEventEffectFunctionMap(): CardEffectFunctionMap {
    return this.materializeEffectMap(this._eventEffectFactories);
  }

  // Builds a fresh per-match map of project effect functions.
  public createProjectEffectFunctionMap(): CardEffectFunctionMap {
    return this.materializeEffectMap(this._projectEffectFactories);
  }

  // Builds a fresh per-match map of landmark effect functions.
  public createLandmarkEffectFunctionMap(): CardEffectFunctionMap {
    return this.materializeEffectMap(this._landmarkEffectFactories);
  }

  // Builds a fresh per-match map of way effect functions.
  public createWayEffectFunctionMap(): CardEffectFunctionMap {
    return this.materializeEffectMap(this._wayEffectFactories);
  }

  // Instantiates effect functions from registered factories.
  private materializeEffectMap(factories: CardEffectFactoryMap): CardEffectFunctionMap {
    return Object.keys(factories).reduce((acc, nextKey) => {
      acc[nextKey] = factories[nextKey]();
      return acc;
    }, {} as CardEffectFunctionMap);
  }
}
