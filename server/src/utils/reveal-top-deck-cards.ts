import { Card, PlayerId } from 'shared/types/index.ts';
import { CardEffectFunctionContext } from '@server-types/index.ts';

// Narrow context needed to reveal cards, independent of any one card effect's
// full context shape.
type RevealTopDeckCardsContext = Pick<CardEffectFunctionContext, 'actionService' | 'cardLibrary' | 'loggerService'>;

/**
 * Reveals the top `n` cards of `playerId`'s deck, one at a time, via the
 * `revealCard` action's `source: 'playerDeck'` path — which shuffles the
 * discard pile back into the deck whenever it runs dry before a reveal.
 *
 * Standardizes the "shuffle when short" idiom that today is hand-rolled at
 * ~50-60 call sites with inconsistent thresholds (some reshuffle on
 * `deck.length < n`, some only on `=== 0`, some never re-check mid-loop).
 * Stops early (returning fewer than `n` cards) if the player runs out of
 * cards in both deck and discard.
 *
 * Pass `setAside: true` to move each revealed card into the set-aside zone
 * (e.g. for effects — like the Knights — that trash/discard from what was
 * revealed rather than leaving it face-up in place).
 */
export const revealTopDeckCards = async (
  ctx: RevealTopDeckCardsContext,
  playerId: PlayerId,
  n: number,
  opts: { setAside?: boolean } = {},
): Promise<Card[]> => {
  const revealed: Card[] = [];

  for (let i = 0; i < n; i++) {
    const cardId = await ctx.actionService.run('revealCard', {
      playerId,
      source: 'playerDeck',
      moveToSetAside: opts.setAside ?? false,
    });

    if (cardId === undefined) {
      ctx.loggerService.debug(
        `[revealTopDeckCards] player ${playerId} ran out of cards to reveal (${revealed.length}/${n} revealed)`,
      );
      break;
    }

    revealed.push(ctx.cardLibrary.getCard(cardId));
  }

  return revealed;
};
