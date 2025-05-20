import { CardId, Match, Player } from 'shared/shared-types.ts';
import {
  CardLifecycleEvent,
  CardLifecycleEventArgMap,
  FindCardsFn,
  GameLifecycleCallback,
  GameLifecycleEvent,
  GameLifeCycleEventArgsMap,
  Reaction,
  ReactionTemplate,
  ReactionTrigger,
  RunGameActionDelegate, TriggeredEffectContext,
  TriggerEventType
} from '../../types.ts';
import { MatchCardLibrary } from '../match-card-library.ts';
import { getOrderStartingFrom } from '../../utils/get-order-starting-from.ts';
import { groupReactionsByCardKey } from './group-reactions-by-card-key.ts';
import { buildActionButtons } from './build-action-buttons.ts';
import { buildActionMap } from './build-action-map.ts';
import { cardLifecycleMap } from '../card-lifecycle-map.ts';
import { LogManager } from '../log-manager.ts';
import { CardPriceRulesController } from '../card-price-rules-controller.ts';
import { CardSourceController } from '../card-source-controller.ts';

export class ReactionManager {
  private _reactions: Reaction[] = [];
  private _expansionGameEventHandlers: Record<GameLifecycleEvent, GameLifecycleCallback[]> = {} as Record<GameLifecycleEvent, GameLifecycleCallback[]>
  
  constructor(
    private readonly _cardSourceController: CardSourceController,
    private readonly _findCards: FindCardsFn,
    private readonly cardPriceController: CardPriceRulesController,
    private readonly logManager: LogManager,
    private readonly _match: Match,
    private readonly _cardLibrary: MatchCardLibrary,
    private readonly runGameActionDelegate: RunGameActionDelegate
  ) {
  }
  
  public endGame() {
  }
  
  registerGameEvent(event: GameLifecycleEvent, handler: GameLifecycleCallback) {
    this._expansionGameEventHandlers[event] ??= [];
    this._expansionGameEventHandlers[event].push(handler);
  }
  
  async getReactions(trigger: ReactionTrigger, reactionSet?: Reaction[]) {
    const reactions = reactionSet ?? this._reactions;
    const finalReactions: Reaction[] = [];
    for (const reaction of reactions) {
      if (reaction.listeningFor !== trigger.eventType) continue;
      
      console.log(`[REACTION MANAGER] checking trigger ${trigger} condition for ${reaction.id} reaction`);
      
      let include = true;
      
      if (reaction.condition !== undefined) {
        const result = await reaction.condition({
          cardSourceController: this._cardSourceController,
          cardPriceController: this.cardPriceController,
          reactionManager: this,
          runGameActionDelegate: this.runGameActionDelegate,
          findCards: this._findCards,
          match: this._match,
          cardLibrary:
          this._cardLibrary,
          trigger,
          reaction
        });
        
        include = result;
      }
      
      if (include) {
        finalReactions.push(reaction);
      }
    }
    
    return finalReactions;
  }
  
  async getReactionsForPlayer(trigger: ReactionTrigger, playerId: number) {
    const playerReactions = this._reactions.filter(reaction => reaction.playerId === playerId);
    return await this.getReactions(trigger, playerReactions);
  }
  
  unregisterTrigger(triggerId: string) {
    for (let i = this._reactions.length - 1; i >= 0; i--) {
      const trigger = this._reactions[i];
      if (trigger.id === triggerId) {
        this._reactions.splice(i, 1);
        console.log(`[REACTION MANAGER] removing trigger reaction ${triggerId} for player ${this._match.players?.find((player) => player.id === trigger.playerId)}`);
      }
    }
  }
  
  registerSystemTemplate<T extends TriggerEventType>(cardId: CardId, event: T, reactionTemplate: Omit<ReactionTemplate<T>, 'id' | 'listeningFor'>): void {
    const card = this._cardLibrary.getCard(cardId);
    
    const systemTemplate = {
      ...reactionTemplate,
      id: `${card.cardKey}:${cardId}:${event}:system`,
      system: true
    }
    
    this.registerReactionTemplate(cardId, event, systemTemplate);
  }
  
  registerReactionTemplate<T extends TriggerEventType>(cardId: CardId, event: T, reactionTemplate: Omit<ReactionTemplate<T>, 'id' | 'listeningFor' | 'system'>): void
  registerReactionTemplate<T extends TriggerEventType>(reactionTemplate: ReactionTemplate<T>): void
  registerReactionTemplate<T extends TriggerEventType>(cardIdOrTemplate: CardId | ReactionTemplate<T>, event?: T, reactionTemplate?: Omit<ReactionTemplate<T>, 'id' | 'listeningFor' | 'system'>) {
    let template: ReactionTemplate<T>;
    
    if (typeof cardIdOrTemplate === 'object') {
      template = cardIdOrTemplate;
    }
    else {
      const card = this._cardLibrary.getCard(cardIdOrTemplate);
      
      template = {
        ...reactionTemplate,
        listeningFor: event,
        id: reactionTemplate && 'id' in reactionTemplate ? reactionTemplate.id : `${card.cardName}:${cardIdOrTemplate}:${event}`
      } as ReactionTemplate<T>;
    }
    
    console.log(`[REACTION MANAGER] registering trigger template ID ${template.id}, for player ${template.playerId}`);
    
    this._reactions.push(new Reaction(template) as any);
  }
  
  async runGameLifecycleEvent<T extends GameLifecycleEvent>(trigger: T, ...args: GameLifeCycleEventArgsMap[T] extends void ? [] : [GameLifeCycleEventArgsMap[T]]) {
    for (const handler of this._expansionGameEventHandlers[trigger] ?? []) {
      await handler({
        cardSourceController: this._cardSourceController,
        findCards: this._findCards,
        cardPriceController: this.cardPriceController,
        cardLibrary: this._cardLibrary,
        match: this._match,
        reactionManager: this,
        runGameActionDelegate: this.runGameActionDelegate,
      }, ...args)
    }
  }
  
  async runCardLifecycleEvent<T extends CardLifecycleEvent>(trigger: T, args: CardLifecycleEventArgMap[T]) {
    const card = this._cardLibrary.getCard(args.cardId);
    
    const fn = cardLifecycleMap[card.cardKey]?.[trigger];
    if (!fn) {
      return;
    }
    
    console.log(`[REACTION MANAGER] running lifecycle trigger '${trigger}' for card ${card}`);
    
    await fn({
      cardSourceController: this._cardSourceController,
      runGameActionDelegate: this.runGameActionDelegate,
      cardPriceController: this.cardPriceController,
      cardLibrary: this._cardLibrary,
      match: this._match,
      reactionManager: this,
      findCards: this._findCards
    }, args as any);
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
        const reactions = (await this.getReactionsForPlayer(
          trigger,
          targetPlayer.id,
        )).filter((r) => {
          const key = r.getSourceKey();
          return !usedReactionIds.has(r.id) && !blockedCardKeys.has(key);
        });
        
        console.log(`[REACTION MANAGER] ${targetPlayer} has ${reactions.length} remaining reactions`);
        
        if (!reactions.length) break;
        
        const compulsoryReactions = reactions.filter(r => r.compulsory && !r.system);
        
        const systemReactions = reactions.filter(r => r.system);
        
        if (systemReactions.length) {
          for (const systemReaction of systemReactions) {
            console.log(`[REACTION MANAGER] running system reaction ${systemReaction.id} for ${targetPlayer}`);
            await this.runReaction(systemReaction, trigger, targetPlayer, reactionContext);
          }
          
          continue;
        }
        
        let selectedReaction: Reaction | undefined = undefined;
        
        const shouldPrompt = (
          reactions.length > 1 &&
          (
            compulsoryReactions.length !== reactions.length || // mix of compulsory + optional
            !compulsoryReactions.every(r => r.getSourceKey() === compulsoryReactions[0].getSourceKey()) // different
                                                                                                        // cards
          )
        );
        
        // when multiple reactions can occur, the user chooses unless they are all compulsory
        // and the same card
        if (shouldPrompt || (reactions.length === 1 && compulsoryReactions.length === 0)) {
          const grouped = groupReactionsByCardKey(reactions);
          const actionButtons = buildActionButtons(grouped, this._cardLibrary);
          const actionMap = buildActionMap(grouped);
          
          console.log(`[REACTION MANAGER] prompting ${targetPlayer} to choose reaction`);
          
          const result = await this.runGameActionDelegate('userPrompt', {
            playerId: targetPlayer.id,
            actionButtons,
            prompt: 'Choose reaction?',
          }) as { action: number };
          
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
        
        await this.runReaction(selectedReaction, trigger, targetPlayer,{
          cardSourceController: this._cardSourceController,
          findCards: this._findCards,
          reactionManager: this,
          cardPriceController: this.cardPriceController,
          isRootLog: false,
          runGameActionDelegate: this.runGameActionDelegate,
          trigger,
          cardLibrary: this._cardLibrary,
          match: this._match,
          reaction: selectedReaction,
        }, reactionContext);
        
        usedReactionIds.add(selectedReaction.id);
        
        if (!selectedReaction.allowMultipleInstances) {
          blockedCardKeys.add(selectedReaction.getSourceKey());
        }
      }
    }
  }
  
  private async runReaction<T extends TriggerEventType>(reaction: Reaction, trigger: ReactionTrigger<T>, targetPlayer: Player, context: TriggeredEffectContext<T>, reactionContext?: any) {
    const reactionResult = await reaction.triggeredEffectFn({
      cardSourceController: this._cardSourceController,
      findCards: this._findCards,
      reactionManager: this,
      cardPriceController: this.cardPriceController,
      isRootLog: false,
      runGameActionDelegate: this.runGameActionDelegate,
      trigger,
      cardLibrary: this._cardLibrary,
      match: this._match,
      reaction,
    });
    
    // right now the only card that created that has a reaction that the
    // card triggering it needs to know about is moat giving immunity.
    // every other reaction just returns undefined. so if the reaction
    // doesn't give a result, don't set it on the context. this might
    // have to expand later.
    if (reactionResult !== undefined) {
      reactionContext[targetPlayer.id] = {
        reaction,
        trigger,
        result: reactionResult,
      };
    }
    
    if (reaction.once) {
      console.log(`[REACTION MANAGER] selected reaction is single-use, unregistering it`);
      this.unregisterTrigger(reaction.id);
    }
  }
}
