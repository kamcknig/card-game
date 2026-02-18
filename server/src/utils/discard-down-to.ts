import { CardEffectFunctionContext } from '@server-types/index.ts';
import { PlayerId } from 'shared/types/index.ts';

// Shared helper context for discard-down-to effects.
type DiscardDownToContext = Pick<
  CardEffectFunctionContext,
  'cardSourceController' | 'actionService' | 'cardLibrary' | 'loggerService'
>;

// Force a player to discard down to a target hand size.
export const discardDownTo = async (
  context: DiscardDownToContext,
  args: { playerId: PlayerId; targetHandSize: number; prompt?: string; logTag: string },
) => {
  // Inspect the current hand size for the target player.
  const hand = context.cardSourceController.getSource('playerHand', args.playerId);
  const handCount = hand.length;

  context.loggerService.debug(`[${args.logTag}] player ${args.playerId} has ${handCount} cards in hand`);
  if (handCount <= args.targetHandSize) {
    return;
  }

  // Prompt the player to discard the excess cards.
  const selectCount = handCount - args.targetHandSize;
  context.loggerService.debug(`[${args.logTag}] prompting player ${args.playerId} to discard ${selectCount} cards`);

  const cardIds = await context.actionService.run('selectCard', {
    prompt: args.prompt ?? 'Confirm discard',
    playerId: args.playerId,
    count: selectCount,
    restrict: context.cardSourceController.getSource('playerHand', args.playerId),
  });

  if (!cardIds?.length) {
    context.loggerService.warn(`[${args.logTag}] no cards selected to discard`);
    return;
  }

  // Discard each selected card.
  for (const cardId of cardIds) {
    context.loggerService.debug(`[${args.logTag}] discarding ${context.cardLibrary.getCard(cardId)}...`);
    await context.actionService.run('discardCard', {
      cardId,
      playerId: args.playerId,
    });
  }
};
