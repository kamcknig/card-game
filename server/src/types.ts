import { Socket } from 'socket.io';
import {
  Card,
  CardId,
  CardKey,
  Match,
  Player,
  PlayerId,
  ServerEmitEvents,
  ServerListenEvents,
} from 'shared/shared-types.ts';
import { GameEffects } from './core/effects/effect-types/game-effects.ts';
import { toNumber } from 'es-toolkit/compat';

import { CardLibrary } from './core/card-library.ts';
import { ReactionManager } from './core/reactions/reaction-manager.ts';
import { LogManager } from './core/log-manager.ts';

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

export type ReactionTrigger = {
  eventType: TriggerEventType;
  // the card that triggered this
  cardId?: number;
  // who triggered this?
  playerId: number;
};

export type TargetContext =
  | { type: 'player', playerId: PlayerId }
  | { type: 'card', playerId: PlayerId, cardId: CardId };

export type SourceContext =
  | { type: 'player', playerId: PlayerId }
  | { type: 'card', playerId: PlayerId, cardId: CardId };

export type ReactionEffectContext = {
  trigger: ReactionTrigger;
  reaction: Reaction;
  isRootLog?: boolean;
};

export type GameActions = {
  buyCard: { playerId: PlayerId; cardId: CardId; };
  playCard: { playerId: PlayerId; cardId: CardId; };
  drawCard: { playerId: PlayerId };
  checkForPlayerActions: undefined;
  nextPhase: undefined;
} & Record<string, any>;

export type GameEffectGenerator = Generator<GameEffects>;

export type EffectGeneratorFactoryContext = {
  reactionManager: ReactionManager;
  logManager: LogManager,
  match: Match,
  cardLibrary: CardLibrary,
}

export type GameActionTypes = keyof GameActions;
export type GameActionEffectGeneratorFn<Args = any> = (
  args: Args,
  overrides?: GameActionOverrides,
) => GameEffectGenerator;
export type GameActionEffectGeneratorMapFactory = (context: EffectGeneratorFactoryContext) => {
  [K in GameActionTypes]: GameActionEffectGeneratorFn<GameActions[K]>;
};

export type ReactionContext = any;

export type CardEffectGeneratorFnContext = {
  reactionContext: ReactionContext;
  playerId: PlayerId;
  cardId: CardId;
}
export type CardEffectGeneratorFn =
  (args: CardEffectGeneratorFnContext) => GameEffectGenerator;

export type CardEffectGeneratorMapFactory =
  Record<CardKey, (context: EffectGeneratorFactoryContext) => CardEffectGeneratorFn>;

export interface CardExpansionModule {
  registerCardLifeCycles?: () => Record<string, LifecycleCallbackMap>;
  registerScoringFunctions?: () => Record<string, (args: {
    match: Match,
    cardLibrary: CardLibrary,
    ownerId: number
  }) => number>;
  registerEffects: CardEffectGeneratorMapFactory;
}


export type GameActionOverrides = {
  actionCost?: number,
  moveCard?: boolean,
  playCard?: boolean,
};

export type ReactionEffectGeneratorFn = (
  args: ReactionEffectContext,
) => GameEffectGenerator;

export type EffectTypes = GameEffects['type'];

export type EffectHandler<T> = (
  effect: Extract<GameEffects, { type: T }>,
  match: Match,
) => EffectHandlerResult;

export type EffectHandlerMap = {
  [T in EffectTypes]: EffectHandler<T>;
};

export type EffectPauseResult = { pause: true; signalId: string };
export type EffectResult = { result: unknown; };
export type EffectRunGeneratorResult = {
  runGenerator: GameEffectGenerator;
};

export type EffectHandlerResult =
  | EffectPauseResult
  | EffectResult
  | EffectRunGeneratorResult
  | number[]
  | void;

export type TriggerEventType = 'cardPlayed' | 'startTurn';

export class Reaction {
  // a concatenation of the card key and card id with a '-'
  public id: string;
  
  // the player's ID who owns this reaction - the one that can decide to do it.
  public playerId: number;
  
  public listeningFor: TriggerEventType;
  
  public once?: boolean = false;
  
  public compulsory?: boolean = false;
  
  public multipleUse?: boolean = true;
  
  // todo working on moat right now which has no condition other than it be an attack.
  // in the future we might need to define this condition method elsewhere such as
  // in the expansion's module? need to wait to see what kind of conditions there are i think
  public condition?: (
    args: { match: Match; cardLibrary: CardLibrary; trigger: ReactionTrigger },
  ) => boolean;
  
  // todo defined in a map somewhere just like registered card effects. so maybe another export
  // from teh expansion module that defines what happens when you ccn react?
  public generatorFn: ReactionEffectGeneratorFn;
  
  constructor(
    arg: {
      id: string;
      playerId: number;
      listeningFor: TriggerEventType;
      condition?: Reaction['condition'];
      generatorFn: ReactionEffectGeneratorFn;
      once?: boolean;
      multipleUse?: boolean;
      compulsory?: boolean;
    },
  ) {
    this.id = `${arg.id}-${Date.now()}`;
    this.playerId = arg.playerId;
    this.listeningFor = arg.listeningFor;
    this.condition = arg.condition ?? (() => true);
    this.generatorFn = arg.generatorFn;
    this.once = arg.once;
    this.multipleUse = arg.multipleUse ?? false;
    this.compulsory = arg.compulsory ?? false;
  }
  
  public getSourceKey() {
    let out;
    try {
      out = this.id.split('-')?.[0];
      return out;
    } catch (e) {
      throw e;
    }
  }
  
  public getSourceId() {
    let out;
    try {
      out = toNumber(this.id.split('-')?.[1]);
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

export interface IEffectRunner {
  runCardEffects(arg: {
    source: SourceContext;
    reactionContext?: unknown,
  }): unknown;
  
  runGameActionEffects<T extends GameActionTypes>(arg: {
    effectName: T,
    context: GameActions[T],
    source: SourceContext
  }): unknown;
  
  runGenerator(arg: {
    generator: GameEffectGenerator,
    source: SourceContext
  }): unknown;
}

export type ReactionTemplate = Omit<Reaction, 'getSourceId' | 'getSourceKey'>;

export type LifecycleResult = {
  registerTriggeredEvents?: ReactionTemplate[];
  unregisterTriggeredEvents?: string[];
};
export type LifecycleCallback = (
  args: { playerId: number; cardId: number },
) => LifecycleResult | void;

export type LifecycleCallbackMap = {
  onEnterHand?: LifecycleCallback;
  onLeaveHand?: LifecycleCallback;
  onEnterPlay?: LifecycleCallback;
  onLeavePlay?: LifecycleCallback;
  onCardPlayed?: LifecycleCallback;
};

export type EffectExceptionSpec = { kind: 'player'; playerIds: PlayerId[] };

export type CardOverrides = Record<PlayerId, Record<CardId, Card>>;
