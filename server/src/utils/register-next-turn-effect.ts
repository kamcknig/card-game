import { Card } from 'shared/types/index.ts';
import { CardEffectFunctionContext, TriggeredEffectContext } from '@server-types/index.ts';

// Wraps the ~63-occurrence "run this again at the start of my next turn"
// duration-effect idiom:
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
export const registerNextTurnEffect = (
  ctx: Pick<CardEffectFunctionContext, 'registerDurationEffect' | 'playerId'>,
  card: Card,
  triggeredEffectFn: (context: TriggeredEffectContext<'startTurn'>) => Promise<void>,
  opts: { repeats?: boolean; compulsory?: boolean; idSuffix?: string } = {},
): string[] => {
  const { playerId } = ctx;
  return ctx.registerDurationEffect(
    card,
    {
      playerId,
      listeningFor: 'startTurn',
      compulsory: opts.compulsory ?? true,
      allowMultipleInstances: true,
      // Fire once (standard "next turn" bonus) unless the card repeats for
      // the rest of the game.
      once: !opts.repeats,
      condition: ({ trigger }) => trigger.args.playerId === playerId,
      triggeredEffectFn,
    },
    {
      idSuffix: opts.idSuffix,
      // Repeating durations never exhaust on their own; a permanent
      // hasActiveEffects keeps the card in the active-duration zone.
      ...(opts.repeats ? { hasActiveEffects: () => true } : {}),
    },
  );
};
