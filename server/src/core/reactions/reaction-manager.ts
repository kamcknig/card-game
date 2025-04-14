import { CardId, Match, PlayerId } from 'shared/shared-types.ts';
import { Reaction, ReactionTemplate, ReactionTrigger } from '../../types.ts';
import { CardLibrary } from '../card-library.ts';
import { getOrderStartingFrom } from '../../utils/get-order-starting-from.ts';
import { groupReactionsByCardKey } from './group-reactions-by-card-key.ts';
import { buildActionButtons } from './build-action-buttons.ts';
import { buildActionMap } from './build-action-map.ts';
import { UserPromptEffect } from '../effects/effect-types/user-prompt.ts';

export class ReactionManager {
  private readonly _triggers: Reaction[] = [];
  
  constructor(
    private readonly match: Match,
    private readonly _cardLibrary: CardLibrary,
  ) {
  }
  
  public endGame() {
  }
  
  unregisterTrigger(triggerId: string) {
    const idx = this._triggers.findIndex((trigger) => trigger.id === triggerId);
    if (idx > -1) {
      const trigger = this._triggers[idx];
      console.log(`[REACTION MANAGER] removing trigger reaction ${triggerId} for player
        ${this.match.players?.find((player) => player.id === trigger.playerId)}`);
      
      this._triggers.splice(idx, 1);
    }
  }
  
  getReactions(trigger: ReactionTrigger) {
    return this._triggers.filter((t) => {
      if (t.listeningFor !== trigger.eventType) return false;
      
      console.log(`[REACTION MANAGER] checking trigger ${trigger} condition for ${t.id} reaction`);
      
      if (trigger.cardId) {
        console.log(`[REACTION MANAGER] trigger card ${this._cardLibrary.getCard(trigger.cardId)}`,);
      }
      
      console.log(`[REACTION MANAGER] trigger player ${this.match.players.find((player) => player.id === trigger.playerId)}`);
      
      if (t.condition !== undefined) {
        return t.condition({ match: this.match, cardLibrary: this._cardLibrary, trigger });
      }
      else {
        return true;
      }
    });
  }
  
  getReactionsForPlayer(
    trigger: ReactionTrigger,
    playerId: number,
  ) {
    const reactions = this.getReactions(trigger).filter((item) => {
      return item.playerId === playerId;
    });
    return reactions;
  }
  
  registerReactionTemplate(reactionTemplate: ReactionTemplate) {
    console.log(`[REACTION MANAGER] registering trigger template ID ${reactionTemplate.id}, for player ${reactionTemplate.playerId}`,);
    this._triggers.push(new Reaction(reactionTemplate));
  }
  
  *runTrigger({ trigger, reactionContext }: { trigger: ReactionTrigger, reactionContext?: any }) {
    reactionContext ??= {};
    
    // now we get the order of players that could be affected by the play (including the current player),
    // then get reactions for them and run them
    const targetOrder = getOrderStartingFrom(
      this.match.players,
      this.match.currentPlayerTurnIndex,
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
        
        console.log(`[REACTION MANAGER] ${targetPlayer} has ${reactions.length} remaining actions`);
        
        if (!reactions.length) break;
        
        const compulsoryReactions = reactions.filter(r => r.compulsory);
        
        let selectedReaction: Reaction | undefined = undefined;
        
        // when you have more than one reaction, the player chooses.
        // if there is only one reaction though, and it's compulsory (such as the merchant's
        // reaction-like card effect to gain a treasure) then we just do it with no choice.
        if (reactions.length > 1 || compulsoryReactions.length === 0) {
          const grouped = groupReactionsByCardKey(reactions);
          const actionButtons = buildActionButtons(grouped, this._cardLibrary);
          const actionMap = buildActionMap(grouped);
          
          const result = (yield new UserPromptEffect({
            playerId: targetPlayer.id,
            sourcePlayerId: trigger.playerId,
            sourceCardId: trigger.cardId,
            actionButtons,
            prompt: 'Choose reaction?',
          })) as { action: number };
          
          if (result.action === 0) {
            console.log(`[REACTION MANAGER] ${targetPlayer} chose not to react`);
            break;
          }
          else {
            console.log(`[REACTION MANAGER] ${targetPlayer} reacts with ${actionMap.get(result.action)}`);
          }
          
          selectedReaction = actionMap.get(result.action);
        }
        else {
          selectedReaction = compulsoryReactions[0];
        }
        
        if (!selectedReaction) {
          console.warn(`[REACTION MANAGER] reaction not found in action map`);
          continue;
        }
        
        const reactionResult = yield* selectedReaction.generatorFn({
          match: this.match,
          cardLibrary: this._cardLibrary,
          trigger,
          reaction: selectedReaction,
        });
        
        // right now the only card that created that has a reaction that the
        // card triggering it needs to know about is moat giving immunity.
        // every other reaction just returns undefined. so if the reaction
        // doesn't give a result, don't set it on the context. this might
        // have to expand later.
        if (reactionResult !== undefined) {
          reactionContext[targetPlayer.id] = {
            reaction: selectedReaction,
            trigger,
            result: reactionResult,
          };
        }
        
        usedReactionIds.add(selectedReaction.id);
        
        if (selectedReaction.once) {
          console.log(`[REACTION MANAGER] selected reaction is single-use, unregistering it`);
          this.unregisterTrigger(selectedReaction.id);
        }
        
        if (!selectedReaction.multipleUse) {
          blockedCardKeys.add(selectedReaction.getSourceKey());
        }
      }
    }
  }
}
