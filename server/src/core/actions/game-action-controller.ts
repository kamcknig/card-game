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
  Match,
  PlayerId,
  SelectActionCardArgs,
  TokenFacing,
  TokenId,
  TokenInstance,
  TokenInstanceId,
  TokenLocation,
  TurnPhase,
  TurnPhaseOrderValues,
  UserPromptActionArgs
} from 'shared/shared-types';
import {MatchCardLibrary} from '../match-card-library.ts';
import {LogManager} from '../log-manager.ts';
import {getCurrentPlayer} from '../../utils/get-current-player.ts';
import {
  AppSocket,
  BaseGameActionDefinitionMap,
  CardEffectFn,
  CardEffectFunctionContext,
  CardEffectFunctionMap,
  DurationEffectOptions,
  FindCardsFn,
  FindCardsFnInput,
  GameActionContext,
  GameActionContextMap,
  GameActionDefinitionMap,
  GameActionOverrides,
  GameActionReturnTypeMap,
  GameActions,
  ReactionTemplate,
  ReactionTrigger,
  RunGameActionDelegate,
  TriggerEventType,
} from '../../types.ts';
import {getPlayerById} from '../../utils/get-player-by-id.ts';
import {ReactionManager} from '../reactions/reaction-manager.ts';
import {CardInteractivityController} from '../card-interactivity-controller.ts';
import {CardPriceRulesController} from '../card-price-rules-controller.ts';
import {CardSourceController} from '../card-source-controller.ts';
import {getTurnPhase} from '../../utils/get-turn-phase.ts';
import {fisherYatesShuffle} from '../../utils/fisher-yates-shuffler.ts';
import {getCardPileKey} from '../../utils/get-card-pile-key.ts';
import {tokenCardPlayedHandlerMap} from '../tokens/token-trigger-map.ts';
import {tokenDefinitionMap} from '../tokens/token-definition-map.ts';
import {prosperityTokenIds} from "@expansions/prosperity/token-prosperity-ids.ts";

export class GameActionController implements BaseGameActionDefinitionMap {
  private customActionHandlers: Partial<GameActionDefinitionMap> = {};
  private customCardEffectHandlers: Record<string, Partial<Record<CardKey, CardEffectFn>>> = {};
  // Guards against re-entrant computer turns triggered by nested game actions.
  private _computerTurnInProgress: boolean = false;

  constructor(
    private _cardSourceController: CardSourceController,
    private _findCards: FindCardsFn,
    private cardPriceRuleController: CardPriceRulesController,
    private cardEffectFunctionMap: CardEffectFunctionMap,
    private eventEffectFunctionMap: CardEffectFunctionMap,
    private projectEffectFunctionMap: CardEffectFunctionMap,
    private boonEffectFunctionMap: CardEffectFunctionMap,
    private hexEffectFunctionMap: CardEffectFunctionMap,
    private stateEffectFunctionMap: CardEffectFunctionMap,
    private artifactEffectFunctionMap: CardEffectFunctionMap,
    private match: Match,
    private cardLibrary: MatchCardLibrary,
    private logManager: LogManager,
    private socketMap: Map<PlayerId, AppSocket>,
    private reactionManager: ReactionManager,
    private runGameActionDelegate: RunGameActionDelegate,
    private readonly interactivityController: CardInteractivityController,
  ) {
  }

  public registerCardEffect(cardKey: CardKey, tag: string, fn: CardEffectFn) {
    this.customCardEffectHandlers[tag] ??= {};

    if (this.customCardEffectHandlers[tag][cardKey]) {
      console.warn(`[action controller] effect for ${cardKey} in ${tag} already exists, overwriting it`);
    }

    this.customCardEffectHandlers[tag][cardKey] = fn;
  }

  // Registers boon effects for the current match.
  public registerBoonEffect(cardKey: CardKey, fn: CardEffectFn) {
    if (this.boonEffectFunctionMap[cardKey]) {
      console.warn(`[action controller] boon effect for ${cardKey} already exists, overwriting it`);
    }
    this.boonEffectFunctionMap[cardKey] = fn;
  }

  // Registers hex effects for the current match.
  public registerHexEffect(cardKey: CardKey, fn: CardEffectFn) {
    if (this.hexEffectFunctionMap[cardKey]) {
      console.warn(`[action controller] hex effect for ${cardKey} already exists, overwriting it`);
    }
    this.hexEffectFunctionMap[cardKey] = fn;
  }

  // Registers state effects for the current match.
  public registerStateEffect(cardKey: CardKey, fn: CardEffectFn) {
    if (this.stateEffectFunctionMap[cardKey]) {
      console.warn(`[action controller] state effect for ${cardKey} already exists, overwriting it`);
    }
    this.stateEffectFunctionMap[cardKey] = fn;
  }

  // Registers artifact effects for the current match.
  public registerArtifactEffect(cardKey: CardKey, fn: CardEffectFn) {
    if (this.artifactEffectFunctionMap[cardKey]) {
      console.warn(`[action controller] artifact effect for ${cardKey} already exists, overwriting it`);
    }
    this.artifactEffectFunctionMap[cardKey] = fn;
  }

  // Registers project effects for the current match.
  public registerProjectEffect(cardKey: CardKey, fn: CardEffectFn) {
    if (this.projectEffectFunctionMap[cardKey]) {
      console.warn(`[action controller] project effect for ${cardKey} already exists, overwriting it`);
    }
    this.projectEffectFunctionMap[cardKey] = fn;
  }

  // Ensures a status-like store (state/artifact) exists on match state.
  private ensureStatusStore(kind: 'state' | 'artifact') {
    if (kind === 'state') {
      this.match.states ??= { cards: [], byPlayer: {} };
      this.match.states.cards ??= [];
      this.match.states.byPlayer ??= {};
      return this.match.states;
    }
    this.match.artifacts ??= { cards: [], byPlayer: {} };
    this.match.artifacts.cards ??= [];
    this.match.artifacts.byPlayer ??= {};
    return this.match.artifacts;
  }

  // Resolves a status-like card from its id or key.
  private resolveStatusCard(
    store: { cards: { id: CardLikeId; cardKey: CardKey }[] },
    args: { statusId?: CardLikeId; statusKey?: CardKey },
  ) {
    return args.statusId !== undefined
      ? store.cards.find(candidate => candidate.id === args.statusId)
      : store.cards.find(candidate => candidate.cardKey === args.statusKey);
  }

  // Finds all owners of a status-like card id.
  private findStatusOwners(store: { byPlayer: Record<PlayerId, CardLikeId[]> }, statusId: CardLikeId): PlayerId[] {
    return Object.entries(store.byPlayer)
      .filter(([, statusIds]) => statusIds.includes(statusId))
      .map(([playerId]) => Number(playerId));
  }

  // Adds a status-like card to a player if not already owned.
  private addStatusToPlayer(store: { byPlayer: Record<PlayerId, CardLikeId[]> }, playerId: PlayerId, statusId: CardLikeId) {
    store.byPlayer[playerId] ??= [];
    if (!store.byPlayer[playerId].includes(statusId)) {
      store.byPlayer[playerId].push(statusId);
    }
  }

  public async invokeAction<K extends GameActions>(
    action: K,
    ...args: Parameters<GameActionDefinitionMap[K]>
  ): Promise<GameActionReturnTypeMap[K]> {
    const handler = (this as any)[action] ?? this.customActionHandlers[action];
    if (!handler) {
      throw new Error(`No handler registered for action: ${action}`);
    }
    return await handler.bind(this)(...args);
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

  // Registers duration cleanup and effect triggers with centralized cleanup tracking.
  private registerDurationEffectInternal<T extends TriggerEventType>(
    card: Card,
    context: CardEffectFunctionContext,
    triggeredTemplate: ReactionTemplate<T> | ReactionTemplate<T>[],
    options?: DurationEffectOptions,
  ): string[] {
    // Track trigger ids to enable cleanup when a card leaves play.
    const registeredTriggerIds: string[] = [];
    // Register cleanup handling to keep duration cards from being discarded.
    const cleanupCount = Math.max(0, options?.cleanupCount ?? 1);
    if (cleanupCount > 0) {
      let remainingCleanups = cleanupCount;
      let lastCleanupTurnNumber: number | null = null;
      const systemTriggerId = context.reactionManager.registerSystemTemplate(card, 'startTurnPhase', {
        playerId: context.playerId,
        // Allow multi-turn duration cards to stay in play across multiple cleanups.
        once: cleanupCount === 1,
        allowMultipleInstances: true,
        condition: async (conditionArgs) => {
          const isCleanup = getTurnPhase(conditionArgs.trigger.args.phaseIndex) === 'cleanup';
          const isNewCleanup = lastCleanupTurnNumber !== conditionArgs.match.turnNumber;
          return isCleanup && isNewCleanup && remainingCleanups > 0;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          console.debug(
            `[${card.cardKey} duration effect] moving to activeDuration zone`,
          );

          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: card.id,
            to: {location: 'activeDuration'},
          });

          // Decrement remaining cleanups and unregister when finished.
          lastCleanupTurnNumber = triggeredArgs.match.turnNumber;
          remainingCleanups = Math.max(0, remainingCleanups - 1);
          if (remainingCleanups <= 0) {
            if (options?.autoRemoveTriggersOnExhaust) {
              triggeredArgs.reactionManager.cleanupDurationTriggers(card.id);
            } else {
              triggeredArgs.reactionManager.unregisterTrigger(triggeredArgs.reaction.id);
            }
          }
        },
      });
      registeredTriggerIds.push(systemTriggerId);
    }

    // Register the trigger to run when the duration card triggers.
    const templates = Array.isArray(triggeredTemplate) ? triggeredTemplate : [triggeredTemplate];
    for (const triggeredTemplateElement of templates) {
      const triggerId = context.reactionManager.registerReactionTemplate(triggeredTemplateElement);
      registeredTriggerIds.push(triggerId);
    }

    return registeredTriggerIds;
  }

  // Executes an effect with consistent logging and error reporting.
  private async runEffectWithLogging(args: {
    source: string;
    sourceType: string;
    playerId: PlayerId;
    effectFn: CardEffectFn;
    context: CardEffectFunctionContext;
  }): Promise<void> {
    console.info(`[${args.sourceType} effect] start ${args.source} for player ${args.playerId}`);
    console.debug(`[${args.sourceType} effect] context cardId ${args.context.cardId}`);
    try {
      await this.logManager.withIndent(async () => {
        await args.effectFn(args.context);
      });
    }
    catch (error) {
      console.error(`[${args.sourceType} effect] error ${args.source} for player ${args.playerId}`);
      console.error(error);
      throw error;
    }
    console.info(`[${args.sourceType} effect] complete ${args.source} for player ${args.playerId}`);
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
        const actionCardId = selectable.find(id => this.cardLibrary.getCard(id).type.includes('ACTION'));
        if (actionCardId) {
          await this.runGameActionDelegate('playCard', {playerId: currentPlayer.id, cardId: actionCardId});
        }
        // Always move to the next phase after one action attempt.
        this._computerTurnInProgress = false;
        await this.runGameActionDelegate('nextPhase');
        return;
      }

      if (turnPhase === 'buy') {
        const selectedId = selectable[0];
        if (selectedId === undefined) {
          this._computerTurnInProgress = false;
          await this.runGameActionDelegate('nextPhase');
          return;
        }

        const event = match.events.find(e => e.id === selectedId);
        if (event) {
          await this.runGameActionDelegate('buyEvent', {
            playerId: currentPlayer.id,
            cardLikeId: selectedId
          });
          this._computerTurnInProgress = false;
          await this.runGameActionDelegate('nextPhase');
          return;
        }

        const project = match.projects?.find(candidate => candidate.id === selectedId);
        if (project) {
          await this.runGameActionDelegate('buyProject', {
            playerId: currentPlayer.id,
            cardLikeId: selectedId
          });
          this._computerTurnInProgress = false;
          await this.runGameActionDelegate('nextPhase');
          return;
        }

        const card = this.cardLibrary.getCard(selectedId);
        const inHand = this._cardSourceController.getSource('playerHand', currentPlayer.id).includes(selectedId);
        if (inHand && card.type.includes('TREASURE')) {
          await this.runGameActionDelegate('playCard', {
            playerId: currentPlayer.id,
            cardId: selectedId,
            overrides: { actionCost: 0 },
          });
          this._computerTurnInProgress = false;
          await this.runGameActionDelegate('nextPhase');
          return;
        }

        const {restricted, cost} = this.cardPriceRuleController.applyRules(card, {playerId: currentPlayer.id});
        if (!restricted) {
          await this.runGameActionDelegate('buyCard', {
            playerId: currentPlayer.id,
            cardId: card.id,
            cardCost: cost
          });
        }

        this._computerTurnInProgress = false;
        await this.runGameActionDelegate('nextPhase');
        return;
      }

      if (turnPhase === 'night') {
        // Computer players play one Night card per Night phase, then advance.
        const nightCardId = selectable.find(id => this.cardLibrary.getCard(id).type.includes('NIGHT'));
        console.debug(`[computer turn] night phase selectable night card ${nightCardId ?? 'none'}`);
        if (nightCardId !== undefined) {
          await this.runGameActionDelegate('playCard', {playerId: currentPlayer.id, cardId: nightCardId});
        }
        this._computerTurnInProgress = false;
        await this.runGameActionDelegate('nextPhase');
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
        const handler = tokenCardPlayedHandlerMap[token.tokenId];
        if (!handler) continue;
        const definition = tokenDefinitionMap[token.tokenId];
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
          runGameAction: this.runGameActionDelegate,
        });
      }
    });
  }

  async gainPotion(args: { count: number }) {
    console.info(`[gainPotion action] gaining ${args.count} potions`);
    this.match.playerPotions += args.count;
    this.match.playerPotions = Math.max(0, this.match.playerPotions);

    console.info(`[gainPotion action] setting player potions to ${this.match.playerPotions}`);
  }

  async gainBuy(args: { count: number }, context?: GameActionContext) {
    console.info(`[gainBuy action] gaining ${args.count} buys`);
    this.match.playerBuys += args.count;
    this.match.playerBuys = Math.max(this.match.playerBuys, 0);

    this.logManager.addLogEntry({
      type: 'gainBuy',
      count: args.count,
      playerId: getCurrentPlayer(this.match).id,
      source: context?.loggingContext?.source,
    });

    console.info(`[gainBuy action] setting player guys to ${this.match.playerBuys}`);
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
    console.debug(`[placeToken action] placed token ${args.tokenId} as ${tokenInstanceId}`);
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
    console.debug(`[moveToken action] moved token ${args.tokenInstanceId}`);
  }

  async removeToken(args: { tokenInstanceId: TokenInstanceId; }, context?: GameActionContext): Promise<void> {
    // Ensure the token exists before removal for deterministic behavior.
    const token = this.getTokenInstance(args.tokenInstanceId);
    delete this.match.tokens[args.tokenInstanceId];
    console.debug(`[removeToken action] removed token ${args.tokenInstanceId}`);
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

  async consumeToken(args: { tokenInstanceId: TokenInstanceId; amount?: number; }): Promise<void> {
    // Resolve the token instance before modifying counters or removal.
    const token = this.getTokenInstance(args.tokenInstanceId);
    const amount = args.amount ?? 1;
    // Tokens with null/undefined/0 counters are infinite and do not decrement.
    if (token.counters === undefined || token.counters === null || token.counters === 0) {
      console.debug(`[consumeToken action] token ${args.tokenInstanceId} is infinite`);
      return;
    }
    // Decrement counters and remove the token if exhausted.
    token.counters = Math.max(0, token.counters - amount);
    if (token.counters === 0) {
      delete this.match.tokens[args.tokenInstanceId];
      console.debug(`[consumeToken action] consumed token ${args.tokenInstanceId}`);
      return;
    }
    console.debug(`[consumeToken action] decremented token ${args.tokenInstanceId} to ${token.counters}`);
  }

  async flipToken(args: { tokenInstanceId: TokenInstanceId; facing: TokenFacing; }): Promise<void> {
    // Resolve the token instance before modifying facing.
    const token = this.getTokenInstance(args.tokenInstanceId);
    token.facing = args.facing;
    console.debug(`[flipToken action] set token ${args.tokenInstanceId} to ${args.facing}`);
  }

  async moveCard(args: { toPlayerId?: PlayerId, cardId: CardId | Card, to: CardLocationSpec, facing?: CardFacing }) {
    // Ensure we are only moving actual cards with moveCard.
    let card: Card;
    if (args.cardId instanceof Card) {
      card = args.cardId;
    }
    else if (typeof args.cardId === 'number') {
      try {
        card = this.cardLibrary.getCard(args.cardId);
      }
      catch (error) {
        const cardLike = this.findCardLike(args.cardId);
        if (cardLike) {
          throw new Error(`[moveCard action] ${cardLike} is a card-like; use moveCardLike instead`);
        }
        throw error;
      }
    }
    else {
      throw new Error('[moveCard action] invalid card argument');
    }
    const cardId = card.id;

    if (Array.isArray(args.to.location)) {
      throw new Error(`[moveCard action] cannot move card to multiple locations`);
    }

    let oldSource: { sourceKey: CardLocation; source: CardId[]; index: number; playerId?: PlayerId; } | null = null;

    try {
      oldSource = this._cardSourceController.findCardSource(cardId);
    } catch (e) {
      console.warn(`[moveCard action] could not find source for ${card}`);
    }

    const newSource = this._cardSourceController.getSource(args.to.location, args.toPlayerId);

    if (!newSource) {
      throw new Error(`[moveCard action] could not find source for ${card}`);
    }

    oldSource?.source.splice(oldSource?.index, 1);

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
            cardId
          });
        } else {
          console.warn(`[moveCard action] could not resolve fromPlayerId for onLeaveHand for ${card}`);
        }
        break;
      }
      case 'playArea':
      case 'activeDuration':
        if (args.to.location === 'playArea' || args.to.location === 'activeDuration') break;
        await this.reactionManager.runCardLifecycleEvent('onLeavePlay', {cardId});
        // Ensure global duration triggers are cleaned when the card leaves play.
        this.reactionManager.cleanupDurationTriggers(cardId);
    }

    newSource.push(cardId);

    switch (args.to.location) {
      case 'playerHand':
        await this.reactionManager.runCardLifecycleEvent('onEnterHand', {
          playerId: args.toPlayerId!,
          cardId
        });
        break;
    }

    console.debug(`[moveCard action] moved ${card} from ${oldSource?.sourceKey} to ${args.to.location}`);

    return oldSource ? {location: oldSource?.sourceKey!, playerId: oldSource?.playerId} : undefined;
  }

  // Moves a card-like (boon/hex/event/landmark) between supported locations.
  async moveCardLike(args: { toPlayerId?: PlayerId; cardLikeId: CardLikeId; to: CardLocationSpec }) {
    if (typeof args.cardLikeId !== 'number') {
      throw new Error('[moveCardLike action] invalid cardLikeId');
    }

    // Prevent card IDs from being moved through the card-like path.
    try {
      const card = this.cardLibrary.getCard(args.cardLikeId);
      throw new Error(`[moveCardLike action] ${card} is a card; use moveCard instead`);
    }
    catch (error) {
      // Ignore missing card errors; those indicate a card-like ID.
      if (!(error instanceof Error) || !error.message.includes('unable to locate card')) {
        throw error;
      }
    }

    const cardLike = this.findCardLike(args.cardLikeId);
    if (!cardLike) {
      throw new Error(`[moveCardLike action] could not find card-like ${args.cardLikeId}`);
    }

    if (Array.isArray(args.to.location)) {
      throw new Error('[moveCardLike action] cannot move card-like to multiple locations');
    }

    let previousLocation: { location: CardLocation; playerId?: PlayerId; } | undefined;

    // Remove from any existing card source location (set-aside only).
    try {
      const existingSource = this._cardSourceController.findCardSource(cardLike.id);
      existingSource.source.splice(existingSource.index, 1);
      previousLocation = { location: existingSource.sourceKey, playerId: existingSource.playerId };
    }
    catch (error) {
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
        const setAside = this._cardSourceController.getSource('set-aside', args.toPlayerId);
        if (!setAside.includes(cardLike.id)) {
          setAside.push(cardLike.id);
        }
        console.debug(`[moveCardLike action] set aside ${cardLike} for player ${args.toPlayerId}`);
        break;
      }
      case 'boonDiscard': {
        const isBoon = this.match.boons?.cards?.some(card => card.id === cardLike.id);
        if (!isBoon) {
          throw new Error(`[moveCardLike action] ${cardLike} is not a boon; cannot move to boonDiscard`);
        }
        if (!this.match.boons?.discard) {
          throw new Error('[moveCardLike action] boon discard pile is not initialized');
        }
        if (!this.match.boons.discard.includes(cardLike.id)) {
          this.match.boons.discard.push(cardLike.id);
        }
        console.debug(`[moveCardLike action] moved ${cardLike} to boon discard`);
        break;
      }
      case 'boonDeck': {
        const isBoon = this.match.boons?.cards?.some(card => card.id === cardLike.id);
        if (!isBoon) {
          throw new Error(`[moveCardLike action] ${cardLike} is not a boon; cannot move to boonDeck`);
        }
        if (!this.match.boons?.deck) {
          throw new Error('[moveCardLike action] boon deck is not initialized');
        }
        if (!this.match.boons.deck.includes(cardLike.id)) {
          this.match.boons.deck.push(cardLike.id);
        }
        console.debug(`[moveCardLike action] moved ${cardLike} to boon deck`);
        break;
      }
      // Hex discard pile for Doom effects.
      case 'hexDiscard': {
        const isHex = this.match.hexes?.cards?.some(card => card.id === cardLike.id);
        if (!isHex) {
          throw new Error(`[moveCardLike action] ${cardLike} is not a hex; cannot move to hexDiscard`);
        }
        if (!this.match.hexes?.discard) {
          throw new Error('[moveCardLike action] hex discard pile is not initialized');
        }
        if (!this.match.hexes.discard.includes(cardLike.id)) {
          this.match.hexes.discard.push(cardLike.id);
        }
        console.debug(`[moveCardLike action] moved ${cardLike} to hex discard`);
        break;
      }
      // Hex deck for Doom effects.
      case 'hexDeck': {
        const isHex = this.match.hexes?.cards?.some(card => card.id === cardLike.id);
        if (!isHex) {
          throw new Error(`[moveCardLike action] ${cardLike} is not a hex; cannot move to hexDeck`);
        }
        if (!this.match.hexes?.deck) {
          throw new Error('[moveCardLike action] hex deck is not initialized');
        }
        if (!this.match.hexes.deck.includes(cardLike.id)) {
          this.match.hexes.deck.push(cardLike.id);
        }
        console.debug(`[moveCardLike action] moved ${cardLike} to hex deck`);
        break;
      }
      default:
        throw new Error(`[moveCardLike action] unsupported location '${args.to.location}'`);
    }

    return previousLocation;
  }

  // Finds a card-like instance by id in the current match.
  private findCardLike(cardLikeId: CardLikeId) {
    const boon = this.match.boons?.cards?.find(card => card.id === cardLikeId);
    if (boon) return boon;
    const hex = this.match.hexes?.cards?.find(card => card.id === cardLikeId);
    if (hex) return hex;
    const event = this.match.events?.find(card => card.id === cardLikeId);
    if (event) return event;
    const landmark = this.match.landmarks?.find(card => card.id === cardLikeId);
    if (landmark) return landmark;
    return this.match.projects?.find(card => card.id === cardLikeId);
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

  async gainAction(args: { count: number }, context?: GameActionContext) {
    console.info(`[gainAction action] gaining ${args.count} actions`);

    this.match.playerActions += args.count;
    this.match.playerActions = Math.max(0, this.match.playerActions);

    this.logManager.addLogEntry({
      type: 'gainAction',
      playerId: getCurrentPlayer(this.match).id,
      count: args.count,
      source: context?.loggingContext?.source,
    })

    console.info(`[gainAction action] setting player actions to ${args.count}`);
  }

  async gainCard(args: {
    playerId: PlayerId,
    cardId: CardId | Card,
    to: CardLocationSpec
  }, context?: GameActionContextMap['gainCard']) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;

    const previousLocation = await this.moveCard({
      cardId,
      to: args.to,
      toPlayerId: args.playerId
    });

    this.match.stats.cardsGainedByTurn[this.match.turnNumber] ??= [];
    this.match.stats.cardsGainedByTurn[this.match.turnNumber]!.push(cardId);

    this.match.stats.cardsGained[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      playerId: args.playerId
    };

    card.owner = args.playerId;

    console.info(`[gainCard action] ${getPlayerById(this.match, args.playerId)} gained ${card}`);

    this.logManager.addLogEntry({
      playerId: args.playerId,
      cardId: cardId,
      type: 'gainCard',
      source: context?.loggingContext?.source,
    });

    const trigger = new ReactionTrigger('cardGained', {
      cardId: cardId,
      playerId: args.playerId,
      bought: context?.bought,
      previousLocation
    });

    await this.reactionManager.runTrigger({trigger});

    const suppress = context?.suppressLifecycle;
    const skipOnGain =
      suppress &&
      (suppress.events?.includes('onGained') || suppress.events === undefined);

    if (!skipOnGain) {
      await this.reactionManager.runCardLifecycleEvent('onGained', {
        playerId: args.playerId,
        cardId,
        bought: context?.bought ?? false
      });
    } else {
      console.debug('[gainCard action] lifecycle onGained event suppressed');
    }

    await this.reactionManager.runGameLifecycleEvent('onCardGained', {
      cardId: cardId,
      playerId: args.playerId,
      match: this.match
    });
  }

  async userPrompt(args: UserPromptActionArgs) {
    const {playerId} = args;

    const signalId = `userPrompt:${playerId}:${Date.now()}`;

    const player = getPlayerById(this.match, playerId);
    if (player?.isComputer) {
      // Computer players always pick the first available action button when prompted.
      if (args.content?.type === 'select-pile') {
        const pileNames = args.content.pileNames ?? [];
        return {result: pileNames.length ? [pileNames[0]] : []};
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
        return {action: 1, result: clamped};
      }
      const actionButtons = args.actionButtons ?? [];
      const firstAction = actionButtons.find(button => button.action !== 0)?.action ?? 0;
      return {action: firstAction};
    }

    const socket = this.socketMap.get(playerId);
    if (!socket) {
      console.debug(`[userPrompt] No socket for player ${playerId}`);
      return null
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

        resolve(response);
      };

      socket.on('userInputReceived', onInput);
      socket.emit('userPrompt', signalId, args);
    });
  }

  async selectCard(args: SelectActionCardArgs) {
    args.count ??= 1;

    let selectableCardIds: CardId[] = [];

    const {count, playerId, restrict} = args;

    if (Array.isArray(restrict) && typeof restrict[0] === 'number') {
      console.debug(`[selectCard action] restricted to set of cards ${restrict}`);
      selectableCardIds = restrict as CardId[];
    } else if (restrict !== undefined) {
      selectableCardIds = this._findCards(restrict as FindCardsFnInput).map(card => card.id);
    }

    console.debug(`[selectCard action] found ${selectableCardIds.length} selectable cards`);

    if (selectableCardIds?.length === 0) {
      console.debug(`[selectCard action] found no cards within restricted set ${restrict}`);
      return [];
    }

    const player = getPlayerById(this.match, playerId);
    if (player?.isComputer) {
      // Computer players choose the first available card(s) from the selectable list.
      const count = this.resolveCountSpec(args.count ?? 1, selectableCardIds.length, args.optional ?? false);
      return selectableCardIds.slice(0, count);
    }

    // if there aren't enough cards, depending on the selection type, we might simply implicitly select cards
    // because the player would be forced to select hem all anyway
    if (typeof count === 'number' && !args.optional) {
      console.debug(`[selectCard action] selection count is an exact count ${count} checking if user has that many cards`);

      if (selectableCardIds.length <= count) {
        console.debug('[selectCard action] user does not have enough, or has exactly the amount of cards to select from, selecting all automatically');
        return selectableCardIds;
      }
    }

    const socket = this.socketMap.get(playerId);

    if (!socket) {
      console.debug(`[selectCard action] no socket found for ${getPlayerById(this.match, playerId)}, skipping`);
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

        if (!Array.isArray(cardIds)) {
          console.warn(`[selectCard action] received invalid cardIds ${cardIds}`);
        }

        resolve(Array.isArray(cardIds) ? cardIds : []);
      };

      socket.on('userInputReceived', onInput);
      socket.emit('selectCard', signalId, {...args, selectableCardIds});
    });
  }

  async trashCard(args: { cardId: CardId | Card, playerId: PlayerId }, context?: GameActionContext) {
    const oldLocation = await this.moveCard({
      cardId: args.cardId,
      to: {location: 'trash'}
    });

    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;

    this.match.stats.trashedCards[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      playerId: getCurrentPlayer(this.match).id
    };

    this.match.stats.trashedCardsByTurn[this.match.turnNumber] ??= [];
    this.match.stats.trashedCardsByTurn[this.match.turnNumber]!.push(cardId);

    console.info(`[trashCard action] trashed ${card}`);

    // Include the source to allow reactions to ignore self-triggered trash effects.
    const trigger: ReactionTrigger = {
      eventType: 'cardTrashed',
      args: {
        playerId: args.playerId,
        cardId: card.id,
        previousLocation: oldLocation,
        source: context?.loggingContext?.source
      }
    }
    await this.reactionManager.runTrigger({trigger});

    await this.reactionManager.runCardLifecycleEvent('onTrashed', {
      cardId: cardId,
      playerId: args.playerId,
      previousLocation: oldLocation
    });

    card.owner = null;
    this.logManager.addLogEntry({
      playerId: args.playerId,
      cardId: cardId,
      type: 'trashCard',
      source: context?.loggingContext?.source,
    });
  }

  async gainVictoryToken(args: { playerId: PlayerId, count: number }, context?: GameActionContext) {
    console.log(`[gainVictoryToken action] player ${args.playerId} gained ${args.count} victory tokens`);
    // Victory tokens are stored as token instances on the player.
    if (args.count <= 0) {
      console.debug(`[gainVictoryToken action] non-positive victory token count ${args.count}, skipping`);
      return;
    }
    const victoryTokenId = prosperityTokenIds.victory;
    for (let i = 0; i < args.count; i += 1) {
      await this.placeToken({
        tokenId: victoryTokenId,
        ownerId: args.playerId,
        location: {type: 'player', playerId: args.playerId},
      }, context);
    }
    console.debug(`[gainVictoryToken action] player ${args.playerId} placed ${args.count} victory tokens`);
  }

  async gainCoffer(args: { playerId: PlayerId, count?: number; }, context?: GameActionContext) {
    console.log(`[gainCoffer action] player ${args.playerId} gained ${args.count} coffers`);
    this.match.coffers[args.playerId] ??= 0;
    this.match.coffers[args.playerId] += args.count ?? 1;
    this.match.coffers[args.playerId] = Math.max(0, this.match.coffers[args.playerId]);
    console.debug(`[gainCoffer action] player ${args.playerId} now has ${this.match.coffers[args.playerId]} coffers`);
  }

  // Adds Villagers tokens (Renaissance) to a player.
  async gainVillager(args: { playerId: PlayerId, count?: number; }, context?: GameActionContext) {
    console.log(`[gainVillager action] player ${args.playerId} gained ${args.count} villagers`);
    // Ensure villagers map exists for older saved states.
    this.match.villagers ??= {};
    this.match.villagers[args.playerId] ??= 0;
    this.match.villagers[args.playerId] += args.count ?? 1;
    this.match.villagers[args.playerId] = Math.max(0, this.match.villagers[args.playerId]);
    console.debug(`[gainVillager action] player ${args.playerId} now has ${this.match.villagers[args.playerId]} villagers`);
  }

  // Adds debt tokens to a player without spending treasure.
  async gainDebt(args: { playerId: PlayerId; count: number; }, context?: GameActionContext) {
    console.log(`[gainDebt action] player ${args.playerId} gained ${args.count} debt`);
    // Ensure debt map exists for older saved states.
    this.match.debt ??= {};
    this.match.debt[args.playerId] ??= 0;
    this.match.debt[args.playerId] += args.count;
    this.match.debt[args.playerId] = Math.max(0, this.match.debt[args.playerId]);
    console.debug(`[gainDebt action] player ${args.playerId} now has ${this.match.debt[args.playerId]} debt`);
  }

  async exchangeCoffer(args: { playerId: PlayerId, count: number; }, context?: GameActionContext) {
    console.log(`[exchangeCoffer action] player ${args.playerId} exchanged ${args.count} coffers`);
    this.match.coffers[args.playerId] -= args.count;
    this.match.playerTreasure += args.count;
  };

  // Spends Villagers to gain actions during the Action phase.
  async spendVillager(args: { playerId: PlayerId, count: number; }, context?: GameActionContext) {
    console.log(`[spendVillager action] player ${args.playerId} spending ${args.count} villagers`);
    const currentPhase = getTurnPhase(this.match.turnPhaseIndex);
    // Villagers can only be spent during the Action phase.
    if (currentPhase !== 'action') {
      console.warn(`[spendVillager action] player ${args.playerId} cannot spend villagers during ${currentPhase} phase`);
      return;
    }
    // Ensure villagers map exists for older saved states.
    this.match.villagers ??= {};
    const currentVillagers = this.match.villagers[args.playerId] ?? 0;
    const spendCount = Math.min(args.count, currentVillagers);
    if (spendCount <= 0) {
      console.debug(`[spendVillager action] player ${args.playerId} has no villagers to spend`);
      return;
    }
    this.match.villagers[args.playerId] = currentVillagers - spendCount;
    console.debug(`[spendVillager action] player ${args.playerId} now has ${this.match.villagers[args.playerId]} villagers`);
    await this.gainAction({ count: spendCount }, context);
  }

  // Pays down debt tokens using the current treasure pool.
  async payDebt(args: { playerId: PlayerId; count: number; }, context?: GameActionContext) {
    // Ensure debt map exists for older saved states.
    this.match.debt ??= {};
    const currentDebt = this.match.debt[args.playerId] ?? 0;
    const payable = Math.min(args.count, currentDebt, this.match.playerTreasure);
    console.log(`[payDebt action] player ${args.playerId} paying ${payable} debt`);
    if (payable <= 0) {
      console.debug(`[payDebt action] player ${args.playerId} not enough payable ${payable} to pay debt`);
      return;
    }
    this.match.debt[args.playerId] = currentDebt - payable;
    this.match.playerTreasure = Math.max(0, this.match.playerTreasure - payable);
    console.debug(`[payDebt action] player ${args.playerId} now has ${this.match.debt[args.playerId]} debt, treasure ${this.match.playerTreasure}`);
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
    overpay?: { inTreasure: number; inCoffer: number; };
    cardCost: CardCost;
  }) {
    // Ensure debt map exists for older saved states.
    this.match.debt ??= {};
    // Prevent buying if the player already has debt tokens.
    const existingDebt = this.match.debt[args.playerId] ?? 0;
    if (existingDebt > 0) {
      console.debug(`[buyCard action] player ${args.playerId} has debt (${existingDebt}), blocking buy`);
      return;
    }
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;

    if (args.overpay?.inCoffer) {
      console.debug(`[buyCard action] player ${args.playerId} overpaid ${args.overpay.inCoffer} coffers, exchanging for treasure`);

      await this.exchangeCoffer({
        playerId: args.playerId,
        count: args.overpay.inCoffer
      });
    }

    console.debug(`[buyCard action] reducing player ${args.playerId} treasure by card cost ${args.cardCost.treasure} treasure`);

    this.match.playerTreasure -= args.cardCost.treasure;

    if (args.cardCost.potion !== undefined) {
      console.debug(`[buyCard action] reducing player ${args.playerId} potions by card cost ${args.cardCost.potion} potions`);
      this.match.playerPotions -= args.cardCost.potion;
    }

    if ((args.cardCost.debt ?? 0) > 0) {
      console.debug(`[buyCard action] adding ${args.cardCost.debt} debt to player ${args.playerId}`);
      await this.gainDebt({playerId: args.playerId, count: args.cardCost.debt!});
    }

    console.debug(`[buyCard action] reducing player ${args.playerId} buys by 1`);

    this.match.playerBuys--;

    console.debug(`[buyCard action] adding bought stats to match`);

    this.match.stats.cardsBoughtByTurn[this.match.turnNumber] ??= [];
    this.match.stats.cardsBoughtByTurn[this.match.turnNumber]!.push(cardId);

    this.match.stats.cardsBought[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      playerId: args.playerId,
      cost: args.cardCost.treasure,
      paid: args.cardCost.treasure + (args.overpay?.inTreasure ?? 0) + (args.overpay?.inCoffer ?? 0)
    }

    console.debug(`[buyCard action] gaining card to discard pile`);

    await this.gainCard({
      playerId: args.playerId,
      cardId,
      to: {location: 'playerDiscard'}
    }, {bought: true, overpay: args.overpay ?? 0});
  }

  async buyEvent(args: {
    cardLikeId: CardLikeId;
    playerId: PlayerId;
  }) {
    // Ensure debt map exists for older saved states.
    this.match.debt ??= {};
    // Prevent buying card-likes if the player already has debt tokens.
    const existingDebt = this.match.debt[args.playerId] ?? 0;
    if (existingDebt > 0) {
      console.debug(`[buyEvent action] player ${args.playerId} has debt (${existingDebt}), blocking buy`);
      return;
    }
    const event = this.match.events.find(e => e.id === args.cardLikeId);

    if (!event) {
      console.warn(`[buyEvent action] could not find event ${args.cardLikeId}`);
      return;
    }

    console.debug(`[buyEvent action] buying ${event}`);

    const cost = event.cost.treasure;

    this.match.playerTreasure -= cost;

    console.debug(`[buyEvent action] reducing player ${args.playerId} treasure ${cost} to ${this.match.playerTreasure}`);

    if ((event.cost.debt ?? 0) > 0) {
      console.debug(`[buyEvent action] adding ${event.cost.debt} debt to player ${args.playerId}`);
      await this.gainDebt({playerId: args.playerId, count: event.cost.debt!});
    }

    this.match.playerBuys--;

    console.debug(`[buyEvent action] reducing player ${args.playerId} buys by 1 to ${this.match.playerBuys}`);

    this.match.stats.cardLikesBoughtByTurn[this.match.turnNumber] ??= [];
    this.match.stats.cardLikesBoughtByTurn[this.match.turnNumber]!.push(args.cardLikeId);

    this.match.stats.cardLikesBought[args.cardLikeId] = {
      playerId: args.playerId,
      turnNumber: this.match.turnNumber,
      turnPhase: getTurnPhase(this.match.turnPhaseIndex)
    }

    const effectFn = this.eventEffectFunctionMap[event.cardKey];

    if (effectFn) {
      console.debug(`[buyEvent action] running effect for ${event}`);

      const context = {
        cardSourceController: this._cardSourceController,
        cardPriceController: this.cardPriceRuleController,
        logManager: this.logManager,
        reactionManager: this.reactionManager,
        runGameActionDelegate: this.runGameActionDelegate,
        cardId: args.cardLikeId,
        playerId: args.playerId,
        match: this.match,
        cardLibrary: this.cardLibrary,
        reactionContext: {},
        findCards: this._findCards
      } as CardEffectFunctionContext;

      // Centralized duration registration with automatic cleanup on leave-play.
      context.registerDurationEffect = (durationCard, triggeredTemplate, options) => {
        const triggerIds = this.registerDurationEffectInternal(durationCard, context, triggeredTemplate, options);
        this.reactionManager.registerDurationTriggers(durationCard.id, triggerIds);
        return triggerIds;
      };

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
    // Ensure debt map exists for older saved states.
    this.match.debt ??= {};
    // Prevent buying projects if the player already has debt tokens.
    const existingDebt = this.match.debt[args.playerId] ?? 0;
    if (existingDebt > 0) {
      console.debug(`[buyProject action] player ${args.playerId} has debt (${existingDebt}), blocking buy`);
      return;
    }

    const project = this.match.projects.find(candidate => candidate.id === args.cardLikeId);
    if (!project) {
      console.warn(`[buyProject action] could not find project ${args.cardLikeId}`);
      return;
    }

    // Ensure the player has an available cube token to place.
    const cubeTokenId = 'cube-token';
    const tokens = Object.values(this.match.tokens ?? {});
    const availableCube = tokens.find(token =>
      token.tokenId === cubeTokenId &&
      token.ownerId === args.playerId &&
      token.location.type === 'playerAvailable' &&
      token.location.playerId === args.playerId
    );

    if (!availableCube) {
      console.debug(`[buyProject action] player ${args.playerId} has no available cube tokens`);
      return;
    }

    // Prevent placing multiple cubes on the same project for the same player.
    const alreadyPlaced = tokens.some(token =>
      token.tokenId === cubeTokenId &&
      token.ownerId === args.playerId &&
      token.location.type === 'cardLike' &&
      token.location.cardLikeId === project.id
    );

    if (alreadyPlaced) {
      console.debug(`[buyProject action] player ${args.playerId} already owns ${project}`);
      return;
    }

    console.debug(`[buyProject action] buying ${project}`);

    const cost = project.cost.treasure ?? 0;
    this.match.playerTreasure -= cost;
    console.debug(`[buyProject action] reducing player ${args.playerId} treasure ${cost} to ${this.match.playerTreasure}`);

    this.match.playerBuys--;
    console.debug(`[buyProject action] reducing player ${args.playerId} buys by 1 to ${this.match.playerBuys}`);

    this.match.stats.cardLikesBoughtByTurn[this.match.turnNumber] ??= [];
    this.match.stats.cardLikesBoughtByTurn[this.match.turnNumber]!.push(args.cardLikeId);

    this.match.stats.cardLikesBought[args.cardLikeId] = {
      playerId: args.playerId,
      turnNumber: this.match.turnNumber,
      turnPhase: getTurnPhase(this.match.turnPhaseIndex)
    }

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
      console.debug(`[buyProject action] running effect for ${project}`);

      const context = {
        cardSourceController: this._cardSourceController,
        cardPriceController: this.cardPriceRuleController,
        logManager: this.logManager,
        reactionManager: this.reactionManager,
        runGameActionDelegate: this.runGameActionDelegate,
        cardId: args.cardLikeId,
        playerId: args.playerId,
        match: this.match,
        cardLibrary: this.cardLibrary,
        reactionContext: {},
        findCards: this._findCards
      } as CardEffectFunctionContext;

      // Centralized duration registration with automatic cleanup on leave-play.
      context.registerDurationEffect = (durationCard, triggeredTemplate, options) => {
        const triggerIds = this.registerDurationEffectInternal(durationCard, context, triggeredTemplate, options);
        this.reactionManager.registerDurationTriggers(durationCard.id, triggerIds);
        return triggerIds;
      };

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
  async receiveBoon(args: { playerId: PlayerId; immediate?: boolean; boonId?: CardLikeId; keepSetAside?: boolean }, context?: GameActionContext) {
    // Default to immediate resolution unless explicitly deferred.
    const immediate = args.immediate ?? true;
    console.log(`[receiveBoon action] player ${args.playerId} receiving a boon`);

    if (!immediate) {
      console.debug('[receiveBoon action] boon will be deferred until resolved');
    }

    // Ensure boon piles exist for older saved states.
    this.match.boons ??= { cards: [], deck: [], discard: [], setAside: [] };
    this.match.boons.cards ??= [];
    this.match.boons.deck ??= [];
    this.match.boons.discard ??= [];
    this.match.boons.setAside ??= [];

    if (this.match.boons.cards.length < 1) {
      console.info('[receiveBoon action] no boons configured, skipping');
      return;
    }

    if (this.match.boons.deck.length < 1 && this.match.boons.discard.length > 0) {
      console.info('[receiveBoon action] boon deck empty, reshuffling discard');
      await this.shuffleCardLike({ kind: 'boon', includeDiscard: true });
    }

    let boonId = args.boonId;
    let boon = boonId !== undefined
      ? this.match.boons.cards.find(candidate => candidate.id === boonId)
      : undefined;

    if (boonId !== undefined && !boon) {
      console.warn(`[receiveBoon action] could not find boon ${boonId}`);
      return;
    }

    if (boonId === undefined || !boon) {
      if (this.match.boons.deck.length < 1) {
        console.info('[receiveBoon action] no boons available to draw');
        return;
      }

      boonId = this.match.boons.deck.pop();
      if (boonId === undefined) {
        console.warn('[receiveBoon action] boon deck draw failed');
        return;
      }

      boon = this.match.boons.cards.find(b => b.id === boonId);
      if (!boon) {
        console.warn(`[receiveBoon action] could not find boon ${boonId}`);
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
        const setAsideSource = this._cardSourceController.getSource('set-aside', args.playerId);
        const setAsideIndex = setAsideSource.indexOf(boonId);
        if (setAsideIndex !== -1) {
          setAsideSource.splice(setAsideIndex, 1);
          console.debug(`[receiveBoon action] removed ${boon} from set-aside for ${source}`);
        }
      }
      catch (error) {
        console.warn(`[receiveBoon action] could not update set-aside for boon ${boonId}`);
        console.error(error);
      }
    };

    // Helper to resolve the boon effect and handle discard logic.
    const resolveBoon = async (source: string) => {
      // TODO: Surface the received boon to the player via detail modal or prompt.
      const effectFn = this.boonEffectFunctionMap[boon.cardKey];

      if (effectFn) {
        console.debug(`[receiveBoon action] running effect for ${boon} (${source})`);

        const effectContext = {
          cardSourceController: this._cardSourceController,
          cardPriceController: this.cardPriceRuleController,
          logManager: this.logManager,
          reactionManager: this.reactionManager,
          runGameActionDelegate: this.runGameActionDelegate,
          cardId: boonId,
          playerId: args.playerId,
          match: this.match,
          cardLibrary: this.cardLibrary,
          reactionContext: {},
          findCards: this._findCards
        } as CardEffectFunctionContext;

        // Centralized duration registration with automatic cleanup on leave-play.
        effectContext.registerDurationEffect = (durationCard, triggeredTemplate, options) => {
          const triggerIds = this.registerDurationEffectInternal(durationCard, effectContext, triggeredTemplate, options);
          this.reactionManager.registerDurationTriggers(durationCard.id, triggerIds);
          return triggerIds;
        };

        // Run boon effects with standardized logging.
        await this.runEffectWithLogging({
          source: boon.toString(),
          sourceType: 'boon',
          playerId: args.playerId,
          effectFn,
          context: effectContext,
        });
      }
      else {
        console.debug(`[receiveBoon action] no effect registered for ${boon.cardKey}`);
      }

      // Skip discarding if the boon was set aside by its effect.
      let isSetAside = false;
      try {
        const setAsideSource = this._cardSourceController.getSource('set-aside', args.playerId);
        isSetAside = setAsideSource.includes(boonId);
      }
      catch (error) {
        console.warn(`[receiveBoon action] could not verify set-aside for boon ${boonId}`);
        console.error(error);
      }

      if (isSetAside) {
        console.debug(`[receiveBoon action] boon ${boon.cardKey} set aside until cleanup`);
        return;
      }

      if (args.keepSetAside) {
        console.debug(`[receiveBoon action] preserving ${boon} in set-aside`);
        return;
      }

      this.match.boons.discard.push(boonId);
      console.debug(`[receiveBoon action] discarded ${boon}`);
    };

    if (!immediate) {
      // Set the boon aside for delayed resolution unless already set aside.
      let alreadySetAside = false;
      try {
        const setAsideSource = this._cardSourceController.getSource('set-aside', args.playerId);
        alreadySetAside = setAsideSource.includes(boonId);
      }
      catch (error) {
        console.warn(`[receiveBoon action] could not check set-aside for boon ${boonId}`);
        console.error(error);
      }

      if (!alreadySetAside) {
        await this.moveCardLike({
          cardLikeId: boonId,
          toPlayerId: args.playerId,
          to: { location: 'set-aside' },
        });
      }

      console.debug(`[receiveBoon action] set aside ${boon} for deferred resolution`);
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
    console.log(`[receiveHex action] player ${args.playerId} receiving a hex`);

    // Ensure hex piles exist for older saved states.
    this.match.hexes ??= { cards: [], deck: [], discard: [] };
    this.match.hexes.cards ??= [];
    this.match.hexes.deck ??= [];
    this.match.hexes.discard ??= [];

    if (this.match.hexes.cards.length < 1) {
      console.info('[receiveHex action] no hexes configured, skipping');
      return;
    }

    if (this.match.hexes.deck.length < 1 && this.match.hexes.discard.length > 0) {
      console.info('[receiveHex action] hex deck empty, reshuffling discard');
      await this.shuffleCardLike({ kind: 'hex', includeDiscard: true });
    }

    let hexId = args.hexId;
    let hex = hexId !== undefined
      ? this.match.hexes.cards.find(candidate => candidate.id === hexId)
      : undefined;

    if (hexId !== undefined && !hex) {
      console.warn(`[receiveHex action] could not find hex ${hexId}`);
      return;
    }

    if (hexId === undefined || !hex) {
      if (this.match.hexes.deck.length < 1) {
        console.info('[receiveHex action] no hexes available to draw');
        return;
      }

      hexId = this.match.hexes.deck.pop();
      if (hexId === undefined) {
        console.warn('[receiveHex action] hex deck draw failed');
        return;
      }

      hex = this.match.hexes.cards.find(h => h.id === hexId);
      if (!hex) {
        console.warn(`[receiveHex action] could not find hex ${hexId}`);
        this.match.hexes.discard.push(hexId);
        return;
      }
    }

    // Remove the hex from deck/discard if it was already staged there.
    const deckIndex = this.match.hexes.deck.indexOf(hexId);
    if (deckIndex !== -1) {
      this.match.hexes.deck.splice(deckIndex, 1);
    }
    const discardIndex = this.match.hexes.discard.indexOf(hexId);
    if (discardIndex !== -1) {
      this.match.hexes.discard.splice(discardIndex, 1);
    }

    const effectFn = this.hexEffectFunctionMap[hex.cardKey];
    if (effectFn) {
      console.debug(`[receiveHex action] running effect for ${hex}`);

      const effectContext = {
        cardSourceController: this._cardSourceController,
        cardPriceController: this.cardPriceRuleController,
        logManager: this.logManager,
        reactionManager: this.reactionManager,
        runGameActionDelegate: this.runGameActionDelegate,
        cardId: hexId,
        playerId: args.playerId,
        match: this.match,
        cardLibrary: this.cardLibrary,
        reactionContext: {},
        findCards: this._findCards
      } as CardEffectFunctionContext;

      // Centralized duration registration with automatic cleanup on leave-play.
      effectContext.registerDurationEffect = (durationCard, triggeredTemplate, options) => {
        const triggerIds = this.registerDurationEffectInternal(durationCard, effectContext, triggeredTemplate, options);
        this.reactionManager.registerDurationTriggers(durationCard.id, triggerIds);
        return triggerIds;
      };

      // Run hex effects with standardized logging.
      await this.runEffectWithLogging({
        source: hex.toString(),
        sourceType: 'hex',
        playerId: args.playerId,
        effectFn,
        context: effectContext,
      });
    }
    else {
      console.debug(`[receiveHex action] no effect registered for ${hex.cardKey}`);
    }

    // Received hexes always go to the discard pile after resolving.
    this.match.hexes.discard.push(hexId);
    console.debug(`[receiveHex action] discarded ${hex}`);

    return hexId;
  }

  // Assigns a state to a player and registers its effect triggers.
  async gainState(args: { playerId: PlayerId; stateId?: CardLikeId; stateKey?: CardKey; removeFromCurrentOwner?: boolean }, context?: GameActionContext) {
    console.log(`[gainState action] player ${args.playerId} gaining state`);

    const store = this.ensureStatusStore('state');
    if (store.cards.length < 1) {
      console.info('[gainState action] no states configured, skipping');
      return;
    }

    const state = this.resolveStatusCard(store, { statusId: args.stateId, statusKey: args.stateKey });

    if (!state) {
      console.warn('[gainState action] could not resolve state to gain');
      return;
    }

    const ownedStates = store.byPlayer[args.playerId] ?? [];
    if (ownedStates.includes(state.id)) {
      console.debug(`[gainState action] player ${args.playerId} already has ${state}`);
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
      console.debug(`[gainState action] no effect registered for ${state.cardKey}`);
      return state.id;
    }

    console.debug(`[gainState action] registering effects for ${state}`);
    const effectContext = {
      cardSourceController: this._cardSourceController,
      cardPriceController: this.cardPriceRuleController,
      logManager: this.logManager,
      reactionManager: this.reactionManager,
      runGameActionDelegate: this.runGameActionDelegate,
      cardId: state.id,
      playerId: args.playerId,
      match: this.match,
      cardLibrary: this.cardLibrary,
      reactionContext: {},
      findCards: this._findCards
    } as CardEffectFunctionContext;

    // Centralized duration registration with automatic cleanup on leave-play.
    effectContext.registerDurationEffect = (durationCard, triggeredTemplate, options) => {
      const triggerIds = this.registerDurationEffectInternal(durationCard, effectContext, triggeredTemplate, options);
      this.reactionManager.registerDurationTriggers(durationCard.id, triggerIds);
      return triggerIds;
    };

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
  async removeState(args: { playerId: PlayerId; stateId?: CardLikeId; stateKey?: CardKey }, context?: GameActionContext): Promise<void> {
    console.log(`[removeState action] player ${args.playerId} removing state`);

    const store = this.ensureStatusStore('state');
    const state = this.resolveStatusCard(store, { statusId: args.stateId, statusKey: args.stateKey });

    if (!state) {
      console.warn('[removeState action] could not resolve state to remove');
      return;
    }

    const ownedStates = store.byPlayer[args.playerId] ?? [];
    const index = ownedStates.indexOf(state.id);
    if (index === -1) {
      console.debug(`[removeState action] player ${args.playerId} does not have ${state}`);
      return;
    }

    ownedStates.splice(index, 1);
    // State-trigger cleanup is handled by the state effect that registered them.
    console.debug(`[removeState action] removed ${state} from player ${args.playerId}`);
  }

  // Assigns an artifact to a player and registers its effect triggers.
  async gainArtifact(args: { playerId: PlayerId; artifactId?: CardLikeId; artifactKey?: CardKey }, context?: GameActionContext) {
    console.log(`[gainArtifact action] player ${args.playerId} gaining artifact`);

    const store = this.ensureStatusStore('artifact');
    if (store.cards.length < 1) {
      console.info('[gainArtifact action] no artifacts configured, skipping');
      return;
    }

    const artifact = this.resolveStatusCard(store, { statusId: args.artifactId, statusKey: args.artifactKey });
    if (!artifact) {
      console.warn('[gainArtifact action] could not resolve artifact to gain');
      return;
    }

    const ownedArtifacts = store.byPlayer[args.playerId] ?? [];
    if (ownedArtifacts.includes(artifact.id)) {
      console.debug(`[gainArtifact action] player ${args.playerId} already has ${artifact}`);
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
      console.debug(`[gainArtifact action] no effect registered for ${artifact.cardKey}`);
      return artifact.id;
    }

    console.debug(`[gainArtifact action] registering effects for ${artifact}`);
    const effectContext = {
      cardSourceController: this._cardSourceController,
      cardPriceController: this.cardPriceRuleController,
      logManager: this.logManager,
      reactionManager: this.reactionManager,
      runGameActionDelegate: this.runGameActionDelegate,
      cardId: artifact.id,
      playerId: args.playerId,
      match: this.match,
      cardLibrary: this.cardLibrary,
      reactionContext: {},
      findCards: this._findCards
    } as CardEffectFunctionContext;

    // Centralized duration registration with automatic cleanup on leave-play.
    effectContext.registerDurationEffect = (durationCard, triggeredTemplate, options) => {
      const triggerIds = this.registerDurationEffectInternal(durationCard, effectContext, triggeredTemplate, options);
      this.reactionManager.registerDurationTriggers(durationCard.id, triggerIds);
      return triggerIds;
    };

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
  async removeArtifact(args: { playerId: PlayerId; artifactId?: CardLikeId; artifactKey?: CardKey }, context?: GameActionContext): Promise<void> {
    console.log(`[removeArtifact action] player ${args.playerId} removing artifact`);

    const store = this.ensureStatusStore('artifact');
    const artifact = this.resolveStatusCard(store, { statusId: args.artifactId, statusKey: args.artifactKey });
    if (!artifact) {
      console.warn('[removeArtifact action] could not resolve artifact to remove');
      return;
    }

    const ownedArtifacts = store.byPlayer[args.playerId] ?? [];
    const index = ownedArtifacts.indexOf(artifact.id);
    if (index === -1) {
      console.debug(`[removeArtifact action] player ${args.playerId} does not have ${artifact}`);
      return;
    }

    ownedArtifacts.splice(index, 1);
    // Artifact-trigger cleanup is handled by the artifact effect that registered them.
    console.debug(`[removeArtifact action] removed ${artifact} from player ${args.playerId}`);
  }

  async revealCard(args: {
    cardId: CardId | Card,
    playerId: PlayerId,
    moveToSetAside?: boolean
  }, context?: GameActionContext) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);

    console.debug(`[revealCard action] ${getPlayerById(this.match, args.playerId)} revealing ${card}`);

    const cardId = card.id;

    if (args.moveToSetAside) {
      console.debug(`[revealCard action] moving card to 'revealed' zone`);

      await this.moveCard({
        cardId: cardId,
        toPlayerId: args.playerId,
        to: {location: 'set-aside'},
        facing: 'front',
      });
    }

    this.logManager.addLogEntry({
      type: 'revealCard',
      cardId: cardId,
      playerId: args.playerId,
      source: context?.loggingContext?.source,
    });
  }

  async checkForRemainingPlayerActions(): Promise<void> {
    const match = this.match;
    const currentPlayer = getCurrentPlayer(match);
    const turnPhase = getTurnPhase(match.turnPhaseIndex);

    console.debug(`[checkForRemainingPlayerActions action] phase: ${turnPhase} for ${currentPlayer} turn ${match.turnNumber}`);

    // Pause automated flow while any human player is disconnected.
    const hasDisconnectedHuman = match.players.some((player) => !player.connected && !player.isComputer);
    if (hasDisconnectedHuman) {
      console.debug('[checkForRemainingPlayerActions action] human disconnected, pausing flow');
      return;
    }

    this.interactivityController.checkCardInteractivity();

    if (turnPhase === 'action') {
      const hasActions = match.playerActions > 0;
      const hasActionCards = this._findCards({location: 'playerHand', playerId: currentPlayer.id})
        .some(cardId => cardId.type.includes('ACTION'));

      if (!hasActions || !hasActionCards) {
        console.debug('[checkForRemainingPlayerActions action] skipping to next phase');
        await this.nextPhase();
        return;
      }
    }

    if (turnPhase === 'buy') {
      const hasBuys = match.playerBuys > 0;

      console.debug(`[checkForRemainingPlayerActions action] ${currentPlayer} as ${hasBuys} buys remaining`);

      if (!hasBuys) {
        console.debug('[checkForRemainingPlayerActions action] skipping to next phase');
        await this.nextPhase();
        return;
      }
    }

    if (turnPhase === 'night') {
      // Skip Night phase automatically if the player has no Night cards to play.
      const hasNightCards = this._findCards({location: 'playerHand', playerId: currentPlayer.id})
        .some(cardId => cardId.type.includes('NIGHT'));

      if (!hasNightCards) {
        console.debug('[checkForRemainingPlayerActions action] no night cards, skipping to next phase');
        await this.nextPhase();
        return;
      }
      console.debug('[checkForRemainingPlayerActions action] night cards available, waiting for play');
    }

    if (turnPhase === 'cleanup') {
      await this.nextPhase();
      return;
    }

    // Allow computer players to take a single action per phase.
    await this.runComputerTurnStep();
  }


  async discardCard(args: { cardId: CardId | Card, playerId: PlayerId }, context?: GameActionContext) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;

    console.info(`[discardCard action] discarding ${card} from ${getPlayerById(this.match, args.playerId)}`);

    const oldLocation = await this.moveCard({
      cardId,
      to: {location: 'playerDiscard'},
      toPlayerId: args.playerId
    });

    if (!oldLocation) {
      throw new Error(`[discardCard action] could not find card ${cardId} in player ${args.playerId}'s discard pile`);
    }

    this.logManager.addLogEntry({
      type: 'discard',
      playerId: args.playerId,
      cardId,
      source: context?.loggingContext?.source,
    });

    const r = new ReactionTrigger('discardCard', {
      previousLocation: oldLocation,
      playerId: args.playerId,
      cardId
    });

    await this.reactionManager.runTrigger({trigger: r});

    await this.reactionManager.runCardLifecycleEvent('onDiscarded', {
      cardId: cardId,
      playerId: args.playerId,
      previousLocation: oldLocation
    });
  }

  async nextPhase() {
    const match = this.match;

    let currentPlayer = getCurrentPlayer(match);

    await this.runEndTurnPhaseTrigger(match.turnPhaseIndex, currentPlayer.id);

    match.turnPhaseIndex = match.turnPhaseIndex + 1;

    if (match.turnPhaseIndex >= TurnPhaseOrderValues.length) {
      match.turnPhaseIndex = 0;
      match.turnNumber++;
    }

    const newPhase = getTurnPhase(match.turnPhaseIndex);

    if (newPhase === 'action') {
      match.playerActions = 1;
      match.playerBuys = 1;
      match.playerTreasure = 0;
      match.playerPotions = 0;

      match.currentPlayerTurnIndex++;

      if (match.currentPlayerTurnIndex >= match.players.length) {
        match.currentPlayerTurnIndex = 0;
        match.roundNumber++;

        this.logManager.addLogEntry({
          root: true,
          type: 'newTurn',
          turn: Math.floor(match.turnNumber / match.players.length) + 1,
        });
      }

      this.logManager.addLogEntry({
        type: 'newPlayerTurn',
        turn: Math.floor(match.turnNumber / match.players.length) + 1,
        playerId: match.players[match.currentPlayerTurnIndex].id,
      });

      currentPlayer = getCurrentPlayer(match);

      console.info(
        `[nextPhase action] new round: ${match.roundNumber}, turn ${match.turnNumber} for ${currentPlayer}`,
      );

      const startTurnTrigger = new ReactionTrigger('startTurn', {
        playerId: match.players[match.currentPlayerTurnIndex].id,
        turnNumber: match.turnNumber,
      });

      await this.reactionManager.runTrigger({trigger: startTurnTrigger});
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
    await this.reactionManager.runTrigger({trigger});
  }

  private async runStartTurnPhaseTrigger(phaseIndex: number) {
    const trigger = new ReactionTrigger('startTurnPhase', {phaseIndex});
    await this.reactionManager.runTrigger({trigger});
  }

  private async handlePhaseEntryEffects(
    phase: TurnPhase,
    runStartPhaseTrigger: boolean,
  ) {
    const match = this.match;

    switch (phase) {
      case 'action':
      case 'buy':
      case 'cleanup': {
        if (runStartPhaseTrigger) {
          await this.runStartTurnPhaseTrigger(match.turnPhaseIndex);
        }

        const currentPlayer = getCurrentPlayer(match);
        const cardsToDiscard = this._findCards({location: 'playArea'})
          .concat(
            this._findCards({
              location: 'playerHand',
              playerId: currentPlayer.id,
            }),
          );

        for (const cardId of cardsToDiscard) {
          await this.discardCard({cardId, playerId: currentPlayer.id});
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

    console.log(
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
      console.warn(
        `[setTurnPhase action] requested by non-current player ${targetPlayerId}, current is ${currentPlayer.id}`,
      );
      return;
    }

    const currentPhase = getTurnPhase(match.turnPhaseIndex);
    if (currentPhase === args.phase) {
      console.debug(
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
      console.debug(`[setTurnPhase action] start phase trigger suppressed`);
    }
  }

  async endTurn() {
    console.info('[endTurn action] removing overrides');

    const trigger = new ReactionTrigger('endTurn', {
      playerId: getCurrentPlayer(this.match).id,
      turnNumber: this.match.turnNumber
    });
    await this.reactionManager.runTrigger({trigger});
  }

  async gainTreasure(args: { count: number }, context?: GameActionContext) {
    const currentPlayer = getCurrentPlayer(this.match);
    let gainAmount = args.count;
    // Allow reactions to modify incoming treasure gains.
    // Include the source card so reactions can attribute token logs.
    const trigger = new ReactionTrigger('treasureGain', {
      playerId: currentPlayer.id,
      count: gainAmount,
      source: context?.loggingContext?.source,
    });
    await this.reactionManager.runTrigger({trigger});
    gainAmount = Math.max(0, trigger.args.count);

    console.info(`[gainTreasure action] gaining ${gainAmount} treasure`);
    this.match.playerTreasure += gainAmount;
    this.match.playerTreasure = Math.max(0, this.match.playerTreasure);

    if (!context?.loggingContext?.suppress) {
      this.logManager.addLogEntry({
        type: 'gainTreasure',
        playerId: currentPlayer.id,
        count: gainAmount,
        source: context?.loggingContext?.source,
      });
    }
  }

  // Single, focused implementation of drawCard
  async drawCard(args: { playerId: PlayerId, count?: number; suppressReactions?: boolean }, context?: GameActionContext) {
    const {playerId, count} = args;

    console.debug(`[drawCard action] player ${playerId} drawing ${count} card(s)`);

    let drawCount = count ?? 1;
    if (!args.suppressReactions) {
      // Allow reactions to modify incoming draw amounts (e.g., -1 Card token).
      const trigger = new ReactionTrigger('drawCards', {
        playerId,
        count: drawCount,
        source: context?.loggingContext?.source,
      });
      await this.reactionManager.runTrigger({trigger});
      drawCount = Math.max(0, trigger.args.count);
    }

    const deck = this._cardSourceController.getSource('playerDeck', playerId);
    const drawnCardIds: CardId[] = [];

    for (let i = 0; i < drawCount; i++) {
      if (deck.length < 1) {
        console.debug(`[drawCard action] Shuffling discard pile`);
        await this.shuffleDeck({playerId});

        if (deck.length < 1) {
          console.debug(`[drawCard action] No cards left in deck, returning null`);
          return drawnCardIds.length > 0 ? drawnCardIds : null;
        }
      }

      const drawnCardId = deck.slice(-1)[0];
      drawnCardIds.push(drawnCardId);

      await this.moveCard({
        cardId: drawnCardId,
        toPlayerId: playerId,
        to: {location: 'playerHand'}
      });

      this.logManager.addLogEntry({
        type: 'draw',
        playerId,
        cardId: drawnCardId,
        source: context?.loggingContext?.source,
      });

      console.debug(`[drawCard action] Drew card ${drawnCardId}`);
    }

    return drawnCardIds;
  }

  // Draws a full hand (default 5), allowing draw-hand reactions to adjust the count.
  async drawHand(args: { playerId: PlayerId; count?: number }, context?: GameActionContext) {
    const { playerId } = args;
    let drawCount = args.count ?? 5;

    console.log(`[drawHand action] player ${playerId} drawing ${drawCount} card(s) for hand`);

    // Anchor draw-hand logs so reaction effects nest underneath.
    this.logManager.addLogEntry({
      type: 'drawHand',
      playerId,
      source: context?.loggingContext?.source,
    });

    const trigger = new ReactionTrigger('drawHand', {
      playerId,
      count: drawCount,
      source: context?.loggingContext?.source,
    });
    await this.reactionManager.runTrigger({ trigger });
    drawCount = Math.max(0, trigger.args.count);

    if (drawCount < 1) {
      console.debug('[drawHand action] draw count is 0, skipping');
      return null;
    }

    // Draw hands should not trigger drawCards reactions.
    return await this.drawCard({ playerId, count: drawCount, suppressReactions: true }, context);
  }

  async playCard(args: {
    playerId: PlayerId,
    cardId: CardId | Card,
    overrides?: GameActionOverrides
  }, context?: GameActionContext) {
    const {playerId} = args;
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;

    if (args.overrides?.moveCard === undefined || args.overrides.moveCard) {
      await this.moveCard({
        cardId: cardId,
        to: {location: 'playArea'},
      });
    }

    if (card.type.includes('ACTION') &&
      args.overrides?.actionCost !== 0) {
      this.match.playerActions -= args.overrides?.actionCost ?? 1;

      console.info(`[playCard action] Reducing player's action count to ${this.match.playerActions}`);
    }

    this.match.stats.playedCardsByTurn[this.match.turnNumber] ??= [];
    this.match.stats.playedCardsByTurn[this.match.turnNumber]!.push(cardId);
    this.match.stats.playedCards[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      playerId: playerId,
    };

    console.info(`[playCard action] ${getPlayerById(this.match, playerId)} played card ${card}`);

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
    await this.reactionManager.runTrigger({trigger: cardPlayedTrigger, reactionContext});

    // Apply supply pile token bonuses before the card's own lifecycle/effects.
    await this.applyTokenBonusesOnCardPlayed(playerId, cardId);

    // now add any triggered effects from the card played
    await this.reactionManager.runCardLifecycleEvent('onCardPlayed', {playerId: args.playerId, cardId});

    // run the effects of the card played, note passing in the reaction context collected from running the trigger
    // above - e.g., could provide immunity to an attack card played
    const buildEffectContext = () => {
      const context = {
        cardSourceController: this._cardSourceController,
        cardPriceController: this.cardPriceRuleController,
        logManager: this.logManager,
        reactionManager: this.reactionManager,
        runGameActionDelegate: this.runGameActionDelegate,
        cardId,
        playerId,
        match: this.match,
        cardLibrary: this.cardLibrary,
        reactionContext,
        findCards: this._findCards
      } as CardEffectFunctionContext;

      // Centralized duration registration with automatic cleanup on leave-play.
      context.registerDurationEffect = (durationCard, triggeredTemplate, options) => {
        const triggerIds = this.registerDurationEffectInternal(durationCard, context, triggeredTemplate, options);
        this.reactionManager.registerDurationTriggers(durationCard.id, triggerIds);
        return triggerIds;
      };

      return context;
    };

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

    for (const expansion of Object.keys(this.customCardEffectHandlers)) {
      const effects = this.customCardEffectHandlers[expansion];
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

    const afterCardPlayedTrigger = new ReactionTrigger('afterCardPlayed', {
      playerId,
      cardId,
    });

    // handle reactions for the card played
    reactionContext = {};
    await this.reactionManager.runTrigger({trigger: afterCardPlayedTrigger, reactionContext});
  }

  // Helper method to shuffle a player's deck
  async shuffleDeck(args: { playerId: PlayerId; includeDiscard?: boolean }, context?: GameActionContext): Promise<void> {
    const {playerId} = args;
    const includeDiscard = args.includeDiscard ?? true;

    console.debug(`[shuffleDeck action] shuffling deck`);

    const deck = this._cardSourceController.getSource('playerDeck', playerId);
    const discard = this._cardSourceController.getSource('playerDiscard', playerId);

    if (includeDiscard) {
      fisherYatesShuffle(discard, true);
      deck.unshift(...discard);
      discard.length = 0;
    } else {
      fisherYatesShuffle(deck, true);
    }

    this.logManager.addLogEntry({
      type: 'shuffleDeck',
      playerId: args.playerId,
      source: context?.loggingContext?.source,
    });
  }

  // Shuffles a card-like deck (boons or hexes), optionally pulling in discards.
  async shuffleCardLike(args: { kind: 'boon' | 'hex'; includeDiscard?: boolean }, context?: GameActionContext): Promise<void> {
    const includeDiscard = args.includeDiscard ?? false;

    // Resolve the target piles based on kind and ensure they exist.
    const piles = args.kind === 'boon' ? (this.match.boons ??= { cards: [], deck: [], discard: [], setAside: [] })
      : (this.match.hexes ??= { cards: [], deck: [], discard: [] });
    piles.deck ??= [];
    piles.discard ??= [];

    const deck = piles.deck;
    const discard = piles.discard;
    if (includeDiscard && discard.length) {
      // Move all discarded cards into the deck before shuffling.
      deck.push(...discard.splice(0, discard.length));
      console.debug(`[shuffleCardLike action] moved discard into ${args.kind} deck (${deck.length} total)`);
    }

    if (deck.length < 2) {
      console.debug(`[shuffleCardLike action] ${args.kind} deck has ${deck.length} card(s), skipping shuffle`);
      return;
    }

    fisherYatesShuffle(deck, true);
    console.info(`[shuffleCardLike action] shuffled ${args.kind} deck (${deck.length} cards)`);
  }
}
