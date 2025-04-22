import { CardId, Match, PlayerId, TurnPhaseOrderValues } from 'shared/shared-types.ts';
import { CardLibrary } from '../card-library.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';
import { LogManager } from '../log-manager.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { AppSocket, CardEffectFunctionMap } from '../../types.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCardOverrides, removeOverrideEffects } from '../../card-data-overrides.ts';
import { findSourceByCardId } from '../../utils/find-source-by-card-id.ts';

export type GameActions =
  | 'playCard'
  | 'gainTreasure'
  | 'nextPhase'
  | 'discardCard'
  | 'endTurn'
  | 'drawCard';

type GameActionMethodMap = {
  [K in GameActions]: GameActionController[K];
};

export class GameActionController {
  constructor(
    private cardEffectFunctionMap: CardEffectFunctionMap,
    private match: Match,
    private cardLibrary: CardLibrary,
    private logManager: LogManager,
    private socketMap: Map<PlayerId, AppSocket>,
  ) {
  }
  
  private emitActionComplete(playerId: PlayerId, cardId?: CardId) {
    if (!this.socketMap) return;
    this.socketMap.forEach(s => {
      s.emit('cardEffectsComplete', playerId, cardId);
    });
  }
  
  async discardCard(args: { cardId: CardId, playerId: PlayerId }) {
    /*if (effect.log) {
      logManager.addLogEntry({
        root: effect.isRootLog,
        type: 'discard',
        playerId: effect.playerId,
        cardId: effect.cardId,
      });
    }*/
    
    const oldSource = findSourceByCardId(args.cardId, this.match, this.cardLibrary);
    oldSource.sourceStore.splice(oldSource.index, 1);
  }
  
  async nextPhase(args: {}) {
    const match = this.match;
    
    match.turnPhaseIndex = match.turnPhaseIndex + 1;
    
    if (match.turnPhaseIndex >= TurnPhaseOrderValues.length) {
      match.turnPhaseIndex = 0;
    }
    
    const newPhase = getTurnPhase(match.turnPhaseIndex);
    const player = match.players[match.currentPlayerTurnIndex];
    
    console.log(`[NEXT PHASE EFFECT] entering phase: ${newPhase}`);
    
    switch (newPhase) {
      case 'action': {
        match.playerActions = 1;
        match.playerBuys = 1;
        match.playerTreasure = 0;
        match.currentPlayerTurnIndex++;
        
        if (match.currentPlayerTurnIndex >= match.players.length) {
          match.currentPlayerTurnIndex = 0;
          match.turnNumber++;
          
          console.log(`[NEXT PHASE EFFECT] new round: ${match.turnNumber} (${match.turnNumber + 1})`);
          
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
            const playedCardsInfo = match.stats.playedCardsInfo?.[card.id];
            
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
                const playerTurnPlayedId = match.stats.playedCardsInfo[card.id].turnPlayerId;
                const playedTurnPlayerIndex = match.players.findIndex(p => p.id === playerTurnPlayedId);
                
                if (playedTurnPlayerIndex !== match.currentPlayerTurnIndex) {
                  await this.discardCard({
                    cardId,
                    playerId: player.id,
                  });
                }
              }
            }
            
            console.log(`[NEXT PHASE EFFECT] ${card} is duration, leaving in play`);
            continue;
          }
          
          console.log(`[NEXT PHASE EFFECT] discarding ${this.cardLibrary.getCard(cardId)}...`);
          
          await this.discardCard({
            cardId,
            playerId: player.id
          });
        }
        
        for (let i = 0; i < 5; i++) {
          console.log(`[NEXT PHASE EFFECT] drawing card...`);
          
          await this.drawCard({
            playerId: player.id
          });
        }
        
        await this.endTurn();
        
        await this.nextPhase({});
        break;
      }
    }
    
    // todo
    // yield* map.checkForPlayerActions(undefined);
  }
  
  async endTurn() {
    removeOverrideEffects('TURN_END');
    
    const overrides = getCardOverrides(this.match, this.cardLibrary);
    
    for (const { id } of this.match.players) {
      const playerOverrides = overrides?.[id];
      const socket = this.socketMap.get(id);
      socket?.emit('setCardDataOverrides', playerOverrides);
    }
  }
  
  async gainTreasure(args: { count: number }) {
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
      root: false,
      type: 'draw',
      playerId,
      cardId: drawnCardId
    });
    
    // Add to hand
    this.match.playerHands[playerId].push(drawnCardId);
    
    return drawnCardId;
  }
  
  async playCard(args: { playerId: PlayerId, cardId: CardId }): Promise<boolean> {
    const { playerId, cardId } = args;
    
    console.log(`[playCard action] ${getPlayerById(this.match, playerId)} playing card ${this.cardLibrary.getCard(cardId)}`);
    
    // 1. Find the card in the player's hand
    const hand = this.match.playerHands[playerId];
    const cardIndex = hand.indexOf(cardId);
    
    if (cardIndex === -1) {
      console.log(`[playCard action] Card not found in player's hand`);
      return false;
    }
    
    // 2. Remove the card from hand
    hand.splice(cardIndex, 1);
    
    // 3. Put the card in the play area
    this.match.playArea.push(cardId);
    
    // 4. If it's an action card, reduce the player's action count
    const card = this.cardLibrary.getCard(cardId);
    
    if (card.type.includes('ACTION')) {
      console.log(`[playCard action] Reducing player's action count`);
      
      this.match.playerActions--;
    }
    
    // 5. Record the card play in match stats
    const turnNumber = this.match.turnNumber;
    
    this.match.stats.playedCardsInfo[cardId] = {
      turnNumber,
      playedPlayerId: playerId,
      turnPlayerId: getCurrentPlayer(this.match).id
    };
    
    const effectFn = this.cardEffectFunctionMap[card.cardKey];
    if (effectFn) {
      await effectFn({cardId, gameActionController: this, playerId, match: this.match});
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
    
    /*if (effect.log) {
     logManager.addLogEntry({
     root: effect.isRootLog,
     type: 'shuffleDeck',
     playerId: effect.playerId
     });
     }*/
  }
}