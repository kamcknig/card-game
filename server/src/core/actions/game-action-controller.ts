import {
  Card,
  CardCost,
  CardFacing,
  CardId,
  CardKey,
  CardLikeId,
  CardLocation,
  CardLocationSpec,
  CountSpec,
  ExtraTurn,
  Match,
  PlayerId,
  SelectActionCardArgs,
  SelectSingleActionCardArgs,
  TokenFacing,
  TokenId,
  TokenInstance,
  TokenInstanceId,
  TokenLocation,
  TurnPhase,
  TurnPhaseOrderValues,
  UserPromptActionArgs,
  BaseCardMetadata,
  SetAsideSourceDescriptor,
  SetAsideSourceKind,
} from 'shared/types/index.ts';
import { MatchCardLibrary } from '../match-card-library.ts';
import { LogManager } from '../log-manager.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import {
  ActionService,
  AppSocket,
  CardEffectFn,
  CardEffectFunctionContext,
  CardEffectFunctionMap,
  DurationReactionTemplate,
  DurationEffectOptions,
  FindCardService,
  GameActionContext,
  GameActionContextMap,
  GameActionDefinitionMap,
  GameActionOverrides,
  GameActionReturnTypeMap,
  GameActions,
  PromptService,
  ReactionTemplate,
  ReactionTrigger,
  SetAsideSourceInput,
  TriggerEventType,
} from '@server-types/index.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { ReactionManager } from '../reactions/reaction-manager.ts';
import { CardInteractivityController } from '../card-interactivity-controller.ts';
import { CardPriceRulesController } from '../card-price-rules-controller.ts';
import { CardSourceController } from '../card-source-controller.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { prosperityTokenIds } from '@expansions/prosperity/token-prosperity-ids.ts';
import { renaissanceTokenIds } from '@expansions/renaissance/token-ids-renaissance.ts';
import { alliesTokenIds } from '@expansions/allies/token-ids-allies.ts';
import {
  findBoonInMatch,
  findCardLikeEntryInMatch,
  findCardLikeInMatch,
  findEventInMatch,
  findHexInMatch,
  findProjectInMatch,
  findWayInMatch,
} from '@shared/find-card-like-in-match.ts';
import { getPlayerTurnIndex } from '@shared/get-player-position-utils.ts';
import { BuyOptionsResolver } from './resolve-buy-options.ts';
import { CardEffectContextFactory } from './card-effect-context-factory.ts';
import { TokenRegistryService } from '../tokens/token-registry-service.ts';
import { RngService } from '../rng-service.ts';
import { LoggerService } from '../logger-service.ts';

export class GameActionController implements GameActionDefinitionMap {
  private _customActionHandlers: Partial<GameActionDefinitionMap> = {};
  private _customCardEffectHandlers: Record<string, Partial<Record<CardKey, CardEffectFn>>> = {};
  // Guards against re-entrant computer turns triggered by nested game actions.
  private _computerTurnInProgress: boolean = false;
  // Stores one-shot Way choices captured during prompt-driven "select card to play" flows.
  private _pendingPlaySelectionWayByPlayerAndCard = new Map<string, {
    wayId: CardLikeId | null;
    turnHistoryIndex: number | undefined;
  }>();

  constructor(
    private cardSourceController: CardSourceController,
    private findCardService: FindCardService,
    private cardPriceController: CardPriceRulesController,
    private readonly cardEffectFunctionMap: CardEffectFunctionMap,
    private readonly eventEffectFunctionMap: CardEffectFunctionMap,
    private readonly projectEffectFunctionMap: CardEffectFunctionMap,
    private readonly wayEffectFunctionMap: CardEffectFunctionMap,
    private readonly boonEffectFunctionMap: CardEffectFunctionMap,
    private readonly hexEffectFunctionMap: CardEffectFunctionMap,
    private readonly stateEffectFunctionMap: CardEffectFunctionMap,
    private readonly artifactEffectFunctionMap: CardEffectFunctionMap,
    private readonly match: Match,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly logManager: LogManager,
    private socketMap: Map<PlayerId, AppSocket>,
    private readonly reactionManager: ReactionManager,
    private interactivityController: CardInteractivityController,
    private buyOptionsResolver: BuyOptionsResolver,
    private promptService: PromptService,
    private readonly actionService: ActionService,
    private readonly cardEffectContextFactory: CardEffectContextFactory,
    private readonly tokenRegistryService: TokenRegistryService,
    private readonly rngService: RngService,
    private readonly loggerService: LoggerService,
  ) {}

  public registerCardEffect(cardKey: CardKey, tag: string, fn: CardEffectFn) {
    this._customCardEffectHandlers[tag] ??= {};

    if (this._customCardEffectHandlers[tag][cardKey]) {
      this.loggerService.warn(`[action controller] effect for ${cardKey} in ${tag} already exists, overwriting it`);
    }

    this._customCardEffectHandlers[tag][cardKey] = fn;
  }

  // Registers boon effects for the current match.
  public registerBoonEffect(cardKey: CardKey, fn: CardEffectFn) {
    if (this.boonEffectFunctionMap[cardKey]) {
      this.loggerService.warn(`[action controller] boon effect for ${cardKey} already exists, overwriting it`);
    }
    this.boonEffectFunctionMap[cardKey] = fn;
  }

  // Registers hex effects for the current match.
  public registerHexEffect(cardKey: CardKey, fn: CardEffectFn) {
    if (this.hexEffectFunctionMap[cardKey]) {
      this.loggerService.warn(`[action controller] hex effect for ${cardKey} already exists, overwriting it`);
    }
    this.hexEffectFunctionMap[cardKey] = fn;
  }

  // Registers state effects for the current match.
  public registerStateEffect(cardKey: CardKey, fn: CardEffectFn) {
    if (this.stateEffectFunctionMap[cardKey]) {
      this.loggerService.warn(`[action controller] state effect for ${cardKey} already exists, overwriting it`);
    }
    this.stateEffectFunctionMap[cardKey] = fn;
  }

  // Registers artifact effects for the current match.
  public registerArtifactEffect(cardKey: CardKey, fn: CardEffectFn) {
    if (this.artifactEffectFunctionMap[cardKey]) {
      this.loggerService.warn(`[action controller] artifact effect for ${cardKey} already exists, overwriting it`);
    }
    this.artifactEffectFunctionMap[cardKey] = fn;
  }

  // Registers project effects for the current match.
  public registerProjectEffect(cardKey: CardKey, fn: CardEffectFn) {
    if (this.projectEffectFunctionMap[cardKey]) {
      this.loggerService.warn(`[action controller] project effect for ${cardKey} already exists, overwriting it`);
    }
    this.projectEffectFunctionMap[cardKey] = fn;
  }

  // Registers way effects for the current match.
  public registerWayEffect(cardKey: CardKey, fn: CardEffectFn) {
    if (this.wayEffectFunctionMap[cardKey]) {
      this.loggerService.warn(`[action controller] way effect for ${cardKey} already exists, overwriting it`);
    }
    this.wayEffectFunctionMap[cardKey] = fn;
  }

  // Returns the requested status-like store (state/artifact) from match state.
  private getStatusStore(kind: 'state' | 'artifact') {
    if (kind === 'state') {
      return this.match.states;
    }
    return this.match.artifacts;
  }

  // Resolves a status-like card from its id or key.
  private resolveStatusCard(
    store: { cards: { id: CardLikeId; cardKey: CardKey }[] },
    args: { statusId?: CardLikeId; statusKey?: CardKey },
  ) {
    return args.statusId !== undefined
      ? store.cards.find((candidate) => candidate.id === args.statusId)
      : store.cards.find((candidate) => candidate.cardKey === args.statusKey);
  }

  // Finds all owners of a status-like card id.
  private findStatusOwners(store: { byPlayer: Record<PlayerId, CardLikeId[]> }, statusId: CardLikeId): PlayerId[] {
    return Object.entries(store.byPlayer)
      .filter(([, statusIds]) => statusIds.includes(statusId))
      .map(([playerId]) => Number(playerId));
  }

  // Adds a status-like card to a player if not already owned.
  private addStatusToPlayer(
    store: { byPlayer: Record<PlayerId, CardLikeId[]> },
    playerId: PlayerId,
    statusId: CardLikeId,
  ) {
    store.byPlayer[playerId] ??= [];
    if (!store.byPlayer[playerId].includes(statusId)) {
      store.byPlayer[playerId].push(statusId);
    }
  }

  public async invokeAction<K extends GameActions>(
    action: K,
    ...args: Parameters<GameActionDefinitionMap[K]>
  ): Promise<GameActionReturnTypeMap[K]> {
    const controllerHandler = (this as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[
      action as string
    ];
    if (controllerHandler) {
      // Invoke on the controller instance so action methods retain `this` access to injected services.
      return await controllerHandler.apply(this, args as unknown[]) as GameActionReturnTypeMap[K];
    }

    const customHandler = this._customActionHandlers[action];
    if (!customHandler) {
      throw new Error(`No handler registered for action: ${action}`);
    }
    const customActionHandler = customHandler as (...args: unknown[]) => Promise<unknown>;
    return await customActionHandler(...(args as unknown[])) as GameActionReturnTypeMap[K];
  }

  // Builds a deterministic token instance id for stable patch ordering.
  private buildTokenInstanceId(tokenId: TokenId): TokenInstanceId {
    // Monotonic counter lives on match state to keep determinism across runs.
    const counter = this.match.tokenInstanceCounter;
    this.match.tokenInstanceCounter += 1;
    return `token:${tokenId}:${counter}`;
  }

  // Returns the token instance or throws if missing to keep token mutations explicit.
  private getTokenInstance(tokenInstanceId: TokenInstanceId): TokenInstance {
    const token = this.match.tokens[tokenInstanceId];
    if (!token) {
      throw new Error(`[token action] missing token instance ${tokenInstanceId}`);
    }
    return token;
  }

  // Returns the active turn-history index to disambiguate same-number extra turns.
  private getCurrentTurnHistoryIndex(): number | undefined {
    const turnHistoryIndex = this.match.stats.turns.length - 1;
    return turnHistoryIndex >= 0 ? turnHistoryIndex : undefined;
  }

  // Returns the stats bucket key for the active turn.
  private getCurrentTurnStatsIndex(): number {
    const turnHistoryIndex = this.getCurrentTurnHistoryIndex();
    if (turnHistoryIndex === undefined) {
      throw new Error('[game action controller] turn history is not initialized');
    }
    return turnHistoryIndex;
  }

  // Builds a deterministic map key for pending prompt-driven play selections.
  private getPendingPlaySelectionKey(playerId: PlayerId, cardId: CardId): string {
    return `${playerId}:${cardId}`;
  }

  // Clears pending play-selection Way choices for one player.
  private clearPendingPlaySelectionsForPlayer(playerId: PlayerId) {
    const keyPrefix = `${playerId}:`;
    for (const key of this._pendingPlaySelectionWayByPlayerAndCard.keys()) {
      if (key.startsWith(keyPrefix)) {
        this._pendingPlaySelectionWayByPlayerAndCard.delete(key);
      }
    }
  }

  // Parses prompt/select responses that can carry selected cards and an optional Way id.
  private parsePlayCardSelectionResult(response: unknown): {
    selectedCardIds: CardId[];
    selectedWayId?: CardLikeId | null;
  } | null {
    if (Array.isArray(response)) {
      if (!response.every((value) => typeof value === 'number')) {
        return null;
      }
      return { selectedCardIds: response as CardId[] };
    }

    if (!response || typeof response !== 'object') {
      return null;
    }

    const payload = response as {
      selectedCardIds?: unknown;
      selectedWayId?: unknown;
      result?: unknown;
    };

    if (Array.isArray(payload.selectedCardIds)) {
      if (!payload.selectedCardIds.every((value) => typeof value === 'number')) {
        return null;
      }
      const selectedWayId = payload.selectedWayId;
      if (selectedWayId !== undefined && selectedWayId !== null && typeof selectedWayId !== 'number') {
        return null;
      }
      return {
        selectedCardIds: payload.selectedCardIds as CardId[],
        selectedWayId: selectedWayId as CardLikeId | null | undefined,
      };
    }

    // userPrompt responses wrap payloads under `result` when action buttons are present.
    if (payload.result !== undefined) {
      const parsedNestedResult = this.parsePlayCardSelectionResult(payload.result);
      if (!parsedNestedResult) {
        return null;
      }
      const selectedWayId = payload.selectedWayId;
      if (selectedWayId !== undefined && selectedWayId !== null && typeof selectedWayId !== 'number') {
        return null;
      }
      if (selectedWayId !== undefined) {
        return {
          ...parsedNestedResult,
          selectedWayId: selectedWayId as CardLikeId | null,
        };
      }
      return parsedNestedResult;
    }

    return null;
  }

  // Queues a one-shot Way choice for the next playCard call of the selected card.
  private queuePendingWaySelectionForPlay(args: {
    playerId: PlayerId;
    selectedCardIds: CardId[];
    selectedWayId?: CardLikeId | null;
  }) {
    this.clearPendingPlaySelectionsForPlayer(args.playerId);
    if (args.selectedCardIds.length !== 1) {
      return;
    }

    const selectedCardId = args.selectedCardIds[0];
    const wayId = args.selectedWayId ?? null;
    const key = this.getPendingPlaySelectionKey(args.playerId, selectedCardId);
    const turnHistoryIndex = this.getCurrentTurnHistoryIndex();
    this._pendingPlaySelectionWayByPlayerAndCard.set(key, {
      wayId,
      turnHistoryIndex,
    });
    this.loggerService.debug(
      `[playCard action] queued prompt Way selection player=${args.playerId} card=${selectedCardId} way=${wayId}`,
    );
  }

  // Infers whether a selection prompt is intended to choose a card to play.
  private inferPromptIsPlaySelection(prompt?: string): boolean {
    if (!prompt) {
      return false;
    }
    const normalizedPrompt = prompt.toLowerCase();
    if (normalizedPrompt === 'choose action' || normalizedPrompt.startsWith('choose action ')) {
      return true;
    }
    if (normalizedPrompt.includes('replay')) {
      return true;
    }

    if (
      normalizedPrompt.includes(' to play') &&
      !normalizedPrompt.includes('next turn') &&
      !normalizedPrompt.includes('set aside')
    ) {
      return true;
    }

    return normalizedPrompt.startsWith('play ') ||
      normalizedPrompt.includes('choose to play') ||
      normalizedPrompt.includes('you may play ');
  }

  // Consumes and returns a queued Way choice for one selected card, when still in the same turn.
  private consumePendingWaySelectionForPlay(playerId: PlayerId, cardId: CardId): CardLikeId | null | undefined {
    const key = this.getPendingPlaySelectionKey(playerId, cardId);
    const entry = this._pendingPlaySelectionWayByPlayerAndCard.get(key);
    if (!entry) {
      return undefined;
    }
    this._pendingPlaySelectionWayByPlayerAndCard.delete(key);
    if (entry.turnHistoryIndex !== this.getCurrentTurnHistoryIndex()) {
      this.loggerService.debug(
        `[playCard action] discarding stale queued Way selection player=${playerId} card=${cardId}`,
      );
      return undefined;
    }
    return entry.wayId;
  }

  // Returns the player's Exile zone source when available.
  private getExileSource(playerId: PlayerId): CardId[] | undefined {
    try {
      return this.cardSourceController.getSource('exile', playerId);
    } catch {
      return undefined;
    }
  }

  // Resolves "discard all or none from Exile on gain" for the gained card key.
  private async resolveExileDiscardOnGain(args: {
    playerId: PlayerId;
    gainedCardId: CardId;
    gainedCardKey: CardKey;
    loggingContext?: GameActionContext['loggingContext'];
  }) {
    const exileSource = this.getExileSource(args.playerId);
    if (!exileSource || exileSource.length === 0) {
      return;
    }

    // Exile only allows discarding other copies of the gained card, never the gained card itself.
    const matchingExileCardIds = exileSource.filter((cardId) =>
      cardId !== args.gainedCardId && this.cardLibrary.getCard(cardId).cardKey === args.gainedCardKey
    );

    if (matchingExileCardIds.length === 0) {
      return;
    }

    const player = getPlayerById(this.match, args.playerId);
    let shouldDiscardFromExile = false;
    const gainedCardName = this.cardLibrary.getCard(args.gainedCardId).cardName;

    if (player?.isComputer) {
      // Computer policy is deterministic: always discard all matching cards from Exile.
      shouldDiscardFromExile = true;
    } else {
      shouldDiscardFromExile = await this.promptService.confirm({
        playerId: args.playerId,
        prompt: `Discard ${matchingExileCardIds.length} ${gainedCardName} card(s) from Exile?`,
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'YES', action: 2 },
        ],
      }, 2);
    }

    if (!shouldDiscardFromExile) {
      this.loggerService.debug(
        `[gainCard action] player ${args.playerId} kept ${matchingExileCardIds.length} ${args.gainedCardKey} card(s) in Exile`,
      );
      return;
    }

    this.loggerService.debug(
      `[gainCard action] player ${args.playerId} discarding ${matchingExileCardIds.length} ${args.gainedCardKey} card(s) from Exile`,
    );

    // Exile rule requires discarding all matching cards, and discard semantics should trigger normally.
    for (const exileCardId of matchingExileCardIds) {
      await this.discardCard(
        {
          playerId: args.playerId,
          cardId: exileCardId,
        },
        { loggingContext: args.loggingContext },
      );
    }
  }

  // Resolves the count spec into a deterministic selection count for computer picks.
  private resolveCountSpec(count: CountSpec | number, available: number, optional: boolean): number {
    if (typeof count === 'number') {
      return Math.min(count, available);
    }
    if (count.kind === 'exact') {
      return Math.min(count.count, available);
    }
    if (count.kind === 'upTo') {
      return Math.min(count.count, available);
    }
    if (count.kind === 'range') {
      // Use the upper bound for deterministic computer selections.
      return Math.min(count.max, available);
    }
    if (optional) {
      return Math.min(1, available);
    }
    return Math.min(1, available);
  }

  // Identifies direct card-id restrictions (including empty arrays).
  private isCardIdRestriction(restrict: SelectActionCardArgs['restrict']): restrict is CardId[] {
    return Array.isArray(restrict) && restrict.every((entry) => typeof entry === 'number');
  }

  // True when the location is one of the two Supply zones.
  private isSupplyLocation(location: CardLocation): location is 'basicSupply' | 'kingdomSupply' {
    return location === 'basicSupply' || location === 'kingdomSupply';
  }

  // Resolves the current visible top card for the supplied card's pile.
  private findTopSupplyCardForCard(card: Card): Card | undefined {
    return this.findCardService.findTopSupplyCardForPileKey({
      pileKey: getCardPileKey(card) as CardKey,
      from: ['basicSupply', 'kingdomSupply'],
    });
  }

  // Collapses supply candidates to visible top cards so board selection does not include hidden pile cards.
  private collapseSupplySelectableCards(selectableCardIds: CardId[]): CardId[] {
    if (selectableCardIds.length < 1) {
      return selectableCardIds;
    }

    const selectableSet = new Set(selectableCardIds);
    const collapsedSelectableIds: CardId[] = [];
    const seenSupplyPiles = new Set<string>();

    for (const selectableCardId of selectableCardIds) {
      let sourceKey: CardLocation;
      try {
        sourceKey = this.cardSourceController.findCardSource(selectableCardId).sourceKey;
      } catch {
        // Preserve ids when source lookup fails.
        if (!collapsedSelectableIds.includes(selectableCardId)) {
          collapsedSelectableIds.push(selectableCardId);
        }
        continue;
      }

      if (sourceKey !== 'basicSupply' && sourceKey !== 'kingdomSupply') {
        if (!collapsedSelectableIds.includes(selectableCardId)) {
          collapsedSelectableIds.push(selectableCardId);
        }
        continue;
      }

      const pileKey = getCardPileKey(this.cardLibrary.getCard(selectableCardId));
      if (seenSupplyPiles.has(pileKey)) {
        continue;
      }
      seenSupplyPiles.add(pileKey);

      const topSupplyCard = this.findCardService.findTopSupplyCardForPileKey({
        pileKey: pileKey as CardKey,
        from: ['basicSupply', 'kingdomSupply'],
      });
      if (!topSupplyCard) {
        continue;
      }

      // Keep only top cards that also satisfy the original filter set.
      if (selectableSet.has(topSupplyCard.id)) {
        collapsedSelectableIds.push(topSupplyCard.id);
      }
    }

    return collapsedSelectableIds;
  }

  // Registers duration cleanup and effect triggers with centralized cleanup tracking.
  private registerDurationEffectInternal<T extends TriggerEventType>(
    card: Card,
    context: CardEffectFunctionContext,
    triggeredTemplate: DurationReactionTemplate<T> | DurationReactionTemplate<T>[],
    options?: DurationEffectOptions,
  ): string[] {
    // Track trigger ids to enable cleanup when a card leaves play.
    const registeredTriggerIds: string[] = [];
    // Register cleanup handling to keep duration cards from being discarded while future effects remain.
    // `hasActiveEffects` is the new dynamic liveness contract: it is evaluated every owner cleanup.
    // Legacy cards continue to use cleanupCount when hasActiveEffects is not provided.
    const hasActiveEffects = options?.hasActiveEffects;
    const cleanupCount = Math.max(0, options?.cleanupCount ?? 1);
    const useLegacyCleanupCount = hasActiveEffects === undefined;
    // We need a cleanup-hold trigger whenever:
    // 1) dynamic liveness is configured, or
    // 2) legacy cleanup countdown indicates the card should stay at least one cleanup.
    const shouldRegisterCleanupHandler = hasActiveEffects !== undefined || cleanupCount > 0;
    if (shouldRegisterCleanupHandler) {
      let remainingCleanups = cleanupCount;
      const systemTriggerId = context.reactionManager.registerSystemTemplate(card, 'startTurnPhase', {
        playerId: context.playerId,
        // Legacy single-cleanup durations can use one-shot cleanup triggers.
        // Dynamic liveness must re-evaluate each owner cleanup, so it cannot be one-shot.
        once: useLegacyCleanupCount && cleanupCount === 1,
        allowMultipleInstances: true,
        condition: async (conditionArgs) => {
          // This trigger listens to every phase start. Restrict to cleanup only.
          const isCleanup = getTurnPhase(conditionArgs.trigger.args.phaseIndex) === 'cleanup';
          if (!isCleanup) {
            return false;
          }

          // Duration retention should only run during the duration owner's cleanup.
          // Other players' cleanups must not change this card's retention state.
          const currentPlayer = getCurrentPlayer(conditionArgs.match);
          if (currentPlayer.id !== context.playerId) {
            return false;
          }

          // Dynamic liveness always re-checks on each owner cleanup.
          if (!useLegacyCleanupCount) {
            return true;
          }

          // Legacy path: only continue while countdown has not exhausted.
          return remainingCleanups > 0;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          // Guard against stale triggers if the card already left play or changed owner.
          // In that case, remove this hold trigger and stop.
          let sourceInfo: { sourceKey: CardLocation; playerId?: PlayerId } | null = null;
          try {
            sourceInfo = triggeredArgs.cardSourceController.findCardSource(card.id);
          } catch {
            sourceInfo = null;
          }

          const isInPlayZone = sourceInfo?.sourceKey === 'playArea' || sourceInfo?.sourceKey === 'activeDuration';
          if (!isInPlayZone || card.owner !== context.playerId) {
            triggeredArgs.reactionManager.unregisterTrigger(triggeredArgs.reaction.id);
            return;
          }

          // Resolve "does this duration still have future work?".
          // Dynamic path uses hasActiveEffects; legacy path uses remaining cleanup count.
          let shouldStayActive = false;
          if (hasActiveEffects) {
            shouldStayActive = await hasActiveEffects(context);
          } else {
            shouldStayActive = remainingCleanups > 0;
          }

          // If no future effects remain, stop duration retention.
          // The normal cleanup flow will discard from playArea this turn.
          if (!shouldStayActive) {
            // If dynamic liveness is used, this cleanup-hold trigger is one of the duration triggers
            // and we want centralized cleanup/unregistration consistency.
            if (hasActiveEffects || options?.autoRemoveTriggersOnExhaust) {
              triggeredArgs.reactionManager.cleanupDurationTriggers(card.id);
            } else {
              triggeredArgs.reactionManager.unregisterTrigger(triggeredArgs.reaction.id);
            }
            return;
          }

          // Keep the card in the active-duration zone across cleanup boundaries.
          // Skip move if it's already there to avoid unnecessary reordering/log noise.
          if (sourceInfo?.sourceKey !== 'activeDuration') {
            this.loggerService.debug(
              `[${card.cardKey} duration effect] moving to activeDuration zone`,
            );

            await triggeredArgs.actionService.run('moveCard', {
              cardId: card.id,
              to: { location: 'activeDuration' },
            });
          }

          // Dynamic liveness does not use countdown depletion.
          // Card remains retained until hasActiveEffects returns false.
          if (!useLegacyCleanupCount) {
            return;
          }

          // Decrement legacy cleanup countdown and unregister when exhausted.
          remainingCleanups = Math.max(0, remainingCleanups - 1);
          if (remainingCleanups > 0) {
            return;
          }

          if (options?.autoRemoveTriggersOnExhaust) {
            triggeredArgs.reactionManager.cleanupDurationTriggers(card.id);
            return;
          }

          // Legacy minimal cleanup: only remove this hold trigger.
          triggeredArgs.reactionManager.unregisterTrigger(triggeredArgs.reaction.id);
        },
      }, {
        idSuffix: options?.idSuffix ? `${options.idSuffix}:durationCleanup` : undefined,
      });
      registeredTriggerIds.push(systemTriggerId);
    }

    // Register each duration effect template.
    // Three paths exist:
    // 1) Explicit id provided: register exactly as-is (caller owns the id).
    // 2) System template without id: use registerSystemTemplate so id/source metadata are generated consistently.
    // 3) Normal template without id: use card-scoped registerReactionTemplate with optional id suffix.
    const templates = Array.isArray(triggeredTemplate) ? triggeredTemplate : [triggeredTemplate];
    for (let templateIndex = 0; templateIndex < templates.length; templateIndex++) {
      const triggeredTemplateElement = templates[templateIndex];
      if (!triggeredTemplateElement) {
        continue;
      }

      // Keep generated ids stable per template slot when an idSuffix is provided.
      const templateIdSuffix = options?.idSuffix ? `${options.idSuffix}:duration:${templateIndex}` : undefined;

      // Explicit id path: preserve caller-defined id and register directly.
      if (triggeredTemplateElement.id) {
        const triggerId = context.reactionManager.registerReactionTemplate(
          triggeredTemplateElement as ReactionTemplate<T>,
        );
        registeredTriggerIds.push(triggerId);
        continue;
      }

      // System-trigger path: preserve system semantics while generating default ids from the source card.
      if (triggeredTemplateElement.system) {
        const { listeningFor, id: _id, ...systemTemplate } = triggeredTemplateElement;
        const triggerId = context.reactionManager.registerSystemTemplate(
          card,
          listeningFor,
          systemTemplate,
          { idSuffix: templateIdSuffix },
        );
        registeredTriggerIds.push(triggerId);
        continue;
      }

      // Standard trigger path: generate id/source metadata from the duration card and event.
      const { listeningFor, id: _id, system: _system, ...reactionTemplate } = triggeredTemplateElement;
      const triggerId = context.reactionManager.registerReactionTemplate(
        card,
        listeningFor,
        reactionTemplate,
        { idSuffix: templateIdSuffix },
      );
      registeredTriggerIds.push(triggerId);
    }

    return registeredTriggerIds;
  }

  // Builds a card-effect context with standardized duration registration wiring.
  private createCardEffectContext(args: {
    cardId: CardLikeId;
    playerId: PlayerId;
    reactionContext?: CardEffectFunctionContext['reactionContext'];
  }): CardEffectFunctionContext {
    let context: CardEffectFunctionContext;
    context = this.cardEffectContextFactory.create({
      cardId: args.cardId,
      playerId: args.playerId,
      reactionContext: args.reactionContext ?? {},
      cardEffectFunctionMap: this.cardEffectFunctionMap,
      customCardEffectHandlers: this._customCardEffectHandlers,
      registerDurationEffect: (durationCard, triggeredTemplate, options) => {
        const triggerIds = this.registerDurationEffectInternal(durationCard, context, triggeredTemplate, options);
        this.reactionManager.registerDurationTriggers(durationCard.id, triggerIds);
        return triggerIds;
      },
    });
    const sourceAwareActions = new Set<GameActions>([
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
    ]);
    context.actionService = {
      run: async <K extends GameActions>(
        action: K,
        ...runArgs: Parameters<GameActionDefinitionMap[K]>
      ): Promise<GameActionReturnTypeMap[K]> => {
        const [actionArgs, actionContext] = runArgs;
        if (!sourceAwareActions.has(action)) {
          return await this.actionService.run(action, ...runArgs);
        }
        if (!actionArgs || typeof actionArgs !== 'object' || Array.isArray(actionArgs)) {
          return await this.actionService.run(action, ...runArgs);
        }
        if (actionContext?.source !== undefined || actionContext?.loggingContext?.source !== undefined) {
          return await this.actionService.run(action, ...runArgs);
        }
        const argsWithSource = [
          actionArgs as Parameters<GameActionDefinitionMap[K]>[0],
          {
            ...(actionContext ?? {}),
            source: args.cardId as CardId,
          }
        ] as unknown as Parameters<GameActionDefinitionMap[K]>;

        return await this.runActionDirect(action, ...argsWithSource);
      },
    };
    return context;
  }

  // Executes actionService.run through one generic signature to avoid overload narrowing issues.
  private async runActionDirect<K extends GameActions>(
    action: K,
    ...args: Parameters<GameActionDefinitionMap[K]>
  ): Promise<GameActionReturnTypeMap[K]> {
    return await this.actionService.run(action, ...args);
  }

  // Resolves action attribution source from context first, then legacy logging fallback.
  private resolveActionSource(context?: GameActionContext): CardId | undefined {
    return context?.source ?? context?.loggingContext?.source;
  }

  // Executes an effect with consistent logging and error reporting.
  private async runEffectWithLogging(args: {
    source: string;
    sourceType: string;
    playerId: PlayerId;
    effectFn: CardEffectFn;
    context: CardEffectFunctionContext;
  }): Promise<void> {
    const effectContext = {
      scope: 'effect',
      sourceType: args.sourceType,
      source: args.source,
      playerId: args.playerId,
      cardId: args.context.cardId,
    } as const;

    this.loggerService.infoWithContext(
      effectContext,
      `[${args.sourceType} effect] start ${args.source} for player ${args.playerId}`,
    );
    this.loggerService.debugWithContext(
      effectContext,
      `[${args.sourceType} effect] context cardId ${args.context.cardId}`,
    );
    try {
      await this.logManager.withIndent(async () => {
        await args.effectFn(args.context);
      });
    } catch (error) {
      this.loggerService.errorWithContext(
        effectContext,
        `[${args.sourceType} effect] error ${args.source} for player ${args.playerId}`,
      );
      this.loggerService.errorWithContext(effectContext, error);
      throw error;
    }
    this.loggerService.infoWithContext(
      effectContext,
      `[${args.sourceType} effect] complete ${args.source} for player ${args.playerId}`,
    );
  }

  // Executes a single automatic action for the current computer player.
  private async runComputerTurnStep(): Promise<void> {
    if (this._computerTurnInProgress) return;

    const match = this.match;
    const currentPlayer = getCurrentPlayer(match);

    if (!currentPlayer.isComputer) return;

    this._computerTurnInProgress = true;

    try {
      const turnPhase = getTurnPhase(match.turnPhaseIndex);
      const selectable = match.selectableCards[currentPlayer.id] ?? [];

      if (turnPhase === 'action') {
        const actionCardId = selectable.find((id) => this.cardLibrary.getCard(id).type.includes('ACTION'));
        if (actionCardId) {
          // AI policy remains normal play only; way-choice heuristics are deferred.
          await this.actionService.run('playCard', { playerId: currentPlayer.id, cardId: actionCardId });
        }
        // Always move to the next phase after one action attempt.
        this._computerTurnInProgress = false;
        await this.actionService.run('nextPhase');
        return;
      }

      if (turnPhase === 'buy') {
        const selectedId = selectable[0];
        if (selectedId === undefined) {
          this._computerTurnInProgress = false;
          await this.actionService.run('nextPhase');
          return;
        }

        const event = findEventInMatch(match, selectedId);
        if (event) {
          await this.actionService.run('buyEvent', {
            playerId: currentPlayer.id,
            cardLikeId: selectedId,
          });
          this._computerTurnInProgress = false;
          await this.actionService.run('nextPhase');
          return;
        }

        const project = findProjectInMatch(match, selectedId);
        if (project) {
          await this.actionService.run('buyProject', {
            playerId: currentPlayer.id,
            cardLikeId: selectedId,
          });
          this._computerTurnInProgress = false;
          await this.actionService.run('nextPhase');
          return;
        }

        const card = this.cardLibrary.getCard(selectedId);
        const inHand = this.cardSourceController.getSource('playerHand', currentPlayer.id).includes(selectedId);
        if (inHand && card.type.includes('TREASURE')) {
          await this.actionService.run('playCard', {
            playerId: currentPlayer.id,
            cardId: selectedId,
            overrides: { actionCost: 0 },
          });
          this._computerTurnInProgress = false;
          await this.actionService.run('nextPhase');
          return;
        }

        const { restricted, cost } = this.cardPriceController.applyRules(card, { playerId: currentPlayer.id });
        if (!restricted) {
          await this.actionService.run('buyCard', {
            playerId: currentPlayer.id,
            cardId: card.id,
            cardCost: cost,
          });
        }

        this._computerTurnInProgress = false;
        await this.actionService.run('nextPhase');
        return;
      }

      if (turnPhase === 'night') {
        // Computer players play one Night card per Night phase, then advance.
        const nightCardId = selectable.find((id) => this.cardLibrary.getCard(id).type.includes('NIGHT'));
        this.loggerService.debug(`[computer turn] night phase selectable night card ${nightCardId ?? 'none'}`);
        if (nightCardId !== undefined) {
          await this.actionService.run('playCard', { playerId: currentPlayer.id, cardId: nightCardId });
        }
        this._computerTurnInProgress = false;
        await this.actionService.run('nextPhase');
        return;
      }
    } finally {
      this._computerTurnInProgress = false;
    }
  }

  // Applies any token bonuses for the player when a card is played from a tokened supply pile.
  private async applyTokenBonusesOnCardPlayed(playerId: PlayerId, cardId: CardId): Promise<void> {
    const card = this.cardLibrary.getCard(cardId);
    const pileKey = getCardPileKey(card);
    const tokenInstanceIds = Object.keys(this.match.tokens).sort();
    await this.logManager.withIndent(async () => {
      for (const tokenInstanceId of tokenInstanceIds) {
        const token = this.match.tokens[tokenInstanceId];
        if (token.ownerId !== playerId) continue;
        if (token.location.type !== 'supplyPile') continue;
        if (token.location.cardKey !== pileKey && token.location.cardKey !== card.cardKey) continue;
        const handler = this.tokenRegistryService.getTokenCardPlayedHandler(token.tokenId);
        if (!handler) continue;
        const definition = this.tokenRegistryService.getTokenDefinition(token.tokenId);
        const effectText = definition?.name ?? 'token bonus';
        // Log the token effect before applying its bonus for clarity in the log.
        this.logManager.addLogEntry({
          type: 'tokenEffect',
          playerId,
          cardId,
          tokenId: token.tokenId,
          effectText,
        });
        await handler({
          match: this.match,
          playerId,
          cardId,
          actionService: this.actionService,
        });
      }
    });
  }

  async gainPotion(args: { count: number }, _context?: GameActionContext) {
    this.loggerService.info(`[gainPotion action] gaining ${args.count} potions`);
    this.match.playerPotions += args.count;
    this.match.playerPotions = Math.max(0, this.match.playerPotions);

    this.loggerService.info(`[gainPotion action] setting player potions to ${this.match.playerPotions}`);
  }

  async gainBuy(args: { count: number }, context?: GameActionContext) {
    const source = this.resolveActionSource(context);
    this.loggerService.info(`[gainBuy action] gaining ${args.count} buys`);
    this.match.playerBuys += args.count;
    this.match.playerBuys = Math.max(this.match.playerBuys, 0);

    this.logManager.addLogEntry({
      type: 'gainBuy',
      count: args.count,
      playerId: getCurrentPlayer(this.match).id,
      source,
    });

    this.loggerService.info(`[gainBuy action] setting player guys to ${this.match.playerBuys}`);
  }

  async placeToken(args: {
    tokenId: TokenId;
    location: TokenLocation;
    ownerId?: PlayerId;
    counters?: number;
    facing?: TokenFacing;
    sourceCardId?: CardId;
  }, context?: GameActionContext): Promise<TokenInstance> {
    // Create a deterministic token instance id for stable patching.
    const tokenInstanceId = this.buildTokenInstanceId(args.tokenId);
    // Create the token instance with explicit location and ownership metadata.
    const tokenInstance: TokenInstance = {
      id: tokenInstanceId,
      tokenId: args.tokenId,
      location: args.location,
      ownerId: args.ownerId,
      counters: args.counters,
      facing: args.facing,
      sourceCardId: args.sourceCardId,
    };
    // Persist the token instance on match state for patch broadcasting.
    this.match.tokens[tokenInstanceId] = tokenInstance;
    this.loggerService.debug(`[placeToken action] placed token ${args.tokenId} as ${tokenInstanceId}`);
    // Emit token placement logs only when callers provide logging context.
    if (context && !context.loggingContext?.suppress) {
      const targetPlayerId = args.ownerId ?? getCurrentPlayer(this.match).id;
      this.logManager.addLogEntry({
        type: 'tokenPlaced',
        playerId: targetPlayerId,
        tokenId: args.tokenId,
        source: context.loggingContext?.source,
      });
    }
    return tokenInstance;
  }

  async moveToken(args: {
    tokenInstanceId: TokenInstanceId;
    location: TokenLocation;
    ownerId?: PlayerId;
  }): Promise<void> {
    // Resolve the token instance to ensure we don't mutate a missing token.
    const token = this.getTokenInstance(args.tokenInstanceId);
    // Update location in-place for a stable token reference.
    token.location = args.location;
    // Optionally transfer ownership when tokens move between players.
    if (args.ownerId !== undefined) {
      token.ownerId = args.ownerId;
    }
    this.loggerService.debug(`[moveToken action] moved token ${args.tokenInstanceId}`);
  }

  async removeToken(args: { tokenInstanceId: TokenInstanceId }, context?: GameActionContext): Promise<void> {
    // Ensure the token exists before removal for deterministic behavior.
    const token = this.getTokenInstance(args.tokenInstanceId);
    delete this.match.tokens[args.tokenInstanceId];
    this.loggerService.debug(`[removeToken action] removed token ${args.tokenInstanceId}`);
    // Emit token consumption logs only when callers provide logging context.
    if (context && !context.loggingContext?.suppress) {
      const targetPlayerId = token.ownerId ?? getCurrentPlayer(this.match).id;
      this.logManager.addLogEntry({
        type: 'tokenConsumed',
        playerId: targetPlayerId,
        tokenId: token.tokenId,
        source: context.loggingContext?.source,
      });
    }
  }

  async consumeToken(args: { tokenInstanceId: TokenInstanceId; amount?: number }): Promise<void> {
    // Resolve the token instance before modifying counters or removal.
    const token = this.getTokenInstance(args.tokenInstanceId);
    const amount = args.amount ?? 1;
    // Tokens with null/undefined/0 counters are infinite and do not decrement.
    if (token.counters === undefined || token.counters === null || token.counters === 0) {
      this.loggerService.debug(`[consumeToken action] token ${args.tokenInstanceId} is infinite`);
      return;
    }
    // Decrement counters and remove the token if exhausted.
    token.counters = Math.max(0, token.counters - amount);
    if (token.counters === 0) {
      delete this.match.tokens[args.tokenInstanceId];
      this.loggerService.debug(`[consumeToken action] consumed token ${args.tokenInstanceId}`);
      return;
    }
    this.loggerService.debug(`[consumeToken action] decremented token ${args.tokenInstanceId} to ${token.counters}`);
  }

  async flipToken(args: { tokenInstanceId: TokenInstanceId; facing: TokenFacing }): Promise<void> {
    // Resolve the token instance before modifying facing.
    const token = this.getTokenInstance(args.tokenInstanceId);
    token.facing = args.facing;
    this.loggerService.debug(`[flipToken action] set token ${args.tokenInstanceId} to ${args.facing}`);
  }

  // Removes set-aside source metadata for a card/card-like id.
  private clearSetAsideSource(cardLikeId: CardLikeId): void {
    this.match.setAsideSourceById ??= {};
    if (this.match.setAsideSourceById[cardLikeId] !== undefined) {
      delete this.match.setAsideSourceById[cardLikeId];
      this.loggerService.debug(`[set-aside source] cleared source metadata for ${cardLikeId}`);
    }
  }

  // Persists set-aside source metadata for a card/card-like id.
  private setSetAsideSource(cardLikeId: CardLikeId, source: SetAsideSourceDescriptor): void {
    this.match.setAsideSourceById ??= {};
    this.match.setAsideSourceById[cardLikeId] = source;
    this.loggerService.debug(`[set-aside source] set source metadata for ${cardLikeId}`, source);
  }

  // Resolves a source kind from a card-like id when the caller omitted an explicit source kind.
  private resolveSetAsideSourceKindFromCardLikeId(cardLikeId: CardLikeId): SetAsideSourceKind {
    const entry = findCardLikeEntryInMatch(this.match, cardLikeId);
    if (!entry) {
      return 'system';
    }
    return entry.kind;
  }

  // Resolves source metadata for a move into set-aside.
  private buildSetAsideSourceDescriptor(args: {
    destinationPlayerId?: PlayerId;
    setAsideSource?: SetAsideSourceInput;
  }): SetAsideSourceDescriptor {
    const setAsideSource = args.setAsideSource;

    let sourceKind: SetAsideSourceKind = setAsideSource?.sourceKind ?? 'system';
    if (!setAsideSource?.sourceKind && setAsideSource?.sourceCardLikeId !== undefined) {
      sourceKind = this.resolveSetAsideSourceKindFromCardLikeId(setAsideSource.sourceCardLikeId);
    } else if (!setAsideSource?.sourceKind && setAsideSource?.sourceCardId !== undefined) {
      sourceKind = 'card';
    }

    return {
      ownerPlayerId: setAsideSource?.ownerPlayerId ?? args.destinationPlayerId,
      sourceKind,
      sourceCardId: setAsideSource?.sourceCardId,
      sourceCardLikeId: setAsideSource?.sourceCardLikeId,
      sourceCardKey: setAsideSource?.sourceCardKey,
      sourceLabel: setAsideSource?.sourceLabel,
    };
  }

  async moveCard(args: {
    toPlayerId?: PlayerId;
    cardId: CardId | Card;
    to: CardLocationSpec;
    facing?: CardFacing;
    setAsideSource?: SetAsideSourceInput;
  }): Promise<{ location: CardLocation; playerId?: PlayerId; emptiedSupplyPileKey?: CardKey } | undefined> {
    // Ensure we are only moving actual cards with moveCard.
    let card: Card;
    if (args.cardId instanceof Card) {
      card = args.cardId;
    } else if (typeof args.cardId === 'number') {
      try {
        card = this.cardLibrary.getCard(args.cardId);
      } catch (error) {
        const cardLike = this.findCardLike(args.cardId);
        if (cardLike) {
          throw new Error(`[moveCard action] ${cardLike} is a landscape; use moveCardLike instead`);
        }
        throw error;
      }
    } else {
      throw new Error('[moveCard action] invalid card argument');
    }
    const cardId = card.id;

    if (Array.isArray(args.to.location)) {
      throw new Error(`[moveCard action] cannot move card to multiple locations`);
    }

    let oldSource: { sourceKey: CardLocation; source: CardId[]; index: number; playerId?: PlayerId } | null = null;

    try {
      oldSource = this.cardSourceController.findCardSource(cardId);
    } catch (e) {
      this.loggerService.warn(`[moveCard action] could not find source for ${card}`);
    }

    // Global base metadata can mark cards as immovable regardless of expansion source.
    const moveMetadata = card.metadata as BaseCardMetadata | undefined;
    if (moveMetadata?.base?.immovable === true) {
      this.loggerService.debug(
        `[moveCard action] blocked move for immovable card ${card} to ${args.to.location}`,
      );
      return oldSource ? { location: oldSource.sourceKey, playerId: oldSource.playerId } : undefined;
    }

    // Some effects omit toPlayerId for player-scoped zones; infer from origin when possible.
    const destinationPlayerId = this.resolveDestinationPlayerId({
      location: args.to.location,
      requestedPlayerId: args.toPlayerId,
      fallbackPlayerId: oldSource?.playerId,
      card,
    });
    const newSource = this.cardSourceController.getSource(args.to.location, destinationPlayerId);

    if (!newSource) {
      throw new Error(`[moveCard action] could not find source for ${card}`);
    }

    oldSource?.source.splice(oldSource?.index, 1);
    let emptiedSupplyPileKey: CardKey | undefined;
    if (oldSource?.sourceKey === 'basicSupply' || oldSource?.sourceKey === 'kingdomSupply') {
      const movedPileKey = getCardPileKey(card) as CardKey;
      const isConfiguredSupplyPile = this.match.config.basicSupply.some((entry) => entry.name === movedPileKey) ||
        this.match.config.kingdomSupply.some((entry) => entry.name === movedPileKey);
      if (isConfiguredSupplyPile) {
        const remainingTopCard = this.findCardService.findTopSupplyCardForPileKey({ pileKey: movedPileKey });
        if (!remainingTopCard) {
          emptiedSupplyPileKey = movedPileKey;
        }
      }
    }
    if (oldSource?.sourceKey === 'set-aside') {
      this.clearSetAsideSource(cardId);
    }

    // Apply default facing rules or explicit facing updates for the destination.
    const destinationFacing = args.facing ?? this.getDefaultFacingForLocation(args.to.location);
    if (destinationFacing) {
      card.facing = destinationFacing;
    }

    switch (oldSource?.sourceKey) {
      case 'playerHand': {
        // Use the origin player ID for leave-hand events; destination can be undefined for play area moves.
        const fromPlayerId = oldSource?.playerId ?? args.toPlayerId;
        if (fromPlayerId !== undefined) {
          await this.reactionManager.runCardLifecycleEvent('onLeaveHand', {
            playerId: fromPlayerId,
            cardId,
          });
        } else {
          this.loggerService.warn(`[moveCard action] could not resolve fromPlayerId for onLeaveHand for ${card}`);
        }
        break;
      }
      case 'playArea':
      case 'activeDuration':
        if (args.to.location === 'playArea' || args.to.location === 'activeDuration') break;
        await this.reactionManager.runCardLifecycleEvent('onLeavePlay', { cardId });
        // Ensure global duration triggers are cleaned when the card leaves play.
        this.reactionManager.cleanupDurationTriggers(cardId);
    }

    // Insert at a requested index when supplied; otherwise append to destination top/end.
    if (args.to.index === undefined) {
      newSource.push(cardId);
    } else {
      const clampedIndex = Math.max(0, Math.min(args.to.index, newSource.length));
      newSource.splice(clampedIndex, 0, cardId);
    }

    switch (args.to.location) {
      case 'set-aside': {
        const sourceDescriptor = this.buildSetAsideSourceDescriptor({
          destinationPlayerId,
          setAsideSource: args.setAsideSource,
        });
        this.setSetAsideSource(cardId, sourceDescriptor);
        break;
      }
      case 'playerHand':
        if (destinationPlayerId === undefined) {
          throw new Error(`[moveCard action] playerHand requires destination player for ${card}`);
        }
        await this.reactionManager.runCardLifecycleEvent('onEnterHand', {
          playerId: destinationPlayerId,
          cardId,
        });
        break;
    }

    const destinationLog = destinationPlayerId === undefined
      ? `${args.to.location}`
      : `${args.to.location}:${destinationPlayerId}`;
    this.loggerService.debug(`[moveCard action] moved ${card} from ${oldSource?.sourceKey} to ${destinationLog}`);

    return oldSource
      ? { location: oldSource.sourceKey, playerId: oldSource.playerId, emptiedSupplyPileKey }
      : undefined;
  }

  // Removes a card from the match entirely (used by "to the box"/removed-from-game effects).
  async removeCardFromGame(args: { cardId: CardId | Card }) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);

    let oldSource: { sourceKey: CardLocation; source: CardId[]; index: number; playerId?: PlayerId } | null = null;
    try {
      oldSource = this.cardSourceController.findCardSource(card.id);
    } catch {
      oldSource = null;
    }

    if (oldSource) {
      oldSource.source.splice(oldSource.index, 1);
      if (oldSource.sourceKey === 'set-aside') {
        this.clearSetAsideSource(card.id);
      }
    }

    card.owner = null;
    this.cardLibrary.removeCard(card.id);
    this.loggerService.info(`[removeCardFromGame action] removed ${card} from game`);
  }

  // Moves a landscape-like entry (boon/hex/event/landmark) between supported locations.
  async moveCardLike(args: {
    toPlayerId?: PlayerId;
    cardLikeId: CardLikeId;
    to: CardLocationSpec;
    setAsideSource?: SetAsideSourceInput;
  }) {
    if (typeof args.cardLikeId !== 'number') {
      throw new Error('[moveCardLike action] invalid cardLikeId');
    }

    // Prevent card IDs from being moved through the landscape path.
    try {
      const card = this.cardLibrary.getCard(args.cardLikeId);
      throw new Error(`[moveCardLike action] ${card} is a card; use moveCard instead`);
    } catch (error) {
      // Ignore missing card errors; those indicate a landscape ID.
      if (!(error instanceof Error) || !error.message.includes('unable to locate card')) {
        throw error;
      }
    }

    const cardLike = this.findCardLike(args.cardLikeId);
    if (!cardLike) {
      throw new Error(`[moveCardLike action] could not find landscape ${args.cardLikeId}`);
    }

    if (Array.isArray(args.to.location)) {
      throw new Error('[moveCardLike action] cannot move landscape to multiple locations');
    }

    let previousLocation: { location: CardLocation; playerId?: PlayerId } | undefined;

    // Remove from any existing card source location (set-aside only).
    try {
      const existingSource = this.cardSourceController.findCardSource(cardLike.id);
      existingSource.source.splice(existingSource.index, 1);
      if (existingSource.sourceKey === 'set-aside') {
        this.clearSetAsideSource(cardLike.id);
      }
      previousLocation = { location: existingSource.sourceKey, playerId: existingSource.playerId };
    } catch (error) {
      // No existing card-source location found; this is expected for boons in deck/discard.
    }

    // Remove from boon deck/discard piles if present.
    const boonDeck = this.match.boons?.deck;
    const boonDiscard = this.match.boons?.discard;
    const deckIndex = boonDeck ? boonDeck.indexOf(cardLike.id) : -1;
    if (deckIndex !== -1 && boonDeck) {
      boonDeck.splice(deckIndex, 1);
      previousLocation ??= { location: 'boonDeck' };
    }
    const discardIndex = boonDiscard ? boonDiscard.indexOf(cardLike.id) : -1;
    if (discardIndex !== -1 && boonDiscard) {
      boonDiscard.splice(discardIndex, 1);
      previousLocation ??= { location: 'boonDiscard' };
    }

    // Remove from hex deck/discard piles if present.
    const hexDeck = this.match.hexes?.deck;
    const hexDiscard = this.match.hexes?.discard;
    const hexDeckIndex = hexDeck ? hexDeck.indexOf(cardLike.id) : -1;
    if (hexDeckIndex !== -1 && hexDeck) {
      hexDeck.splice(hexDeckIndex, 1);
      previousLocation ??= { location: 'hexDeck' };
    }
    const hexDiscardIndex = hexDiscard ? hexDiscard.indexOf(cardLike.id) : -1;
    if (hexDiscardIndex !== -1 && hexDiscard) {
      hexDiscard.splice(hexDiscardIndex, 1);
      previousLocation ??= { location: 'hexDiscard' };
    }

    switch (args.to.location) {
      case 'set-aside': {
        if (args.toPlayerId === undefined) {
          throw new Error('[moveCardLike action] set-aside requires a player id');
        }
        const setAside = this.cardSourceController.getSource('set-aside', args.toPlayerId);
        if (!setAside.includes(cardLike.id)) {
          setAside.push(cardLike.id);
        }
        const sourceDescriptor = this.buildSetAsideSourceDescriptor({
          destinationPlayerId: args.toPlayerId,
          setAsideSource: args.setAsideSource,
        });
        this.setSetAsideSource(cardLike.id, sourceDescriptor);
        this.loggerService.debug(`[moveCardLike action] set aside ${cardLike} for player ${args.toPlayerId}`);
        break;
      }
      case 'boonDiscard': {
        const isBoon = this.match.boons?.cards?.some((card) => card.id === cardLike.id);
        if (!isBoon) {
          throw new Error(`[moveCardLike action] ${cardLike} is not a boon; cannot move to boonDiscard`);
        }
        if (!this.match.boons?.discard) {
          throw new Error('[moveCardLike action] boon discard pile is not initialized');
        }
        if (!this.match.boons.discard.includes(cardLike.id)) {
          this.match.boons.discard.push(cardLike.id);
        }
        this.loggerService.debug(`[moveCardLike action] moved ${cardLike} to boon discard`);
        break;
      }
      case 'boonDeck': {
        const isBoon = this.match.boons?.cards?.some((card) => card.id === cardLike.id);
        if (!isBoon) {
          throw new Error(`[moveCardLike action] ${cardLike} is not a boon; cannot move to boonDeck`);
        }
        if (!this.match.boons?.deck) {
          throw new Error('[moveCardLike action] boon deck is not initialized');
        }
        if (!this.match.boons.deck.includes(cardLike.id)) {
          this.match.boons.deck.push(cardLike.id);
        }
        this.loggerService.debug(`[moveCardLike action] moved ${cardLike} to boon deck`);
        break;
      }
      // Hex discard pile for Doom effects.
      case 'hexDiscard': {
        const isHex = this.match.hexes?.cards?.some((card) => card.id === cardLike.id);
        if (!isHex) {
          throw new Error(`[moveCardLike action] ${cardLike} is not a hex; cannot move to hexDiscard`);
        }
        if (!this.match.hexes?.discard) {
          throw new Error('[moveCardLike action] hex discard pile is not initialized');
        }
        if (!this.match.hexes.discard.includes(cardLike.id)) {
          this.match.hexes.discard.push(cardLike.id);
        }
        this.loggerService.debug(`[moveCardLike action] moved ${cardLike} to hex discard`);
        break;
      }
      // Hex deck for Doom effects.
      case 'hexDeck': {
        const isHex = this.match.hexes?.cards?.some((card) => card.id === cardLike.id);
        if (!isHex) {
          throw new Error(`[moveCardLike action] ${cardLike} is not a hex; cannot move to hexDeck`);
        }
        if (!this.match.hexes?.deck) {
          throw new Error('[moveCardLike action] hex deck is not initialized');
        }
        if (!this.match.hexes.deck.includes(cardLike.id)) {
          this.match.hexes.deck.push(cardLike.id);
        }
        this.loggerService.debug(`[moveCardLike action] moved ${cardLike} to hex deck`);
        break;
      }
      default:
        throw new Error(`[moveCardLike action] unsupported location '${args.to.location}'`);
    }

    return previousLocation;
  }

  // Rotates a split pile by moving all copies of the current top card to the bottom.
  async rotateSplitPile(args: { pileKey: CardKey }): Promise<void> {
    const supplySources = [
      this.cardSourceController.getSource('kingdomSupply'),
      this.cardSourceController.getSource('basicSupply'),
    ];

    // Locate all cards belonging to the requested pile key.
    const pileEntries: { source: CardId[]; index: number; cardId: CardId }[] = [];
    for (const source of supplySources) {
      for (let i = 0; i < source.length; i++) {
        const cardId = source[i];
        const card = this.cardLibrary.getCard(cardId);
        if (getCardPileKey(card) !== args.pileKey) {
          continue;
        }
        pileEntries.push({ source, index: i, cardId });
      }
    }

    if (pileEntries.length < 1) {
      this.loggerService.debug(`[rotateSplitPile action] no pile found for ${args.pileKey}`);
      return;
    }

    const topCardId = pileEntries[pileEntries.length - 1].cardId;
    const topCardKey = this.cardLibrary.getCard(topCardId).cardKey;
    const topCardEntries = pileEntries.filter((entry) => this.cardLibrary.getCard(entry.cardId).cardKey === topCardKey);
    const nonTopEntries = pileEntries.filter((entry) => this.cardLibrary.getCard(entry.cardId).cardKey !== topCardKey);
    const rotatedCardIds = [...topCardEntries.map((entry) => entry.cardId), ...nonTopEntries.map((entry) => entry.cardId)];

    // Reapply rotated pile order into original pile slots while preserving non-pile cards.
    for (const [entryIndex, entry] of pileEntries.entries()) {
      entry.source[entry.index] = rotatedCardIds[entryIndex];
    }

    const newTopCardId = rotatedCardIds[rotatedCardIds.length - 1];
    const newTopCardKey = this.cardLibrary.getCard(newTopCardId).cardKey;
    this.loggerService.info(
      `[rotateSplitPile action] rotated pile ${args.pileKey} top ${topCardKey} -> ${newTopCardKey}`,
    );
  }

  // Finds a landscape-like instance by id in the current match.
  private findCardLike(cardLikeId: CardLikeId) {
    // moveCardLike only supports these movable landscape categories.
    return findCardLikeInMatch(this.match, cardLikeId, {
      includeKinds: ['boon', 'hex', 'event', 'landmark', 'project'],
    });
  }

  // Sets default facing for common locations; set-aside is left untouched by default.
  private getDefaultFacingForLocation(location: CardLocation): CardFacing | undefined {
    if (location === 'playerDeck') {
      return 'back';
    }
    if (location === 'set-aside') {
      return undefined;
    }
    return 'front';
  }

  // Resolves destination player ownership for player-scoped card locations.
  private resolveDestinationPlayerId(args: {
    location: CardLocation;
    requestedPlayerId?: PlayerId;
    fallbackPlayerId?: PlayerId;
    card: Card;
  }): PlayerId | undefined {
    const playerScopedLocations = new Set<CardLocation>([
      'playerHand',
      'playerDiscard',
      'playerDeck',
      'set-aside',
    ]);

    if (!playerScopedLocations.has(args.location)) {
      return args.requestedPlayerId;
    }

    if (args.requestedPlayerId !== undefined) {
      return args.requestedPlayerId;
    }

    if (args.fallbackPlayerId !== undefined) {
      this.loggerService.debug(
        `[moveCard action] inferred destination player ${args.fallbackPlayerId} for ${args.card} to ${args.location}`,
      );
      return args.fallbackPlayerId;
    }

    throw new Error(
      `[moveCard action] ${args.location} requires a player id for ${args.card}; provide toPlayerId or move from a player-owned source`,
    );
  }

  async gainAction(args: { count: number }, context?: GameActionContext) {
    const source = this.resolveActionSource(context);
    let gainAmount = args.count;
    // Allow reactions to modify incoming action gains (e.g., Snowy Village lockout).
    const trigger = new ReactionTrigger('actionGain', {
      playerId: getCurrentPlayer(this.match).id,
      count: gainAmount,
      source,
    });
    await this.reactionManager.runTrigger({ trigger });
    gainAmount = Math.max(0, trigger.args.count);

    this.loggerService.info(`[gainAction action] gaining ${gainAmount} actions`);

    this.match.playerActions += gainAmount;
    this.match.playerActions = Math.max(0, this.match.playerActions);

    this.logManager.addLogEntry({
      type: 'gainAction',
      playerId: getCurrentPlayer(this.match).id,
      count: gainAmount,
      source,
    });

    this.loggerService.info(`[gainAction action] setting player actions to ${this.match.playerActions}`);
  }

  async gainCard(args: {
    playerId: PlayerId;
    cardId: CardId | Card;
    to: CardLocationSpec;
  }, context?: GameActionContextMap['gainCard']) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;

    const previousLocation = await this.moveCard({
      cardId,
      to: args.to,
      toPlayerId: args.playerId,
    });

    const turnStatsIndex = this.getCurrentTurnStatsIndex();
    this.match.stats.cardsGainedByTurn[turnStatsIndex] ??= [];
    this.match.stats.cardsGainedByTurn[turnStatsIndex]!.push(cardId);

    this.match.stats.cardsGained[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      turnHistoryIndex: this.getCurrentTurnHistoryIndex(),
      playerId: args.playerId,
    };

    card.owner = args.playerId;

    this.loggerService.info(`[gainCard action] ${getPlayerById(this.match, args.playerId)} gained ${card}`);

    this.logManager.addLogEntry({
      playerId: args.playerId,
      cardId: cardId,
      type: 'gainCard',
      source: context?.loggingContext?.source,
    });

    const trigger = new ReactionTrigger('cardGained', {
      cardId: cardId,
      playerId: args.playerId,
      bought: context?.bought ?? false,
      previousLocation,
      emptiedSupplyPileKey: previousLocation?.emptiedSupplyPileKey,
      gainedLocation: Array.isArray(args.to.location) ? undefined : {
        location: args.to.location,
        playerId: (
            args.to.location === 'playerHand' ||
            args.to.location === 'playerDeck' ||
            args.to.location === 'playerDiscard' ||
            args.to.location === 'playArea' ||
            args.to.location === 'activeDuration'
          )
          ? args.playerId
          : undefined,
      },
    });

    await this.reactionManager.runTrigger({ trigger });

    const suppress = context?.suppressLifeCycle;
    const skipOnGain = suppress &&
      (suppress.events?.includes('onGained') || suppress.events === undefined);

    if (!skipOnGain) {
      await this.reactionManager.runCardLifecycleEvent('onGained', {
        playerId: args.playerId,
        cardId,
        bought: context?.bought ?? false,
        gainContext: context?.lifecycleContext?.onGained,
      });
    } else {
      this.loggerService.debug('[gainCard action] lifecycle onGained event suppressed');
    }

    await this.reactionManager.runGameLifecycleEvent('onCardGained', {
      cardId: cardId,
      playerId: args.playerId,
      match: this.match,
    });

    // Exile rule: when you gain a card, you may discard all other copies of it from Exile.
    await this.resolveExileDiscardOnGain({
      playerId: args.playerId,
      gainedCardId: cardId,
      gainedCardKey: card.cardKey,
      loggingContext: context?.loggingContext,
    });
  }

  // Gains and reveals the current top card from the Loot non-supply pile.
  async gainLoot(
    args: { playerId: PlayerId; to?: CardLocationSpec },
    context?: GameActionContext,
  ): Promise<CardId | undefined> {
    const destination = args.to ?? { location: 'playerDiscard' };
    const topLootCard = this.findCardService.findTopNonSupplyCardForPileName({
      pileName: 'loot',
    });

    if (!topLootCard) {
      this.loggerService.debug('[gainLoot action] no Loot cards remain to gain');
      return undefined;
    }

    this.loggerService.info(
      `[gainLoot action] ${getPlayerById(this.match, args.playerId)} gaining top Loot ${topLootCard.id}`,
    );
    await this.gainCard({
      playerId: args.playerId,
      cardId: topLootCard.id,
      to: destination,
    }, context);

    // Loot gains are always revealed after being gained.
    await this.revealCard({
      playerId: args.playerId,
      cardId: topLootCard.id,
    }, context);

    return topLootCard.id;
  }

  async exileCard(args: { cardId: CardId | Card; playerId: PlayerId }, _context?: GameActionContext) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);

    this.loggerService.info(`[exileCard action] exiling ${card} for ${getPlayerById(this.match, args.playerId)}`);

    await this.moveCard({
      cardId: card.id,
      toPlayerId: args.playerId,
      to: { location: 'exile' },
    });

    // Cards in Exile are owned by the exiling player.
    card.owner = args.playerId;

    this.loggerService.debug(`[exileCard action] ${card} moved to exile for player ${args.playerId}`);
  }

  async userPrompt(args: UserPromptActionArgs) {
    const { playerId } = args;
    // Default prompt behavior waits for input unless explicitly marked display-only.
    const waitForInput = args.waitForInput ?? true;

    const signalId = `userPrompt:${playerId}:${Date.now()}`;

    const player = getPlayerById(this.match, playerId);
    if (!waitForInput) {
      // Display-only prompts are ignored for computer players.
      if (player?.isComputer) {
        return null;
      }
      const socket = this.socketMap.get(playerId);
      if (!socket) {
        this.loggerService.debug(`[userPrompt] No socket for player ${playerId}`);
        return null;
      }
      this.loggerService.debug(`[userPrompt] dispatching display-only prompt to player ${playerId}`);
      socket.emit('userPrompt', signalId, args);
      return null;
    }

    if (player?.isComputer) {
      // Computer players always pick the first available action button when prompted.
      if (args.content?.type === 'select-pile') {
        const pileNames = args.content.pileNames ?? [];
        return { result: pileNames.length ? [pileNames[0]] : [] };
      }
      if (args.content?.type === 'number-input') {
        // Provide a deterministic numeric answer for AI prompts.
        // Resolve bounds with infinite defaults when min/max are omitted.
        const minValue = args.content.min ?? Number.NEGATIVE_INFINITY;
        const maxValue = args.content.max ?? Number.POSITIVE_INFINITY;
        // Prefer the provided value, otherwise use the min if finite or 0 as a fallback.
        const requestedValue = args.content.value ?? (Number.isFinite(minValue) ? minValue : 0);
        // Clamp into the allowed range.
        const clamped = Math.min(Math.max(requestedValue, minValue), maxValue);
        return { action: 1, result: clamped };
      }
      const actionButtons = args.actionButtons ?? [];
      const firstAction = actionButtons.find((button) => button.action !== 0)?.action ?? 0;
      return { action: firstAction };
    }

    const socket = this.socketMap.get(playerId);
    if (!socket) {
      this.loggerService.debug(`[userPrompt] No socket for player ${playerId}`);
      return null;
    }

    const currentPlayerId = getCurrentPlayer(this.match).id;

    if (playerId !== currentPlayerId) {
      this.socketMap.forEach((socket, id) => {
        if (id !== playerId) {
          socket.emit('waitingForPlayer', playerId);
        }
      });
    }

    return new Promise((resolve) => {
      const onInput = (incomingSignalId: string, response: unknown) => {
        if (incomingSignalId !== signalId) return;

        socket.off('userInputReceived', onInput);

        if (playerId !== currentPlayerId) {
          this.socketMap.forEach((socket, id) => {
            if (id !== playerId) {
              socket.emit('doneWaitingForPlayer', playerId);
            }
          });
        }

        if (args.content?.type === 'select' && args.content.playCard) {
          const parsedSelection = this.parsePlayCardSelectionResult(response);
          if (!parsedSelection) {
            this.loggerService.warn('[userPrompt] invalid play-card selection payload');
          } else {
            this.queuePendingWaySelectionForPlay({
              playerId,
              selectedCardIds: parsedSelection.selectedCardIds,
              selectedWayId: parsedSelection.selectedWayId,
            });
          }
        }

        resolve(response);
      };

      socket.on('userInputReceived', onInput);
      socket.emit('userPrompt', signalId, args);
    });
  }

  async selectCard(args: SelectActionCardArgs) {
    args.count ??= 1;
    const playSelection = args.playCard ?? this.inferPromptIsPlaySelection(args.prompt);
    this.loggerService.debug(
      `[selectCard action] play-selection=${playSelection} prompt='${args.prompt}' explicit=${args.playCard}`,
    );

    let selectableCardIds: CardId[] = [];

    const { count, playerId, restrict } = args;

    if (Array.isArray(restrict)) {
      if (this.isCardIdRestriction(restrict)) {
        this.loggerService.debug(`[selectCard action] restricted to set of cards ${restrict}`);
        selectableCardIds = restrict;
      } else {
        selectableCardIds = this.findCardService.findCards(restrict).map((card) => card.id);
      }
    } else if (restrict !== undefined) {
      selectableCardIds = this.findCardService.findCards(restrict).map((card) => card.id);
    }

    if (!this.isCardIdRestriction(restrict)) {
      const originalSelectableCount = selectableCardIds.length;
      selectableCardIds = this.collapseSupplySelectableCards(selectableCardIds);
      if (selectableCardIds.length !== originalSelectableCount) {
        this.loggerService.debug(
          `[selectCard action] collapsed supply candidates from ${originalSelectableCount} to ${selectableCardIds.length} visible card(s)`,
        );
      }
    }

    this.loggerService.debug(`[selectCard action] found ${selectableCardIds.length} selectable cards`);

    if (selectableCardIds?.length === 0) {
      this.loggerService.debug(`[selectCard action] found no cards within restricted set ${restrict}`);
      return [];
    }

    const player = getPlayerById(this.match, playerId);
    if (player?.isComputer) {
      // Computer players choose the first available card(s) from the selectable list.
      const count = this.resolveCountSpec(args.count ?? 1, selectableCardIds.length, args.optional ?? false);
      return selectableCardIds.slice(0, count);
    }

    // If selection is exact and the player has <= required cards, selection is forced and can auto-resolve.
    const exactRequiredCount = typeof count === 'number'
      ? count
      : count.kind === 'exact'
      ? count.count
      : undefined;
    if (exactRequiredCount !== undefined && !args.optional) {
      this.loggerService.debug(
        `[selectCard action] selection count is exact (${exactRequiredCount}); checking for forced auto-selection`,
      );

      const keepPromptForWayChoice = playSelection &&
        exactRequiredCount === 1 &&
        (this.match.ways?.length ?? 0) > 0;
      if (keepPromptForWayChoice) {
        this.loggerService.debug(
          '[selectCard action] keeping prompt open for explicit Way choice on single-card play selection',
        );
      }

      if (selectableCardIds.length <= exactRequiredCount && !keepPromptForWayChoice) {
        this.loggerService.debug(
          '[selectCard action] user does not have enough, or has exactly the amount of cards to select from, selecting all automatically',
        );
        return selectableCardIds;
      }
    }

    const socket = this.socketMap.get(playerId);

    if (!socket) {
      this.loggerService.debug(
        `[selectCard action] no socket found for ${getPlayerById(this.match, playerId)}, skipping`,
      );
      return [];
    }

    const signalId = `selectCard:${playerId}:${Date.now()}`;
    const currentPlayerId = getCurrentPlayer(this.match).id;

    if (playerId !== currentPlayerId) {
      this.socketMap.forEach((socket, id) => {
        if (id !== playerId) {
          socket.emit('waitingForPlayer', playerId);
        }
      });
    }

    return new Promise<CardId[]>((resolve) => {
      const onInput = (incomingSignalId: string, cardIds: unknown) => {
        if (incomingSignalId !== signalId) return;

        socket.off('userInputReceived', onInput);

        // ✅ Clear "waiting" if needed
        if (playerId !== currentPlayerId) {
          this.socketMap.forEach((socket, id) => {
            if (id !== playerId) {
              socket.emit('doneWaitingForPlayer', playerId);
            }
          });
        }

        const parsedSelection = this.parsePlayCardSelectionResult(cardIds);
        if (!parsedSelection) {
          this.loggerService.warn(`[selectCard action] received invalid cardIds payload`);
          resolve([]);
          return;
        }

        if (playSelection) {
          this.queuePendingWaySelectionForPlay({
            playerId,
            selectedCardIds: parsedSelection.selectedCardIds,
            selectedWayId: parsedSelection.selectedWayId,
          });
        }

        resolve(parsedSelection.selectedCardIds);
      };

      socket.on('userInputReceived', onInput);
      socket.emit('selectCard', signalId, { ...args, playCard: playSelection, selectableCardIds });
    });
  }

  // Wraps selectCard for single-card flows and returns null when no selection was made.
  async selectSingleCard(args: SelectSingleActionCardArgs): Promise<CardId | null> {
    const selectedCardIdList = await this.actionService.run('selectCard', {
      ...args,
      count: 1,
    });
    return selectedCardIdList[0] ?? null;
  }

  async trashCard(args: { cardId: CardId | Card; playerId: PlayerId }, context?: GameActionContext) {
    const oldLocation = await this.moveCard({
      cardId: args.cardId,
      to: { location: 'trash' },
    });

    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;

    this.match.stats.trashedCards[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      turnHistoryIndex: this.getCurrentTurnHistoryIndex(),
      playerId: getCurrentPlayer(this.match).id,
    };

    const turnStatsIndex = this.getCurrentTurnStatsIndex();
    this.match.stats.trashedCardsByTurn[turnStatsIndex] ??= [];
    this.match.stats.trashedCardsByTurn[turnStatsIndex]!.push(cardId);

    this.loggerService.info(`[trashCard action] trashed ${card}`);

    // Include the source to allow reactions to ignore self-triggered trash effects.
    const trigger: ReactionTrigger = {
      eventType: 'cardTrashed',
      args: {
        playerId: args.playerId,
        cardId: card.id,
        previousLocation: oldLocation,
        emptiedSupplyPileKey: oldLocation?.emptiedSupplyPileKey,
        source: context?.loggingContext?.source,
      },
    };
    await this.reactionManager.runTrigger({ trigger });

    await this.reactionManager.runCardLifecycleEvent('onTrashed', {
      cardId: cardId,
      playerId: args.playerId,
      previousLocation: oldLocation,
    });

    card.owner = null;
    this.logManager.addLogEntry({
      playerId: args.playerId,
      cardId: cardId,
      type: 'trashCard',
      source: context?.loggingContext?.source,
    });
  }

  async gainVictoryToken(args: { playerId: PlayerId; count: number }, context?: GameActionContext) {
    this.loggerService.log(`[gainVictoryToken action] player ${args.playerId} gained ${args.count} victory tokens`);
    // Victory tokens are stored as token instances on the player.
    if (args.count <= 0) {
      this.loggerService.debug(`[gainVictoryToken action] non-positive victory token count ${args.count}, skipping`);
      return;
    }
    const victoryTokenId = prosperityTokenIds.victory;
    for (let i = 0; i < args.count; i += 1) {
      await this.placeToken({
        tokenId: victoryTokenId,
        ownerId: args.playerId,
        location: { type: 'player', playerId: args.playerId },
      }, context);
    }
    this.loggerService.debug(`[gainVictoryToken action] player ${args.playerId} placed ${args.count} victory tokens`);
  }

  // Adds an extra turn to the queue for processing at turn end.
  async queueExtraTurn(args: { turn: ExtraTurn }) {
    this.loggerService.info(
      `[queueExtraTurn action] queueing extra turn owner ${args.turn.controllerId} player ${args.turn.playerId}`,
    );
    this.match.extraTurnQueue.push({ ...args.turn });
    this.loggerService.debug(`[queueExtraTurn action] queue size now ${this.match.extraTurnQueue.length}`);
  }

  // Adds pending skipped turns for a player (used by effects like Lich).
  async skipTurn(args: { playerId: PlayerId; count?: number }, _context?: GameActionContext) {
    const skipCount = Math.max(0, args.count ?? 1);
    if (skipCount <= 0) {
      this.loggerService.debug(`[skipTurn action] non-positive skip count ${skipCount}, skipping`);
      return;
    }

    this.match.skippedTurns[args.playerId] ??= 0;
    this.match.skippedTurns[args.playerId] += skipCount;
    this.loggerService.info(
      `[skipTurn action] player ${args.playerId} will skip ${this.match.skippedTurns[args.playerId]} future turn(s)`,
    );
  }

  async gainCoffer(args: { playerId: PlayerId; count?: number }, _context?: GameActionContext) {
    this.loggerService.log(`[gainCoffer action] player ${args.playerId} gained ${args.count} coffers`);
    this.match.coffers[args.playerId] ??= 0;
    this.match.coffers[args.playerId] += args.count ?? 1;
    this.match.coffers[args.playerId] = Math.max(0, this.match.coffers[args.playerId]);
    this.loggerService.debug(
      `[gainCoffer action] player ${args.playerId} now has ${this.match.coffers[args.playerId]} coffers`,
    );
  }

  // Adds or removes Favor tokens (Allies) for a player.
  async gainFavor(args: { playerId: PlayerId; count?: number }, _context?: GameActionContext) {
    const count = args.count ?? 1;
    this.loggerService.log(`[gainFavor action] player ${args.playerId} delta ${count} Favor`);

    if (count === 0) {
      this.loggerService.debug('[gainFavor action] zero Favor delta, skipping');
      return;
    }

    if (count > 0) {
      for (let i = 0; i < count; i += 1) {
        await this.placeToken({
          tokenId: alliesTokenIds.favor,
          ownerId: args.playerId,
          location: { type: 'player', playerId: args.playerId },
        });
      }
      this.loggerService.debug(`[gainFavor action] player ${args.playerId} gained ${count} Favor token(s)`);
      return;
    }

    let remainingToSpend = Math.abs(count);
    const favorTokens = Object.values(this.match.tokens ?? {})
      .filter((token) =>
        token.tokenId === alliesTokenIds.favor &&
        token.location.type === 'player' &&
        token.location.playerId === args.playerId
      )
      .sort((left, right) => left.id.localeCompare(right.id));

    for (const token of favorTokens) {
      if (remainingToSpend < 1) {
        break;
      }

      const tokenAvailableCount = Math.max(1, token.counters ?? 1);
      const spendFromToken = Math.min(remainingToSpend, tokenAvailableCount);

      if ((token.counters ?? 0) > spendFromToken) {
        await this.consumeToken({ tokenInstanceId: token.id, amount: spendFromToken });
      } else {
        await this.removeToken({ tokenInstanceId: token.id });
      }

      remainingToSpend -= spendFromToken;
    }

    if (remainingToSpend > 0) {
      this.loggerService.warn(
        `[gainFavor action] player ${args.playerId} missing ${remainingToSpend} Favor while spending`,
      );
    }

    const updatedFavorCount = Object.values(this.match.tokens ?? {})
      .filter((token) =>
        token.tokenId === alliesTokenIds.favor &&
        token.location.type === 'player' &&
        token.location.playerId === args.playerId
      )
      .reduce((total, token) => total + Math.max(1, token.counters ?? 1), 0);
    this.loggerService.debug(
      `[gainFavor action] player ${args.playerId} now has ${updatedFavorCount} Favor token(s)`,
    );
  }

  // Adds Villagers tokens (Renaissance) to a player.
  async gainVillager(args: { playerId: PlayerId; count?: number }, context?: GameActionContext) {
    this.loggerService.log(`[gainVillager action] player ${args.playerId} gained ${args.count} villagers`);
    this.match.villagers[args.playerId] ??= 0;
    this.match.villagers[args.playerId] += args.count ?? 1;
    this.match.villagers[args.playerId] = Math.max(0, this.match.villagers[args.playerId]);
    this.loggerService.debug(
      `[gainVillager action] player ${args.playerId} now has ${this.match.villagers[args.playerId]} villagers`,
    );
  }

  // Adds debt tokens to a player without spending treasure.
  async gainDebt(args: { playerId: PlayerId; count: number }, context?: GameActionContext) {
    this.loggerService.log(`[gainDebt action] player ${args.playerId} gained ${args.count} debt`);
    this.match.debt[args.playerId] ??= 0;
    this.match.debt[args.playerId] += args.count;
    this.match.debt[args.playerId] = Math.max(0, this.match.debt[args.playerId]);
    this.loggerService.debug(
      `[gainDebt action] player ${args.playerId} now has ${this.match.debt[args.playerId]} debt`,
    );
  }

  async exchangeCoffer(args: { playerId: PlayerId; count: number }, context?: GameActionContext) {
    this.loggerService.log(`[exchangeCoffer action] player ${args.playerId} exchanged ${args.count} coffers`);
    this.match.coffers[args.playerId] -= args.count;
    this.match.playerTreasure += args.count;
  }

  // Spends Villagers to gain actions during the Action phase.
  async spendVillager(args: { playerId: PlayerId; count: number }, context?: GameActionContext) {
    this.loggerService.log(`[spendVillager action] player ${args.playerId} spending ${args.count} villagers`);
    const currentPhase = getTurnPhase(this.match.turnPhaseIndex);
    // Villagers can only be spent during the Action phase.
    if (currentPhase !== 'action') {
      this.loggerService.warn(
        `[spendVillager action] player ${args.playerId} cannot spend villagers during ${currentPhase} phase`,
      );
      return;
    }
    const currentVillagers = this.match.villagers[args.playerId] ?? 0;
    const spendCount = Math.min(args.count, currentVillagers);
    if (spendCount <= 0) {
      this.loggerService.debug(`[spendVillager action] player ${args.playerId} has no villagers to spend`);
      return;
    }
    this.match.villagers[args.playerId] = currentVillagers - spendCount;
    this.loggerService.debug(
      `[spendVillager action] player ${args.playerId} now has ${this.match.villagers[args.playerId]} villagers`,
    );
    await this.gainAction({ count: spendCount }, context);
  }

  // Pays down debt tokens using the current treasure pool.
  async payDebt(args: { playerId: PlayerId; count: number }, context?: GameActionContext) {
    const currentDebt = this.match.debt[args.playerId] ?? 0;
    const payable = Math.min(args.count, currentDebt, this.match.playerTreasure);
    this.loggerService.log(`[payDebt action] player ${args.playerId} paying ${payable} debt`);
    if (payable <= 0) {
      this.loggerService.debug(`[payDebt action] player ${args.playerId} not enough payable ${payable} to pay debt`);
      return;
    }
    this.match.debt[args.playerId] = currentDebt - payable;
    this.match.playerTreasure = Math.max(0, this.match.playerTreasure - payable);
    this.loggerService.debug(
      `[payDebt action] player ${args.playerId} now has ${
        this.match.debt[args.playerId]
      } debt, treasure ${this.match.playerTreasure}`,
    );
    // Log the debt payment for the UI log.
    this.logManager.addLogEntry({
      type: 'payDebt',
      playerId: args.playerId,
      count: payable,
      source: context?.loggingContext?.source,
    });
  }

  async buyCard(args: {
    cardId: CardId | Card;
    playerId: PlayerId;
    overpay?: { inTreasure: number; inCoffer: number };
    cardCost: CardCost;
    buyOptionId?: string;
  }) {
    // Prevent buying if the player already has debt tokens.
    const existingDebt = this.match.debt[args.playerId] ?? 0;
    if (existingDebt > 0) {
      this.loggerService.debug(`[buyCard action] player ${args.playerId} has debt (${existingDebt}), blocking buy`);
      return;
    }
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;

    // Resolve legal buy options at execution time to avoid stale client-side choices.
    const resolvedBuyOptions = this.buyOptionsResolver.resolveBuyOptions({
      cardId: card,
      playerId: args.playerId,
    });
    const selectedBuyOption = args.buyOptionId
      ? resolvedBuyOptions.options.find((option) => option.id === args.buyOptionId)
      : resolvedBuyOptions.options.find((option) => option.kind === 'standard') ?? resolvedBuyOptions.options[0];

    if (!selectedBuyOption) {
      this.loggerService.debug(`[buyCard action] no legal buy option for ${card} and player ${args.playerId}`);
      return;
    }

    const standardCost = resolvedBuyOptions.cost;
    let paidTreasure = 0;

    if (selectedBuyOption.kind === 'standard') {
      // Standard payments use normal treasure/potion/debt handling.
      if (args.overpay?.inCoffer) {
        this.loggerService.debug(
          `[buyCard action] player ${args.playerId} overpaid ${args.overpay.inCoffer} coffers, exchanging for treasure`,
        );

        await this.exchangeCoffer({
          playerId: args.playerId,
          count: args.overpay.inCoffer,
        });
      }

      this.loggerService.debug(
        `[buyCard action] reducing player ${args.playerId} treasure by card cost ${standardCost.treasure} treasure`,
      );

      this.match.playerTreasure -= standardCost.treasure;
      paidTreasure = standardCost.treasure + (args.overpay?.inTreasure ?? 0) + (args.overpay?.inCoffer ?? 0);

      if (standardCost.potion !== undefined) {
        this.loggerService.debug(
          `[buyCard action] reducing player ${args.playerId} potions by card cost ${standardCost.potion} potions`,
        );
        this.match.playerPotions -= standardCost.potion;
      }

      if ((standardCost.debt ?? 0) > 0) {
        this.loggerService.debug(`[buyCard action] adding ${standardCost.debt} debt to player ${args.playerId}`);
        await this.gainDebt({ playerId: args.playerId, count: standardCost.debt! });
      }
    } else {
      // Alternate payments delegate their payment logic to the expansion-provided handler.
      const applyResult = await selectedBuyOption.option?.apply({
        match: this.match,
        playerId: args.playerId,
        card,
        cardLibrary: this.cardLibrary,
        findCardService: this.findCardService,
        cardSourceController: this.cardSourceController,
        cardPriceController: this.cardPriceController,
        actionService: this.actionService,
        promptService: this.promptService,
        reactionManager: this.reactionManager,
        logManager: this.logManager,
      });
      if (applyResult?.successful === false) {
        this.loggerService.debug(
          `[buyCard action] alternate buy option ${selectedBuyOption.id} did not complete payment`,
        );
        return;
      }
      paidTreasure = applyResult?.paidTreasure ?? 0;
    }

    this.loggerService.debug(`[buyCard action] reducing player ${args.playerId} buys by 1`);

    this.match.playerBuys--;

    this.loggerService.debug(`[buyCard action] adding bought stats to match`);

    const turnStatsIndex = this.getCurrentTurnStatsIndex();
    this.match.stats.cardsBoughtByTurn[turnStatsIndex] ??= [];
    this.match.stats.cardsBoughtByTurn[turnStatsIndex]!.push(cardId);

    this.match.stats.cardsBought[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      turnHistoryIndex: this.getCurrentTurnHistoryIndex(),
      playerId: args.playerId,
      cost: standardCost.treasure,
      paid: paidTreasure,
    };

    this.loggerService.debug(`[buyCard action] gaining card to discard pile`);

    await this.gainCard({
      playerId: args.playerId,
      cardId,
      to: { location: 'playerDiscard' },
    }, {
      bought: true,
      overpay: (args.overpay?.inTreasure ?? 0) + (args.overpay?.inCoffer ?? 0),
    });
  }

  async buyEvent(args: {
    cardLikeId: CardLikeId;
    playerId: PlayerId;
  }) {
    // Prevent buying landscapes if the player already has debt tokens.
    const existingDebt = this.match.debt[args.playerId] ?? 0;
    if (existingDebt > 0) {
      this.loggerService.debug(`[buyEvent action] player ${args.playerId} has debt (${existingDebt}), blocking buy`);
      return;
    }
    const event = findEventInMatch(this.match, args.cardLikeId);

    if (!event) {
      this.loggerService.warn(`[buyEvent action] could not find event ${args.cardLikeId}`);
      return;
    }

    this.loggerService.debug(`[buyEvent action] buying ${event}`);

    const cost = event.cost.treasure;

    this.match.playerTreasure -= cost;

    this.loggerService.debug(
      `[buyEvent action] reducing player ${args.playerId} treasure ${cost} to ${this.match.playerTreasure}`,
    );

    if ((event.cost.debt ?? 0) > 0) {
      this.loggerService.debug(`[buyEvent action] adding ${event.cost.debt} debt to player ${args.playerId}`);
      await this.gainDebt({ playerId: args.playerId, count: event.cost.debt! });
    }

    this.match.playerBuys--;

    this.loggerService.debug(
      `[buyEvent action] reducing player ${args.playerId} buys by 1 to ${this.match.playerBuys}`,
    );

    const turnStatsIndex = this.getCurrentTurnStatsIndex();
    this.match.stats.cardLikesBoughtByTurn[turnStatsIndex] ??= [];
    this.match.stats.cardLikesBoughtByTurn[turnStatsIndex]!.push(args.cardLikeId);

    this.match.stats.cardLikesBought[args.cardLikeId] = {
      playerId: args.playerId,
      turnNumber: this.match.turnNumber,
      turnHistoryIndex: this.getCurrentTurnHistoryIndex(),
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
    };

    const effectFn = this.eventEffectFunctionMap[event.cardKey];

    if (effectFn) {
      this.loggerService.debug(`[buyEvent action] running effect for ${event}`);

      const context = this.createCardEffectContext({
        cardId: args.cardLikeId,
        playerId: args.playerId,
      });

      // Run event effects with standardized logging.
      await this.runEffectWithLogging({
        source: event.toString(),
        sourceType: 'event',
        playerId: args.playerId,
        effectFn,
        context,
      });
    }
  }

  async buyProject(args: {
    cardLikeId: CardLikeId;
    playerId: PlayerId;
  }) {
    // Prevent buying projects if the player already has debt tokens.
    const existingDebt = this.match.debt[args.playerId] ?? 0;
    if (existingDebt > 0) {
      this.loggerService.debug(`[buyProject action] player ${args.playerId} has debt (${existingDebt}), blocking buy`);
      return;
    }

    const project = findProjectInMatch(this.match, args.cardLikeId);
    if (!project) {
      this.loggerService.warn(`[buyProject action] could not find project ${args.cardLikeId}`);
      return;
    }

    // Ensure the player has an available cube token to place.
    const cubeTokenId = renaissanceTokenIds.cube;
    const tokens = Object.values(this.match.tokens);
    const availableCube = tokens.find((token) =>
      token.tokenId === cubeTokenId &&
      token.ownerId === args.playerId &&
      token.location.type === 'playerAvailable' &&
      token.location.playerId === args.playerId
    );

    if (!availableCube) {
      this.loggerService.debug(`[buyProject action] player ${args.playerId} has no available cube tokens`);
      return;
    }

    // Prevent placing multiple cubes on the same project for the same player.
    const alreadyPlaced = tokens.some((token) =>
      token.tokenId === cubeTokenId &&
      token.ownerId === args.playerId &&
      token.location.type === 'cardLike' &&
      token.location.cardLikeId === project.id
    );

    if (alreadyPlaced) {
      this.loggerService.debug(`[buyProject action] player ${args.playerId} already owns ${project}`);
      return;
    }

    this.loggerService.debug(`[buyProject action] buying ${project}`);

    const cost = project.cost.treasure ?? 0;
    this.match.playerTreasure -= cost;
    this.loggerService.debug(
      `[buyProject action] reducing player ${args.playerId} treasure ${cost} to ${this.match.playerTreasure}`,
    );

    this.match.playerBuys--;
    this.loggerService.debug(
      `[buyProject action] reducing player ${args.playerId} buys by 1 to ${this.match.playerBuys}`,
    );

    const turnStatsIndex = this.getCurrentTurnStatsIndex();
    this.match.stats.cardLikesBoughtByTurn[turnStatsIndex] ??= [];
    this.match.stats.cardLikesBoughtByTurn[turnStatsIndex]!.push(args.cardLikeId);

    this.match.stats.cardLikesBought[args.cardLikeId] = {
      playerId: args.playerId,
      turnNumber: this.match.turnNumber,
      turnHistoryIndex: this.getCurrentTurnHistoryIndex(),
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
    };

    this.logManager.addLogEntry({
      type: 'buyProject',
      playerId: args.playerId,
      cardLikeId: project.id,
    });

    // Move a cube token onto the project to mark ownership.
    await this.moveToken({
      tokenInstanceId: availableCube.id,
      location: { type: 'cardLike', cardLikeId: project.id },
    });

    const effectFn = this.projectEffectFunctionMap[project.cardKey];
    if (effectFn) {
      this.loggerService.debug(`[buyProject action] running effect for ${project}`);

      const context = this.createCardEffectContext({
        cardId: args.cardLikeId,
        playerId: args.playerId,
      });

      // Run project effects with standardized logging.
      await this.runEffectWithLogging({
        source: project.toString(),
        sourceType: 'project',
        playerId: args.playerId,
        effectFn,
        context,
      });
    }
  }

  // Receives a boon from the shared boon deck and resolves its effect.
  async receiveBoon(
    args: { playerId: PlayerId; immediate?: boolean; boonId?: CardLikeId; keepSetAside?: boolean },
    context?: GameActionContext,
  ) {
    // Default to immediate resolution unless explicitly deferred.
    const immediate = args.immediate ?? true;
    this.loggerService.log(`[receiveBoon action] player ${args.playerId} receiving a boon`);

    if (!immediate) {
      this.loggerService.debug('[receiveBoon action] boon will be deferred until resolved');
    }

    if (this.match.boons.cards.length < 1) {
      this.loggerService.info('[receiveBoon action] no boons configured, skipping');
      return;
    }

    if (this.match.boons.deck.length < 1 && this.match.boons.discard.length > 0) {
      this.loggerService.info('[receiveBoon action] boon deck empty, reshuffling discard');
      await this.shuffleCardLike({ kind: 'boon', includeDiscard: true, playerId: args.playerId });
    }

    let boonId = args.boonId;
    let boon = boonId !== undefined ? findBoonInMatch(this.match, boonId) : undefined;

    if (boonId !== undefined && !boon) {
      this.loggerService.warn(`[receiveBoon action] could not find boon ${boonId}`);
      return;
    }

    if (boonId === undefined || !boon) {
      if (this.match.boons.deck.length < 1) {
        this.loggerService.info('[receiveBoon action] no boons available to draw');
        return;
      }

      boonId = this.match.boons.deck.pop();
      if (boonId === undefined) {
        this.loggerService.warn('[receiveBoon action] boon deck draw failed');
        return;
      }

      boon = findBoonInMatch(this.match, boonId);
      if (!boon) {
        this.loggerService.warn(`[receiveBoon action] could not find boon ${boonId}`);
        this.match.boons.discard.push(boonId);
        return;
      }
    }

    // Remove the boon from deck/discard if it was already staged there.
    const deckIndex = this.match.boons.deck.indexOf(boonId);
    if (deckIndex !== -1) {
      this.match.boons.deck.splice(deckIndex, 1);
    }
    const discardIndex = this.match.boons.discard.indexOf(boonId);
    if (discardIndex !== -1) {
      this.match.boons.discard.splice(discardIndex, 1);
    }

    // Helper to remove a boon from set-aside before resolving its effect.
    const removeSetAside = (source: string) => {
      try {
        const setAsideSource = this.cardSourceController.getSource('set-aside', args.playerId);
        const setAsideIndex = setAsideSource.indexOf(boonId);
        if (setAsideIndex !== -1) {
          setAsideSource.splice(setAsideIndex, 1);
          this.clearSetAsideSource(boonId);
          this.loggerService.debug(`[receiveBoon action] removed ${boon} from set-aside for ${source}`);
        }
      } catch (error) {
        this.loggerService.warn(`[receiveBoon action] could not update set-aside for boon ${boonId}`);
        this.loggerService.error(error);
      }
    };

    // Show a non-blocking received-boon modal.
    const receivedBoonPlayerName = getPlayerById(this.match, args.playerId)?.name ?? `Player ${args.playerId}`;
    await this.actionService.run('userPrompt', {
      playerId: args.playerId,
      prompt: `${receivedBoonPlayerName} received a Boon`,
      content: { type: 'display-cards', cardLikeIds: [boonId] },
      waitForInput: false,
    });

    // Helper to resolve the boon effect and handle discard logic.
    const resolveBoon = async (source: string) => {
      const effectFn = this.boonEffectFunctionMap[boon.cardKey];

      if (effectFn) {
        this.loggerService.debug(`[receiveBoon action] running effect for ${boon} (${source})`);

        const effectContext = this.createCardEffectContext({
          cardId: boonId,
          playerId: args.playerId,
        });

        // Run boon effects with standardized logging.
        await this.runEffectWithLogging({
          source: boon.toString(),
          sourceType: 'boon',
          playerId: args.playerId,
          effectFn,
          context: effectContext,
        });
      } else {
        this.loggerService.debug(`[receiveBoon action] no effect registered for ${boon.cardKey}`);
      }

      // Skip discarding if the boon was set aside by its effect.
      let isSetAside = false;
      try {
        const setAsideSource = this.cardSourceController.getSource('set-aside', args.playerId);
        isSetAside = setAsideSource.includes(boonId);
      } catch (error) {
        this.loggerService.warn(`[receiveBoon action] could not verify set-aside for boon ${boonId}`);
        this.loggerService.error(error);
      }

      if (isSetAside) {
        this.loggerService.debug(`[receiveBoon action] boon ${boon.cardKey} set aside until cleanup`);
        return;
      }

      if (args.keepSetAside) {
        this.loggerService.debug(`[receiveBoon action] preserving ${boon} in set-aside`);
        return;
      }

      this.match.boons.discard.push(boonId);
      this.loggerService.debug(`[receiveBoon action] discarded ${boon}`);
    };

    if (!immediate) {
      // Set the boon aside for delayed resolution unless already set aside.
      let alreadySetAside = false;
      try {
        const setAsideSource = this.cardSourceController.getSource('set-aside', args.playerId);
        alreadySetAside = setAsideSource.includes(boonId);
      } catch (error) {
        this.loggerService.warn(`[receiveBoon action] could not check set-aside for boon ${boonId}`);
        this.loggerService.error(error);
      }

      if (!alreadySetAside) {
        await this.moveCardLike({
          cardLikeId: boonId,
          toPlayerId: args.playerId,
          to: { location: 'set-aside' },
          setAsideSource: {
            ownerPlayerId: args.playerId,
            sourceKind: 'boon',
            sourceCardLikeId: boonId,
          },
        });
      }

      this.loggerService.debug(`[receiveBoon action] set aside ${boon} for deferred resolution`);
      return boonId;
    }

    // Ensure deferred boons are removed from set-aside before resolving.
    removeSetAside('immediate resolution');

    // Resolve the boon immediately (default behavior).
    await resolveBoon('immediate');

    return boonId;
  }

  // Receives a hex from the shared hex deck and resolves its effect.
  async receiveHex(args: { playerId: PlayerId; hexId?: CardLikeId }, context?: GameActionContext) {
    this.loggerService.log(`[receiveHex action] player ${args.playerId} receiving a hex`);

    if (this.match.hexes.cards.length < 1) {
      this.loggerService.info('[receiveHex action] no hexes configured, skipping');
      return;
    }

    if (this.match.hexes.deck.length < 1 && this.match.hexes.discard.length > 0) {
      this.loggerService.info('[receiveHex action] hex deck empty, reshuffling discard');
      await this.shuffleCardLike({ kind: 'hex', includeDiscard: true, playerId: args.playerId });
    }

    let hexId = args.hexId;
    let hex = hexId !== undefined ? findHexInMatch(this.match, hexId) : undefined;

    if (hexId !== undefined && !hex) {
      this.loggerService.warn(`[receiveHex action] could not find hex ${hexId}`);
      return;
    }

    if (hexId === undefined || !hex) {
      if (this.match.hexes.deck.length < 1) {
        this.loggerService.info('[receiveHex action] no hexes available to draw');
        return;
      }

      hexId = this.match.hexes.deck.pop();
      if (hexId === undefined) {
        this.loggerService.warn('[receiveHex action] hex deck draw failed');
        return;
      }

      hex = findHexInMatch(this.match, hexId);
      if (!hex) {
        this.loggerService.warn(`[receiveHex action] could not find hex ${hexId}`);
        this.match.hexes.discard.push(hexId);
        return;
      }
    }

    // Narrow the resolved hex/hexId for the remaining resolution flow.
    if (hexId === undefined || !hex) {
      this.loggerService.warn('[receiveHex action] hex resolution incomplete, skipping');
      return;
    }
    const resolvedHexId = hexId;
    const resolvedHex = hex;

    // Remove the hex from deck/discard if it was already staged there.
    const deckIndex = this.match.hexes.deck.indexOf(resolvedHexId);
    if (deckIndex !== -1) {
      this.match.hexes.deck.splice(deckIndex, 1);
    }
    const discardIndex = this.match.hexes.discard.indexOf(resolvedHexId);
    if (discardIndex !== -1) {
      this.match.hexes.discard.splice(discardIndex, 1);
    }

    // Show a non-blocking received-hex modal before resolving hex effects.
    const receivedHexPlayerName = getPlayerById(this.match, args.playerId)?.name ?? `Player ${args.playerId}`;
    await this.actionService.run('userPrompt', {
      playerId: args.playerId,
      prompt: `${receivedHexPlayerName} received a Hex`,
      content: { type: 'display-cards', cardLikeIds: [resolvedHexId] },
      waitForInput: false,
    });

    const effectFn = this.hexEffectFunctionMap[resolvedHex.cardKey];
    if (effectFn) {
      this.loggerService.debug(`[receiveHex action] running effect for ${resolvedHex}`);

      const effectContext = this.createCardEffectContext({
        cardId: resolvedHexId,
        playerId: args.playerId,
      });

      // Run hex effects with standardized logging.
      await this.runEffectWithLogging({
        source: resolvedHex.toString(),
        sourceType: 'hex',
        playerId: args.playerId,
        effectFn,
        context: effectContext,
      });
    } else {
      this.loggerService.debug(`[receiveHex action] no effect registered for ${resolvedHex.cardKey}`);
    }

    // Received hexes always go to the discard pile after resolving.
    this.match.hexes.discard.push(resolvedHexId);
    this.loggerService.debug(`[receiveHex action] discarded ${resolvedHex}`);

    return resolvedHexId;
  }

  // Assigns a state to a player and registers its effect triggers.
  async gainState(
    args: { playerId: PlayerId; stateId?: CardLikeId; stateKey?: CardKey; removeFromCurrentOwner?: boolean },
    context?: GameActionContext,
  ) {
    this.loggerService.log(`[gainState action] player ${args.playerId} gaining state`);

    const store = this.getStatusStore('state');
    if (store.cards.length < 1) {
      this.loggerService.info('[gainState action] no states configured, skipping');
      return;
    }

    const state = this.resolveStatusCard(store, { statusId: args.stateId, statusKey: args.stateKey });

    if (!state) {
      this.loggerService.warn('[gainState action] could not resolve state to gain');
      return;
    }

    const ownedStates = store.byPlayer[args.playerId] ?? [];
    if (ownedStates.includes(state.id)) {
      this.loggerService.debug(`[gainState action] player ${args.playerId} already has ${state}`);
      return state.id;
    }

    // Only strip the state from previous owners when explicitly requested.
    if (args.removeFromCurrentOwner) {
      const ownerIds = this.findStatusOwners(store, state.id);
      for (const ownerId of ownerIds) {
        await this.removeState({ playerId: ownerId, stateId: state.id });
      }
    }

    this.addStatusToPlayer(store, args.playerId, state.id);

    const effectFn = this.stateEffectFunctionMap[state.cardKey];
    if (!effectFn) {
      this.loggerService.debug(`[gainState action] no effect registered for ${state.cardKey}`);
      return state.id;
    }

    this.loggerService.debug(`[gainState action] registering effects for ${state}`);
    const effectContext = this.createCardEffectContext({
      cardId: state.id,
      playerId: args.playerId,
    });

    // Run state effects with standardized logging.
    await this.runEffectWithLogging({
      source: state.toString(),
      sourceType: 'state',
      playerId: args.playerId,
      effectFn,
      context: effectContext,
    });

    return state.id;
  }

  // Removes a state from a player and cleans up any registered triggers.
  async removeState(
    args: { playerId: PlayerId; stateId?: CardLikeId; stateKey?: CardKey },
    context?: GameActionContext,
  ): Promise<void> {
    this.loggerService.log(`[removeState action] player ${args.playerId} removing state`);

    const store = this.getStatusStore('state');
    const state = this.resolveStatusCard(store, { statusId: args.stateId, statusKey: args.stateKey });

    if (!state) {
      this.loggerService.warn('[removeState action] could not resolve state to remove');
      return;
    }

    const ownedStates = store.byPlayer[args.playerId] ?? [];
    const index = ownedStates.indexOf(state.id);
    if (index === -1) {
      this.loggerService.debug(`[removeState action] player ${args.playerId} does not have ${state}`);
      return;
    }

    ownedStates.splice(index, 1);
    // State-trigger cleanup is handled by the state effect that registered them.
    this.loggerService.debug(`[removeState action] removed ${state} from player ${args.playerId}`);
  }

  // Assigns an artifact to a player and registers its effect triggers.
  async gainArtifact(
    args: { playerId: PlayerId; artifactId?: CardLikeId; artifactKey?: CardKey },
    context?: GameActionContext,
  ) {
    this.loggerService.log(`[gainArtifact action] player ${args.playerId} gaining artifact`);

    const store = this.getStatusStore('artifact');
    if (store.cards.length < 1) {
      this.loggerService.info('[gainArtifact action] no artifacts configured, skipping');
      return;
    }

    const artifact = this.resolveStatusCard(store, { statusId: args.artifactId, statusKey: args.artifactKey });
    if (!artifact) {
      this.loggerService.warn('[gainArtifact action] could not resolve artifact to gain');
      return;
    }

    const ownedArtifacts = store.byPlayer[args.playerId] ?? [];
    if (ownedArtifacts.includes(artifact.id)) {
      this.loggerService.debug(`[gainArtifact action] player ${args.playerId} already has ${artifact}`);
      return artifact.id;
    }

    // Artifacts are unique; remove from all previous owners.
    const ownerIds = this.findStatusOwners(store, artifact.id);
    for (const ownerId of ownerIds) {
      await this.removeArtifact({ playerId: ownerId, artifactId: artifact.id });
    }

    this.addStatusToPlayer(store, args.playerId, artifact.id);

    const effectFn = this.artifactEffectFunctionMap[artifact.cardKey];
    if (!effectFn) {
      this.loggerService.debug(`[gainArtifact action] no effect registered for ${artifact.cardKey}`);
      return artifact.id;
    }

    this.loggerService.debug(`[gainArtifact action] registering effects for ${artifact}`);
    const effectContext = this.createCardEffectContext({
      cardId: artifact.id,
      playerId: args.playerId,
    });

    // Run artifact effects with standardized logging.
    await this.runEffectWithLogging({
      source: artifact.toString(),
      sourceType: 'artifact',
      playerId: args.playerId,
      effectFn,
      context: effectContext,
    });

    return artifact.id;
  }

  // Removes an artifact from a player and cleans up any registered triggers.
  async removeArtifact(
    args: { playerId: PlayerId; artifactId?: CardLikeId; artifactKey?: CardKey },
    context?: GameActionContext,
  ): Promise<void> {
    this.loggerService.log(`[removeArtifact action] player ${args.playerId} removing artifact`);

    const store = this.getStatusStore('artifact');
    const artifact = this.resolveStatusCard(store, { statusId: args.artifactId, statusKey: args.artifactKey });
    if (!artifact) {
      this.loggerService.warn('[removeArtifact action] could not resolve artifact to remove');
      return;
    }

    const ownedArtifacts = store.byPlayer[args.playerId] ?? [];
    const index = ownedArtifacts.indexOf(artifact.id);
    if (index === -1) {
      this.loggerService.debug(`[removeArtifact action] player ${args.playerId} does not have ${artifact}`);
      return;
    }

    ownedArtifacts.splice(index, 1);
    // Artifact-trigger cleanup is handled by the artifact effect that registered them.
    this.loggerService.debug(`[removeArtifact action] removed ${artifact} from player ${args.playerId}`);
  }

  async revealCard(args: {
    cardId?: CardId | Card;
    playerId: PlayerId;
    source?: 'playerDeck' | 'playerDiscard';
    moveToSetAside?: boolean;
  }, context?: GameActionContext): Promise<CardId | undefined> {
    let cardId: CardId | undefined;
    // Resolve reveal target either from an explicit card id or from a source zone.
    if (args.cardId instanceof Card) {
      cardId = args.cardId.id;
    } else if (typeof args.cardId === 'number') {
      cardId = args.cardId;
    } else if (args.source === 'playerDeck') {
      let deck = this.cardSourceController.getSource('playerDeck', args.playerId);
      if (!deck.length) {
        this.loggerService.debug(`[revealCard action] player ${args.playerId} deck empty, shuffling discard into deck`);
        await this.shuffleDeck({ playerId: args.playerId }, context);
        deck = this.cardSourceController.getSource('playerDeck', args.playerId);
      }
      cardId = deck.slice(-1)[0];
    } else if (args.source === 'playerDiscard') {
      const discard = this.cardSourceController.getSource('playerDiscard', args.playerId);
      if (!discard.length) {
        this.loggerService.debug(
          `[revealCard action] player ${args.playerId} discard empty, shuffling for reveal fallback`,
        );
        await this.shuffleDeck({ playerId: args.playerId }, context);
        const deck = this.cardSourceController.getSource('playerDeck', args.playerId);
        cardId = deck.slice(-1)[0];
      } else {
        cardId = discard.slice(-1)[0];
      }
    } else {
      throw new Error('[revealCard action] cardId or source is required');
    }

    if (cardId === undefined) {
      this.loggerService.debug(`[revealCard action] player ${args.playerId} has no card to reveal`);
      return undefined;
    }

    const card = this.cardLibrary.getCard(cardId);
    let previousLocation: { location: CardLocation; playerId?: PlayerId } | undefined;

    this.loggerService.debug(`[revealCard action] ${getPlayerById(this.match, args.playerId)} revealing ${card}`);

    if (args.moveToSetAside) {
      this.loggerService.debug(`[revealCard action] moving card to 'revealed' zone`);

      previousLocation = await this.moveCard({
        cardId: cardId,
        toPlayerId: args.playerId,
        to: { location: 'set-aside' },
        facing: 'front',
      });
    }

    this.logManager.addLogEntry({
      type: 'revealCard',
      cardId: cardId,
      playerId: args.playerId,
      source: context?.loggingContext?.source,
    });

    await this.reactionManager.runCardLifecycleEvent('onRevealed', {
      playerId: args.playerId,
      cardId,
      previousLocation,
    });

    return cardId;
  }

  async checkForRemainingPlayerActions(): Promise<void> {
    const match = this.match;
    const currentPlayer = getCurrentPlayer(match);
    const turnPhase = getTurnPhase(match.turnPhaseIndex);

    this.loggerService.debug(
      `[checkForRemainingPlayerActions action] phase: ${turnPhase} for ${currentPlayer} turn ${match.turnNumber}`,
    );

    // Pause automated flow while any human player is disconnected.
    const hasDisconnectedHuman = match.players.some((player) => !player.connected && !player.isComputer);
    if (hasDisconnectedHuman) {
      this.loggerService.debug('[checkForRemainingPlayerActions action] human disconnected, pausing flow');
      return;
    }

    this.interactivityController.checkCardInteractivity();

    if (turnPhase === 'action') {
      const hasActions = match.playerActions > 0;
      const hasActionCards = this.findCardService.findCards({ location: 'playerHand', playerId: currentPlayer.id })
        .some((cardId) => cardId.type.includes('ACTION'));

      if (!hasActions || !hasActionCards) {
        this.loggerService.debug('[checkForRemainingPlayerActions action] skipping to next phase');
        await this.nextPhase();
        return;
      }
    }

    if (turnPhase === 'buy') {
      const hasBuys = match.playerBuys > 0;

      this.loggerService.debug(`[checkForRemainingPlayerActions action] ${currentPlayer} as ${hasBuys} buys remaining`);

      if (!hasBuys) {
        this.loggerService.debug('[checkForRemainingPlayerActions action] skipping to next phase');
        await this.nextPhase();
        return;
      }
    }

    if (turnPhase === 'night') {
      // Skip Night phase automatically if the player has no Night cards to play.
      const hasNightCards = this.findCardService.findCards({ location: 'playerHand', playerId: currentPlayer.id })
        .some((cardId) => cardId.type.includes('NIGHT'));

      if (!hasNightCards) {
        this.loggerService.debug('[checkForRemainingPlayerActions action] no night cards, skipping to next phase');
        await this.nextPhase();
        return;
      }
      this.loggerService.debug('[checkForRemainingPlayerActions action] night cards available, waiting for play');
    }

    if (turnPhase === 'cleanup') {
      await this.nextPhase();
      return;
    }

    // Allow computer players to take a single action per phase.
    await this.runComputerTurnStep();
  }

  async discardCard(
    args: { cardId: CardId | Card | Array<CardId | Card>; playerId: PlayerId },
    context?: GameActionContext,
  ) {
    // Allow both single-card and multi-card discard calls while preserving input order.
    const discardCards = (Array.isArray(args.cardId) ? args.cardId : [args.cardId])
      .map((nextCard) => nextCard instanceof Card ? nextCard : this.cardLibrary.getCard(nextCard));

    if (discardCards.length < 1) {
      this.loggerService.warn('[discardCard action] called with no cards to discard');
      return;
    }

    this.loggerService.info(
      `[discardCard action] discarding ${discardCards.length} card(s) from ${getPlayerById(this.match, args.playerId)}`,
    );

    const lastDiscardCard = discardCards[discardCards.length - 1];

    for (const [index, discardCard] of discardCards.entries()) {
      const isLastDiscard = index === discardCards.length - 1;
      const oldLocation = await this.moveCard({
        cardId: discardCard.id,
        to: { location: 'playerDiscard' },
        toPlayerId: args.playerId,
        // Reveal only the final discarded card; keep prior discarded cards face-down.
        facing: isLastDiscard ? 'front' : 'back',
      });

      if (!oldLocation) {
        throw new Error(
          `[discardCard action] could not find card ${discardCard.id} in player ${args.playerId}'s discard pile`,
        );
      }

      const r = new ReactionTrigger('discardCard', {
        previousLocation: oldLocation,
        playerId: args.playerId,
        cardId: discardCard.id,
      });

      await this.reactionManager.runTrigger({ trigger: r });

      await this.reactionManager.runCardLifecycleEvent('onDiscarded', {
        cardId: discardCard.id,
        playerId: args.playerId,
        previousLocation: oldLocation,
      });
    }

    // Emit a single log entry for grouped discards; only the final card remains face-up in the message.
    this.logManager.addLogEntry({
      type: 'discard',
      playerId: args.playerId,
      cardId: lastDiscardCard.id,
      count: discardCards.length,
      source: context?.loggingContext?.source,
    });
  }

  async nextPhase() {
    const match = this.match;

    let currentPlayer = getCurrentPlayer(match);
    type ScheduledTurn = {
      kind: 'extra' | 'fleet' | 'normal';
      turn: ExtraTurn;
    };
    let scheduledTurn: ScheduledTurn | undefined;

    await this.runEndTurnPhaseTrigger(match.turnPhaseIndex, currentPlayer.id);

    match.turnPhaseIndex = match.turnPhaseIndex + 1;

    if (match.turnPhaseIndex >= TurnPhaseOrderValues.length) {
      match.turnPhaseIndex = 0;

      // If Fleet round has already assigned all Fleet turns, stop turn scheduling and finalize game next.
      if (
        match.fleetRound.active &&
        match.fleetRound.nextFleetPlayerIndex >= match.fleetRound.eligiblePlayerIdsInOrder.length
      ) {
        const discardedExtraTurnCount = match.extraTurnQueue.length;
        if (discardedExtraTurnCount > 0) {
          this.loggerService.info(
            `[nextPhase action] Fleet round ended; discarding ${discardedExtraTurnCount} remaining extra turn(s)`,
          );
        } else {
          this.loggerService.info('[nextPhase action] Fleet round ended; no remaining extra turns to discard');
        }

        match.extraTurnQueue = [];
        match.fleetRound.active = false;
        match.fleetRound.completed = true;
        return;
      }

      // Resolves the next scheduled turn source in priority order: valid extra turn, Fleet turn, then normal turn.
      const resolveNextScheduledTurn = (): ScheduledTurn => {
        // Resolve the next valid extra turn, skipping entries that would create a third consecutive turn.
        while (match.extraTurnQueue.length > 0) {
          const queuedExtraTurn = match.extraTurnQueue.shift();
          if (!queuedExtraTurn) {
            break;
          }

          const turns = match.stats.turns;
          const previousTurn = turns.length >= 1 ? turns[turns.length - 1] : undefined;
          const secondPreviousTurn = turns.length >= 2 ? turns[turns.length - 2] : undefined;
          const wouldBeThirdTurnInARow = previousTurn?.playerId === queuedExtraTurn.playerId &&
            secondPreviousTurn?.playerId === queuedExtraTurn.playerId;

          if (wouldBeThirdTurnInARow) {
            this.loggerService.info(
              `[nextPhase action] skipping extra turn for player ${queuedExtraTurn.playerId}; would be a third consecutive turn`,
            );
            continue;
          }

          return {
            kind: 'extra',
            turn: queuedExtraTurn,
          };
        }

        // Fleet turns happen after normal extra turns while Fleet round is active.
        if (match.fleetRound.active) {
          const nextFleetTurnIndex = match.fleetRound.nextFleetPlayerIndex;
          const nextFleetPlayerId = match.fleetRound.eligiblePlayerIdsInOrder[nextFleetTurnIndex];
          if (nextFleetPlayerId !== undefined) {
            match.fleetRound.nextFleetPlayerIndex++;
            this.loggerService.info(
              `[nextPhase action] scheduling Fleet turn for player ${nextFleetPlayerId} (${
                nextFleetTurnIndex + 1
              }/${match.fleetRound.eligiblePlayerIdsInOrder.length})`,
            );
            return {
              kind: 'fleet',
              turn: { playerId: nextFleetPlayerId },
            };
          }
        }

        const nextPlayerIndex = (match.currentPlayerTurnIndex + 1) % match.players.length;
        return {
          kind: 'normal',
          turn: { playerId: match.players[nextPlayerIndex].id },
        };
      };

      // Consume pending skipped turns before starting a real turn.
      while (!scheduledTurn) {
        const candidateTurn = resolveNextScheduledTurn();
        const candidatePlayerId = candidateTurn.turn.playerId;
        const pendingSkips = match.skippedTurns[candidatePlayerId] ?? 0;

        if (pendingSkips < 1) {
          scheduledTurn = candidateTurn;
          break;
        }

        match.skippedTurns[candidatePlayerId] = pendingSkips - 1;
        this.loggerService.info(
          `[nextPhase action] player ${candidatePlayerId} skips a turn (${match.skippedTurns[candidatePlayerId]} remaining)`,
        );

        // Skipped turns still count for turn history and tiebreaking even though no phases run.
        const isSamePlayerExtraTurn = candidateTurn.kind === 'extra' && candidatePlayerId === currentPlayer.id;
        if (!isSamePlayerExtraTurn) {
          match.turnNumber += 1;
        }
        match.currentPlayerTurnIndex = getPlayerTurnIndex({ match, playerId: candidatePlayerId });
        match.roundNumber = Math.floor(match.turnNumber / match.players.length) + 1;

        this.logManager.addLogEntry({
          root: true,
          type: 'newTurn',
          turn: match.roundNumber,
          source: candidateTurn.turn.sourceId,
        });

        this.logManager.addLogEntry({
          type: 'newPlayerTurn',
          turn: match.roundNumber,
          playerId: candidatePlayerId,
        });

        match.stats.turns.push({
          turnNumber: match.turnNumber,
          controllerId: candidateTurn.turn.controllerId ?? candidatePlayerId,
          playerId: candidatePlayerId,
          sourceId: candidateTurn.turn.sourceId,
        });

        currentPlayer = getCurrentPlayer(match);
      }

      // If there is an extra turn in the queue and it's the same player, keep turnNumber stable.
      const isSamePlayerExtraTurn = scheduledTurn.kind === 'extra' && scheduledTurn.turn.playerId === currentPlayer.id;
      match.turnNumber = isSamePlayerExtraTurn ? match.turnNumber : match.turnNumber + 1;
    }

    const newPhase = getTurnPhase(match.turnPhaseIndex);

    if (newPhase === 'action') {
      match.playerActions = 1;
      match.playerBuys = 1;
      match.playerTreasure = 10;
      match.playerPotions = 0;

      if (scheduledTurn) {
        match.currentPlayerTurnIndex = getPlayerTurnIndex({ match, playerId: scheduledTurn.turn.playerId });
      } else {
        match.currentPlayerTurnIndex++;
      }

      if (match.currentPlayerTurnIndex >= match.players.length) {
        match.currentPlayerTurnIndex = 0;
      }

      match.roundNumber = Math.floor(match.turnNumber / match.players.length) + 1;

      this.logManager.addLogEntry({
        root: true,
        type: 'newTurn',
        turn: match.roundNumber,
        source: scheduledTurn?.turn.sourceId,
      });

      this.logManager.addLogEntry({
        type: 'newPlayerTurn',
        turn: match.roundNumber,
        playerId: match.players[match.currentPlayerTurnIndex].id,
      });

      currentPlayer = getCurrentPlayer(match);
      // Track every started turn, including extra turns and owner/controller overrides.
      match.stats.turns.push({
        turnNumber: match.turnNumber,
        controllerId: scheduledTurn?.turn.controllerId ?? currentPlayer.id,
        playerId: currentPlayer.id,
        sourceId: scheduledTurn?.turn.sourceId,
      });

      this.loggerService.info(
        `[nextPhase action] new round: ${match.roundNumber}, turn ${match.turnNumber} for ${currentPlayer}`,
      );

      // Duration cards should be in play during their owner's turn while still active.
      await this.restoreActiveDurationCardsToPlayArea(currentPlayer.id);

      const startTurnTrigger = new ReactionTrigger('startTurn', {
        playerId: match.players[match.currentPlayerTurnIndex].id,
        turnNumber: match.turnNumber,
      });

      await this.reactionManager.runTrigger({ trigger: startTurnTrigger });
    }

    await this.enterPhase({
      phaseIndex: match.turnPhaseIndex,
      runPhaseEntryEffects: true,
      runStartPhaseTrigger: true,
      logLabel: 'nextPhase action',
    });
  }

  private async runEndTurnPhaseTrigger(phaseIndex: number, playerId: PlayerId) {
    const trigger = new ReactionTrigger('endTurnPhase', {
      phaseIndex,
      playerId,
    });
    await this.reactionManager.runTrigger({ trigger });
  }

  private async runStartTurnPhaseTrigger(phaseIndex: number) {
    const trigger = new ReactionTrigger('startTurnPhase', { phaseIndex });
    await this.reactionManager.runTrigger({ trigger });
  }

  // Moves active Duration cards for one player from activeDuration back to playArea.
  private async restoreActiveDurationCardsToPlayArea(playerId: PlayerId) {
    const activeDuration = this.cardSourceController.getSource('activeDuration')
      .filter((cardId) => this.cardLibrary.getCard(cardId).owner === playerId);

    for (const cardId of activeDuration) {
      await this.moveCard({
        cardId,
        to: { location: 'playArea' },
      });
    }
  }

  private async handlePhaseEntryEffects(
    phase: TurnPhase,
    runStartPhaseTrigger: boolean,
  ) {
    const match = this.match;

    switch (phase) {
      case 'action':
      case 'buy': {
        // Action and buy phase entry should only run start-of-phase triggers.
        if (runStartPhaseTrigger) {
          await this.runStartTurnPhaseTrigger(match.turnPhaseIndex);
        }
        break;
      }
      case 'cleanup': {
        // Cleanup phase entry performs the end-of-turn card movement and redraw.
        if (runStartPhaseTrigger) {
          await this.runStartTurnPhaseTrigger(match.turnPhaseIndex);
        }

        const currentPlayer = getCurrentPlayer(match);
        const currentTurnHistoryIndex = match.stats.turns.length - 1;
        const cardsInPlay = this.findCardService.findCards({ location: 'playArea' })
          .filter((card) => card.owner === currentPlayer.id);
        const cardsToKeepInPlayAtCleanup = new Set<CardId>(
          cardsInPlay
            .filter((card) => {
              const metadata = card.metadata as BaseCardMetadata | undefined;
              return metadata?.base?.skipDiscardFromPlayAtCleanupTurnHistoryIndex === currentTurnHistoryIndex;
            })
            .map((card) => card.id),
        );
        // Clear one-cleanup base metadata now that this cleanup pass is resolving.
        for (const card of cardsInPlay) {
          const metadata = card.metadata as BaseCardMetadata | undefined;
          if (metadata?.base?.skipDiscardFromPlayAtCleanupTurnHistoryIndex === currentTurnHistoryIndex) {
            delete metadata.base.skipDiscardFromPlayAtCleanupTurnHistoryIndex;
          }
        }

        const cardsToDiscard = cardsInPlay
          .filter((card) => !cardsToKeepInPlayAtCleanup.has(card.id))
          .concat(
            this.findCardService.findCards({
              location: 'playerHand',
              playerId: currentPlayer.id,
            }),
          );

        for (const cardId of cardsToDiscard) {
          await this.discardCard({ cardId, playerId: currentPlayer.id });
        }

        // Draw a full hand for the next turn.
        await this.drawHand({ playerId: currentPlayer.id });

        await this.endTurn();

        break;
      }
      case 'night': {
        // Night phase currently only triggers phase start reactions.
        if (runStartPhaseTrigger) {
          await this.runStartTurnPhaseTrigger(match.turnPhaseIndex);
        }
        break;
      }
    }
  }

  private async enterPhase(args: {
    phaseIndex: number;
    runPhaseEntryEffects: boolean;
    runStartPhaseTrigger: boolean;
    logLabel: string;
  }) {
    const match = this.match;
    const phase = getTurnPhase(args.phaseIndex);

    match.turnPhaseIndex = args.phaseIndex;

    this.loggerService.log(
      `[${args.logLabel}] entering phase: ${phase} for turn ${match.turnNumber}`,
    );

    if (args.runPhaseEntryEffects) {
      await this.handlePhaseEntryEffects(phase, args.runStartPhaseTrigger);
    } else if (args.runStartPhaseTrigger) {
      await this.runStartTurnPhaseTrigger(match.turnPhaseIndex);
    }

    await this.checkForRemainingPlayerActions();
  }

  // Sets the turn phase explicitly without changing turn or player order.
  async setTurnPhase(args: {
    phase: TurnPhase;
    playerId?: PlayerId;
    endCurrentPhase?: boolean;
    startNewPhase?: boolean;
  }) {
    const match = this.match;
    const currentPlayer = getCurrentPlayer(match);
    const targetPlayerId = args.playerId ?? currentPlayer.id;

    if (targetPlayerId !== currentPlayer.id) {
      this.loggerService.warn(
        `[setTurnPhase action] requested by non-current player ${targetPlayerId}, current is ${currentPlayer.id}`,
      );
      return;
    }

    const currentPhase = getTurnPhase(match.turnPhaseIndex);
    if (currentPhase === args.phase) {
      this.loggerService.debug(
        `[setTurnPhase action] already in ${args.phase} phase, skipping`,
      );
      return;
    }

    const targetIndex = TurnPhaseOrderValues.indexOf(args.phase);
    if (targetIndex < 0) {
      throw new Error(`[setTurnPhase action] invalid phase ${args.phase}`);
    }

    const shouldEnd = args.endCurrentPhase ?? true;
    const shouldStart = args.startNewPhase ?? true;

    if (shouldEnd) {
      await this.runEndTurnPhaseTrigger(match.turnPhaseIndex, currentPlayer.id);
    }

    await this.enterPhase({
      phaseIndex: targetIndex,
      runPhaseEntryEffects: false,
      runStartPhaseTrigger: shouldStart,
      logLabel: 'setTurnPhase action',
    });

    if (!shouldStart) {
      this.loggerService.debug(`[setTurnPhase action] start phase trigger suppressed`);
    }
  }

  async endTurn() {
    this.loggerService.info('[endTurn action] removing overrides');

    const trigger = new ReactionTrigger('endTurn', {
      playerId: getCurrentPlayer(this.match).id,
      turnNumber: this.match.turnNumber,
    });
    await this.reactionManager.runTrigger({ trigger });
  }

  async gainTreasure(args: { count: number }, context?: GameActionContext) {
    const currentPlayer = getCurrentPlayer(this.match);
    const source = this.resolveActionSource(context);
    let gainAmount = args.count;
    // Allow reactions to modify incoming treasure gains.
    // Include the source card so reactions can attribute token logs.
    const trigger = new ReactionTrigger('treasureGain', {
      playerId: currentPlayer.id,
      count: gainAmount,
      source,
    });
    await this.reactionManager.runTrigger({ trigger });
    gainAmount = Math.max(0, trigger.args.count);

    this.loggerService.info(`[gainTreasure action] gaining ${gainAmount} treasure`);
    this.match.playerTreasure += gainAmount;
    this.match.playerTreasure = Math.max(0, this.match.playerTreasure);

    if (!context?.loggingContext?.suppress) {
      this.logManager.addLogEntry({
        type: 'gainTreasure',
        playerId: currentPlayer.id,
        count: gainAmount,
        source,
      });
    }
  }

  // Spends treasure from the current player's pool without allowing negatives.
  async spendTreasure(args: { count: number }, _context?: GameActionContext) {
    const currentPlayer = getCurrentPlayer(this.match);
    const requestedAmount = Math.max(0, args.count);
    const spendAmount = Math.min(requestedAmount, this.match.playerTreasure);
    this.loggerService.info(`[spendTreasure action] player ${currentPlayer.id} spending ${spendAmount} treasure`);

    if (spendAmount < 1) {
      this.loggerService.debug('[spendTreasure action] no treasure spent');
      return;
    }

    this.match.playerTreasure -= spendAmount;
    this.match.playerTreasure = Math.max(0, this.match.playerTreasure);
    this.loggerService.debug(
      `[spendTreasure action] player ${currentPlayer.id} treasure now ${this.match.playerTreasure}`,
    );
  }

  // Single, focused implementation of drawCard
  async drawCard(
    args: { playerId: PlayerId; count?: number; suppressReactions?: boolean },
    context?: GameActionContext,
  ) {
    const source = this.resolveActionSource(context);
    const { playerId, count } = args;
    const returnSingleResult = count === undefined || count === 1;
    this.loggerService.debug(`[drawCard action] player ${playerId} drawing ${count} card(s)`);

    let drawCount = (count === undefined || isNaN(count)) ? 1 : count;

    if (drawCount === 0 ) {
      this.loggerService.debug('[drawCard action] draw count is 0, skipping');
      return returnSingleResult ? null : [];
    }

    if (!args.suppressReactions) {
      // Allow reactions to modify incoming draw amounts (e.g., -1 Card token).
      const trigger = new ReactionTrigger('drawCards', {
        playerId,
        count: drawCount,
        source,
      });
      await this.reactionManager.runTrigger({ trigger });
      drawCount = Math.max(0, trigger.args.count);
    }

    const deck = this.cardSourceController.getSource('playerDeck', playerId);
    const drawnCardIds: CardId[] = [];

    for (let i = 0; i < drawCount; i++) {
      if (deck.length < 1) {
        this.loggerService.debug(`[drawCard action] Shuffling discard pile`);
        await this.shuffleDeck({ playerId });

        if (deck.length < 1) {
          this.loggerService.debug(`[drawCard action] No cards left in deck, returning null`);
          if (drawnCardIds.length < 1) {
            return null;
          }
          return returnSingleResult ? drawnCardIds[0] : drawnCardIds;
        }
      }

      const drawnCardId = deck.slice(-1)[0];
      drawnCardIds.push(drawnCardId);

      await this.moveCard({
        cardId: drawnCardId,
        toPlayerId: playerId,
        to: { location: 'playerHand' },
      });

      this.logManager.addLogEntry({
        type: 'draw',
        playerId,
        cardId: drawnCardId,
        source,
      });

      this.loggerService.debug(`[drawCard action] Drew card ${drawnCardId}`);
    }

    return returnSingleResult ? (drawnCardIds[0] ?? null) : drawnCardIds;
  }

  // Draws a full hand (default 5), allowing draw-hand reactions to adjust the count.
  async drawHand(args: { playerId: PlayerId; count?: number }, context?: GameActionContext) {
    const source = this.resolveActionSource(context);
    const { playerId } = args;
    let drawCount = args.count ?? 5;

    this.loggerService.log(`[drawHand action] player ${playerId} drawing ${drawCount} card(s) for hand`);

    // Anchor draw-hand logs so reaction effects nest underneath.
    this.logManager.addLogEntry({
      type: 'drawHand',
      playerId,
      source,
    });

    const trigger = new ReactionTrigger('drawHand', {
      playerId,
      count: drawCount,
      source,
    });
    await this.reactionManager.runTrigger({ trigger });
    drawCount = Math.max(0, trigger.args.count);

    if (drawCount < 1) {
      this.loggerService.debug('[drawHand action] draw count is 0, skipping');
      return null;
    }

    // Draw hands should not trigger drawCards reactions.
    const drawn = await this.drawCard({ playerId, count: drawCount, suppressReactions: true }, context);
    if (drawn === null) {
      return null;
    }
    return Array.isArray(drawn) ? drawn : [drawn];
  }

  // Resolves which way id (if any) should apply for this card play.
  private async resolveWaySelectionForPlay(args: {
    playerId: PlayerId;
    card: Card;
    requestedWayId?: CardLikeId | null;
  }): Promise<CardLikeId | null> {
    const queuedWayId = args.requestedWayId === undefined
      ? this.consumePendingWaySelectionForPlay(args.playerId, args.card.id)
      : undefined;

    // Ways only apply to Action cards.
    if (!args.card.type.includes('ACTION')) {
      return null;
    }

    const activeWays = this.match.ways ?? [];
    if (activeWays.length < 1) {
      return null;
    }

    // Explicit caller choices always win (null = normal, id = selected way).
    if (args.requestedWayId !== undefined) {
      return args.requestedWayId;
    }

    if (queuedWayId !== undefined) {
      return queuedWayId;
    }
    // No explicit or queued way choice: resolve to normal play without opening a fallback prompt.
    this.loggerService.debug(
      `[playCard action] no explicit/queued way selection for ${args.card}; using normal play path`,
    );
    return null;
  }

  // Activates a card's instruction pipeline without counting as a new play.
  async activateCardEffects(args: {
    playerId: PlayerId;
    cardId: CardId | Card;
    wayId?: CardLikeId | null;
    reactionContext?: CardEffectFunctionContext['reactionContext'];
  }): Promise<void> {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;
    const playerId = args.playerId;

    const resolvedWayId = args.wayId ?? null;
    let selectedWay = resolvedWayId === null ? undefined : findWayInMatch(this.match, resolvedWayId);
    if (resolvedWayId !== null && !selectedWay) {
      this.loggerService.warn(
        `[activateCardEffects action] requested way ${resolvedWayId} was not found; using normal path`,
      );
    }
    const missingWayEffect = selectedWay ? this.wayEffectFunctionMap[selectedWay.cardKey] === undefined : false;

    const reactionContext = args.reactionContext ?? {};
    await this.reactionManager.runCardLifecycleEvent('onCardPlayed', { playerId, cardId });

    const buildEffectContext = () => this.createCardEffectContext({
      cardId,
      playerId,
      reactionContext,
    });

    // Runs the card's normal effect pipeline (base + expansion handlers).
    const runNormalCardEffectPipeline = async (): Promise<void> => {
      let effectFn = this.cardEffectFunctionMap[card.cardKey];
      if (effectFn) {
        // Run base card effects with standardized logging.
        await this.runEffectWithLogging({
          source: card.toString(),
          sourceType: 'card',
          playerId,
          effectFn,
          context: buildEffectContext(),
        });
      }

      for (const expansion of Object.keys(this._customCardEffectHandlers)) {
        const effects = this._customCardEffectHandlers[expansion];
        effectFn = effects[card.cardKey];
        if (effectFn) {
          // Run expansion-registered card effects with standardized logging.
          await this.runEffectWithLogging({
            source: card.toString(),
            sourceType: `card:${expansion}`,
            playerId,
            effectFn,
            context: buildEffectContext(),
          });
        }
      }
    };

    if (selectedWay) {
      const wayEffectFn = this.wayEffectFunctionMap[selectedWay.cardKey];
      if (!wayEffectFn) {
        this.loggerService.warn(
          `[activateCardEffects action] no effect registered for ${selectedWay.cardKey}; falling back to normal path`,
        );
      } else {
        await this.runEffectWithLogging({
          source: `[WAY ${selectedWay.id} - ${selectedWay.cardName}]`,
          sourceType: 'way',
          playerId,
          effectFn: wayEffectFn,
          context: buildEffectContext(),
        });
      }
    }

    // Normal path runs when no way is selected, or when a selected way has no effect yet.
    if (!selectedWay || missingWayEffect) {
      await runNormalCardEffectPipeline();
    }

  }

  async playCard(args: {
    playerId: PlayerId;
    cardId: CardId | Card;
    // Optional way selection that replaces the card's on-play effect path.
    // undefined => prompt, null => explicit normal play, cardLikeId => explicit way play.
    wayId?: CardLikeId | null;
    overrides?: GameActionOverrides;
  }, context?: GameActionContext) {
    const { playerId } = args;
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;
    // Resolve way selection once so all downstream logs and effect execution are deterministic.
    const resolvedWayId = await this.resolveWaySelectionForPlay({
      playerId,
      card,
      requestedWayId: args.wayId,
    });
    let selectedWay = resolvedWayId === null ? undefined : findWayInMatch(this.match, resolvedWayId);
    if (resolvedWayId !== null && !selectedWay) {
      this.loggerService.warn(`[playCard action] requested way ${resolvedWayId} was not found; using normal path`);
    }
    const missingWayEffect = selectedWay ? this.wayEffectFunctionMap[selectedWay.cardKey] === undefined : false;
    const playPathLabel = selectedWay
      ? missingWayEffect
        ? `normal(fallback-way:${selectedWay.cardKey})`
        : `way:${selectedWay.cardKey}`
      : 'normal';

    if (args.overrides?.moveCard === undefined || args.overrides.moveCard) {
      await this.moveCard({
        cardId: cardId,
        to: { location: 'playArea' },
      });
    }

    if (
      card.type.includes('ACTION') &&
      args.overrides?.actionCost !== 0
    ) {
      this.match.playerActions -= args.overrides?.actionCost ?? 1;

      this.loggerService.info(`[playCard action] Reducing player's action count to ${this.match.playerActions}`);
    }

    const turnStatsIndex = this.getCurrentTurnStatsIndex();
    this.match.stats.playedCardsByTurn[turnStatsIndex] ??= [];
    this.match.stats.playedCardsByTurn[turnStatsIndex]!.push(cardId);
    this.match.stats.playedCards[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      turnHistoryIndex: this.getCurrentTurnHistoryIndex(),
      playerId: playerId,
    };

    this.loggerService.info(`[playCard action] ${getPlayerById(this.match, playerId)} played card ${card}`);
    this.loggerService.info(`[playCard action] resolved play path ${playPathLabel} for ${card}`);

    this.logManager.addLogEntry({
      type: 'cardPlayed',
      cardId,
      playerId,
      source: context?.loggingContext?.source,
    });

    // find any reactions for the cardPlayed event type
    const cardPlayedTrigger = new ReactionTrigger('cardPlayed', {
      playerId,
      cardId,
    });

    // handle reactions for the card played
    let reactionContext = {};
    await this.reactionManager.runTrigger({ trigger: cardPlayedTrigger, reactionContext });

    // Apply supply pile token bonuses before the card's own lifecycle/effects.
    await this.applyTokenBonusesOnCardPlayed(playerId, cardId);

    // Allow reactions to suppress the played card's own on-play lifecycle/effect pipeline.
    const beforePlayedCardEffectTrigger = new ReactionTrigger('beforePlayedCardEffect', {
      playerId,
      cardId,
      skipPlayEffect: false,
    });
    await this.reactionManager.runTrigger({ trigger: beforePlayedCardEffectTrigger, reactionContext });
    const skipPlayedCardEffect = beforePlayedCardEffectTrigger.args.skipPlayEffect === true;
    let followedPlayedCardInstructions = false;
    if (skipPlayedCardEffect) {
      this.loggerService.debug(`[playCard action] suppressing on-play effects for ${card}`);
    } else {
      await this.actionService.run('activateCardEffects', {
        playerId,
        cardId,
        wayId: selectedWay?.id ?? null,
        reactionContext,
      });
      followedPlayedCardInstructions = !selectedWay ||
        selectedWay.cardKey === 'way-of-the-chameleon' ||
        missingWayEffect;
    }

    const afterCardPlayedTrigger = new ReactionTrigger('afterCardPlayed', {
      playerId,
      cardId,
      wayId: selectedWay?.id ?? null,
      followedPlayedCardInstructions,
    });

    // handle reactions for the card played
    reactionContext = {};
    await this.reactionManager.runTrigger({ trigger: afterCardPlayedTrigger, reactionContext });
  }

  // Generic shuffle action used by card and landscape shuffles.
  async shuffle(
    args: { playerId?: PlayerId; cardIds?: CardId[]; cardLikeIds?: CardLikeId[] },
    context?: GameActionContext,
  ): Promise<void> {
    const source = this.resolveActionSource(context);
    const cardIds = args.cardIds ?? [];
    const cardLikeIds = args.cardLikeIds ?? [];

    if (args.playerId === undefined) {
      if (cardIds.length > 1) {
        fisherYatesShuffle(cardIds, true, () => this.rngService.nextFloat());
        this.loggerService.debug(`[shuffle action] shuffled ${cardIds.length} card(s)`);
      }
      if (cardLikeIds.length > 1) {
        fisherYatesShuffle(cardLikeIds, true, () => this.rngService.nextFloat());
        this.loggerService.debug(`[shuffle action] shuffled ${cardLikeIds.length} landscape id(s)`);
      }
      return;
    }

    if (cardIds.length <= 1 && cardLikeIds.length <= 1) {
      // Ignore non-shuffles where there are not enough elements.
      return;
    }

    // Emit a generic pre-shuffle trigger so reactions can alter which cards are shuffled.
    const trigger = new ReactionTrigger('shuffle', {
      playerId: args.playerId,
      // Pass snapshots for reaction inspection/selection.
      cardIds: cardIds.length ? [...cardIds] : undefined,
      cardLikeIds: cardLikeIds.length ? [...cardLikeIds] : undefined,
      source,
    });
    await this.reactionManager.runTrigger({ trigger });

    // Trust trigger-modified shuffle lists directly.
    if (trigger.args.cardIds !== undefined) {
      cardIds.length = 0;
      cardIds.push(...trigger.args.cardIds);
    }
    if (trigger.args.cardLikeIds !== undefined) {
      cardLikeIds.length = 0;
      cardLikeIds.push(...trigger.args.cardLikeIds);
    }

    if (cardIds.length > 1) {
      fisherYatesShuffle(cardIds, true, () => this.rngService.nextFloat());
      this.loggerService.debug(`[shuffle action] shuffled ${cardIds.length} card(s)`);
    }
    if (cardLikeIds.length > 1) {
      fisherYatesShuffle(cardLikeIds, true, () => this.rngService.nextFloat());
      this.loggerService.debug(`[shuffle action] shuffled ${cardLikeIds.length} landscape id(s)`);
    }

    // Emit a post-shuffle trigger so effects can reorder/partition the randomized packet before merge.
    const postShuffleTrigger = new ReactionTrigger('afterShuffle', {
      playerId: args.playerId,
      cardIds: cardIds.length ? [...cardIds] : undefined,
      cardLikeIds: cardLikeIds.length ? [...cardLikeIds] : undefined,
      source,
    });
    await this.reactionManager.runTrigger({ trigger: postShuffleTrigger });

    // Trust post-shuffle trigger packet mutation directly as final packet content/order.
    if (postShuffleTrigger.args.cardIds !== undefined) {
      cardIds.length = 0;
      cardIds.push(...postShuffleTrigger.args.cardIds);
    }
    if (postShuffleTrigger.args.cardLikeIds !== undefined) {
      cardLikeIds.length = 0;
      cardLikeIds.push(...postShuffleTrigger.args.cardLikeIds);
    }
  }

  // Helper method to shuffle a player's deck
  async shuffleDeck(
    args: { playerId: PlayerId; includeDiscard?: boolean },
    context?: GameActionContext,
  ): Promise<void> {
    const source = this.resolveActionSource(context);
    const { playerId } = args;
    const includeDiscard = args.includeDiscard ?? true;

    this.loggerService.debug(`[shuffleDeck action] shuffling deck`);

    const deck = this.cardSourceController.getSource('playerDeck', playerId);
    const discard = this.cardSourceController.getSource('playerDiscard', playerId);

    if (includeDiscard) {
      // Shuffle a copy so reactions can remove cards from the shuffled subset without erasing discard state.
      const discardCardsToShuffle = [...discard];
      await this.shuffle({ playerId, cardIds: discardCardsToShuffle }, context);

      for (const shuffledCardId of discardCardsToShuffle) {
        const discardIndex = discard.indexOf(shuffledCardId);
        if (discardIndex >= 0) {
          discard.splice(discardIndex, 1);
        }
      }
      deck.unshift(...discardCardsToShuffle);
    } else {
      await this.shuffle({ playerId, cardIds: deck }, context);
    }

    this.logManager.addLogEntry({
      type: 'shuffleDeck',
      playerId: args.playerId,
      source,
    });
  }

  // Shuffles a landscape deck (boons or hexes), optionally pulling in discards.
  async shuffleCardLike(
    args: { kind: 'boon' | 'hex'; includeDiscard?: boolean; playerId?: PlayerId },
    context?: GameActionContext,
  ): Promise<void> {
    const source = this.resolveActionSource(context);
    const includeDiscard = args.includeDiscard ?? false;

    // Resolve the target piles based on kind.
    const piles = args.kind === 'boon' ? this.match.boons : this.match.hexes;

    const deck = piles.deck;
    const discard = piles.discard;
    if (includeDiscard && discard.length) {
      // Move all discarded cards into the deck before shuffling.
      deck.push(...discard.splice(0, discard.length));
      this.loggerService.debug(`[shuffleCardLike action] moved discard into ${args.kind} deck (${deck.length} total)`);
    }

    if (deck.length < 2) {
      this.loggerService.debug(
        `[shuffleCardLike action] ${args.kind} deck has ${deck.length} card(s), skipping shuffle`,
      );
      return;
    }

    await this.shuffle({ playerId: args.playerId, cardLikeIds: deck }, {
      ...context,
      source,
    });
    this.loggerService.info(`[shuffleCardLike action] shuffled ${args.kind} deck (${deck.length} cards)`);
  }

  /**
   * Resolves an ExtraTurn instance
   *
   * @private
   */
  private async resolveExtraTurn(turn: ExtraTurn) {
  }
}
