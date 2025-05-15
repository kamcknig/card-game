import {
  Card,
  CardCost,
  CardId,
  CardKey,
  CardLocation,
  CardLocationSpec,
  Match,
  PlayerId,
  SelectActionCardArgs,
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

export class GameActionController implements BaseGameActionDefinitionMap {
  private customActionHandlers: Partial<GameActionDefinitionMap> = {};
  private customCardEffectHandlers: Record<string, Record<CardKey, CardEffectFn>> = {};
  
  constructor(
    private _cardSourceController: CardSourceController,
    private _findCards: FindCardsFn,
    private cardPriceRuleController: CardPriceRulesController,
    private cardEffectFunctionMap: CardEffectFunctionMap,
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
  
  async gainPotion(args: { count: number }) {
    console.log(`[gainPotion action] gaining ${args.count} potions`);
    this.match.playerPotions += args.count;
    this.match.playerPotions = Math.max(0, this.match.playerPotions);
    
    console.log(`[gainPotion action] setting player potions to ${this.match.playerPotions}`);
  }
  
  async gainBuy(args: { count: number }, context?: GameActionContext) {
    console.log(`[gainBuy action] gaining ${args.count} buys`);
    this.match.playerBuys += args.count;
    this.match.playerBuys = Math.max(this.match.playerBuys, 0);
    
    this.logManager.addLogEntry({
      type: 'gainBuy',
      count: args.count,
      playerId: getCurrentPlayer(this.match).id,
      source: context?.loggingContext?.source,
    });
    
    console.log(`[gainBuy action] setting player guys to ${this.match.playerBuys}`);
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
      case 'playerHand':
        await this.reactionManager.runCardLifecycleEvent('onLeaveHand', {
          playerId: args.toPlayerId!,
          cardId
        });
        break;
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
    
    console.log(`[moveCard action] moved ${card} from ${oldSource?.sourceKey} to ${args.to.location}`);
    
    return { location: oldSource?.sourceKey!, playerId: oldSource?.playerId };
  }
  
  async gainAction(args: { count: number }, context?: GameActionContext) {
    console.log(`[gainAction action] gaining ${args.count} actions`);
    
    this.match.playerActions += args.count;
    this.match.playerActions = Math.max(0, this.match.playerActions);
    
    this.logManager.addLogEntry({
      type: 'gainAction',
      playerId: getCurrentPlayer(this.match).id,
      count: args.count,
      source: context?.loggingContext?.source,
    })
    
    console.log(`[gainAction action] setting player actions to ${args.count}`);
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
    this.match.stats.cardsGainedByTurn[this.match.turnNumber].push(cardId);
    
    this.match.stats.cardsGained[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      playerId: args.playerId
    };
    
    card.owner = args.playerId;
    
    console.log(`[gainCard action] ${getPlayerById(this.match, args.playerId)} gained ${card}`);
    
    this.logManager.addLogEntry({
      playerId: args.playerId,
      cardId: cardId,
      type: 'gainCard',
      source: context?.loggingContext?.source,
    });
    
    const trigger = new ReactionTrigger('gainCard', {
      cardId: cardId,
      playerId: args.playerId,
      bought: context?.bought,
      previousLocation
    });
    
    this.logManager.enter();
    await this.reactionManager.runTrigger({ trigger });
    this.logManager.exit();
    
    await this.reactionManager.runCardLifecycleEvent('onGained', {
      playerId: args.playerId,
      cardId: cardId,
      bought: context?.bought ?? false
    });
    
    await this.reactionManager.runGameLifecycleEvent('onCardGained', {
      cardId: cardId,
      playerId: args.playerId,
      match: this.match
    });
  }
  
  async userPrompt(args: UserPromptActionArgs) {
    const { playerId } = args;
    
    const signalId = `userPrompt:${playerId}:${Date.now()}`;
    
    const socket = this.socketMap.get(playerId);
    if (!socket) {
      console.log(`[userPrompt] No socket for player ${playerId}`);
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
      console.log(`[selectCard action] restricted to set of cards ${restrict}`);
      selectableCardIds = restrict as CardId[];
    }
    else if (restrict !== undefined) {
      selectableCardIds = this._findCards(restrict as FindCardsFnInput).map(card => card.id);
    }
    
    console.log(`[selectCard action] found ${selectableCardIds.length} selectable cards`);
    
    if (selectableCardIds?.length === 0) {
      console.log(`[selectCard action] found no cards within restricted set ${restrict}`);
      return [];
    }
    
    // if there aren't enough cards, depending on the selection type, we might simply implicitly select cards
    // because the player would be forced to select hem all anyway
    if (typeof count === 'number' && !args.optional) {
      console.log(`[selectCard action] selection count is an exact count ${count} checking if user has that many cards`);
      
      if (selectableCardIds.length <= count) {
        console.log('[selectCard action] user does not have enough, or has exactly the amount of cards to select from, selecting all automatically');
        return selectableCardIds;
      }
    }
    
    const socket = this.socketMap.get(playerId);
    
    if (!socket) {
      console.log(`[selectCard action] no socket found for ${getPlayerById(this.match, playerId)}, skipping`);
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
    card.owner = null;
    
    this.match.stats.trashedCards[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      playerId: getCurrentPlayer(this.match).id
    };
    
    this.match.stats.trashedCardsByTurn[this.match.turnNumber] ??= [];
    this.match.stats.trashedCardsByTurn[this.match.turnNumber].push(cardId);
    
    console.log(`[trashCard action] trashed ${card}`);
    
    const trigger: ReactionTrigger = {
      eventType: 'cardTrashed',
      args: {
        playerId: args.playerId,
        cardId: card.id
      }
    }
    await this.reactionManager.runTrigger({ trigger });
    
    await this.reactionManager.runCardLifecycleEvent('onTrashed', {
      cardId: cardId,
      playerId: args.playerId,
      previousLocation: oldLocation
    });
    
    this.logManager.addLogEntry({
      playerId: args.playerId,
      cardId: cardId,
      type: 'trashCard',
      source: context?.loggingContext?.source,
    });
  }
  
  async gainVictoryToken(args: { playerId: PlayerId, count: number }, context?: GameActionContext) {
    console.log(`[gainVictoryToken action] player ${args.playerId} gained ${args.count} victory tokens`);
    this.match.playerVictoryTokens ??= {};
    this.match.playerVictoryTokens[args.playerId] ??= 0;
    const newCount = this.match.playerVictoryTokens[args.playerId] + args.count;
    this.match.playerVictoryTokens[args.playerId] = newCount;
    console.log(`[gainVictoryToken action] player ${args.playerId} new victory token count ${newCount}`);
  }
  
  async gainCoffer(args: { playerId: PlayerId, count?: number; }, context?: GameActionContext) {
    console.log(`[gainCoffer action] player ${args.playerId} gained ${args.count} coffers`);
    this.match.coffers[args.playerId] ??= 0;
    this.match.coffers[args.playerId] += args.count ?? 1;
    this.match.coffers[args.playerId] = Math.max(0, this.match.coffers[args.playerId]);
    console.log(`[gainCoffer action] player ${args.playerId} now has ${this.match.coffers[args.playerId]} coffers`);
  }
  
  async exchangeCoffer(args: { playerId: PlayerId, count: number; }, context?: GameActionContext) {
    console.log(`[exchangeCoffer action] player ${args.playerId} exchanged ${args.count} coffers`);
    this.match.coffers[args.playerId] -= args.count;
    this.match.playerTreasure += args.count;
  };
  
  async buyCard(args: {
    cardId: CardId | Card;
    playerId: PlayerId,
    overpay?: { inTreasure: number; inCoffer: number; },
    cardCost: CardCost
  }) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;
    
    if (args.overpay?.inCoffer) {
      console.log(`[buyCard action] player ${args.playerId} overpaid ${args.overpay.inCoffer} coffers, exchanging for treasure`);
      
      await this.exchangeCoffer({
        playerId: args.playerId,
        count: args.overpay.inCoffer
      });
    }
    
    console.log(`[buyCard action] reducing player ${args.playerId} treasure by card cost ${args.cardCost.treasure} treasure`);
    this.match.playerTreasure -= args.cardCost.treasure;
    
    if (args.cardCost.potion !== undefined) {
      console.log(`[buyCard action] reducing player ${args.playerId} potions by card cost ${args.cardCost.potion} potions`);
      this.match.playerPotions -= args.cardCost.potion;
    }
    
    console.log(`[buyCard action] reducing player ${args.playerId} buys by 1`);
    this.match.playerBuys--;
    
    console.log(`[buyCard action] adding bought stats to match`);
    this.match.stats.cardsBought[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      playerId: args.playerId,
      cost: args.cardCost.treasure,
      paid: args.cardCost.treasure + (args.overpay?.inTreasure ?? 0) + (args.overpay?.inCoffer ?? 0)
    }
    
    console.log(`[buyCard action] gaining card to discard pile`);
    await this.gainCard({
      playerId: args.playerId,
      cardId,
      to: { location: 'playerDiscard' }
    }, { bought: true, overpay: args.overpay ?? 0 });
  }
  
  async revealCard(args: {
    cardId: CardId | Card,
    playerId: PlayerId,
    moveToSetAside?: boolean
  }, context?: GameActionContext) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    console.log(`[revealCard action] ${getPlayerById(this.match, args.playerId)} revealing ${card}`);
    const cardId = card.id;
    
    if (args.moveToSetAside) {
      console.log(`[revealCard action] moving card to 'revealed' zone`);
      
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
    
    console.log(`[checkForRemainingPlayerActions action] phase: ${turnPhase} for ${currentPlayer} turn ${match.turnNumber}`);
    
    this.interactivityController.checkCardInteractivity();
    
    if (turnPhase === 'action') {
      const hasActions = match.playerActions > 0;
      const hasActionCards = this._findCards({ location: 'playerHand', playerId: currentPlayer.id })
        .some(cardId => cardId.type.includes('ACTION'));
      
      if (!hasActions || !hasActionCards) {
        console.log('[checkForRemainingPlayerActions action] skipping to next phase');
        await this.nextPhase();
      }
    }
    
    if (turnPhase === 'buy') {
      const hasBuys = match.playerBuys > 0;
      
      console.log(`[checkForRemainingPlayerActions action] ${currentPlayer} as ${hasBuys} buys remaining`);
      
      if (!hasBuys) {
        console.log('[checkForRemainingPlayerActions action] skipping to next phase');
        await this.nextPhase();
      }
    }
    
    if (turnPhase === 'cleanup') {
      await this.nextPhase();
    }
  }
  
  
  async discardCard(args: { cardId: CardId | Card, playerId: PlayerId }, context?: GameActionContext) {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const cardId = card.id;
    
    console.log(`[discardCard action] discarding ${card} from ${getPlayerById(this.match, args.playerId)}`);
    
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
    
    this.logManager.enter();
    await this.reactionManager.runTrigger({ trigger: r });
    this.logManager.exit();
    
    await this.reactionManager.runCardLifecycleEvent('onDiscarded', {
      cardId: cardId,
      playerId: args.playerId,
      previousLocation: oldLocation
    });
  }
  
  async nextPhase() {
    const match = this.match;
    
    const trigger = new ReactionTrigger('endTurnPhase', { phaseIndex: match.turnPhaseIndex });
    await this.reactionManager.runTrigger({ trigger });
    
    match.turnPhaseIndex = match.turnPhaseIndex + 1;
    
    if (match.turnPhaseIndex >= TurnPhaseOrderValues.length) {
      match.turnPhaseIndex = 0;
      match.turnNumber++;
    }
    
    const newPhase = getTurnPhase(match.turnPhaseIndex);
    let currentPlayer = getCurrentPlayer(match);
    
    console.log(`[nextPhase action] entering phase: ${newPhase} for turn ${match.turnNumber}`);
    
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
        
        console.log(`[nextPhase action] new round: ${match.roundNumber}, turn ${match.turnNumber} for ${currentPlayer}`);
        
        for (const cardId of [...this._findCards({ location: 'activeDuration' })]) {
          const turnsSincePlayed = match.turnNumber - match.stats.playedCards[cardId.id].turnNumber;
          
          const shouldMoveToPlayArea = (
            currentPlayer.id === match.stats.playedCards[cardId.id].playerId &&
            turnsSincePlayed > 0
          );
          
          if (shouldMoveToPlayArea) {
            await this.moveCard({
              cardId,
              to: { location: 'playArea' }
            })
          }
        }
        
        const startTurnTrigger = new ReactionTrigger('startTurn', {
          playerId: match.players[match.currentPlayerTurnIndex].id
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
        
        const cardsToDiscard = this._findCards({ location: ['activeDuration', 'playArea'] })
          .concat(this._findCards({ location: 'playerHand', playerId: currentPlayer.id }));
        
        for (const cardId of cardsToDiscard) {
          const stats = match?.stats?.playedCards?.[cardId.id];
          
          if (!cardId.type.includes('DURATION') || !stats) {
            await this.discardCard({ cardId, playerId: currentPlayer.id });
            continue;
          }
          
          const turnsSincePlayed = match.turnNumber - stats.turnNumber;
          
          const shouldDiscard = (
            currentPlayer.id === stats.playerId &&
            turnsSincePlayed > 0
          );
          
          if (shouldDiscard) {
            console.log(`[nextPhase action] discarding ${cardId}...`);
            await this.discardCard({ cardId, playerId: currentPlayer.id });
          }
          else {
            await this.moveCard({
              cardId: cardId.id,
              to: { location: 'activeDuration' }
            });
            
            console.log(`[nextPhase action] ${cardId} is duration, leaving in play, moving to 'activeDuration' area`);
          }
        }
        
        for (let i = 0; i < 5; i++) {
          console.log(`[nextPhase action] drawing card...`);
          
          await this.drawCard({ playerId: currentPlayer.id });
        }
        
        await this.endTurn();
        
        break;
      }
    }
    
    await this.checkForRemainingPlayerActions();
  }
  
  async endTurn() {
    console.log('[endTurn action] removing overrides');
    
    const trigger = new ReactionTrigger('endTurn',);
    await this.reactionManager.runTrigger({ trigger });
  }
  
  async gainTreasure(args: { count: number }, context?: GameActionContext) {
    console.log(`[gainTreasure action] gaining ${args.count} treasure`);
    this.match.playerTreasure += args.count;
    this.match.playerTreasure = Math.max(0, this.match.playerTreasure);
    
    this.logManager.addLogEntry({
      type: 'gainTreasure',
      playerId: getCurrentPlayer(this.match).id,
      count: args.count,
      source: context?.loggingContext?.source,
    });
  }
  
  // Single, focused implementation of drawCard
  async drawCard(args: { playerId: PlayerId, count?: number }, context?: GameActionContext) {
    const { playerId, count } = args;
    
    console.log(`[drawCard action] player ${playerId} drawing ${count} card(s)`);
    
    const deck = this._cardSourceController.getSource('playerDeck', playerId);
    const drawnCardIds: CardId[] = [];
    
    for (let i = 0; i < (count ?? 1); i++) {
      if (deck.length < 1) {
        console.log(`[drawCard action] Shuffling discard pile`);
        await this.shuffleDeck({ playerId });
        
        if (deck.length < 1) {
          console.log(`[drawCard action] No cards left in deck, returning null`);
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
      
      console.log(`[drawCard action] Drew card ${drawnCardId}`);
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
    
    await this.moveCard({
      cardId: cardId,
      to: { location: 'playArea' },
    });
    
    if (card.type.includes('ACTION') && args.overrides?.actionCost !== 0) {
      this.match.playerActions -= args.overrides?.actionCost ?? 1;
      
      console.log(`[playCard action] Reducing player's action count to ${this.match.playerActions}`);
    }
    
    this.match.stats.playedCardsByTurn[this.match.turnNumber] ??= [];
    this.match.stats.playedCardsByTurn[this.match.turnNumber].push(cardId);
    this.match.stats.playedCards[cardId] = {
      turnPhase: getTurnPhase(this.match.turnPhaseIndex),
      turnNumber: this.match.turnNumber,
      playerId: playerId,
    };
    
    console.log(`[playCard action] ${getPlayerById(this.match, playerId)} played card ${card}`);
    
    this.logManager.addLogEntry({
      type: 'cardPlayed',
      cardId,
      playerId,
      source: context?.loggingContext?.source,
    });
    
    // find any reactions for the cardPlayed event type
    const trigger = new ReactionTrigger('cardPlayed', {
      playerId,
      cardId,
    });
    
    // handle reactions for the card played
    const reactionContext = {};
    this.logManager.enter();
    await this.reactionManager.runTrigger({ trigger, reactionContext });
    this.logManager.exit();
    
    // now add any triggered effects from the card played
    await this.reactionManager.runCardLifecycleEvent('onCardPlayed', { playerId: args.playerId, cardId });
    
    // run the effects of the card played, note passing in the reaction context collected from running the trigger
    // above - e.g., could provide immunity to an attack card played
    let effectFn = this.cardEffectFunctionMap[card.cardKey];
    if (effectFn) {
      this.logManager.enter();
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
      this.logManager.exit();
    }
    
    for (const expansion of Object.keys(this.customCardEffectHandlers)) {
      const effects = this.customCardEffectHandlers[expansion];
      effectFn = effects[card.cardKey];
      if (effectFn) {
        this.logManager.enter();
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
        this.logManager.exit();
      }
    }
  }
  
  // Helper method to shuffle a player's deck
  async shuffleDeck(args: { playerId: PlayerId }, context?: GameActionContext): Promise<void> {
    const { playerId } = args;
    
    console.log(`[shuffleDeck action] shuffling deck`);
    
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