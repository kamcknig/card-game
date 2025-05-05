import {
  CardId,
  CardKey,
  CardLocationSpec,
  Match,
  PlayerId,
  SelectActionCardArgs,
  TurnPhaseOrderValues,
  UserPromptActionArgs
} from 'shared/shared-types.ts';
import { CardLibrary } from '../card-library.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';
import { LogManager } from '../log-manager.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import {
  AppSocket,
  BaseGameActionDefinitionMap,
  CardEffectFn,
  CardEffectFunctionMap,
  GameActionContext,
  GameActionContextMap,
  GameActionDefinitionMap,
  GameActionOverrides,
  GameActionReturnTypeMap,
  GameActions,
  ReactionTrigger,
  RunGameActionDelegate
} from '../../types.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { findSourceByCardId } from '../../utils/find-source-by-card-id.ts';
import { findSourceByLocationSpec } from '../../utils/find-source-by-location-spec.ts';
import { findCards } from '../../utils/find-cards.ts';
import { castArray, isNumber } from 'es-toolkit/compat';
import { ReactionManager } from '../reactions/reaction-manager.ts';
import { CardInteractivityController } from '../card-interactivity-controller.ts';
import { CardPriceRulesController } from '../card-price-rules-controller.ts';

export class GameActionController implements BaseGameActionDefinitionMap {
  private customActionHandlers: Partial<GameActionDefinitionMap> = {};
  private customCardEffectHandlers: Record<string, Record<CardKey, CardEffectFn>> = {};
  
  constructor(
    private cardPriceRuleController: CardPriceRulesController,
    private cardEffectFunctionMap: CardEffectFunctionMap,
    private match: Match,
    private cardLibrary: CardLibrary,
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
  
  public registerAction<K extends GameActions>(key: K, handler: GameActionDefinitionMap[K]) {
    if ((this as any)[key]) {
      throw new Error(`[action controller] action ${key} is reserved`);
    }
    
    if (this.customActionHandlers[key]) {
      console.warn(`[action controller] overwriting existing action handler for ${key}`);
    }
    
    this.customActionHandlers[key] = handler;
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
    
    console.log(`[gainPotion action] setting player potions to ${this.match.playerPotions}`);
  }
  
  async gainBuy(args: { count: number }, context?: GameActionContext) {
    console.log(`[gainBuy action] gaining ${args.count} buys`);
    this.match.playerBuys += args.count;
    
    this.logManager.addLogEntry({
      type: 'gainBuy',
      count: args.count,
      playerId: getCurrentPlayer(this.match).id,
      source: context?.loggingContext?.source,
    });
    
    console.log(`[gainBuy action] setting player guys to ${this.match.playerBuys}`);
  }
  
  async moveCard(args: { toPlayerId?: PlayerId, cardId: CardId, to: CardLocationSpec }) {
    const oldSource = findSourceByCardId(args.cardId, this.match, this.cardLibrary);
    args.to.location = castArray(args.to.location);
    const newSource = findSourceByLocationSpec({ spec: args.to, playerId: args.toPlayerId }, this.match);
    
    oldSource.sourceStore.splice(oldSource.index, 1);
    
    switch (oldSource.storeKey) {
      case 'playerHands':
        await this.reactionManager.runCardLifecycleEvent('onLeaveHand', {
          playerId: args.toPlayerId!,
          cardId: args.cardId
        });
        break;
      case 'playArea':
      case 'activeDuration':
        if (newSource === this.match.playArea || newSource === this.match.activeDurationCards) break;
        await this.reactionManager.runCardLifecycleEvent('onLeavePlay', { cardId: args.cardId });
    }
    
    args.to.location = castArray(args.to.location);
    
    newSource.push(args.cardId);
    
    switch (args.to.location[0]) {
      case 'playerHands':
        await this.reactionManager.runCardLifecycleEvent('onEnterHand', {
          playerId: args.toPlayerId!,
          cardId: args.cardId
        });
        break;
    }
    
    console.log(`[moveCard action] moved ${this.cardLibrary.getCard(args.cardId)} from ${oldSource.storeKey} to ${args.to.location}`);
    
    return oldSource.storeKey;
  }
  
  async gainAction(args: { count: number }, context?: GameActionContext) {
    console.log(`[gainAction action] gaining ${args.count} actions`);
    
    this.match.playerActions += args.count;
    
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
    cardId: CardId,
    to: CardLocationSpec
  }, context?: GameActionContextMap['gainCard']) {
    await this.moveCard({
      cardId: args.cardId,
      to: args.to,
      toPlayerId: args.playerId
    });
    
    this.match.stats.cardsGainedByTurn[this.match.turnNumber] ??= [];
    this.match.stats.cardsGainedByTurn[this.match.turnNumber].push(args.cardId);
    
    this.match.stats.cardsGained[args.cardId] = {
      turnNumber: this.match.turnNumber,
      playerId: args.playerId
    };
    
    this.cardLibrary.getCard(args.cardId).owner = args.playerId;
    
    console.log(`[gainCard action] ${getPlayerById(this.match, args.playerId)} gained ${this.cardLibrary.getCard(args.cardId)}`);
    
    this.logManager.addLogEntry({
      playerId: args.playerId,
      cardId: args.cardId,
      type: 'gainCard',
      source: context?.loggingContext?.source,
    });
    
    const trigger = new ReactionTrigger('gainCard', {
      cardId: args.cardId,
      playerId: args.playerId,
      bought: context?.bought,
    });
    
    this.logManager.enter();
    await this.reactionManager.runTrigger({ trigger });
    this.logManager.exit();
    
    await this.reactionManager.runCardLifecycleEvent('onGained', {
      playerId: args.playerId,
      cardId: args.cardId,
      bought: context?.bought ?? false,
      overpaid: context?.overpay ?? 0
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
    
    let selectableCardIds: number[] = [];
    
    const { count, playerId, restrict } = args;
    
    if (Array.isArray(restrict)) {
      console.log(`[selectCard action] restricted to set of cards ${restrict}`);
      selectableCardIds = restrict;
    }
    else if (restrict.from) {
      if (restrict.from.location === 'playerDecks') {
        console.warn('[selectCard action] will not be able to select from deck, not sending it to client, nor able to show them to them right now');
        return [];
      }
      
      selectableCardIds = findCards(
        this.match,
        {
          location: restrict.from.location,
          cards: !Array.isArray(restrict.card) ? restrict.card : undefined,
          cost: restrict.cost ? { spec: restrict.cost, cardCostController: this.cardPriceRuleController } : undefined,
        },
        this.cardLibrary,
      );
      
      console.log(`[selectCard action] found ${selectableCardIds.length} selectable cards`);
    }
    
    if (selectableCardIds?.length === 0) {
      console.log(`[selectCard action] found no cards within restricted set ${restrict}`);
      return [];
    }
    
    // if there aren't enough cards, depending on the selection type, we might simply implicitly select cards
    // because the player would be forced to select hem all anyway
    if (isNumber(count) && !args.optional) {
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
  
  async trashCard(args: { cardId: CardId, playerId: PlayerId }, context?: GameActionContext) {
    await this.moveCard({
      cardId: args.cardId,
      to: { location: 'trash' }
    });
    
    const card = this.cardLibrary.getCard(args.cardId);
    card.owner = null;
    
    this.match.stats.trashedCards[args.cardId] = {
      turnNumber: this.match.turnNumber,
      playerId: getCurrentPlayer(this.match).id
    };
    
    console.log(`[trashCard action] trashed ${card}`);
    
    this.logManager.addLogEntry({
      playerId: args.playerId,
      cardId: args.cardId,
      type: 'trashCard',
      source: context?.loggingContext?.source,
    });
  }
  
  async buyCard(args: { cardId: CardId; playerId: PlayerId, overpay?: number }) {
    const card = this.cardLibrary.getCard(args.cardId);
    
    const { cost } = this.cardPriceRuleController.applyRules(
      card,
      {
        match: this.match,
        playerId: args.playerId
      }
    );
    
    this.match.playerTreasure -= cost.treasure;
    
    if (cost.potion !== undefined) {
      this.match.playerPotions -= cost.potion;
    }
    
    this.match.playerBuys--;
    
    this.match.stats.cardsBought[args.cardId] = {
      turnNumber: this.match.turnNumber,
      playerId: args.playerId,
      cost: cost.treasure,
      paid: cost.treasure + (args.overpay ?? 0)
    }
    
    await this.gainCard({
      playerId: args.playerId,
      cardId: args.cardId,
      to: { location: 'playerDiscards' }
    }, { bought: true, overpay: args.overpay ?? 0 });
  }
  
  async revealCard(args: {
    cardId: CardId,
    playerId: PlayerId,
    moveToSetAside?: boolean
  }, context?: GameActionContext) {
    console.log(`[revealCard action] ${getPlayerById(this.match, args.playerId)} revealing ${this.cardLibrary.getCard(args.cardId)}`);
    
    if (args.moveToSetAside) {
      console.log(`[revealCard action] moving card to 'revealed' zone`);
      
      await this.moveCard({
        cardId: args.cardId,
        toPlayerId: args.playerId,
        to: { location: 'set-aside' }
      });
    }
    
    this.logManager.addLogEntry({
      type: 'revealCard',
      cardId: args.cardId,
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
      const hasActionCards = match.playerHands[currentPlayer.id]
        .some(cardId => this.cardLibrary.getCard(cardId).type.includes('ACTION'));
      
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
  
  
  async discardCard(args: { cardId: CardId, playerId: PlayerId }, context?: GameActionContext) {
    console.log(`[discardCard action] discarding ${this.cardLibrary.getCard(args.cardId)} from ${getPlayerById(this.match, args.playerId)}`);
    
    const oldLocation = await this.moveCard({
      cardId: args.cardId,
      to: { location: 'playerDiscards' },
      toPlayerId: args.playerId
    });
    
    this.logManager.addLogEntry({
      type: 'discard',
      playerId: args.playerId,
      cardId: args.cardId,
      source: context?.loggingContext?.source,
    });
    
    const r = new ReactionTrigger('discardCard', {
      previousLocation: oldLocation,
      playerId: args.playerId,
      cardId: args.cardId
    });
    
    this.logManager.enter();
    await this.reactionManager.runTrigger({ trigger: r });
    this.logManager.exit();
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
        
        for (const cardId of [...match.activeDurationCards]) {
          const turnsSincePlayed = match.turnNumber - match.stats.playedCards[cardId].turnNumber;
          
          const shouldMoveToPlayArea = (
            currentPlayer.id === match.stats.playedCards[cardId].playerId &&
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
        
        const cardsToDiscard = match.playArea.concat(match.activeDurationCards, match.playerHands[currentPlayer.id]);
        
        for (const cardId of cardsToDiscard) {
          const card = this.cardLibrary.getCard(cardId);
          
          const stats = match?.stats?.playedCards?.[cardId];
          
          if (!card.type.includes('DURATION') || !stats) {
            await this.discardCard({ cardId, playerId: currentPlayer.id });
            continue;
          }
          
          const turnsSincePlayed = match.turnNumber - stats.turnNumber;
          
          const shouldDiscard = (
            currentPlayer.id === stats.playerId &&
            turnsSincePlayed > 0
          );
          
          if (shouldDiscard) {
            console.log(`[nextPhase action] discarding ${card}...`);
            await this.discardCard({ cardId, playerId: currentPlayer.id });
          }
          else {
            await this.moveCard({
              cardId,
              to: { location: 'activeDuration' }
            });
            
            console.log(`[nextPhase action] ${card} is duration, leaving in play, moving to 'activeDuration' area`);
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
    
    this.logManager.addLogEntry({
      type: 'gainTreasure',
      playerId: getCurrentPlayer(this.match).id,
      count: args.count,
      source: context?.loggingContext?.source,
    });
  }
  
  // Single, focused implementation of drawCard
  async drawCard(args: { playerId: PlayerId, count?: number }, context?: GameActionContext) {
    const { playerId } = args;
    
    const deck = this.match.playerDecks[playerId];
    const drawnCardIds: CardId[] = [];
    
    for (let i = 0; i < (args.count ?? 1); i++) {
      if (deck.length < 1) {
        console.log(`[drawCard action] Shuffling discard pile`);
        await this.shuffleDeck({ playerId });
        
        if (deck.length < 1) {
          console.log(`[drawCard action] No cards left in deck, returning null`);
          return drawnCardIds.length > 0 ? drawnCardIds : null;
        }
      }
      
      const drawnCardId = deck.slice(-1)[0];
      
      await this.moveCard({
        cardId: drawnCardId,
        toPlayerId: playerId,
        to: { location: 'playerHands' }
      });
      
      console.log(`[drawCard action] Drew card ${this.cardLibrary.getCard(drawnCardId)}`);
      
      this.logManager.addLogEntry({
        type: 'draw',
        playerId,
        cardId: drawnCardId,
        source: context?.loggingContext?.source,
      });
    }
    
    return drawnCardIds;
  }
  
  async playCard(args: {
    playerId: PlayerId,
    cardId: CardId,
    overrides?: GameActionOverrides
  }, context?: GameActionContext) {
    const { playerId, cardId } = args;
    
    await this.moveCard({
      cardId: args.cardId,
      to: { location: 'playArea' },
    });
    
    const card = this.cardLibrary.getCard(cardId);
    
    if (card.type.includes('ACTION') && args.overrides?.actionCost !== 0) {
      this.match.playerActions -= args.overrides?.actionCost ?? 1;
      
      console.log(`[playCard action] Reducing player's action count to ${this.match.playerActions}`);
    }
    
    this.match.stats.playedCardsByTurn[this.match.turnNumber] ??= [];
    this.match.stats.playedCardsByTurn[this.match.turnNumber].push(cardId);
    this.match.stats.playedCards[cardId] = {
      turnNumber: this.match.turnNumber,
      playerId: playerId,
    };
    
    console.log(`[playCard action] ${getPlayerById(this.match, playerId)} played card ${this.cardLibrary.getCard(cardId)}`);
    
    this.logManager.addLogEntry({
      type: 'cardPlayed',
      cardId,
      playerId,
      source: context?.loggingContext?.source,
    });
    
    // now add any triggered effects from the card played
    await this.reactionManager.runCardLifecycleEvent('onCardPlayed', { playerId: args.playerId, cardId: args.cardId });
    
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
    
    // run the effects of the card played, note passing in the reaction context collected from running the trigger
    // above - e.g., could provide immunity to an attack card played
    let effectFn = this.cardEffectFunctionMap[card.cardKey];
    if (effectFn) {
      this.logManager.enter();
      await effectFn({
        cardPriceController: this.cardPriceRuleController,
        reactionManager: this.reactionManager,
        runGameActionDelegate: this.runGameActionDelegate,
        cardId,
        gameActionController: this,
        playerId,
        match: this.match,
        cardLibrary: this.cardLibrary,
        reactionContext,
      });
      this.logManager.exit();
    }
    
    for (const expansion of Object.keys(this.customCardEffectHandlers)) {
      const effects = this.customCardEffectHandlers[expansion];
      effectFn = effects[card.cardKey];
      if (effectFn) {
        this.logManager.enter();
        await effectFn({
          cardPriceController: this.cardPriceRuleController,
          reactionManager: this.reactionManager,
          runGameActionDelegate: this.runGameActionDelegate,
          cardId,
          gameActionController: this,
          playerId,
          match: this.match,
          cardLibrary: this.cardLibrary,
          reactionContext,
        });
        this.logManager.exit();
      }
    }
  }
  
  // Helper method to shuffle a player's deck
  async shuffleDeck(args: { playerId: PlayerId }, context?: GameActionContext): Promise<void> {
    const { playerId } = args;
    
    console.log(`[shuffleDeck action] shuffling deck`);
    
    const deck = this.match.playerDecks[playerId];
    const discard = this.match.playerDiscards[playerId];
    
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