import {
  Card,
  CardCost,
  CardId,
  CardKey,
  CardLikeId,
  CardLocation,
  CardLocationSpec,
  CountSpec,
  Match,
  PlayerId,
  SelectActionCardArgs,
  TokenId,
  TokenInstance,
  TokenInstanceId,
  TokenFacing,
  TokenLocation,
  TurnPhaseOrderValues,
  UserPromptActionArgs
} from 'shared/shared-types.ts';
import { MatchCardLibrary } from '../match-card-library.ts';
import { LogManager } from '../log-manager.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import {
  AppSocket,
  BaseGameActionDefinitionMap,
  CardEffectFn,
  CardEffectFunctionMap,
  FindCardsFn,
  FindCardsFnInput,
  GameActionContext,
  GameActionContextMap,
  GameActionDefinitionMap,
  GameActionOverrides,
  GameActionReturnTypeMap,
  GameActions,
  ReactionTrigger,
  RunGameActionDelegate,
} from '../../types.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { ReactionManager } from '../reactions/reaction-manager.ts';
import { CardInteractivityController } from '../card-interactivity-controller.ts';
import { CardPriceRulesController } from '../card-price-rules-controller.ts';
import { CardSourceController } from '../card-source-controller.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';
import { tokenCardPlayedHandlerMap } from '../tokens/token-trigger-map.ts';
import { tokenDefinitionMap } from '../tokens/token-definition-map.ts';

export class GameActionController implements BaseGameActionDefinitionMap {
  private customActionHandlers: Partial<GameActionDefinitionMap> = {};
  private customCardEffectHandlers: Record<string, Record<CardKey, CardEffectFn>> = {};
  // Guards against re-entrant computer turns triggered by nested game actions.
  private _computerTurnInProgress: boolean = false;
  
  constructor(
    private _cardSourceController: CardSourceController,
    private _findCards: FindCardsFn,
    private cardPriceRuleController: CardPriceRulesController,
    private cardEffectFunctionMap: CardEffectFunctionMap,
    private eventEffectFunctionMap: CardEffectFunctionMap,
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
    if (optional) {
      return Math.min(1, available);
    }
    return Math.min(1, available);
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
          await this.runGameActionDelegate('playCard', { playerId: currentPlayer.id, cardId: actionCardId });
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
          await this.runGameActionDelegate('buyCardLike', { playerId: currentPlayer.id, cardLikeId: selectedId });
          this._computerTurnInProgress = false;
          await this.runGameActionDelegate('nextPhase');
          return;
        }
        
        const card = this.cardLibrary.getCard(selectedId);
        const inHand = this._cardSourceController.getSource('playerHand', currentPlayer.id).includes(selectedId);
        if (inHand && card.type.includes('TREASURE')) {
          await this.runGameActionDelegate('playCard', { playerId: currentPlayer.id, cardId: selectedId });
          this._computerTurnInProgress = false;
          await this.runGameActionDelegate('nextPhase');
          return;
        }
        
        const { restricted, cost } = this.cardPriceRuleController.applyRules(card, { playerId: currentPlayer.id });
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
    }
    finally {
      this._computerTurnInProgress = false;
    }
  }

  // Applies any token bonuses for the player when a card is played from a tokened supply pile.
  private async applyTokenBonusesOnCardPlayed(playerId: PlayerId, cardId: CardId): Promise<void> {
    const card = this.cardLibrary.getCard(cardId);
    const pileKey = card.randomizer ?? card.cardKey;
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
    console.debug(`[gainPotion action] gaining ${args.count} potions`);
    this.match.playerPotions += args.count;
    this.match.playerPotions = Math.max(0, this.match.playerPotions);
    
    console.debug(`[gainPotion action] setting player potions to ${this.match.playerPotions}`);
  }
  
  async gainBuy(args: { count: number }, context?: GameActionContext) {
    console.debug(`[gainBuy action] gaining ${args.count} buys`);
    this.match.playerBuys += args.count;
    this.match.playerBuys = Math.max(this.match.playerBuys, 0);
    
    this.logManager.addLogEntry({
      type: 'gainBuy',
      count: args.count,
      playerId: getCurrentPlayer(this.match).id,
      source: context?.loggingContext?.source,
    });
    
    console.debug(`[gainBuy action] setting player guys to ${this.match.playerBuys}`);
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

  async moveToken(args: { tokenInstanceId: TokenInstanceId; location: TokenLocation; }): Promise<void> {
    // Resolve the token instance to ensure we don't mutate a missing token.
    const token = this.getTokenInstance(args.tokenInstanceId);
    // Update location in-place for a stable token reference.
    token.location = args.location;
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
  
  async moveCard(args: { toPlayerId?: PlayerId, cardId: CardId | Card, to: CardLocationSpec }) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
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
        await this.reactionManager.runCardLifecycleEvent('onLeavePlay', { cardId });
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
    
    return oldSource ? { location: oldSource?.sourceKey!, playerId: oldSource?.playerId } : undefined;
  }
  
  async gainAction(args: { count: number }, context?: GameActionContext) {
    console.debug(`[gainAction action] gaining ${args.count} actions`);
    
    this.match.playerActions += args.count;
    this.match.playerActions = Math.max(0, this.match.playerActions);
    
    this.logManager.addLogEntry({
      type: 'gainAction',
      playerId: getCurrentPlayer(this.match).id,
      count: args.count,
      source: context?.loggingContext?.source,
    })
    
    console.debug(`[gainAction action] setting player actions to ${args.count}`);
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
    
    console.debug(`[gainCard action] ${getPlayerById(this.match, args.playerId)} gained ${card}`);
    
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
    
    await this.reactionManager.runTrigger({ trigger });
    
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
    }
    else {
      console.debug('[gainCard action] lifecycle onGained event suppressed');
    }
    
    await this.reactionManager.runGameLifecycleEvent('onCardGained', {
      cardId: cardId,
      playerId: args.playerId,
      match: this.match
    });
  }
  
  async userPrompt(args: UserPromptActionArgs) {
    const { playerId } = args;
    
    const signalId = `userPrompt:${playerId}:${Date.now()}`;
    
    const player = getPlayerById(this.match, playerId);
    if (player?.isComputer) {
      // Computer players always pick the first available action button when prompted.
      if (args.content?.type === 'select-pile') {
        const pileNames = args.content.pileNames ?? [];
        return { result: pileNames.length ? [pileNames[0]] : [] };
      }
      const actionButtons = args.actionButtons ?? [];
      const firstAction = actionButtons.find(button => button.action !== 0)?.action ?? 0;
      return { action: firstAction };
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
    
    const { count, playerId, restrict } = args;
    
    if (Array.isArray(restrict) && typeof restrict[0] === 'number') {
      console.debug(`[selectCard action] restricted to set of cards ${restrict}`);
      selectableCardIds = restrict as CardId[];
    }
    else if (restrict !== undefined) {
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
      socket.emit('selectCard', signalId, { ...args, selectableCardIds });
    });
  }
  
  async trashCard(args: { cardId: CardId | Card, playerId: PlayerId }, context?: GameActionContext) {
    const oldLocation = await this.moveCard({
      cardId: args.cardId,
      to: { location: 'trash' }
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
    
    console.debug(`[trashCard action] trashed ${card}`);
    
    const trigger: ReactionTrigger = {
      eventType: 'cardTrashed',
      args: {
        playerId: args.playerId,
        cardId: card.id,
        previousLocation: oldLocation
      }
    }
    await this.reactionManager.runTrigger({ trigger });
    
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
    console.debug(`[gainVictoryToken action] player ${args.playerId} gained ${args.count} victory tokens`);
    this.match.playerVictoryTokens ??= {};
    this.match.playerVictoryTokens[args.playerId] ??= 0;
    const newCount = this.match.playerVictoryTokens[args.playerId] + args.count;
    this.match.playerVictoryTokens[args.playerId] = newCount;
    console.debug(`[gainVictoryToken action] player ${args.playerId} new victory token count ${newCount}`);
  }
  
  async gainCoffer(args: { playerId: PlayerId, count?: number; }, context?: GameActionContext) {
    console.debug(`[gainCoffer action] player ${args.playerId} gained ${args.count} coffers`);
    this.match.coffers[args.playerId] ??= 0;
    this.match.coffers[args.playerId] += args.count ?? 1;
    this.match.coffers[args.playerId] = Math.max(0, this.match.coffers[args.playerId]);
    console.debug(`[gainCoffer action] player ${args.playerId} now has ${this.match.coffers[args.playerId]} coffers`);
  }
  
  async exchangeCoffer(args: { playerId: PlayerId, count: number; }, context?: GameActionContext) {
    console.debug(`[exchangeCoffer action] player ${args.playerId} exchanged ${args.count} coffers`);
    this.match.coffers[args.playerId] -= args.count;
    this.match.playerTreasure += args.count;
  };
  
  async buyCard(args: {
    cardId: CardId | Card;
    playerId: PlayerId;
    overpay?: { inTreasure: number; inCoffer: number; };
    cardCost: CardCost;
  }) {
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
      to: { location: 'playerDiscard' }
    }, { bought: true, overpay: args.overpay ?? 0 });
  }
  
  async buyCardLike(args: {
    cardLikeId: CardLikeId;
    playerId: PlayerId;
  }) {
    const event = this.match.events.find(e => e.id === args.cardLikeId);
    
    if (!event) {
      console.warn(`[buyCardLike action] could not find event ${args.cardLikeId}`);
      return;
    }
    
    console.debug(`[buyCardLike action] buying ${event}`);
    
    const cost = event.cost.treasure;
    
    this.match.playerTreasure -= cost;
    
    console.debug(`[buyCardLike action] reducing player ${args.playerId} treasure ${cost} to ${this.match.playerTreasure}`);
    
    this.match.playerBuys--;
    
    console.debug(`[buyCardLike action] reducing player ${args.playerId} buys by 1 to ${this.match.playerBuys}`);
    
    this.match.stats.cardLikesBoughtByTurn[this.match.turnNumber] ??= [];
    this.match.stats.cardLikesBoughtByTurn[this.match.turnNumber]!.push(args.cardLikeId);
    
    this.match.stats.cardLikesBought[args.cardLikeId] = {
      playerId: args.playerId,
      turnNumber: this.match.turnNumber,
      turnPhase: getTurnPhase(this.match.turnPhaseIndex)
    }
    
    const effectFn = this.eventEffectFunctionMap[event.cardKey];
    
    if (effectFn) {
      console.debug(`[buyCardLike action] running effect for ${event}`);

      await this.logManager.withIndent(async () => {
        await effectFn({
          cardSourceController: this._cardSourceController,
          cardPriceController: this.cardPriceRuleController,
          reactionManager: this.reactionManager,
          runGameActionDelegate: this.runGameActionDelegate,
          cardId: args.cardLikeId,
          playerId: args.playerId,
          match: this.match,
          cardLibrary: this.cardLibrary,
          reactionContext: {},
          findCards: this._findCards
        });
      });
    }
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
        to: { location: 'set-aside' }
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
    
    this.interactivityController.checkCardInteractivity();
    
    if (turnPhase === 'action') {
      const hasActions = match.playerActions > 0;
      const hasActionCards = this._findCards({ location: 'playerHand', playerId: currentPlayer.id })
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
    
    console.debug(`[discardCard action] discarding ${card} from ${getPlayerById(this.match, args.playerId)}`);
    
    const oldLocation = await this.moveCard({
      cardId,
      to: { location: 'playerDiscard' },
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
    
    await this.reactionManager.runTrigger({ trigger: r });
    
    await this.reactionManager.runCardLifecycleEvent('onDiscarded', {
      cardId: cardId,
      playerId: args.playerId,
      previousLocation: oldLocation
    });
  }
  
  async nextPhase() {
    const match = this.match;
    
    let currentPlayer = getCurrentPlayer(match);
    
    const trigger = new ReactionTrigger('endTurnPhase', {
      phaseIndex: match.turnPhaseIndex,
      playerId: currentPlayer.id
    });
    await this.reactionManager.runTrigger({ trigger });
    
    match.turnPhaseIndex = match.turnPhaseIndex + 1;
    
    if (match.turnPhaseIndex >= TurnPhaseOrderValues.length) {
      match.turnPhaseIndex = 0;
      match.turnNumber++;
    }
    
    const newPhase = getTurnPhase(match.turnPhaseIndex);
    
    console.debug(`[nextPhase action] entering phase: ${newPhase} for turn ${match.turnNumber}`);
    
    switch (newPhase) {
      case 'action': {
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
          playerId: match.players[match.currentPlayerTurnIndex].id
        });
        
        currentPlayer = getCurrentPlayer(match);
        
        console.debug(`[nextPhase action] new round: ${match.roundNumber}, turn ${match.turnNumber} for ${currentPlayer}`);
        
        const startTurnTrigger = new ReactionTrigger('startTurn', {
          playerId: match.players[match.currentPlayerTurnIndex].id,
          turnNumber: match.turnNumber
        });
        await this.reactionManager.runTrigger({ trigger: startTurnTrigger });
        
        const startPhaseTrigger = new ReactionTrigger('startTurnPhase', { phaseIndex: match.turnPhaseIndex });
        await this.reactionManager.runTrigger({ trigger: startPhaseTrigger });
        
        break;
      }
      case 'buy': {
        const startPhaseTrigger = new ReactionTrigger('startTurnPhase', { phaseIndex: match.turnPhaseIndex });
        await this.reactionManager.runTrigger({ trigger: startPhaseTrigger });
        break;
      }
      case 'cleanup': {
        const startPhaseTrigger = new ReactionTrigger('startTurnPhase', { phaseIndex: match.turnPhaseIndex });
        await this.reactionManager.runTrigger({ trigger: startPhaseTrigger });
        
        const cardsToDiscard = this._findCards({ location: 'playArea' })
          .concat(this._findCards({ location: 'playerHand', playerId: currentPlayer.id }));
        
        for (const cardId of cardsToDiscard) {
          await this.discardCard({ cardId, playerId: currentPlayer.id });
        }
        
        for (let i = 0; i < 5; i++) {
          console.debug(`[nextPhase action] drawing card...`);
          
          await this.drawCard({ playerId: currentPlayer.id });
        }
        
        await this.endTurn();
        
        break;
      }
    }
    
    await this.checkForRemainingPlayerActions();
  }
  
  async endTurn() {
    console.debug('[endTurn action] removing overrides');
    
    const trigger = new ReactionTrigger('endTurn',);
    await this.reactionManager.runTrigger({ trigger });
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
    await this.reactionManager.runTrigger({ trigger });
    gainAmount = Math.max(0, trigger.args.count);
    
    console.debug(`[gainTreasure action] gaining ${gainAmount} treasure`);
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
  async drawCard(args: { playerId: PlayerId, count?: number }, context?: GameActionContext) {
    const { playerId, count } = args;
    
    console.debug(`[drawCard action] player ${playerId} drawing ${count} card(s)`);

    let drawCount = count ?? 1;
    // Allow reactions to modify incoming draw amounts (e.g., -1 Card token).
    const trigger = new ReactionTrigger('drawCards', {
      playerId,
      count: drawCount,
      source: context?.loggingContext?.source,
    });
    await this.reactionManager.runTrigger({ trigger });
    drawCount = Math.max(0, trigger.args.count);
    
    const deck = this._cardSourceController.getSource('playerDeck', playerId);
    const drawnCardIds: CardId[] = [];
    
    for (let i = 0; i < drawCount; i++) {
      if (deck.length < 1) {
        console.debug(`[drawCard action] Shuffling discard pile`);
        await this.shuffleDeck({ playerId });
        
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
        to: { location: 'playerHand' }
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
  
  async playCard(args: {
    playerId: PlayerId,
    cardId: CardId | Card,
    overrides?: GameActionOverrides
  }, context?: GameActionContext) {
    const { playerId } = args;
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;
    
    if (args.overrides?.moveCard === undefined || args.overrides.moveCard) {
      await this.moveCard({
        cardId: cardId,
        to: { location: 'playArea' },
      });
    }
    
    if (card.type.includes('ACTION') && args.overrides?.actionCost !== 0) {
      this.match.playerActions -= args.overrides?.actionCost ?? 1;
      
      console.debug(`[playCard action] Reducing player's action count to ${this.match.playerActions}`);
    }
    
    this.match.stats.playedCardsByTurn[this.match.turnNumber] ??= [];
    this.match.stats.playedCardsByTurn[this.match.turnNumber]!.push(cardId);
    this.match.stats.playedCards[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      playerId: playerId,
    };
    
    console.debug(`[playCard action] ${getPlayerById(this.match, playerId)} played card ${card}`);
    
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
    
    // now add any triggered effects from the card played
    await this.reactionManager.runCardLifecycleEvent('onCardPlayed', { playerId: args.playerId, cardId });
    
    // run the effects of the card played, note passing in the reaction context collected from running the trigger
    // above - e.g., could provide immunity to an attack card played
    let effectFn = this.cardEffectFunctionMap[card.cardKey];
    if (effectFn) {
      await this.logManager.withIndent(async () => {
        await effectFn({
          cardSourceController: this._cardSourceController,
          cardPriceController: this.cardPriceRuleController,
          reactionManager: this.reactionManager,
          runGameActionDelegate: this.runGameActionDelegate,
          cardId,
          playerId,
          match: this.match,
          cardLibrary: this.cardLibrary,
          reactionContext,
          findCards: this._findCards
        });
      });
    }
    
    for (const expansion of Object.keys(this.customCardEffectHandlers)) {
      const effects = this.customCardEffectHandlers[expansion];
      effectFn = effects[card.cardKey];
      if (effectFn) {
        await this.logManager.withIndent(async () => {
          await effectFn({
            cardSourceController: this._cardSourceController,
            cardPriceController: this.cardPriceRuleController,
            reactionManager: this.reactionManager,
            runGameActionDelegate: this.runGameActionDelegate,
            cardId,
            playerId,
            match: this.match,
            cardLibrary: this.cardLibrary,
            reactionContext,
            findCards: this._findCards
          });
        });
      }
    }
    
    const afterCardPlayedTrigger = new ReactionTrigger('afterCardPlayed', {
      playerId,
      cardId,
    });
    
    // handle reactions for the card played
    reactionContext = {};
    await this.reactionManager.runTrigger({ trigger: afterCardPlayedTrigger, reactionContext });
  }
  
  // Helper method to shuffle a player's deck
  async shuffleDeck(args: { playerId: PlayerId }, context?: GameActionContext): Promise<void> {
    const { playerId } = args;
    
    console.debug(`[shuffleDeck action] shuffling deck`);
    
    const deck = this._cardSourceController.getSource('playerDeck', playerId);
    const discard = this._cardSourceController.getSource('playerDiscard', playerId);
    
    fisherYatesShuffle(discard, true);
    deck.unshift(...discard);
    discard.length = 0;
    
    this.logManager.addLogEntry({
      type: 'shuffleDeck',
      playerId: args.playerId,
      source: context?.loggingContext?.source,
    });
  }
}
