import { Socket } from 'socket.io';
import {
  Card,
  CardId,
  CardKey,
  EffectTarget,
  LocationSpec,
  Match,
  MatchStats,
  PlayerId,
  SelectActionCardArgs,
  ServerEmitEvents,
  ServerListenEvents, UserPromptActionArgs,
} from 'shared/shared-types.ts';
import { toNumber } from 'es-toolkit/compat';

import { CardLibrary } from './core/card-library.ts';
import { ReactionManager } from './core/reactions/reaction-manager.ts';
import { LogManager } from './core/log-manager.ts';
import { GameActionController } from './core/effects/game-action-controller.ts';
import { MatchController } from './core/match-controller.ts';

export type AppSocket = Socket<ServerListenEvents, ServerEmitEvents>;

export type DistributiveOmit<T, K extends PropertyKey> =
  T extends any ? Omit<T, K> : never;

/**
 * A base match configuration that can be used to spread default values.
 *
 * The `supply.baseCards` property contains all possible base supply card combinations for the number
 * of players in a given game.
 */
export const MatchBaseConfiguration = {
  numberOfKingdomPiles: 10,
  cards: {
    supply: {
      baseCards: [
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
          'gold': 60,
          'duchy': 12,
          'silver': 80,
          'estate': 12,
          'copper': 120,
          'curse': 50,
        },
      ],
    },
  },
  playerStartingHand: {
    'copper': 7,
    'estate': 3,
  },
} as const;

type ReactionTriggerArgs = {
  eventType: TriggerEventType;
  playerId: number;
  cardId?: number;
};

export class ReactionTrigger {
  eventType: TriggerEventType;
  
  // the card that triggered this
  cardId?: number;
  
  // who triggered this?
  playerId: number;

  constructor(args: ReactionTriggerArgs) {
    this.eventType = args.eventType;
    this.cardId = args.cardId;
    this.playerId = args.playerId;
  }
  
  toString() {
    return `[TRIGGER ${this.eventType} - player ${this.playerId} - card ${this.cardId} ]`;
  }
  
  // @ts-ignore
  [Symbol.for('Deno.customInspect')]() {
    return this.toString();
  }
}

export type SourceContext =
  | { type: 'player', playerId: PlayerId }
  | { type: 'card', playerId: PlayerId, cardId: CardId };

export type TriggeredEffectContext = {
  runGameActionDelegate: RunGameActionDelegate;
  logManager: LogManager;
  sourceContext: SourceContext;
  matchController: MatchController,
  gameActionController: GameActionController;
  trigger: ReactionTrigger;
  reaction: Reaction;
  isRootLog?: boolean;
};

export type GameActionArgsMap = {
  checkForRemainingPlayerActions: void;
  buyCard: { playerId: PlayerId; cardId: CardId };
  discardCard: { cardId: CardId; playerId: PlayerId };
  drawCard: { playerId: PlayerId };
  endTurn: void;
  gainAction: { count: number };
  gainBuy: { count: number; };
  gainCard: { playerId: PlayerId; cardId: CardId; to: LocationSpec };
  gainTreasure: { count: number };
  modifyCost: ModifyActionCardArgs;
  moveCard: { toPlayerId?: PlayerId; cardId: CardId; to: LocationSpec };
  newTurn: void;
  nextPhase: void;
  playCard: { playerId: PlayerId; cardId: CardId, overrides?: GameActionOverrides };
  revealCard: { cardId: CardId, playerId: PlayerId, moveToRevealed?: boolean },
  selectCard: SelectActionCardArgs;
  shuffleDeck: { playerId: PlayerId };
  trashCard: { playerId: PlayerId; cardId: CardId };
  userPrompt: UserPromptActionArgs;
};

export type ModifyActionCardArgs = {
  appliesTo: EffectTarget;
  expiresAt: 'TURN_END';
  appliesToCard: EffectTarget;
  amount: number;
};

export type GameActions = keyof GameActionArgsMap

export type GameActionMethodMap = {
  [K in GameActions]: (args: GameActionArgsMap[K]) => Promise<any>
};

export type RunGameActionDelegate = <K extends GameActions>(
  action: K,
  ...args: GameActionArgsMap[K] extends void
    ? []
    : [GameActionArgsMap[K]]
) => Promise<ReturnType<GameActionController[K]>>;


export type ReactionContext = any;

export type CardEffectFunctionMapFactory = Record<CardKey, () => (context: CardEffectFunctionContext) => Promise<void>>;

export type CardEffectFunctionContext = {
  match: Match,
  runGameActionDelegate: RunGameActionDelegate,
  logManager: LogManager,
  gameActionController: GameActionController;
  reactionContext?: ReactionContext;
  playerId: PlayerId;
  cardId: CardId;
  cardLibrary: CardLibrary
}

export type CardTriggeredEffectFn = (args: TriggeredEffectContext) => Promise<any>;

export type CardEffectFunction = (args: CardEffectFunctionContext) => Promise<void>;

export type CardEffectFunctionMap =
  Record<CardKey, CardEffectFunction>;

export interface CardExpansionModule {
  registerCardLifeCycles?: () => Record<string, LifecycleCallbackMap>;
  registerScoringFunctions?: () => Record<string, (args: {
    match: Match,
    cardLibrary: CardLibrary,
    ownerId: number
  }) => number>;
  registerEffects: CardEffectFunctionMapFactory;
}

export type GameActionOverrides = {
  actionCost?: number,
  moveCard?: boolean,
  playCard?: boolean,
};

export type TriggerEventType = 'cardPlayed' | 'startTurn' | 'gainCard';

type ReactionArgs = {
  id: string;
  playerId: number;
  listeningFor: TriggerEventType;
  condition?: Reaction['condition'];
  triggeredEffectFn: CardTriggeredEffectFn;
  once?: boolean;
  allow?: boolean;
  compulsory?: boolean;
  allowMultipleUse?: boolean;
};

export class Reaction {
  // a concatenation of the card key and card id with a '-'
  public id: string;
  
  // the player's ID who owns this reaction - the one that can decide to do it.
  public playerId: number;
  
  public listeningFor: TriggerEventType;
  
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
  public condition?: (
    args: {
      matchStats: MatchStats;
      match: Match;
      cardLibrary: CardLibrary;
      trigger: ReactionTrigger
    },
  ) => boolean;
  
  // todo defined in a map somewhere just like registered card effects. so maybe another export
  // from teh expansion module that defines what happens when you ccn react?
  public triggeredEffectFn: CardTriggeredEffectFn;
  
  constructor(arg: ReactionArgs) {
    this.id = arg.id;
    this.playerId = arg.playerId;
    this.listeningFor = arg.listeningFor;
    this.condition = arg.condition ?? (() => true);
    this.triggeredEffectFn = arg.triggeredEffectFn;
    this.once = arg.once ?? false;
    this.allowMultipleInstances = arg.allowMultipleUse ?? true;
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

export type ReactionTemplate = Omit<Reaction, 'getSourceId' | 'getSourceKey' | 'getBaseId'>;

export type LifecycleResult = {
  registerTriggeredEvents?: ReactionTemplate[];
  unregisterTriggeredEvents?: string[];
};
export type LifecycleCallback = (
  args: {
    runGameActionDelegate: RunGameActionDelegate;
    gameActionController: GameActionController;
    playerId: number;
    cardId: number;
  },
) => LifecycleResult | void;

export type LifecycleCallbackMap = {
  onEnterHand?: LifecycleCallback;
  onLeaveHand?: LifecycleCallback;
  onEnterPlay?: LifecycleCallback;
  onLeavePlay?: LifecycleCallback;
  onCardPlayed?: LifecycleCallback;
};

export type CardOverrides = Record<PlayerId, Record<CardId, Card>>;
