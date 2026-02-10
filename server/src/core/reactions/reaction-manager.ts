import { Card, CardId, CardLike, Event, Landmark, Match, Player } from 'shared/shared-types.ts';
import {
  CardLifecycleEvent,
  CardLifecycleEventArgMap,
  FindCardsFn,
  GameLifecycleCallback,
  GameLifecycleEvent,
  GameLifeCycleEventArgsMap,
  ReactionContext,
  Reaction,
  ReactionSourceType,
  ReactionTemplate,
  ReactionTemplateOptions,
  ReactionTrigger,
  RunGameActionDelegate, TriggeredEffectContext,
  TriggerEventType
} from '../../types.ts';
import { MatchCardLibrary } from '../match-card-library.ts';
import { getOrderStartingFrom } from '../../utils/get-order-starting-from.ts';
import { groupReactionsByCardKey } from './group-reactions-by-card-key.ts';
import { initImmunityScope } from '../../utils/reaction-immunity.ts';
import { buildActionButtons } from './build-action-buttons.ts';
import { buildActionMap } from './build-action-map.ts';
import { cardLifecycleMap } from '../card-lifecycle-map.ts';
import { LogManager } from '../log-manager.ts';
import { CardPriceRulesController } from '../card-price-rules-controller.ts';
import { CardSourceController } from '../card-source-controller.ts';

export class ReactionManager {
  private _reactions: Reaction[] = [];
  private _expansionGameEventHandlers: Record<GameLifecycleEvent, GameLifecycleCallback[]> = {} as Record<GameLifecycleEvent, GameLifecycleCallback[]>
  // Tracks duration-trigger IDs so they can be cleaned up when a card leaves play.
  private _durationTriggerIdsByCardId: Map<CardId, Set<string>> = new Map();

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

  // Associates duration triggers with a card ID for cleanup on leave-play.
  registerDurationTriggers(cardId: CardId, triggerIds: string[]) {
    if (!triggerIds.length) return;
    const existing = this._durationTriggerIdsByCardId.get(cardId) ?? new Set<string>();
    for (const triggerId of triggerIds) {
      existing.add(triggerId);
    }
    this._durationTriggerIdsByCardId.set(cardId, existing);
  }

  // Removes any duration triggers associated with the given card ID.
  cleanupDurationTriggers(cardId: CardId) {
    const triggerIds = this._durationTriggerIdsByCardId.get(cardId);
    if (!triggerIds) return;
    for (const triggerId of triggerIds) {
      this.unregisterTrigger(triggerId);
    }
    this._durationTriggerIdsByCardId.delete(cardId);
  }

  async getReactions(trigger: ReactionTrigger, reactionSet?: Reaction[]) {
    const reactions = reactionSet ?? this._reactions;
    const finalReactions: Reaction[] = [];
    for (const reaction of reactions) {
      if (reaction.listeningFor !== trigger.eventType) continue;

      console.info(`[REACTION MANAGER] checking trigger ${trigger} condition for ${reaction.id} reaction`);

      let include = true;

      if (reaction.condition !== undefined) {
        const result = await reaction.condition({
          cardSourceController: this._cardSourceController,
          cardPriceController: this.cardPriceController,
          logManager: this.logManager,
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
        console.info(`[REACTION MANAGER] removing trigger reaction ${triggerId} for player ${this._match.players?.find((player) => player.id === trigger.playerId)}`);
      }
    }
  }

  registerSystemTemplate<T extends TriggerEventType>(
    cardLike: CardLike,
    event: T,
    reactionTemplate: Omit<ReactionTemplate<T>, 'id' | 'listeningFor'>,
    templateOptions?: ReactionTemplateOptions,
  ): string {
    // Support an optional suffix for system reaction IDs.
    const idSuffix = templateOptions?.idSuffix;
    const systemTemplate = {
      ...reactionTemplate,
      id: `${cardLike.cardKey}:${cardLike.id}:${event}:system` +
        (idSuffix ? `:${idSuffix}` : ''),
      system: true
    }

    return this.registerReactionTemplate(cardLike, event, systemTemplate);
  }

  registerReactionTemplate<T extends TriggerEventType>(
    cardLike: CardLike,
    event: T,
    reactionTemplate: Omit<ReactionTemplate<T>, 'id' | 'listeningFor' | 'system'>,
    templateOptions?: ReactionTemplateOptions,
  ): string
  registerReactionTemplate<T extends TriggerEventType>(reactionTemplate: ReactionTemplate<T>): string
  registerReactionTemplate<T extends TriggerEventType>(
    cardLikeOrTemplate: CardLike | ReactionTemplate<T>,
    event?: T,
    reactionTemplate?: Omit<ReactionTemplate<T>, 'id' | 'listeningFor' | 'system'>,
    templateOptions?: ReactionTemplateOptions,
  ): string {
    let template: ReactionTemplate<T>;

    if (!(cardLikeOrTemplate instanceof CardLike)) {
      template = cardLikeOrTemplate;
    }
    else {
      // Resolve a stable source type for card-like reactions.
      const sourceType: ReactionSourceType = cardLikeOrTemplate instanceof Event
        ? 'event'
        : cardLikeOrTemplate instanceof Landmark
        ? 'landmark'
        : cardLikeOrTemplate instanceof Card
        ? 'card'
        : 'other';
      // Allow optional ID suffixes for default reaction IDs.
      const idSuffix = templateOptions?.idSuffix;
      const defaultId = `${cardLikeOrTemplate.cardName}:${cardLikeOrTemplate.id}:${event}` +
        (idSuffix ? `:${idSuffix}` : '');
      template = {
        ...reactionTemplate,
        listeningFor: event,
        id: reactionTemplate && 'id' in reactionTemplate ? reactionTemplate.id : defaultId,
        // Populate reaction source metadata for UI labels.
        sourceId: reactionTemplate?.sourceId ?? cardLikeOrTemplate.id,
        sourceKey: reactionTemplate?.sourceKey ?? cardLikeOrTemplate.cardKey,
        sourceName: reactionTemplate?.sourceName ?? cardLikeOrTemplate.cardName,
        sourceType: reactionTemplate?.sourceType ?? sourceType,
      } as ReactionTemplate<T>;
    }

    console.info(`[REACTION MANAGER] registering trigger template ID ${template.id}, for player ${template.playerId}`);

    this._reactions.push(new Reaction(template) as any);
    return template.id;
  }

  async runGameLifecycleEvent<T extends GameLifecycleEvent>(trigger: T, ...args: GameLifeCycleEventArgsMap[T] extends void ? [] : [GameLifeCycleEventArgsMap[T]]) {
    for (const handler of this._expansionGameEventHandlers[trigger] ?? []) {
      await handler({
        cardSourceController: this._cardSourceController,
        findCards: this._findCards,
        cardPriceController: this.cardPriceController,
        logManager: this.logManager,
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

    console.info(`[REACTION MANAGER] running lifecycle trigger '${trigger}' for card ${card}`);

    await fn({
      cardSourceController: this._cardSourceController,
      runGameActionDelegate: this.runGameActionDelegate,
      cardPriceController: this.cardPriceController,
      logManager: this.logManager,
      cardLibrary: this._cardLibrary,
      match: this._match,
      reactionManager: this,
      findCards: this._findCards
    }, args as any);
  }

  async runTrigger({ trigger, reactionContext }: { trigger: ReactionTrigger, reactionContext?: ReactionContext }) {
    reactionContext ??= {};
    // Track immunity scope to ensure context is not reused across triggers.
    initImmunityScope(reactionContext, trigger);

    // now we get the order of players that could be affected by the play (including the current player),
    // then get reactions for them and run them
    const targetOrder = getOrderStartingFrom(
      this._match.players,
      this._match.currentPlayerTurnIndex,
    );

    for (const targetPlayer of targetOrder) {
      console.info(`[REACTION MANAGER] checking '${trigger.eventType}' reactions for ${targetPlayer}`);

      const usedReactionIds = new Set<string>();
      const blockedCardKeys = new Set<string>();
      const queuedAutoReactions: Reaction[] = [];
      const queuedAutoIds = new Set<string>();

      while (true) {
        const reactions = (await this.getReactionsForPlayer(
          trigger,
          targetPlayer.id,
        )).filter((r) => {
          const key = r.getSourceKey();
          return !usedReactionIds.has(r.id) && !blockedCardKeys.has(key);
        });

        // Queue auto-resolve reactions to run after player-driven ordering is complete.
        for (const reaction of reactions) {
          if (reaction.autoResolve && !queuedAutoIds.has(reaction.id)) {
            queuedAutoReactions.push(reaction);
            queuedAutoIds.add(reaction.id);
          }
        }

        const promptReactions = reactions.filter((reaction) => !reaction.autoResolve);

        console.info(`[REACTION MANAGER] ${targetPlayer} has ${promptReactions.length} remaining reactions`);

        if (!promptReactions.length) break;

        const compulsoryReactions = promptReactions.filter(r => r.compulsory && !r.system);

        const systemReactions = promptReactions.filter(r => r.system);

        if (systemReactions.length) {
    for (const systemReaction of systemReactions) {
      console.info(`[REACTION MANAGER] running system reaction ${systemReaction.id} for ${targetPlayer}`);
      const systemContext = this.buildTriggeredEffectContext(trigger, systemReaction);
      await this.runReaction(systemReaction, trigger, targetPlayer, systemContext, reactionContext);
    }

          continue;
        }

        let selectedReaction: Reaction | undefined = undefined;

        const shouldPrompt = (
          promptReactions.length > 1 &&
          (
            compulsoryReactions.length !== promptReactions.length || // mix of compulsory + optional
            !compulsoryReactions.every(r => r.getSourceKey() === compulsoryReactions[0].getSourceKey()) // different
                                                                                                        // cards
          )
        );

        // when multiple reactions can occur, the user chooses unless they are all compulsory
        // and the same card
        if (shouldPrompt || (promptReactions.length === 1 && compulsoryReactions.length === 0)) {
          const grouped = groupReactionsByCardKey(promptReactions);
          const actionButtons = buildActionButtons(grouped, this._cardLibrary);
          const actionMap = buildActionMap(grouped);

          console.info(`[REACTION MANAGER] prompting ${targetPlayer} to choose reaction`);

          const result = await this.runGameActionDelegate('userPrompt', {
            playerId: targetPlayer.id,
            actionButtons,
            prompt: 'Choose reaction?',
          }) as { action: number };

          if (result.action === 0) {
            console.info(`[REACTION MANAGER] ${targetPlayer} chose not to react`);
            break;
          }
          else {
            console.info(`[REACTION MANAGER] ${targetPlayer} reacts with ${actionMap.get(result.action)}`);
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

        const reactionContextObject = this.buildTriggeredEffectContext(
          trigger,
          selectedReaction,
        );
        await this.runReaction(
          selectedReaction,
          trigger,
          targetPlayer,
          reactionContextObject,
          reactionContext,
        );

        usedReactionIds.add(selectedReaction.id);

        if (!selectedReaction.allowMultipleInstances) {
          blockedCardKeys.add(selectedReaction.getSourceKey());
        }
      }

      // Auto-resolve any queued reactions after player ordering decisions.
      for (const autoReaction of queuedAutoReactions) {
        // Re-check the reaction condition against the latest game state.
        const stillValid = (await this.getReactions(trigger, [autoReaction])).length > 0;
        if (!stillValid) continue;

        console.info(`[REACTION MANAGER] auto-resolving reaction ${autoReaction.id} for ${targetPlayer}`);
        const autoReactionContext = this.buildTriggeredEffectContext(
          trigger,
          autoReaction,
        );
        await this.runReaction(
          autoReaction,
          trigger,
          targetPlayer,
          autoReactionContext,
          reactionContext,
        );
      }
    }
  }

  private async runReaction<T extends TriggerEventType>(reaction: Reaction, trigger: ReactionTrigger<T>, targetPlayer: Player, context: TriggeredEffectContext<T>, reactionContext?: any) {
    await this.logManager.withIndent(async () => {
      // Ensure reaction-caused logs are scoped and unwind cleanly.
      await reaction.triggeredEffectFn({
        ...context,
        reactionContext,
      });
    });

    if (reaction.once) {
      console.info(`[REACTION MANAGER] selected reaction is single-use, unregistering it`);
      this.unregisterTrigger(reaction.id);
    }
  }

  private buildTriggeredEffectContext<T extends TriggerEventType>(
    trigger: ReactionTrigger<T>,
    reaction: Reaction,
  ): TriggeredEffectContext<T> {
    return {
      cardSourceController: this._cardSourceController,
      findCards: this._findCards,
      reactionManager: this,
      cardPriceController: this.cardPriceController,
      logManager: this.logManager,
      isRootLog: false,
      runGameActionDelegate: this.runGameActionDelegate,
      trigger,
      cardLibrary: this._cardLibrary,
      match: this._match,
      reaction,
    };
  }
}
