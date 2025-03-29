import { Socket } from "socket.io";
import { Card, Match, MatchUpdate, ServerEmitEvents, ServerListenEvents, } from "shared/shared-types.ts";
import { GameEffects } from "./effect.ts";
import { toNumber } from 'es-toolkit/compat';
import { CardLibrary } from './match-controller.ts';

export type AppSocket = Socket<ServerListenEvents, ServerEmitEvents>;

export type CardData = Omit<
  Card,
  "id" | "location" | "owner" | "order" | "cardKey"
>;

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
          "province": 1,
          "gold": 30,
          "duchy": 8,
          "silver": 40,
          "estate": 8,
          "copper": 60,
          "curse": 10,
        },
        {
          "province": 12,
          "gold": 30,
          "duchy": 12,
          "silver": 40,
          "estate": 12,
          "copper": 60,
          "curse": 20,
        },
        {
          "province": 12,
          "gold": 30,
          "duchy": 12,
          "silver": 40,
          "estate": 12,
          "copper": 60,
          "curse": 30,
        },
        {
          "province": 15,
          "gold": 60,
          "duchy": 12,
          "silver": 80,
          "estate": 12,
          "copper": 120,
          "curse": 40,
        },
        {
          "province": 18,
          "gold": 60,
          "duchy": 12,
          "silver": 80,
          "estate": 12,
          "copper": 120,
          "curse": 50,
        },
      ],
    },
  },
  playerStartingHand: {
    "copper": 7,
    "estate": 3,
  },
} as const;

export type ReactionTrigger = {
  eventType: TriggerEventType;
  // the card that triggered this
  cardId: number;
  // who triggered this?
  playerId: number;
}

export type ReactionEffectGeneratorFn = (
  match: Match,
  cardLibrary: CardLibrary,
  trigger: ReactionTrigger,
  reaction: Reaction,
) => EffectGenerator<GameEffects>;

export type AsyncReactionEffectGeneratorFn = (
  match: Match,
  cardLibrary: CardLibrary,
  trigger: ReactionTrigger,
  reaction: Reaction,
) => Promise<EffectGenerator<GameEffects>>;

export type EffectGenerator<T> = Generator<
  T,
  unknown,
  unknown
>;
export type EffectGeneratorFn = (
  matchState: Match,
  cardLibrary: CardLibrary,
  triggerPlayerId: number,
  triggerCardId?: number,
  // deno-lint-ignore no-explicit-any
  reactionContext?: any,
) => EffectGenerator<GameEffects>;
export type AsyncEffectGeneratorFn = (
  matchState: Match,
  cardLibrary: CardLibrary,
  triggerPlayerId: number,
  triggerCardId?: number,
  // deno-lint-ignore no-explicit-any
  reactionContext?: any,
) => Promise<EffectGenerator<GameEffects>>;

export type EffectTypes = GameEffects["type"];

export type EffectHandler<T> = (
  effect: Extract<GameEffects, { type: T }>,
  match: Match,
  acc: MatchUpdate
) => EffectHandlerResult;

export type EffectHandlerMap = {
  [T in EffectTypes]: EffectHandler<T>;
};

export type EffectHandlerResult = Promise<unknown>;

export type TriggerEventType =
  | "cardPlayed";

export class Reaction {
  public id: string;

  // the player's ID who owns this reaction - the one that can decide to do it.
  public playerId: number;

  public listeningFor: TriggerEventType;

  public once?: boolean = false;

  // todo working on moat right now which has no condition other than it be an attack.
  // in the future we might need to define this condition method elsewhere such as
  // in the expansion's module? need to wait to see what kind of conditions there are i think
  public condition?: (match: Match, cardLibrary: CardLibrary, trigger: ReactionTrigger) => boolean;

  // todo defined in a map somewhere just like registered card effects. so maybe another export
  // from teh expansion module that defines what happens when you ccn react?
  public generatorFn:
    | ReactionEffectGeneratorFn
    | AsyncReactionEffectGeneratorFn;

  constructor(
    arg: {
      id: string;
      playerId: number;
      listeningFor: TriggerEventType;
      condition?: Reaction["condition"];
      generatorFn: ReactionEffectGeneratorFn | AsyncReactionEffectGeneratorFn;
      once?: boolean;
    },
  ) {
    this.id = arg.id;
    this.playerId = arg.playerId;
    this.listeningFor = arg.listeningFor;
    this.condition = arg.condition ?? (() => true);
    this.generatorFn = arg.generatorFn;
    this.once = arg.once;
  }

  public getSourceKey() {
    let out;
    try {
      out = this.id.split("-")?.[0];
      return out;
    } catch {
      return undefined;
    }
  }

  public getSourceId() {
    let out;
    try {
      out = toNumber(this.id.split("-")?.[1]);
      return out;
    } catch {
      return undefined;
    }
  }
}

export interface IEffectRunner {
  runCardEffects(
    match: Match,
    playerId: number,
    cardId: number,
    acc: MatchUpdate,
    reactionContext?: unknown,
  ): Promise<unknown>;
  
  runGameActionEffects(
    effectName: string,
    match: Match,
    playerId: number,
    cardId?: number,
  ): Promise<unknown>;
  
  runGenerator(
    generator: EffectGenerator<GameEffects>,
    match: Match,
    playerId: number,
    acc?: MatchUpdate,
  ): Promise<unknown>;
  
  suspendedCallbackRunner(fn: () => Promise<void>): Promise<unknown>;
}

export type ReactionTemplate = Omit<Reaction, 'getSourceId' | 'getSourceKey'>;

export type LifecycleResult = {
  registerTriggers?: ReactionTemplate[];
  unregisterTriggers?: string[];
}
export type LifecycleCallback = (playerId: number, cardId: number) => LifecycleResult | void;

export type LifecycleCallbackMap = {
  onEnterHand?: LifecycleCallback;
  onLeaveHand?: LifecycleCallback;
  onEnterPlay?: LifecycleCallback;
  onLeavePlay?: LifecycleCallback;
};
export type PlayerID = number;
export type CardId = number;