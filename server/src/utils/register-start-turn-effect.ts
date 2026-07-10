import { Card } from 'shared/types/index.ts';
import { CardEffectFunctionContext, TriggeredEffectContext } from '@server-types/index.ts';

// Wraps the ~63-occurrence `listeningFor: 'startTurn'` duration-effect idiom
// — a card's effect firing at the start of the owning player's turn, either
// once (the "next turn" bonus, the default) or every turn for the rest of
// the game (`repeats: true`, e.g. Endless Chalice). This is not a general
// wrapper for duration effects — those can listen for triggers other than
// `startTurn`, and keep calling `registerDurationEffect` directly.
//
// Base call this wraps:
//
//   args.registerDurationEffect(card, {
//     playerId: args.playerId,
//     listeningFor: 'startTurn',
//     compulsory: true,
//     allowMultipleInstances: true,
//     once: true,
//     condition: ({ trigger }) => trigger.args.playerId === args.playerId,
//     triggeredEffectFn: ...,
//   });
//
// generating the auto-id and defaults consistently. Pass `repeats: true` for
// the handful of deliberate outliers (e.g. Endless Chalice) that fire every
// turn for the rest of the game instead of once — that maps to
// `once: false` plus a permanent `hasActiveEffects`.
//
// A handful of sites (e.g. Frigate, Taskmaster) gate duration-zone retention
// with a dynamic predicate instead of the static `repeats` default (e.g.
// "stay active only while an attack window is open"). Pass `hasActiveEffects`
// to override the default liveness predicate in those cases; it always wins
// over `repeats` when provided.
//
// The Allies expansion consistently registers its next-turn effects as
// `system: true` (auto-resolves regardless of player interaction, cf.
// `ReactionTemplate.system`), and a few also set `autoResolve: true` (skip
// letting the player choose reaction ordering). Pass either to preserve that.
//
// Several sites (e.g. Adventures' Bridge Troll, Caravan Guard) register with
// a hand-built id (e.g. `bridge-troll:${cardId}:startTurn`) that an
// `onLeavePlay` lifecycle hook later unregisters by that exact literal
// string. Pass `id` to reproduce that id verbatim — an explicit id always
// wins over auto-generation (mirrors `registerDurationEffectInternal`'s own
// "explicit id provided: register exactly as-is" contract).
//
// A few Rising Sun sites (Riverboat, Samurai) also pass
// `autoRemoveTriggersOnExhaust` so every duration trigger registered for the
// card (not just this cleanup-hold trigger) is torn down once
// `hasActiveEffects` goes false. Pass it through verbatim when present.
export const registerStartTurnEffect = (
  ctx: Pick<CardEffectFunctionContext, 'registerDurationEffect' | 'playerId'>,
  card: Card,
  triggeredEffectFn: (context: TriggeredEffectContext<'startTurn'>) => Promise<void>,
  opts: {
    repeats?: boolean;
    compulsory?: boolean;
    system?: boolean;
    autoResolve?: boolean;
    idSuffix?: string;
    id?: string;
    hasActiveEffects?: (context: CardEffectFunctionContext) => boolean | Promise<boolean>;
    autoRemoveTriggersOnExhaust?: boolean;
  } = {},
): string[] => {
  const { playerId } = ctx;
  return ctx.registerDurationEffect(
    card,
    {
      ...(opts.id ? { id: opts.id } : {}),
      playerId,
      listeningFor: 'startTurn',
      compulsory: opts.compulsory ?? true,
      allowMultipleInstances: true,
      // Fire once (standard "next turn" bonus) unless the card repeats for
      // the rest of the game.
      once: !opts.repeats,
      system: opts.system ?? false,
      autoResolve: opts.autoResolve ?? false,
      condition: ({ trigger }) => trigger.args.playerId === playerId,
      triggeredEffectFn,
    },
    {
      idSuffix: opts.idSuffix,
      autoRemoveTriggersOnExhaust: opts.autoRemoveTriggersOnExhaust,
      // An explicit predicate always wins; otherwise repeating durations
      // never exhaust on their own, so a permanent hasActiveEffects keeps
      // the card in the active-duration zone.
      ...(opts.hasActiveEffects
        ? { hasActiveEffects: opts.hasActiveEffects }
        : opts.repeats
          ? { hasActiveEffects: () => true }
          : {}),
    },
  );
};
