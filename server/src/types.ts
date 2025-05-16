import { Socket } from 'socket.io';
import {
  Card,
  CardCost,
  CardId,
  CardKey,
  CardLocation,
  CardLocationSpec,
  CardNoId,
  CardType,
  ComputedMatchConfiguration,
  CostSpec,
  EffectTarget,
  Match,
  PlayerId,
  SelectActionCardArgs,
  ServerEmitEvents,
  ServerListenEvents,
  UserPromptActionArgs,
} from 'shared/shared-types.ts';
import { toNumber } from 'es-toolkit/compat';

import { MatchCardLibrary } from './core/match-card-library.ts';
import { ReactionManager } from './core/reactions/reaction-manager.ts';
import { ExpansionData } from '@expansions/expansion-library.ts';
import { CardPriceRulesController } from './core/card-price-rules-controller.ts';
import { CardSourceController } from './core/card-source-controller.ts';

export type AppSocket = Socket<ServerListenEvents, ServerEmitEvents>;

export type DistributiveOmit<T, K extends PropertyKey> =
  T extends any ? Omit<T, K> : never;

declare module 'shared/shared-types.ts' {
  interface SelectActionCardArgs {
    restrict: FindCardsFnInput | CardId[];
    autoSelect?: boolean;
  }
}

/**
 * A base match configuration that can be used to spread default values.
 *
 * The `supply.baseCards` property contains all possible base supply card combinations for the number
 * of players in a given game.
 */
export const MatchBaseConfiguration = {
  numberOfKingdomPiles: 10,
  basicSupplyByPlayerCount: [
    {
      'province': 8,
      'duchy': 8,
      'estate': 8,
      'curse': 10,
      'gold': 30,
      'silver': 40,
      'copper': 60,
    },
    {
      'province': 12,
      'duchy': 12,
      'estate': 12,
      'curse': 20,
      'gold': 30,
      'silver': 40,
      'copper': 60,
    },
    {
      'province': 12,
      'duchy': 12,
      'estate': 12,
      'curse': 30,
      'gold': 30,
      'silver': 40,
      'copper': 60,
    },
    {
      'province': 15,
      'duchy': 12,
      'estate': 12,
      'curse': 40,
      'gold': 60,
      'silver': 80,
      'copper': 120,
    },
    {
      'province': 18,
      'duchy': 12,
      'estate': 12,
      'curse': 50,
      'gold': 60,
      'silver': 80,
      'copper': 120,
    },
    {
      'province': 18,
      'duchy': 12,
      'estate': 12,
      'curse': 50,
      'gold': 60,
      'silver': 80,
      'copper': 120,
    },
  ],
  playerStartingHand: {
    'copper': 7,
    'estate': 3,
  },
} as const;

export interface LifecycleSuppression {
  events?: CardLifecycleEvent[];
}

export type GameActionContext = {
  loggingContext?: {
    suppress?: boolean;
    source?: CardId;
  };
  suppressLifeCycle?: LifecycleSuppression;
};

export interface BaseGameActionDefinitionMap {
  buyCard: (args: {
    cardId: CardId | Card;
    playerId: PlayerId,
    cardCost: CardCost,
    overpay?: { inTreasure: number; inCoffer: number; }
  }) => Promise<void>;
  checkForRemainingPlayerActions: () => Promise<void>;
  exchangeCoffer: (args: { playerId: PlayerId; count: number; }) => Promise<void>;
  discardCard: (args: { cardId: CardId | Card, playerId: PlayerId }, context?: GameActionContext) => Promise<void>;
  drawCard: (args: { playerId: PlayerId, count?: number }, context?: GameActionContext) => Promise<CardId[] | null>
  endTurn: () => Promise<void>;
  gainAction: (args: { count: number }, context?: GameActionContext) => Promise<void>;
  gainBuy: (args: { count: number }, context?: GameActionContext) => Promise<void>;
  gainCoffer: (args: { playerId: PlayerId; count: number; }, context?: GameActionContext) => Promise<void>;
  gainCard: (args: {
    playerId: PlayerId,
    cardId: CardId | Card,
    to: CardLocationSpec
  }, context?: GameActionContext & { bought?: boolean, overpay?: number }) => Promise<void>;
  gainPotion: (args: { count: number }) => Promise<void>;
  gainTreasure: (args: { count: number }, context?: GameActionContext) => Promise<void>;
  gainVictoryToken: (args: { playerId: PlayerId; count: number; }, context?: GameActionContext) => Promise<void>;
  moveCard: (args: {
    toPlayerId?: PlayerId,
    cardId: CardId | Card,
    to: CardLocationSpec
  }) => Promise<{ location: CardLocation; playerId?: PlayerId; } | undefined>;
  nextPhase: () => Promise<void>;
  playCard: (args: {
    playerId: PlayerId,
    cardId: CardId | Card,
    overrides?: GameActionOverrides
  }, context?: GameActionContext) => Promise<void>;
  revealCard: (args: {
    cardId: CardId | Card,
    playerId: PlayerId,
    moveToSetAside?: boolean
  }, context?: GameActionContext) => Promise<void>;
  selectCard: (args: SelectActionCardArgs) => Promise<CardId[]>;
  shuffleDeck: (args: { playerId: PlayerId }, context?: GameActionContext) => Promise<void>;
  trashCard: (args: { cardId: CardId | Card, playerId: PlayerId }, context?: GameActionContext) => Promise<void>;
  userPrompt: (args: UserPromptActionArgs) => Promise<unknown>;
}

export interface GameActionDefinitionMap extends BaseGameActionDefinitionMap {
  [key: string]: (...args: any[]) => Promise<any>;
}

export type GameActions = keyof GameActionDefinitionMap;

export type GameActionArgsMap = {
  [K in GameActions]: Parameters<GameActionDefinitionMap[K]>[0];
};

export type GameActionContextMap = {
  [K in GameActions]: Parameters<GameActionDefinitionMap[K]>[1];
};

export type GameActionReturnTypeMap = {
  [K in GameActions]: Awaited<ReturnType<GameActionDefinitionMap[K]>>;
};

export type RunGameActionDelegate = <K extends GameActions>(
  action: K,
  ...args: Parameters<GameActionDefinitionMap[K]>
) => Promise<GameActionReturnTypeMap[K]>;

export type ReactionContext = any;

export type CardEffectFn = (context: CardEffectFunctionContext) => Promise<void>;

export type CardEffectFactory = () => CardEffectFn;

export type CardEffectFactoryMap = Record<CardKey, CardEffectFactory>;

export interface AppContext {
  cardSourceController: CardSourceController;
  cardPriceController: CardPriceRulesController;
  match: Match;
  reactionManager: ReactionManager;
  reactionContext?: ReactionContext;
  cardLibrary: MatchCardLibrary;
  findCards: FindCardsFn;
}

export type CostFindCardsFilter = CostSpec;

export interface CardDataFindCardsFilter {
  tags?: string | string[];
  cardKeys?: CardKey | CardKey[];
  cardType?: CardType | CardType[];
  owner?: PlayerId;
  kingdom?: string;
}

export interface SourceFindCardsFilter {
  location: CardLocation | CardLocation[];
  playerId?: PlayerId;
}

export type NonLocationFilters = CostFindCardsFilter | CardDataFindCardsFilter;

export type FindCardsFnFactory = (cardSourceController: CardSourceController, cardCostController: CardPriceRulesController, cardLibrary: MatchCardLibrary) => FindCardsFn;

export type FindCardsFnInput =
  | NonLocationFilters[]
  | SourceFindCardsFilter
  | NonLocationFilters
  | [SourceFindCardsFilter, ...NonLocationFilters[]];


export type FindCardsFn = (filters: FindCardsFnInput) => Card[];

export function isSourceFindCardsFilter(filter: unknown): filter is SourceFindCardsFilter {
  return (
    typeof filter === 'object' &&
    filter !== null &&
    'location' in filter
  );
}

export function isCostFindCardsFilter(filter: unknown): filter is CostFindCardsFilter {
  return (
    typeof filter === 'object' &&
    filter !== null &&
    'kind' in filter &&
    'playerId' in filter &&
    'amount' in filter
  );
}

export function isCardDataFindCardsFilter(filter: unknown): filter is CardDataFindCardsFilter {
  return (
    typeof filter === 'object' &&
    filter !== null &&
    (
      'tags' in filter ||
      'cardKeys' in filter ||
      'cardType' in filter ||
      'owner' in filter
    )
  );
}

export interface CardEffectFunctionContext extends AppContext {
  playerId: PlayerId;
  cardId: CardId;
  runGameActionDelegate: RunGameActionDelegate;
}

export type CardTriggeredEffectFn<T extends TriggerEventType> = (context: TriggeredEffectContext<T>) => Promise<any>;

type CardTriggerEffectConditionFn<T extends TriggerEventType> = (context: TriggeredEffectConditionContext<T>) => boolean | Promise<boolean>;

export type CardEffectFunction = (context: CardEffectFunctionContext) => Promise<void>;

export type CardEffectFunctionMap =
  Record<CardKey, CardEffectFunction>;

export interface CardScoringFnContext extends AppContext {
  ownerId: number;
}

export type ExpansionConfiguratorContext = InitializeExpansionContext & {
  config: ComputedMatchConfiguration;
  /**
   * This is the *entire* library of cards. This *should* be pristine data loaded from expansions
   */
  cardLibrary: Record<CardKey, CardNoId>;
  expansionData: ExpansionData;
};

export type ExpansionConfigurator = (args: ExpansionConfiguratorContext) => Promise<ComputedMatchConfiguration>;
export type ExpansionConfiguratorFactory = () => ExpansionConfigurator;

export type CardScoringFunction = (args: CardScoringFnContext) => number;

export type CardExpansionActionConditionMap = {
  canBuy?: (args: { match: Match, cardLibrary: MatchCardLibrary, playerId: PlayerId }) => boolean
};

export interface CardExpansionModule {
  [p: CardKey]: {
    registerActionConditions?: () => CardExpansionActionConditionMap;
    registerLifeCycleMethods?: () => CardLifecycleCallbackMap;
    registerScoringFunction?: () => CardScoringFunction;
    registerEffects?: CardEffectFactory;
  }
}

export type GameActionOverrides = {
  actionCost?: number,
  moveCard?: boolean,
  playCard?: boolean,
};

export class ReactionTrigger<T extends TriggerEventType = TriggerEventType> {
  eventType: T;
  
  args: TriggerEventTypeContext[T];
  
  constructor(eventType: T, ...rest: TriggerEventTypeContext[T] extends void ? [] : [TriggerEventTypeContext[T]]) {
    this.eventType = eventType;
    this.args = (rest[0] ?? undefined) as TriggerEventTypeContext[T];
  }
  
  toString() {
    return `[TRIGGER ${this.eventType}]`;
  }
  
  // @ts-ignore
  [Symbol.for('Deno.customInspect')]() {
    return this.toString();
  }
}

export interface TriggeredEffectContext<T extends TriggerEventType> extends AppContext {
  trigger: ReactionTrigger<T>;
  reaction: Reaction;
  runGameActionDelegate: RunGameActionDelegate;
  isRootLog?: boolean;
}

export interface TriggeredEffectConditionContext<T extends TriggerEventType> extends AppContext {
  trigger: ReactionTrigger<T>;
  reaction: Reaction;
  runGameActionDelegate: RunGameActionDelegate;
}

export type TriggerEventTypeContext = {
  cardTrashed: {
    cardId: CardId;
    playerId: PlayerId;
    previousLocation: { location: CardLocation; playerId?: PlayerId; };
  };
  cardPlayed: { playerId: PlayerId; cardId: CardId; };
  startTurn: { playerId: PlayerId; turnNumber: number; };
  cardGained: {
    playerId: PlayerId;
    cardId: CardId;
    bought: boolean;
    previousLocation?: { location: CardLocation; playerId?: PlayerId; };
  };
  endTurnPhase: { phaseIndex: number; };
  startTurnPhase: { phaseIndex: number; };
  endTurn: void;
  discardCard: {
    previousLocation: { location: CardLocation; playerId?: PlayerId; };
    playerId: PlayerId;
    cardId: CardId;
  };
}

export type TriggerEventType = keyof TriggerEventTypeContext;

export class Reaction<T extends TriggerEventType = TriggerEventType> {
  // a concatenation of the card key and card id with a '-'
  public id: string;
  
  // the player's ID who owns this reaction - the one that can decide to do it.
  public playerId: number;
  
  public listeningFor: T;
  
  /**
   * Indicates the triggered effect only happens once for this particular instance of the reaction.
   *
   * @default false
   */
  public once?: boolean = false;
  
  /**
   * Indicates that the triggered effect happens regardless of user choice.
   *
   * @default false
   */
  public compulsory?: boolean = false;
  
  /**
   * Indicates that the reaction can be used by multiple different instances of the same card.
   *
   * @default true
   */
  public allowMultipleInstances?: boolean = true;
  
  public extraData?: any;
  
  // todo working on moat right now which has no condition other than it be an attack.
  // in the future we might need to define this condition method elsewhere such as
  // in the expansion's module? need to wait to see what kind of conditions there are i think
  public condition?: CardTriggerEffectConditionFn<T>
  
  // todo defined in a map somewhere just like registered card effects. so maybe another export
  // from teh expansion module that defines what happens when you ccn react?
  public triggeredEffectFn: CardTriggeredEffectFn<T>;
  
  constructor(arg: ReactionTemplate<T>) {
    this.id = arg.id;
    this.playerId = arg.playerId;
    this.listeningFor = arg.listeningFor;
    this.condition = arg.condition ?? (() => true);
    this.triggeredEffectFn = arg.triggeredEffectFn;
    this.once = arg.once ?? false;
    this.allowMultipleInstances = arg.allowMultipleInstances ?? true;
    this.compulsory = arg.compulsory ?? false;
  }
  
  public getBaseId() {
    return `${this.getSourceKey()}:${this.getSourceId()}`;
  }
  
  public getSourceKey() {
    let out;
    try {
      out = this.id.split(':')?.[0];
      return out;
    } catch (e) {
      throw e;
    }
  }
  
  public getSourceId() {
    let out;
    try {
      out = toNumber(this.id.split(':')?.[1]);
      return out;
    } catch (e) {
      throw e;
    }
  }
  
  toString() {
    return `[REACTION ${this.id} - owner {${this.playerId}}]`;
  }
  
  // @ts-ignore
  [Symbol.for('Deno.customInspect')]() {
    return this.toString();
  }
}

export type ReactionTemplate<T extends TriggerEventType = TriggerEventType> = Omit<Reaction<T>, 'getSourceId' | 'getSourceKey' | 'getBaseId'>;

export type GameLifecycleCallbackContext = AppContext & {
  cardId: CardId,
  runGameActionDelegate: RunGameActionDelegate;
}

export type GameLifecycleCallback = (args: Omit<GameLifecycleCallbackContext, 'cardId'>, ...rest: any[]) => Promise<CardLifecycleCallbackResult | void>;
export type CardGameLifeCycleCallback = (args: GameLifecycleCallbackContext, ...rest: any[]) => Promise<void>;

export type GameLifecycleEvent =
  | 'onGameStart'
  | 'onCardGained';

export type GameLifeCycleEventArgsMap = {
  onGameStart: { match: Match };
  onCardGained: { cardId: CardId, playerId: PlayerId, match: Match }
}

export type CardLifecycleCallbackContext = AppContext & {
  runGameActionDelegate: RunGameActionDelegate;
}

export type CardLifecycleEvent =
  | 'onGained'
  | 'onTrashed'
  | 'onDiscarded'
  | 'onEnterHand'
  | 'onLeaveHand'
  | 'onEnterPlay'
  | 'onLeavePlay'
  | 'onCardPlayed';

export interface CardLifecycleCallbackMap {
  onTrashed?: CardLifecycleCallback<'onTrashed'>;
  onGained?: CardLifecycleCallback<'onGained'>;
  onDiscarded?: CardLifecycleCallback<'onDiscarded'>;
  onEnterHand?: CardLifecycleCallback<'onEnterHand'>;
  onLeaveHand?: CardLifecycleCallback<'onLeaveHand'>;
  onEnterPlay?: CardLifecycleCallback<'onEnterPlay'>;
  onLeavePlay?: CardLifecycleCallback<'onLeavePlay'>;
  onCardPlayed?: CardLifecycleCallback<'onCardPlayed'>;
}

export interface CardLifecycleEventArgMap {
  onGained: { playerId: PlayerId, cardId: CardId, bought: boolean; };
  onTrashed: {
    playerId: PlayerId,
    cardId: CardId,
    previousLocation?: { location: CardLocation; playerId?: PlayerId; }
  };
  onDiscarded: {
    playerId: PlayerId,
    cardId: CardId,
    previousLocation?: { location: CardLocation; playerId?: PlayerId; }
  };
  onEnterHand: { playerId: PlayerId, cardId: CardId };
  onLeaveHand: { playerId: PlayerId, cardId: CardId };
  onEnterPlay: { playerId: PlayerId, cardId: CardId };
  onLeavePlay: { cardId: CardId };
  onCardPlayed: { playerId: PlayerId, cardId: CardId };
}

export type CardLifecycleCallbackResult = {
  registerTriggeredEvents?: ReactionTemplate[];
  unregisterTriggeredEvents?: string[];
};

export type CardLifecycleCallback<T extends CardLifecycleEvent> = (args: CardLifecycleCallbackContext, rest: CardLifecycleEventArgMap[T]) => Promise<CardLifecycleCallbackResult | void>;

export type CardEffectRegistrar = (cardKey: CardKey, tag: string, fn: CardEffectFn) => void;

export type PlayerScoreDecoratorRegistrar = (decorator: PlayerScoreDecorator) => void;
export type PlayerScoreDecorator = (playerId: PlayerId, match: Match) => void;

export type EndGameConditionFnContext = AppContext;
export type EndGameConditionFn = (args: EndGameConditionFnContext) => boolean;
export type EndGameConditionRegistrar = (endGameConditionFn: EndGameConditionFn) => void;

export type ClientEventRegistrar = <T extends keyof ServerListenEvents>(event: T, eventHandler: ServerListenEvents[T]) => void;
export type ClientEventRegistry = (registrar: ClientEventRegistrar, context: {
  match: Match,
  runGameActionDelegate: RunGameActionDelegate,
}) => void;

export type GameEventRegistrar = (event: GameLifecycleEvent, handler: GameLifecycleCallback) => void;

export type InitializeExpansionContext = {
  cardSourceController: CardSourceController,
  gameEventRegistrar: GameEventRegistrar,
  match: Match;
  clientEventRegistrar: ClientEventRegistrar;
  endGameConditionRegistrar: EndGameConditionRegistrar;
  playerScoreDecoratorRegistrar: PlayerScoreDecoratorRegistrar;
  cardEffectRegistrar: CardEffectRegistrar;
}