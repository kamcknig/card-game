import { Socket } from 'socket.io';
import {
  Card,
  CardCost,
  CardDataFindCardsFilter,
  CardFacing,
  CardId,
  CardKey,
  CardLikeId,
  CardLocation,
  CardLocationSpec,
  CardNoId,
  ComputedMatchConfiguration,
  CostFindCardsFilter,
  ExtraTurn,
  FindCardsFnInput,
  Match,
  NonLocationFilters,
  PlayerId,
  SelectActionCardArgs,
  SelectSingleActionCardArgs,
  ServerEmitEvents,
  ServerListenEvents,
  SourceFindCardsFilter,
  TokenDefinition,
  TokenFacing,
  TokenId,
  TokenInstance,
  TokenInstanceId,
  TokenLocation,
  TurnPhase,
  UserPromptActionArgs,
} from 'shared/types/index.ts';
import { toNumber } from 'es-toolkit/compat';

import { MatchCardLibrary } from './core/match-card-library.ts';
import { ReactionManager } from './core/reactions/reaction-manager.ts';
import { ExpansionData, ExpansionDataLibrary } from '@expansions/expansion-library.ts';
import { CardPriceRulesController } from './core/card-price-rules-controller.ts';
import { CardSourceController } from './core/card-source-controller.ts';
import { LogManager } from './core/log-manager.ts';
import type { CardInstanceFactoryService } from './core/card-instance-factory-service.ts';
import type { RngService } from './core/rng-service.ts';
import type { LoggerService } from './core/logger-service.ts';

export type AppSocket = Socket<ServerListenEvents, ServerEmitEvents>;

export type DistributiveOmit<T, K extends PropertyKey> = T extends any ? Omit<T, K> : never;

// Re-export shared find-card filter types used by server consumers.
export type {
  CardDataFindCardsFilter,
  CostFindCardsFilter,
  FindCardsFnInput,
  NonLocationFilters,
  SourceFindCardsFilter,
};

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
  numberOfEventsAndOthers: 2,
} as const;

export interface LifecycleSuppression {
  events?: CardLifecycleEvent[];
}

export interface OnGainedLifecycleContext {
  // Card that initiated the gain, if any.
  sourceCardId?: CardId;
}

export type GameActionContext = {
  loggingContext?: {
    suppress?: boolean;
    source?: CardId;
  };
  suppressLifeCycle?: LifecycleSuppression;
  // Ephemeral lifecycle payload passed only for this specific action call.
  lifecycleContext?: {
    onGained?: OnGainedLifecycleContext;
  };
};

export interface GameActionDefinitionMap {
  buyCard: (args: {
    cardId: CardId | Card;
    playerId: PlayerId;
    cardCost: CardCost;
    buyOptionId?: string;
    overpay?: { inTreasure: number; inCoffer: number };
  }) => Promise<void>;
  buyEvent: (args: {
    cardLikeId: CardLikeId;
    playerId: PlayerId;
  }) => Promise<void>;
  buyProject: (args: {
    cardLikeId: CardLikeId;
    playerId: PlayerId;
  }) => Promise<void>;
  checkForRemainingPlayerActions: () => Promise<void>;
  exchangeCoffer: (args: { playerId: PlayerId; count: number }) => Promise<void>;
  discardCard: (args: { cardId: CardId | Card; playerId: PlayerId }, context?: GameActionContext) => Promise<void>;
  drawCard: (
    args: { playerId: PlayerId; count?: number; suppressReactions?: boolean },
    context?: GameActionContext,
  ) => Promise<CardId | CardId[] | null>;
  // Draws a hand of cards (default 5), triggering drawHand reactions.
  drawHand: (args: { playerId: PlayerId; count?: number }, context?: GameActionContext) => Promise<CardId[] | null>;
  endTurn: () => Promise<void>;
  // Moves a card to the player's Exile mat without treating it as gain/trash.
  exileCard: (args: { cardId: CardId | Card; playerId: PlayerId }, context?: GameActionContext) => Promise<void>;
  gainAction: (args: { count: number }, context?: GameActionContext) => Promise<void>;
  gainBuy: (args: { count: number }, context?: GameActionContext) => Promise<void>;
  gainCoffer: (args: { playerId: PlayerId; count: number }, context?: GameActionContext) => Promise<void>;
  // Adds Villagers tokens to a player (Renaissance).
  gainVillager: (args: { playerId: PlayerId; count: number }, context?: GameActionContext) => Promise<void>;
  // Adds debt tokens to a player (used by Empires-style costs/effects).
  gainDebt: (args: { playerId: PlayerId; count: number }, context?: GameActionContext) => Promise<void>;
  // Spends Villagers tokens to gain actions.
  spendVillager: (args: { playerId: PlayerId; count: number }, context?: GameActionContext) => Promise<void>;
  gainCard: (args: {
    playerId: PlayerId;
    cardId: CardId | Card;
    to: CardLocationSpec;
  }, context?: GameActionContext & { bought?: boolean; overpay?: number }) => Promise<void>;
  gainPotion: (args: { count: number }) => Promise<void>;
  gainTreasure: (args: { count: number }, context?: GameActionContext) => Promise<void>;
  gainVictoryToken: (args: { playerId: PlayerId; count: number }, context?: GameActionContext) => Promise<void>;
  // adds a turn to the extra turn queue
  queueExtraTurn: (args: { turn: ExtraTurn }) => Promise<void>;
  // Receives a boon from the shared boon deck (used by Fate cards).
  receiveBoon: (
    args: { playerId: PlayerId; immediate?: boolean; boonId?: CardLikeId; keepSetAside?: boolean },
    context?: GameActionContext,
  ) => Promise<CardLikeId | undefined>;
  // Receives a hex from the shared hex deck (used by Doom cards).
  receiveHex: (
    args: { playerId: PlayerId; hexId?: CardLikeId },
    context?: GameActionContext,
  ) => Promise<CardLikeId | undefined>;
  // Assigns a state to a player (used by state-granting cards).
  gainState: (
    args: { playerId: PlayerId; stateId?: CardLikeId; stateKey?: CardKey; removeFromCurrentOwner?: boolean },
    context?: GameActionContext,
  ) => Promise<CardLikeId | undefined>;
  // Removes a state from a player (used by state cleanup and effects).
  removeState: (
    args: { playerId: PlayerId; stateId?: CardLikeId; stateKey?: CardKey },
    context?: GameActionContext,
  ) => Promise<void>;
  // Assigns an artifact to a player (used by artifact-granting cards).
  gainArtifact: (
    args: { playerId: PlayerId; artifactId?: CardLikeId; artifactKey?: CardKey },
    context?: GameActionContext,
  ) => Promise<CardLikeId | undefined>;
  // Removes an artifact from a player (used by artifact cleanup and effects).
  removeArtifact: (
    args: { playerId: PlayerId; artifactId?: CardLikeId; artifactKey?: CardKey },
    context?: GameActionContext,
  ) => Promise<void>;
  // Pays down debt tokens using the current player's treasure pool.
  payDebt: (args: { playerId: PlayerId; count: number }, context?: GameActionContext) => Promise<void>;
  // Expansions use token actions to place and manage token instances.
  placeToken: (args: {
    tokenId: TokenId;
    location: TokenLocation;
    ownerId?: PlayerId;
    counters?: number;
    facing?: TokenFacing;
    sourceCardId?: CardId;
  }, context?: GameActionContext) => Promise<TokenInstance>;
  // Expansions use token actions to place and manage token instances.
  moveToken: (args: {
    tokenInstanceId: TokenInstanceId;
    location: TokenLocation;
    ownerId?: PlayerId;
  }, context?: GameActionContext) => Promise<void>;
  // Expansions use token actions to place and manage token instances.
  removeToken: (args: { tokenInstanceId: TokenInstanceId }, context?: GameActionContext) => Promise<void>;
  // Expansions use token actions to place and manage token instances.
  consumeToken: (args: {
    tokenInstanceId: TokenInstanceId;
    amount?: number;
  }, context?: GameActionContext) => Promise<void>;
  // Expansions use token actions to place and manage token instances.
  flipToken: (args: {
    tokenInstanceId: TokenInstanceId;
    facing: TokenFacing;
  }, context?: GameActionContext) => Promise<void>;
  moveCard: (args: {
    toPlayerId?: PlayerId;
    cardId: CardId | Card;
    to: CardLocationSpec;
    // Optional facing update applied when the card moves.
    facing?: CardFacing;
  }) => Promise<{ location: CardLocation; playerId?: PlayerId } | undefined>;
  // Moves a card-like (boon/event/landmark) to a supported location.
  moveCardLike: (args: {
    toPlayerId?: PlayerId;
    cardLikeId: CardLikeId;
    to: CardLocationSpec;
  }) => Promise<{ location: CardLocation; playerId?: PlayerId } | undefined>;
  // Sets the current turn phase without advancing the turn counter.
  setTurnPhase: (args: {
    phase: TurnPhase;
    playerId?: PlayerId;
    endCurrentPhase?: boolean;
    startNewPhase?: boolean;
  }) => Promise<void>;
  nextPhase: () => Promise<void>;
  playCard: (args: {
    playerId: PlayerId;
    cardId: CardId | Card;
    overrides?: GameActionOverrides;
  }, context?: GameActionContext) => Promise<void>;
  revealCard: (args: {
    cardId?: CardId | Card;
    playerId: PlayerId;
    // Optional source to reveal from when cardId is not provided.
    source?: 'playerDeck' | 'playerDiscard';
    moveToSetAside?: boolean;
  }, context?: GameActionContext) => Promise<CardId | undefined>;
  selectCard: (args: SelectActionCardArgs) => Promise<CardId[]>;
  selectSingleCard: (args: SelectSingleActionCardArgs) => Promise<CardId | null>;
  // Generic shuffle action for cards and card-likes; does not add UI log entries.
  shuffle: (
    args: { playerId?: PlayerId; cardIds?: CardId[]; cardLikeIds?: CardLikeId[] },
    context?: GameActionContext,
  ) => Promise<void>;
  shuffleDeck: (args: { playerId: PlayerId; includeDiscard?: boolean }, context?: GameActionContext) => Promise<void>;
  // Shuffles a card-like deck such as boons or hexes.
  shuffleCardLike: (
    args: { kind: 'boon' | 'hex'; includeDiscard?: boolean; playerId?: PlayerId },
    context?: GameActionContext,
  ) => Promise<void>;
  trashCard: (args: { cardId: CardId | Card; playerId: PlayerId }, context?: GameActionContext) => Promise<void>;
  userPrompt: (args: UserPromptActionArgs) => Promise<unknown | null>;
}

export type GameActions = keyof GameActionDefinitionMap;

export type GameActionContextMap = {
  [K in GameActions]: Parameters<GameActionDefinitionMap[K]>[1];
};

export type GameActionReturnTypeMap = {
  [K in GameActions]: Awaited<ReturnType<GameActionDefinitionMap[K]>>;
};

type GameActionRunnerBase = <K extends GameActions>(
  action: K,
  ...args: Parameters<GameActionDefinitionMap[K]>
) => Promise<GameActionReturnTypeMap[K]>;

export type GameActionRunner = GameActionRunnerBase & {
  (
    action: 'drawCard',
    args: { playerId: PlayerId; count?: 1; suppressReactions?: boolean },
    context?: GameActionContext,
  ): Promise<CardId | null>;
  (
    action: 'drawCard',
    args: { playerId: PlayerId; count: number; suppressReactions?: boolean },
    context?: GameActionContext,
  ): Promise<CardId[] | null>;
  (
    action: 'selectCard',
    args: SelectActionCardArgs,
  ): Promise<CardId[]>;
  (
    action: 'selectSingleCard',
    args: Omit<SelectSingleActionCardArgs, 'count'>,
  ): Promise<CardId | null>;
  (
    action: 'selectSingleCard',
    args: Omit<SelectSingleActionCardArgs, 'count'> & { count: 1 },
  ): Promise<CardId | null>;
  (
    action: 'selectSingleCard',
    args: Omit<SelectSingleActionCardArgs, 'count'> & { count: { kind: 'exact'; count: 1 } },
  ): Promise<CardId | null>;
  (
    action: 'selectSingleCard',
    args: Omit<SelectSingleActionCardArgs, 'count'> & { count: { kind: 'upTo'; count: 1 } },
  ): Promise<CardId | null>;
  <TUserPromptResult = unknown>(
    action: 'userPrompt',
    args: UserPromptActionArgs,
  ): Promise<TUserPromptResult | null>;
};

export type ActionService = {
  run: GameActionRunner;
};

export type PromptService = {
  request<TResult = unknown>(args: UserPromptActionArgs): Promise<TResult | null>;
  requestAction(args: UserPromptActionArgs): Promise<number | null>;
  chooseOne(args: UserPromptActionArgs): Promise<number | null>;
  confirm(args: UserPromptActionArgs, confirmAction?: number): Promise<boolean>;
  requestNumberInput(args: UserPromptActionArgs, confirmAction?: number): Promise<number | null>;
  selectCardsFromPrompt(args: UserPromptActionArgs): Promise<CardId[]>;
  selectSingleCardFromPrompt(args: UserPromptActionArgs): Promise<CardId | null>;
  selectSingleCardFromAction(args: SelectSingleActionCardArgs): Promise<CardId | null>;
  requestActionResult<TResult = unknown>(
    args: UserPromptActionArgs,
  ): Promise<{ action: number; result: TResult | undefined } | null>;
  requestResult<TResult = unknown>(args: UserPromptActionArgs): Promise<TResult | null>;
};

export type ReactionContext = {
  // Track per-player immunity flags for the current trigger.
  immunityByPlayerId?: Partial<Record<PlayerId, true>>;
  // Captures the trigger scope that initialized the reaction context.
  immunityScope?: string;
};

export type CardEffectFn = (context: CardEffectFunctionContext) => Promise<void>;

export type CardEffectFactory = () => CardEffectFn;

export type CardEffectFactoryMap = Record<CardKey, CardEffectFactory>;

export interface AppContext {
  cardSourceController: CardSourceController;
  cardPriceController: CardPriceRulesController;
  logManager: LogManager;
  loggerService: LoggerService;
  rngService: RngService;
  match: Match;
  reactionManager: ReactionManager;
  reactionContext?: ReactionContext;
  cardLibrary: MatchCardLibrary;
  findCardService: FindCardService;
  supplyGainService: SupplyGainService;
  promptService: PromptService;
}

export type FindCardsFn = (filters: FindCardsFnInput) => Card[];
export type FindCardService = {
  findCards: FindCardsFn;
  getCardsInPlay: () => Card[];
  getRemainingSupplyCount: () => number;
  findTopSupplyCardForPileKey: (args: {
    pileKey: CardKey;
    from?: ('basicSupply' | 'kingdomSupply') | ('basicSupply' | 'kingdomSupply')[];
  }) => Card | undefined;
};

export type SupplyGainService = {
  gainTopSupplyCardForPileKey: (args: {
    playerId: PlayerId;
    pileKey: CardKey;
    to: CardLocationSpec;
    from?: ('basicSupply' | 'kingdomSupply') | ('basicSupply' | 'kingdomSupply')[];
    logTag?: string;
  }) => Promise<CardId | undefined>;
};

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
  actionService: ActionService;
  // Registers duration triggers with engine-managed cleanup for the given card.
  registerDurationEffect: <T extends TriggerEventType>(
    card: Card,
    triggeredTemplate: ReactionTemplate<T> | ReactionTemplate<T>[],
    options?: DurationEffectOptions,
  ) => string[];
}

// Options for duration cards that persist across multiple cleanup phases.
export type DurationEffectOptions = {
  cleanupCount?: number;
  // When true, remove all registered duration triggers once cleanup is exhausted.
  autoRemoveTriggersOnExhaust?: boolean;
};

export type CardTriggeredEffectFn<T extends TriggerEventType> = (context: TriggeredEffectContext<T>) => Promise<void>;

type CardTriggerEffectConditionFn<T extends TriggerEventType> = (
  context: TriggeredEffectConditionContext<T>,
) => boolean | Promise<boolean>;

export type CardEffectFunction = (context: CardEffectFunctionContext) => Promise<void>;

// Effect maps are sparse; only registered card keys are populated.
export type CardEffectFunctionMap = Partial<Record<CardKey, CardEffectFunction>>;

export interface CardScoringFnContext extends AppContext {
  ownerId: number;
}

export type ExpansionConfiguratorContext = InitializeExpansionContext & {
  config: ComputedMatchConfiguration;
  /**
   * This is the *entire* library of cards. This *should* be pristine data loaded from expansions
   */
  cardLibrary: Record<CardKey, CardNoId>;
  // Loaded expansion metadata keyed by expansion name.
  expansionCatalog: ExpansionDataLibrary;
  expansionData: ExpansionData;
};

export type ExpansionConfigurator = (args: ExpansionConfiguratorContext) => Promise<ComputedMatchConfiguration>;
export type ExpansionConfiguratorFactory = () => ExpansionConfigurator;

export type CardScoringFunction = (args: CardScoringFnContext) => number;

export type CardExpansionActionConditionMap = {
  canBuy?: (args: { match: Match; cardLibrary: MatchCardLibrary; playerId: PlayerId }) => boolean;
};

// Shared context for checking whether an alternate buy option can currently be bought.
export type CardAlternateBuyOptionCanBuyContext = {
  match: Match;
  playerId: PlayerId;
  card: Card;
  cardLibrary: MatchCardLibrary;
  findCardService: FindCardService;
  cardSourceController: CardSourceController;
  cardPriceController: CardPriceRulesController;
};

// Runtime context for applying an alternate buy option.
export type CardAlternateBuyOptionApplyContext = CardAlternateBuyOptionCanBuyContext & {
  actionService: ActionService;
  promptService: PromptService;
  reactionManager: ReactionManager;
  logManager: LogManager;
};

// Optional summary data returned after applying an alternate buy option.
export type CardAlternateBuyOptionApplyResult = {
  paidTreasure?: number;
  successful?: boolean;
};

// Defines a non-standard way to pay for buying a card.
export type CardAlternateBuyOption = {
  id: string;
  label: string;
  canBuy: (args: CardAlternateBuyOptionCanBuyContext) => boolean;
  apply: (args: CardAlternateBuyOptionApplyContext) => Promise<CardAlternateBuyOptionApplyResult | void>;
};

export interface CardExpansionModule {
  [p: CardKey]: {
    registerActionConditions?: () => CardExpansionActionConditionMap;
    registerAlternateBuyOptions?: () => CardAlternateBuyOption[];
    registerLifeCycleMethods?: () => CardLifecycleCallbackMap;
    registerScoringFunction?: () => CardScoringFunction;
    registerEffects?: CardEffectFactory;
  };
}

export type GameActionOverrides = {
  actionCost?: number;
  moveCard?: boolean;
  playCard?: boolean;
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

  [Symbol.for('Deno.customInspect')]() {
    return this.toString();
  }
}

export interface TriggeredEffectContext<T extends TriggerEventType> extends AppContext {
  trigger: ReactionTrigger<T>;
  reaction: Reaction;
  actionService: ActionService;
  isRootLog?: boolean;
}

export interface TriggeredEffectConditionContext<T extends TriggerEventType> extends AppContext {
  trigger: ReactionTrigger<T>;
  reaction: Reaction;
  actionService: ActionService;
}

export type TriggerEventTypeContext = {
  afterCardPlayed: {
    cardId: CardId;
    playerId: PlayerId;
  };
  treasureGain: {
    playerId: PlayerId;
    count: number;
    // Optional source card for token/log attribution.
    source?: CardId;
  };
  actionGain: {
    playerId: PlayerId;
    count: number;
    // Optional source card for token/log attribution.
    source?: CardId;
  };
  drawHand: {
    playerId: PlayerId;
    count: number;
    // Optional source card for token/log attribution.
    source?: CardId;
  };
  drawCards: {
    playerId: PlayerId;
    count: number;
    // Optional source card for token/log attribution.
    source?: CardId;
  };
  cardTrashed: {
    cardId: CardId;
    playerId: PlayerId;
    previousLocation: { location: CardLocation; playerId?: PlayerId };
    // Optional source card-like for trigger attribution.
    source?: CardId;
  };
  cardPlayed: { playerId: PlayerId; cardId: CardId };
  // Triggered at the start of a player's turn
  startTurn: { playerId: PlayerId; turnNumber: number };
  cardGained: {
    playerId: PlayerId;
    cardId: CardId;
    bought: boolean;
    previousLocation?: { location: CardLocation; playerId?: PlayerId };
    // Destination where the card was gained before any cardGained reactions resolve.
    gainedLocation?: { location: CardLocation; playerId?: PlayerId };
  };
  // Triggered on the end of each phase of a player's turn
  endTurnPhase: { phaseIndex: number; playerId: PlayerId };
  // Triggered on the start of each phase of a player's turn
  startTurnPhase: { phaseIndex: number };
  // Triggered when cards/card-likes are shuffled for a specific player.
  shuffle: {
    playerId: PlayerId;
    cardIds?: CardId[];
    cardLikeIds?: CardLikeId[];
    // Optional source card for token/log attribution.
    source?: CardId;
  };
  // Triggered at the end of each player's turn
  endTurn: {
    playerId: PlayerId;
    turnNumber: number;
  };
  discardCard: {
    previousLocation: { location: CardLocation; playerId?: PlayerId };
    playerId: PlayerId;
    cardId: CardId;
  };
};

export type TriggerEventType = keyof TriggerEventTypeContext;

// Explicit metadata for reaction sources used in prompts and logging.
export type ReactionSourceType = 'card' | 'event' | 'landmark' | 'project' | 'token' | 'other';

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
   * Indicates that the triggered effect happens regardless of game state and user interaction. The user will still
   * be able to choose the order in which reactions occur if they occur on the same trigger. To disable that,
   * `autoResolve` must be true
   *
   * @default false
   */
  public system?: boolean = false;

  /**
   * Indicates the reaction should auto-resolve without prompting the player.
   *
   * @default false
   */
  public autoResolve?: boolean = false;

  /**
   * Indicates that the reaction can be used by multiple different instances of the same card.
   *
   * @default true
   */
  public allowMultipleInstances?: boolean = true;

  // Source metadata for reaction prompts and grouping.
  public sourceId?: number;
  public sourceKey?: string;
  public sourceName?: string;
  public sourceType?: ReactionSourceType;

  // todo working on moat right now which has no condition other than it be an attack.
  // in the future we might need to define this condition method elsewhere such as
  // in the expansion's module? need to wait to see what kind of conditions there are i think
  public condition?: CardTriggerEffectConditionFn<T>;

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
    this.system = arg.system ?? false;
    this.autoResolve = arg.autoResolve ?? false;
    // Preserve explicit reaction source metadata when provided.
    this.sourceId = arg.sourceId;
    this.sourceKey = arg.sourceKey;
    this.sourceName = arg.sourceName;
    this.sourceType = arg.sourceType;
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

  [Symbol.for('Deno.customInspect')]() {
    return this.toString();
  }
}

export type ReactionTemplate<T extends TriggerEventType = TriggerEventType> = Omit<
  Reaction<T>,
  'getSourceId' | 'getSourceKey' | 'getBaseId'
>;

// Optional configuration for reaction templates.
export type ReactionTemplateOptions = { idSuffix?: string };

export type GameLifecycleCallbackContext = AppContext & {
  cardId: CardId;
  actionService: ActionService;
  cardInstanceFactoryService: CardInstanceFactoryService;
};

export type GameLifecycleCallback = (
  args: Omit<GameLifecycleCallbackContext, 'cardId'>,
  ...rest: any[]
) => Promise<CardLifecycleCallbackResult | void>;

export type GameLifecycleEvent =
  | 'onGameStart'
  | 'onCardGained';

export type GameLifeCycleEventArgsMap = {
  onGameStart: { match: Match };
  onCardGained: { cardId: CardId; playerId: PlayerId; match: Match };
};

export type CardLifecycleCallbackContext = AppContext & {
  actionService: ActionService;
};

export type CardLifecycleEvent =
  | 'onGained'
  | 'onTrashed'
  | 'onRevealed'
  | 'onDiscarded'
  | 'onEnterHand'
  | 'onLeaveHand'
  | 'onEnterPlay'
  | 'onLeavePlay'
  | 'onCardPlayed';

export interface CardLifecycleCallbackMap {
  onTrashed?: CardLifecycleCallback<'onTrashed'>;
  onGained?: CardLifecycleCallback<'onGained'>;
  onRevealed?: CardLifecycleCallback<'onRevealed'>;
  onDiscarded?: CardLifecycleCallback<'onDiscarded'>;
  onEnterHand?: CardLifecycleCallback<'onEnterHand'>;
  onLeaveHand?: CardLifecycleCallback<'onLeaveHand'>;
  onEnterPlay?: CardLifecycleCallback<'onEnterPlay'>;
  onLeavePlay?: CardLifecycleCallback<'onLeavePlay'>;
  onCardPlayed?: CardLifecycleCallback<'onCardPlayed'>;
}

export interface CardLifecycleEventArgMap {
  onGained: {
    playerId: PlayerId;
    cardId: CardId;
    bought: boolean;
    gainContext?: OnGainedLifecycleContext;
  };
  onTrashed: {
    playerId: PlayerId;
    cardId: CardId;
    previousLocation?: { location: CardLocation; playerId?: PlayerId };
  };
  onRevealed: {
    playerId: PlayerId;
    cardId: CardId;
    previousLocation?: { location: CardLocation; playerId?: PlayerId };
  };
  onDiscarded: {
    playerId: PlayerId;
    cardId: CardId;
    previousLocation?: { location: CardLocation; playerId?: PlayerId };
  };
  onEnterHand: { playerId: PlayerId; cardId: CardId };
  onLeaveHand: { playerId: PlayerId; cardId: CardId };
  onEnterPlay: { playerId: PlayerId; cardId: CardId };
  onLeavePlay: { cardId: CardId };
  onCardPlayed: { playerId: PlayerId; cardId: CardId };
}

export type CardLifecycleCallbackResult = {
  registerTriggeredEvents?: ReactionTemplate[];
  unregisterTriggeredEvents?: string[];
};

export type CardLifecycleCallback<T extends CardLifecycleEvent> = (
  args: CardLifecycleCallbackContext,
  rest: CardLifecycleEventArgMap[T],
) => Promise<CardLifecycleCallbackResult | void>;

export type CardEffectRegistrar = (cardKey: CardKey, tag: string, fn: CardEffectFn) => void;
// Registers boon effects by card key for the current match.
export type BoonEffectRegistrar = (cardKey: CardKey, fn: CardEffectFn) => void;
// Registers hex effects by card key for the current match.
export type HexEffectRegistrar = (cardKey: CardKey, fn: CardEffectFn) => void;
// Registers state effects by card key for the current match.
export type StateEffectRegistrar = (cardKey: CardKey, fn: CardEffectFn) => void;
// Registers artifact effects by card key for the current match.
export type ArtifactEffectRegistrar = (cardKey: CardKey, fn: CardEffectFn) => void;
// Registers project effects by card key for the current match.
export type ProjectEffectRegistrar = (cardKey: CardKey, fn: CardEffectFn) => void;
// Registers a token definition for the server runtime.
export type TokenDefinitionRegistrar = (definition: TokenDefinition) => void;
// Runs when a tokened pile card is played by the token owner.
export type TokenCardPlayedHandler = (context: {
  match: Match;
  playerId: PlayerId;
  cardId: CardId;
  actionService: ActionService;
}) => Promise<void>;
// Registers a token card-played handler for a token id.
export type TokenCardPlayedHandlerRegistrar = (tokenId: TokenId, handler: TokenCardPlayedHandler) => void;
// Aggregates all expansion-level effect/definition registration entrypoints.
export type ExpansionRegistrationFacade = {
  registerCardEffect: CardEffectRegistrar;
  registerBoonEffect: BoonEffectRegistrar;
  registerHexEffect: HexEffectRegistrar;
  registerStateEffect: StateEffectRegistrar;
  registerArtifactEffect: ArtifactEffectRegistrar;
  registerProjectEffect: ProjectEffectRegistrar;
  registerTokenDefinition: TokenDefinitionRegistrar;
  registerTokenCardPlayedHandler: TokenCardPlayedHandlerRegistrar;
};

export type PlayerScoreDecoratorRegistrar = (decorator: PlayerScoreDecorator) => void;
export type PlayerScoreDecorator = (playerId: PlayerId, match: Match, cardLibrary: MatchCardLibrary) => void;

export type EndGamePolicyDecision = 'continue' | 'end_now' | 'defer';
export type EndGamePolicyFnContext = AppContext & { endTriggered: boolean };
export type EndGamePolicyFnOutcome = {
  endTriggered?: boolean;
  decision?: EndGamePolicyDecision;
};
export type EndGamePolicyFn = (args: EndGamePolicyFnContext) => EndGamePolicyFnOutcome;
export type EndGamePolicyRegistrationOptions = {
  // Lower values run earlier. Defaults to 100.
  priority?: number;
};
export type EndGamePolicyRegistrar = (
  endGamePolicyFn: EndGamePolicyFn,
  options?: EndGamePolicyRegistrationOptions,
) => void;

export type ClientEventRegistrar = <T extends keyof ServerListenEvents>(
  event: T,
  eventHandler: ServerListenEvents[T],
) => void;

export type GameEventRegistrar = (event: GameLifecycleEvent, handler: GameLifecycleCallback) => void;

export type InitializeExpansionContext = {
  cardSourceController: CardSourceController;
  cardInstanceFactoryService: CardInstanceFactoryService;
  loggerService: LoggerService;
  rngService: RngService;
  gameEventRegistrar: GameEventRegistrar;
  match: Match;
  clientEventRegistrar: ClientEventRegistrar;
  endGamePolicyRegistrar: EndGamePolicyRegistrar;
  playerScoreDecoratorRegistrar: PlayerScoreDecoratorRegistrar;
  expansionRegistration: ExpansionRegistrationFacade;
};
