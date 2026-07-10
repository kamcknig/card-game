import { CardId } from 'shared/types/index.ts';
import { ActionService, GameActionDefinitionMap, GameActionReturnTypeMap, GameActions } from '@server-types/index.ts';

// Actions whose GameActionContext.source feeds log-entry attribution. When an
// effect or triggered reaction runs one of these without an explicit source,
// the wrapping action service injects the owning card's id so the log can
// name the cause (rendered client-side as a trailing "(CardName)" link when
// not redundant with the entry's visual parent).
export const SOURCE_AWARE_ACTIONS: ReadonlySet<GameActions> = new Set<GameActions>([
  'gainTreasure',
  'gainAction',
  'gainBuy',
  'gainPotion',
  'gainVictoryToken',
  'drawCard',
  'drawHand',
  'shuffle',
  'shuffleDeck',
  'shuffleCardLike',
  // Card-movement actions added for triggered-effect attribution — their
  // handlers already read context.source into their log entries.
  'gainCard',
  'trashCard',
  'discardCard',
  'revealCard',
  'playCard',
]);

/**
 * Wraps an ActionService so SOURCE_AWARE_ACTIONS automatically carry
 * `context.source = sourceCardId` unless the caller provided a source
 * explicitly (an explicit source always wins). Non-source-aware actions and
 * malformed argument shapes pass through untouched.
 *
 * Defined here and consumed by GameActionController.createCardEffectContext
 * (on-play effects) and ReactionContextFactory.createTriggeredEffectContext
 * (reactions / duration effects).
 */
export function wrapActionServiceWithSource(actionService: ActionService, sourceCardId: CardId): ActionService {
  return {
    run: async <K extends GameActions>(
      action: K,
      ...runArgs: Parameters<GameActionDefinitionMap[K]>
    ): Promise<GameActionReturnTypeMap[K]> => {
      const [actionArgs, actionContext] = runArgs;
      if (!SOURCE_AWARE_ACTIONS.has(action)) {
        return await actionService.run(action, ...runArgs);
      }
      if (!actionArgs || typeof actionArgs !== 'object' || Array.isArray(actionArgs)) {
        return await actionService.run(action, ...runArgs);
      }
      // An explicit source from the caller always wins over injection.
      if (actionContext?.source !== undefined) {
        return await actionService.run(action, ...runArgs);
      }
      const argsWithSource = [
        actionArgs as Parameters<GameActionDefinitionMap[K]>[0],
        {
          ...(actionContext ?? {}),
          source: sourceCardId,
        },
      ] as unknown as Parameters<GameActionDefinitionMap[K]>;
      return await actionService.run(action, ...argsWithSource);
    },
  };
}
