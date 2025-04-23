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
  GameActionOverrides,
  ModifyActionCardArgs,
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

export class GameActionController {
  constructor(
    private cardEffectFunctionMap: CardEffectFunctionMap,
    private match: Match,
    private cardLibrary: CardLibrary,
    private logManager: LogManager,
    private socketMap: Map<PlayerId, AppSocket>,
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
    
    args.to.location = castArray(args.to.location);
    
    const newSource = findSourceByLocationSpec({ spec: args.to, playerId: args.toPlayerId }, this.match);
    newSource.push(args.cardId);
    
    console.log(`[moveCard action] moving ${this.cardLibrary.getCard(args.cardId)} from ${oldSource.storeKey} to ${args.to.location}`);
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
    
    console.log(`[gainCard action] ${getPlayerById(this.match, args.playerId)} gained ${this.cardLibrary.getCard(args.cardId)}`);
    
    this.logManager.addLogEntry({
      root: true,
      playerId: args.playerId,
      cardId: args.cardId,
      type: 'gainCard'
    });
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
    
    // todo
    /*const trigger = new ReactionTrigger({
     cardId: args.cardId,
     playerId: args.playerId,
     eventType: 'gainCard'
     });
     
     yield* reactionManager.runTrigger({ trigger });*/
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
    const player = match.players[match.currentPlayerTurnIndex];
    
    console.log(`[nextPhase action] entering phase: ${newPhase}`);
    
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
        
        // TODO
        /*const trigger = new ReactionTrigger({
         eventType: 'startTurn',
         playerId: match.players[match.currentPlayerTurnIndex].id
         });
         
         const reactionContext = {};
         yield* reactionManager.runTrigger({ trigger, reactionContext });*/
        
        break;
      }
      case 'buy':
        // no explicit behavior
        break;
      case 'cleanup': {
        const cardsToDiscard = match.playArea.concat(match.playerHands[player.id]);
        
        for (const cardId of cardsToDiscard) {
          const card = this.cardLibrary.getCard(cardId);
          
          // if the card is a duration card, and it was played this turn
          if (card.type.includes('DURATION')) {
            const playedCardsInfo = match.stats.playedCards?.[card.id];
            
            if (!playedCardsInfo) continue;
            const turnPlayed = playedCardsInfo.turnNumber;
            
            // if cleaning up for the player that played the duration card
            if (playedCardsInfo.playedPlayerId === player.id) {
              // and the turn is different, it's time to discard
              if (turnPlayed !== match.turnNumber) {
                await this.discardCard({
                  cardId,
                  playerId: player.id
                });
              }
              else {
                // if it's the same turn number,
                const playerTurnPlayedId = match.stats.playedCards[card.id].turnPlayerId;
                const playedTurnPlayerIndex = match.players.findIndex(p => p.id === playerTurnPlayedId);
                
                if (playedTurnPlayerIndex !== match.currentPlayerTurnIndex) {
                  await this.discardCard({
                    cardId,
                    playerId: player.id,
                  });
                }
              }
            }
            
            console.log(`[nextPhase action] ${card} is duration, leaving in play`);
            continue;
          }
          
          console.log(`[nextPhase action] discarding ${this.cardLibrary.getCard(cardId)}...`);
          
          await this.discardCard({
            cardId,
            playerId: player.id
          });
        }
        
        for (let i = 0; i < 5; i++) {
          console.log(`[nextPhase action] drawing card...`);
          
          await this.drawCard({
            playerId: player.id
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
    
    const drawnCardId = deck.pop();
    if (!drawnCardId) return null;
    
    console.log(`[drawCard action] Drew card ${this.cardLibrary.getCard(drawnCardId)}`);
    
    this.logManager.addLogEntry({
      root: true,
      type: 'draw',
      playerId,
      cardId: drawnCardId
    });
    
    // Add to hand
    this.match.playerHands[playerId].push(drawnCardId);
    
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
    
    // todo reaction triggers
    // 6. run reactions for the card being played
    /*const trigger = new ReactionTrigger({
     eventType: 'cardPlayed',
     playerId,
     cardId,
     });
     
     const reactionContext = {};
     yield* reactionManager.runTrigger({ trigger, reactionContext });*/
    
    // todo check for triggered effects to register
    /*const card = cardLibrary.getCard(effect.cardId);
     const triggerTemplates = cardLifecycleMap[card.cardKey]
     ?.onCardPlayed?.({ playerId: effect.playerId, cardId: effect.cardId })?.registerTriggeredEvents;
     
     for (const trigger of triggerTemplates ?? []) {
     reactionManager.registerReactionTemplate(trigger);
     }*/
    // 7. run the cards effects
    const effectFn = this.cardEffectFunctionMap[card.cardKey];
    if (effectFn) {
      await effectFn({
        runGameActionDelegate: this.runGameActionDelegate,
        cardId,
        gameActionController: this,
        playerId,
        match: this.match,
        cardLibrary: this.cardLibrary,
        reactionContext: {},
        logManager: this.logManager,
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