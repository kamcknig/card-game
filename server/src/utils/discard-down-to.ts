import { CardEffectFunctionContext } from '../types.ts';
import { PlayerId } from 'shared/shared-types.ts';

// Shared helper context for discard-down-to effects.
type DiscardDownToContext = Pick<
  CardEffectFunctionContext,
  'cardSourceController' | 'runGameActionDelegate' | 'cardLibrary'
>;

// Force a player to discard down to a target hand size.
export const discardDownTo = async (
  context: DiscardDownToContext,
  args: { playerId: PlayerId; targetHandSize: number; prompt?: string; logTag: string },
) => {
  // Inspect the current hand size for the target player.
  const hand = context.cardSourceController.getSource('playerHand', args.playerId);
  const handCount = hand.length;

  console.debug(`[${args.logTag}] player ${args.playerId} has ${handCount} cards in hand`);
  if (handCount <= args.targetHandSize) {
    return;
  }

  // Prompt the player to discard the excess cards.
  const selectCount = handCount - args.targetHandSize;
  console.debug(`[${args.logTag}] prompting player ${args.playerId} to discard ${selectCount} cards`);

  const cardIds = await context.runGameActionDelegate('selectCard', {
    prompt: args.prompt ?? 'Confirm discard',
    playerId: args.playerId,
    count: selectCount,
    restrict: context.cardSourceController.getSource('playerHand', args.playerId),
  });

  if (!cardIds?.length) {
    console.warn(`[${args.logTag}] no cards selected to discard`);
    return;
  }

  // Discard each selected card.
  for (const cardId of cardIds) {
    console.debug(`[${args.logTag}] discarding ${context.cardLibrary.getCard(cardId)}...`);
    await context.runGameActionDelegate('discardCard', {
      cardId,
      playerId: args.playerId,
    });
  }
};
