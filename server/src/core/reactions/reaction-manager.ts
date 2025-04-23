import { CardId, Match, PlayerId } from 'shared/shared-types.ts';
import { LifecycleTriggers, Reaction, ReactionTemplate, ReactionTrigger, RunGameActionDelegate } from '../../types.ts';
import { CardLibrary } from '../card-library.ts';
import { getOrderStartingFrom } from '../../utils/get-order-starting-from.ts';
import { groupReactionsByCardKey } from './group-reactions-by-card-key.ts';
import { buildActionButtons } from './build-action-buttons.ts';
import { buildActionMap } from './build-action-map.ts';
import { cardLifecycleMap } from '../card-lifecycle-map.ts';

export class ReactionManager {
  private readonly _triggers: Reaction[] = [];
  
  constructor(
    private readonly _match: Match,
    private readonly _cardLibrary: CardLibrary,
    private readonly runGameActionDelegate: RunGameActionDelegate
  ) {
  }
  
  public endGame() {
  }
  
  getReactions(trigger: ReactionTrigger) {
    return this._triggers.filter((t) => {
      if (t.listeningFor !== trigger.eventType) return false;
      
      console.log(`[REACTION MANAGER] checking trigger ${trigger} condition for ${t.id} reaction`);
      
      if (t.condition !== undefined) {
        return t.condition({
          match: this._match,
          cardLibrary:
          this._cardLibrary, trigger
        });
      }
      else {
        return true;
      }
    });
  }
  
  getReactionsForPlayer(trigger: ReactionTrigger, playerId: number) {
    const reactions = this.getReactions(trigger).filter((item) => {
      return item.playerId === playerId;
    });
    return reactions;
  }
  
  unregisterTrigger(triggerId: string) {
    for (let i = this._triggers.length - 1; i >= 0; i--) {
      const trigger = this._triggers[i];
      if (trigger.id === triggerId) {
        this._triggers.splice(i, 1);
        console.log(`[REACTION MANAGER] removing trigger reaction ${triggerId} for player ${this._match.players?.find((player) => player.id === trigger.playerId)}`);
      }
    }
  }
  
  registerReactionTemplate(reactionTemplate: ReactionTemplate) {
    console.log(`[REACTION MANAGER] registering trigger template ID ${reactionTemplate.id}, for player ${reactionTemplate.playerId}`,);
    this._triggers.push(new Reaction(reactionTemplate));
  }
  
  handleLifecycleTrigger(trigger: LifecycleTriggers, context: { playerId?: PlayerId, cardId: CardId }) {
    const card = this._cardLibrary.getCard(context.cardId);
    
    const fn = cardLifecycleMap[card.cardKey]?.[trigger];
    if (!fn) {
      return;
    }
    
    console.log(`[REACTION MANAGER] running lifecycle trigger '${trigger}' for card ${card}`);
    fn({
      cardId: context.cardId,
      playerId: context.playerId!,
      reactionManager: this,
      runGameActionDelegate: this.runGameActionDelegate,
    });
  }
  
  async runTrigger({ trigger, reactionContext }: { trigger: ReactionTrigger, reactionContext?: any }) {
    reactionContext ??= {};
    
    // now we get the order of players that could be affected by the play (including the current player),
    // then get reactions for them and run them
    const targetOrder = getOrderStartingFrom(
      this._match.players,
      this._match.currentPlayerTurnIndex,
    );
    
    for (const targetPlayer of targetOrder) {
      console.log(`[REACTION MANAGER] checking '${trigger.eventType}' reactions for ${targetPlayer}`);
      
      const usedReactionIds = new Set<string>();
      const blockedCardKeys = new Set<string>();
      
      while (true) {
        const reactions = this.getReactionsForPlayer(
          trigger,
          targetPlayer.id,
        ).filter((r) => {
          const key = r.getSourceKey();
          return !usedReactionIds.has(r.id) && !blockedCardKeys.has(key);
        });
        
        console.log(`[REACTION MANAGER] ${targetPlayer} has ${reactions.length} remaining reactions`);
        
        if (!reactions.length) break;
        
        const compulsoryReactions = reactions.filter(r => r.compulsory);
        
        let selectedReaction: Reaction | undefined = undefined;
        
        const shouldPrompt = (
          reactions.length > 1 &&
          (
            compulsoryReactions.length !== reactions.length || // mix of compulsory + optional
            !compulsoryReactions.every(r => r.getSourceKey() === compulsoryReactions[0].getSourceKey()) // different cards
          )
        );
        
        // when multiple reactions can occur, the user chooses unless they are all compulsory
        // and the same card
        if (shouldPrompt || (reactions.length === 1 && compulsoryReactions.length === 0)) {
          const grouped = groupReactionsByCardKey(reactions);
          const actionButtons = buildActionButtons(grouped, this._cardLibrary);
          const actionMap = buildActionMap(grouped);
          
          console.log(`[REACTION MANAGER] prompting ${targetPlayer} to choose reaction`);
          
          /*const result = (yield new UserPromptEffect({
            playerId: targetPlayer.id,
            actionButtons,
            prompt: 'Choose reaction?',
          })) as { action: number };*/
          
          /*if (result.action === 0) {
            console.log(`[REACTION MANAGER] ${targetPlayer} chose not to react`);
            break;
          }
          else {
            console.log(`[REACTION MANAGER] ${targetPlayer} reacts with ${actionMap.get(result.action)}`);
          }
          
          selectedReaction = actionMap.get(result.action);*/
        }
        else {
          selectedReaction = compulsoryReactions[0];
        }
        
        if (!selectedReaction) {
          console.warn(`[REACTION MANAGER] reaction not found in action map`);
          continue;
        }
        
        /*const reactionResult = yield* selectedReaction.triggeredEffectFn({
          trigger,
          reaction: selectedReaction,
        });*/
        
        // right now the only card that created that has a reaction that the
        // card triggering it needs to know about is moat giving immunity.
        // every other reaction just returns undefined. so if the reaction
        // doesn't give a result, don't set it on the context. this might
        // have to expand later.
        /*if (reactionResult !== undefined) {
          reactionContext[targetPlayer.id] = {
            reaction: selectedReaction,
            trigger,
            result: reactionResult,
          };
        }*/
        
        usedReactionIds.add(selectedReaction.id);
        
        if (selectedReaction.once) {
          console.log(`[REACTION MANAGER] selected reaction is single-use, unregistering it`);
          this.unregisterTrigger(selectedReaction.id);
        }
        
        if (!selectedReaction.allowMultipleInstances) {
          blockedCardKeys.add(selectedReaction.getSourceKey());
        }
      }
    }
  }
}
