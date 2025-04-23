import {
  CardId,
  LocationSpec,
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
  CardEffectFunctionMap,
  GameActionControllerInterface,
  GameActionOverrides,
  ModifyActionCardArgs,
  ReactionTrigger,
  RunGameActionDelegate
} from '../../types.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { cardDataOverrides, getCardOverrides, removeOverrideEffects } from '../../card-data-overrides.ts';
import { findSourceByCardId } from '../../utils/find-source-by-card-id.ts';
import { getEffectiveCardCost } from '../../utils/get-effective-card-cost.ts';
import { findSourceByLocationSpec } from '../../utils/find-source-by-location-spec.ts';
import { findCards } from '../../utils/find-cards.ts';
import { castArray, isNumber } from 'es-toolkit/compat';
import { ReactionManager } from '../reactions/reaction-manager.ts';
import { getDistanceToPlayer } from '../../shared/get-player-position-utils.ts';

export class GameActionController implements GameActionControllerInterface {
  constructor(
    private cardEffectFunctionMap: CardEffectFunctionMap,
    private match: Match,
    private cardLibrary: CardLibrary,
    private logManager: LogManager,
    private socketMap: Map<PlayerId, AppSocket>,
    private reactionManager: ReactionManager,
    private runGameActionDelegate: RunGameActionDelegate
  ) {
  }
  
  // todo change this probably to setOverrides when there are more overrides later?
  async modifyCost(args: ModifyActionCardArgs) {
    let targets: PlayerId[] = [];
    if (args.appliesTo === 'ALL') {
      targets = this.match.players.map(p => p.id);
    }
    
    cardDataOverrides.push({ targets, overrideEffect: args });
    
    const overrides = getCardOverrides(this.match, this.cardLibrary);
    
    for (const targetId of targets) {
      const playerOverrides = overrides?.[targetId];
      const socket = this.socketMap.get(targetId);
      socket?.emit('setCardDataOverrides', playerOverrides);
    }
  }
  
  async gainBuy(args: { count: number }) {
    console.log(`[gainBuy action] gaining ${args.count} buys`);
    this.match.playerBuys += args.count;
    console.log(`[gainBuy action] setting player guys to ${this.match.playerBuys}`);
  }
  
  async moveCard(args: { toPlayerId?: PlayerId, cardId: CardId, to: LocationSpec }) {
    const oldSource = findSourceByCardId(args.cardId, this.match, this.cardLibrary);
    oldSource.sourceStore.splice(oldSource.index, 1);
    
    switch (oldSource.storeKey) {
      case 'playerHands':
        this.reactionManager.registerLifecycleEvent('onLeaveHand', { playerId: args.toPlayerId!, cardId: args.cardId });
        break;
      case 'playArea':
        this.reactionManager.registerLifecycleEvent('onLeavePlay', { cardId: args.cardId });
    }
    
    args.to.location = castArray(args.to.location);
    
    const newSource = findSourceByLocationSpec({ spec: args.to, playerId: args.toPlayerId }, this.match);
    newSource.push(args.cardId);
    
    switch (args.to.location[0]) {
      case 'playerHands':
        this.reactionManager.registerLifecycleEvent('onEnterHand', { playerId: args.toPlayerId!, cardId: args.cardId });
        break;
    }
    
    console.log(`[moveCard action] moved ${this.cardLibrary.getCard(args.cardId)} from ${oldSource.storeKey} to ${args.to.location}`);
  }
  
  async gainAction(args: { count: number }) {
    console.log(`[gainAction action] gaining ${args.count} actions`);
    
    this.match.playerActions += args.count;
    
    console.log(`[gainAction action] setting player actions to ${args.count}`);
  }
  
  async gainCard(args: { playerId: PlayerId, cardId: CardId, to: LocationSpec }) {
    await this.moveCard({
      cardId: args.cardId,
      to: args.to,
      toPlayerId: args.playerId
    });
    
    this.match.stats.cardsGained[args.cardId] = {
      turnNumber: this.match.turnNumber,
      turnPlayerId: getCurrentPlayer(this.match).id,
      playedPlayerId: args.playerId
    };
    
    this.cardLibrary.getCard(args.cardId).owner = args.playerId;
    
    console.log(`[gainCard action] ${getPlayerById(this.match, args.playerId)} gained ${this.cardLibrary.getCard(args.cardId)}`);
    
    this.logManager.addLogEntry({
      root: true,
      playerId: args.playerId,
      cardId: args.cardId,
      type: 'gainCard'
    });
    
    const trigger = new ReactionTrigger({
      eventType: 'gainCard',
      cardId: args.cardId,
      playerId: args.playerId
    });
    
    await this.reactionManager.runTrigger({ trigger });
  }
  
  async newTurn() {
    this.logManager.addLogEntry({
      root: true,
      type: 'newTurn',
      turn: this.match.turnNumber,
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
        restrict,
        this.cardLibrary,
        playerId,
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
  
  async trashCard(args: { cardId: CardId, playerId: PlayerId }) {
    await this.moveCard({
      cardId: args.cardId,
      to: { location: 'trash' }
    });
    
    this.match.stats.trashedCards[args.cardId] = {
      turnNumber: this.match.turnNumber,
      playedPlayerId: args.playerId,
      turnPlayerId: getCurrentPlayer(this.match).id
    };
    
    console.log(`[trashCard action] trashed ${this.cardLibrary.getCard(args.cardId)}`);
    
    this.logManager.addLogEntry({
      root: true,
      playerId: args.playerId,
      cardId: args.cardId,
      type: 'trashCard'
    });
  }
  
  async buyCard(args: { cardId: CardId; playerId: PlayerId }) {
    const cardCost = getEffectiveCardCost(
      args.playerId,
      args.cardId,
      this.match,
      this.cardLibrary
    );
    
    this.match.playerTreasure -= cardCost;
    this.match.playerBuys--;
    
    await this.gainCard({
      playerId: args.playerId,
      cardId: args.cardId,
      to: { location: 'playerDiscards' }
    });
  }
  
  async revealCard(args: { cardId: CardId, playerId: PlayerId, moveToRevealed?: boolean }) {
    console.log(`[revealCard action] ${getPlayerById(this.match, args.playerId)} revealing ${this.cardLibrary.getCard(args.cardId)}`);
    
    if (args.moveToRevealed) {
      console.log(`[revealCard action] moving card to 'revealed' zone`);
      
      await this.moveCard({
        cardId: args.cardId,
        to: { location: 'revealed' }
      });
    }
    
    this.logManager.addLogEntry({
      root: true,
      type: 'revealCard',
      cardId: args.cardId,
      playerId: args.playerId,
    });
  }
  
  async checkForRemainingPlayerActions(): Promise<void> {
    const match = this.match;
    const currentPlayer = getCurrentPlayer(match);
    const turnPhase = getTurnPhase(match.turnPhaseIndex);
    
    console.log(`[checkForRemainingPlayerActions action] phase: ${turnPhase}, player: ${currentPlayer.name}`);
    
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
      const hasTreasure = match.playerHands[currentPlayer.id]
        .some(cardId => this.cardLibrary.getCard(cardId).type.includes('TREASURE'));
      const hasMoney = match.playerTreasure > 0;
      
      if ((!hasTreasure && !hasMoney) || !hasBuys) {
        console.log('[checkForRemainingPlayerActions action] skipping to next phase');
        await this.nextPhase();
      }
    }
  }
  
  
  async discardCard(args: { cardId: CardId, playerId: PlayerId }) {
    console.log(`[discardCard action] discarding ${this.cardLibrary.getCard(args.cardId)} from ${getPlayerById(this.match, args.playerId)}`);
    
    await this.moveCard({
      cardId: args.cardId,
      to: { location: 'playerDiscards' },
      toPlayerId: args.playerId
    });
    
    this.logManager.addLogEntry({
      root: true,
      type: 'discard',
      playerId: args.playerId,
      cardId: args.cardId,
    });
  }
  
  async nextPhase() {
    const match = this.match;
    
    match.turnPhaseIndex = match.turnPhaseIndex + 1;
    
    if (match.turnPhaseIndex >= TurnPhaseOrderValues.length) {
      match.turnPhaseIndex = 0;
    }
    
    const newPhase = getTurnPhase(match.turnPhaseIndex);
    const currentPlayer = getCurrentPlayer(match);
    
    console.log(`[nextPhase action] entering phase: ${newPhase} for turn ${match.turnNumber}`);
    
    switch (newPhase) {
      case 'action': {
        match.playerActions = 1;
        match.playerBuys = 1;
        match.playerTreasure = 0;
        match.currentPlayerTurnIndex++;
        
        if (match.currentPlayerTurnIndex >= match.players.length) {
          match.currentPlayerTurnIndex = 0;
          match.turnNumber++;
          
          console.log(`[nextPhase action] new round: ${match.turnNumber} (${match.turnNumber + 1})`);
          
          await this.endTurn();
        }
        
        this.logManager.addLogEntry({
          root: true,
          type: 'newPlayerTurn',
          turn: match.turnNumber,
          playerId: match.players[match.currentPlayerTurnIndex].id
        });
        
        const trigger = new ReactionTrigger({
          eventType: 'startTurn',
          playerId: match.players[match.currentPlayerTurnIndex].id
        });
        
        const reactionContext = {};
        await this.reactionManager.runTrigger({ trigger, reactionContext });
        
        break;
      }
      case 'buy':
        // no explicit behavior
        break;
      case 'cleanup': {
        const cardsToDiscard = match.playArea.concat(match.activeDurationCards, match.playerHands[currentPlayer.id]);
        
        for (const cardId of cardsToDiscard) {
          const card = this.cardLibrary.getCard(cardId);
          
          if (!card.type.includes('DURATION')) {
            await this.discardCard({ cardId, playerId: currentPlayer.id });
            continue;
          }
          
          // if the card is a duration card, and it was played this turn
          const stats = match.stats.playedCards?.[cardId];
          if (!stats) continue;
          
          const turnsPassed = getDistanceToPlayer({
            startPlayerId: stats.turnPlayerId,
            targetPlayerId: stats.playedPlayerId,
            match
          }) + (match.turnNumber - stats.turnNumber);
          
          const turnPlayer = getPlayerById(match, stats.turnPlayerId);
          const playedPlayer = getPlayerById(match, stats.playedPlayerId);
          
          console.log(`[nextPhase action] ${turnsPassed} turns passed since ${playedPlayer} played ${card} on ${turnPlayer}'s turn`);
          
          const shouldDiscard = (
            stats.playedPlayerId === currentPlayer.id &&
            turnsPassed > 0
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
          
          await this.drawCard({
            playerId: currentPlayer.id
          });
        }
        
        await this.endTurn();
        
        await this.nextPhase();
        break;
      }
    }
    
    await this.runGameActionDelegate('checkForRemainingPlayerActions');
  }
  
  async endTurn() {
    console.log('[endTurn action] removing overrides');
    removeOverrideEffects('TURN_END');
    
    const overrides = getCardOverrides(this.match, this.cardLibrary);
    
    for (const { id } of this.match.players) {
      const playerOverrides = overrides?.[id];
      const socket = this.socketMap.get(id);
      socket?.emit('setCardDataOverrides', playerOverrides);
    }
  }
  
  async gainTreasure(args: { count: number }) {
    console.log(`[gainTreasure action] gaining ${args.count} treasure`);
    this.match.playerTreasure += args.count;
  }
  
  // Single, focused implementation of drawCard
  async drawCard(args: { playerId: PlayerId }): Promise<CardId | null> {
    const { playerId } = args;
    
    const deck = this.match.playerDecks[playerId];
    const discard = this.match.playerDiscards[playerId];
    
    if (discard.length + deck.length === 0) {
      console.log('[drawCard action] Not enough cards to draw');
      return null;
    }
    
    // If deck is empty, shuffle discard into deck
    if (deck.length === 0) {
      console.log(`[drawCard action] Shuffling discard pile`);
      await this.shuffleDeck({ playerId });
    }
    
    const drawnCardId = deck.slice(-1)[0];
    if (!drawnCardId) return null;
    
    await this.moveCard({
      cardId: drawnCardId,
      toPlayerId: playerId,
      to: { location: 'playerHands' }
    });
    
    console.log(`[drawCard action] Drew card ${this.cardLibrary.getCard(drawnCardId)}`);
    
    this.logManager.addLogEntry({
      root: true,
      type: 'draw',
      playerId,
      cardId: drawnCardId
    });
    
    return drawnCardId;
  }
  
  async playCard(args: { playerId: PlayerId, cardId: CardId, overrides?: GameActionOverrides }): Promise<boolean> {
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
    
    this.match.stats.playedCards[cardId] = {
      turnNumber: this.match.turnNumber,
      playedPlayerId: playerId,
      turnPlayerId: getCurrentPlayer(this.match).id
    };
    
    console.log(`[playCard action] ${getPlayerById(this.match, playerId)} played card ${this.cardLibrary.getCard(cardId)}`);
    
    this.logManager.addLogEntry({
      type: 'cardPlayed',
      cardId,
      playerId,
      root: true,
    });
    
    // find any reactions for the cardPlayed event type
    const trigger = new ReactionTrigger({
      eventType: 'cardPlayed',
      playerId,
      cardId,
    });
    
    // handle reactions for the card played
    const reactionContext = {};
    await this.reactionManager.runTrigger({ trigger, reactionContext });
    
    // now add any triggered effects from the card played
    this.reactionManager.registerLifecycleEvent('onCardPlayed', { playerId: args.playerId, cardId: args.cardId });
    
    // run the effects of the card played, note passing in the reaction context collected from running the trigger
    // above - e.g., could provide immunity to an attack card played
    const effectFn = this.cardEffectFunctionMap[card.cardKey];
    if (effectFn) {
      await effectFn({
        reactionManager: this.reactionManager,
        runGameActionDelegate: this.runGameActionDelegate,
        cardId,
        gameActionController: this,
        playerId,
        match: this.match,
        cardLibrary: this.cardLibrary,
        reactionContext,
      });
    }
    
    return true;
  }
  
  // Helper method to shuffle a player's deck
  async shuffleDeck(args: { playerId: PlayerId }): Promise<void> {
    const { playerId } = args;
    
    console.log(`[shuffleDeck action] shuffling deck`);
    
    const deck = this.match.playerDecks[playerId];
    const discard = this.match.playerDiscards[playerId];
    
    fisherYatesShuffle(discard, true);
    deck.unshift(...discard);
    discard.length = 0;
    
    this.logManager.addLogEntry({
      root: true,
      type: 'shuffleDeck',
      playerId: args.playerId
    });
  }
}