// Define event types
import { CardId, Match, PlayerId } from 'shared/shared-types.ts';
import { CardLibrary } from '../card-library.ts';
import { EffectsController } from '../effects/effects-controller.ts';

export type GameEventType =
  | 'cardPlayed'
  | 'attackPlayed'
  | 'gainCard'
  | 'startTurn';

// Basic event interface
export interface GameEvent {
  type: GameEventType;
  playerId: PlayerId;
  cardId?: CardId;
  targetIds?: PlayerId[];
  data?: any;
}

// Reaction result
export interface ReactionResult {
  applied: boolean;
  immunity?: boolean;
  prevented?: boolean;
  additionalData?: any;
}

interface ReactionConditionContext {
  event: GameEvent;
  match: Match;
  cardLibrary: CardLibrary;
}

interface ReactionExecuteContext {
  effectsController: { runGameActionEffects: any };
  event: GameEvent;
  match: Match;
  cardLibrary: CardLibrary;
}

// Reaction interface
export interface Reaction {
  id: string;
  playerId: PlayerId;
  sourceCardId: CardId;
  compulsory: boolean;
  once: boolean;
  condition: (args: ReactionConditionContext) => boolean;
  execute: (args: ReactionExecuteContext) => Promise<ReactionResult>;
}

export interface PromptPlayerArgs {
  playerId: PlayerId;
  options: any;
}

export class EventSystem {
  private reactions: Map<GameEventType, Reaction[]> = new Map();
  
  constructor(
    private match: Match,
    private cardLibrary: CardLibrary,
    private promptPlayer: (args: PromptPlayerArgs) => Promise<any>
  ) {
  }
  
  private _effectsController: { runGameActionEffects: any } | undefined;
  
  setEffectsController (effectsController: { runGameActionEffects: any }) {
    this._effectsController = effectsController;
  }
  
  registerReaction(eventType: GameEventType, reaction: Reaction) {
    if (!this.reactions.has(eventType)) {
      this.reactions.set(eventType, []);
    }
    this.reactions.get(eventType)!.push(reaction);
    console.log(`[EVENT SYSTEM] Registered reaction ${reaction.id} for event ${eventType}`);
  }
  
  unregisterReaction(reactionId: string) {
    for (const [eventType, reactions] of this.reactions.entries()) {
      const index = reactions.findIndex(r => r.id === reactionId);
      if (index >= 0) {
        reactions.splice(index, 1);
        console.log(`[EVENT SYSTEM] Unregistered reaction ${reactionId} from event ${eventType}`);
        return;
      }
    }
  }
  
  async processEvent(event: GameEvent): Promise<ReactionResult[]> {
    console.log(`[EVENT SYSTEM] Processing event ${event.type} from player ${event.playerId}`);
    
    if (!this.reactions.has(event.type)) {
      return [];
    }
    
    const applicableReactions = this.reactions.get(event.type)!.filter(reaction =>
      reaction.condition({ event, match: this.match, cardLibrary: this.cardLibrary }));
    
    if (applicableReactions.length === 0) {
      return [];
    }
    
    // Group reactions by player
    const reactionsByPlayer = new Map<PlayerId, Reaction[]>();
    for (const reaction of applicableReactions) {
      if (!reactionsByPlayer.has(reaction.playerId)) {
        reactionsByPlayer.set(reaction.playerId, []);
      }
      reactionsByPlayer.get(reaction.playerId)!.push(reaction);
    }
    
    const results: ReactionResult[] = [];
    
    // Process each player's reactions
    for (const [playerId, playerReactions] of reactionsByPlayer.entries()) {
      // If multiple reactions, let player choose (unless compulsory)
      let chosenReaction: Reaction | null = null;
      
      if (playerReactions.length === 1) {
        chosenReaction = playerReactions[0];
        if (!chosenReaction.compulsory) {
          const useReaction = await this.promptPlayer({
            playerId,
            options: {
              type: 'confirm',
              message: `Use ${this.cardLibrary.getCard(chosenReaction.sourceCardId).cardName} reaction?`,
              options: ['Yes', 'No']
            }
          });
          
          if (!useReaction) {
            chosenReaction = null;
          }
        }
      }
      else {
        // Let player choose between multiple reactions
        const reactionOptions = playerReactions.map(r => ({
          id: r.id,
          name: this.cardLibrary.getCard(r.sourceCardId).cardName
        }));
        
        const chosenId = await this.promptPlayer({
          playerId,
          options: {
            type: 'select',
            message: 'Choose a reaction to use:',
            options: [...reactionOptions, { id: 'none', name: 'Do not react' }]
          }
        });
        
        if (chosenId !== 'none') {
          chosenReaction = playerReactions.find(r => r.id === chosenId) || null;
        }
      }
      
      if (chosenReaction) {
        const result = await chosenReaction.execute({
          effectsController: this._effectsController!,
          event,
          match: this.match,
          cardLibrary:
          this.cardLibrary
        });
        results.push(result);
        
        if (chosenReaction.once) {
          this.unregisterReaction(chosenReaction.id);
        }
        
        // If this reaction prevents further processing, stop here
        if (result.prevented) {
          break;
        }
      }
    }
    
    return results;
  }
}