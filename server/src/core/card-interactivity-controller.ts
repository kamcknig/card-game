import { AppSocket } from '../types.ts';
import { Card, CardId, Match, Player, PlayerId, TurnPhaseOrderValues, } from 'shared/shared-types.ts';
import { isUndefined } from 'es-toolkit/compat';
import { getEffectiveCardCost } from '../utils/get-effective-card-cost.ts';
import { CardLibrary } from './card-library.ts';
import { MatchController } from './match-controller.ts';
import { getPlayerById } from '../utils/get-player-by-id.ts';
import { GameActionController } from './effects/game-action-controller.ts';
import { getTurnPhase } from '../utils/get-turn-phase.ts';

export class CardInteractivityController {
  private _gameOver: boolean = false;
  
  constructor(
    private readonly gameActionsController: GameActionController,
    private readonly match: Match,
    private readonly _socketMap: Map<PlayerId, AppSocket>,
    private readonly _cardLibrary: CardLibrary,
    private readonly _cardTapCompleteCallback: (
      card: Card,
      player: Player,
    ) => void,
    private readonly _matchController: MatchController,
  ) {
    this._socketMap.forEach((s) => {
      s.on('cardTapped', (pId, cId) => this.onCardTapped(pId, cId));
      s.on('playAllTreasure', async (pId) => await this.onPlayAllTreasure(pId));
    });
  }
  
  public playerAdded(s: AppSocket | undefined) {
    s?.on('cardTapped', (pId, cId) => this.onCardTapped(pId, cId));
    s?.on('playAllTreasure', async (pId) => await this.onPlayAllTreasure(pId));
  }
  
  public playerRemoved(socket: AppSocket | undefined) {
    socket?.off('cardTapped');
    socket?.off('playAllTreasure');
  }
  
  public endGame() {
    console.log(`[card interactivity] removing socket listeners and marking ended`,);
    this._socketMap.forEach((s) => {
      s.off('cardTapped');
      s.off('playAllTreasure');
    });
    this._gameOver = true;
  }
  
  public checkCardInteractivity(): void {
    if (this._gameOver) {
      console.log(`[card interactivity] game is over, not processing match update`,);
      return;
    }
    
    const match = this.match;
    
    const currentPlayer = match.players[match.currentPlayerTurnIndex];
    const turnPhase = TurnPhaseOrderValues[match.turnPhaseIndex];
    
    console.log(`[card interactivity] determining selectable cards - phase '${turnPhase}, player ${currentPlayer}', player Index '${match.currentPlayerTurnIndex}'`);
    
    const selectableCards: number[] = [];
    
    const hand = match.playerHands[currentPlayer.id]
      .map((id) => this._cardLibrary.getCard(id));
    
    if (turnPhase === 'buy') {
      const cardsAdded: string[] = [];
      const supply = match.supply.concat(match.kingdom)
        .map((id) => this._cardLibrary.getCard(id));
      
      for (let i = supply.length - 1; i >= 0; i--) {
        const card = supply[i];
        if (cardsAdded.includes(card.cardKey)) {
          continue;
        }
        
        const cardCost = getEffectiveCardCost(
          currentPlayer.id,
          card.id,
          match,
          this._cardLibrary,
        );
        
        if (cardCost <= match.playerTreasure && match.playerBuys > 0) {
          selectableCards.push(card.id);
          cardsAdded.push(card.cardKey);
        }
      }
      
      for (const card of hand) {
        if (card.type.includes('TREASURE')) {
          selectableCards.push(card.id);
        }
      }
    }
    else if (turnPhase === 'action') {
      for (const card of hand) {
        if (card.type.includes('ACTION') && match.playerActions > 0) {
          selectableCards.push(card.id);
        }
      }
    }
    
    match.selectableCards = match.players.reduce((prev, { id }) => {
      prev[id] = id === currentPlayer.id ? selectableCards : [];
      return prev;
    }, {} as Record<PlayerId, CardId[]>);
    
    console.log(`[card interactivity] selectable cards`);
    
    for (const key of Object.keys(match.selectableCards)) {
      const tmp = match.selectableCards[+key]?.concat() ?? [];
      const p = getPlayerById(match, +key);
      console.log(`${p} can select ${tmp.length} cards`);
    }
  }
  
  private async onPlayAllTreasure(playerId: PlayerId) {
    console.log('[card interactivity] playing all treasures for current player');
    
    if (this._gameOver) {
      console.log(`[card interactivity] game is over, not playing treasures`);
      return;
    }
    
    const match = this.match;
    const player = getPlayerById(match, playerId);
    
    if (isUndefined(player)) {
      console.warn(`[card interactivity] could not find current player`);
      return;
    }
    
    const hand = match.playerHands[player.id];
    const treasureCards = hand.filter((e) =>
      this._cardLibrary.getCard(e).type.includes('TREASURE')
    );
    console.log(`[card interactivity] ${player} has ${treasureCards.length} treasure cards in hand`);
    if (hand.length === 0 || treasureCards.length === 0) {
      return;
    }
    
    for (const cardId of treasureCards) {
      await this._matchController.runGameAction('playCard', { playerId, cardId });
    }
    
    this._socketMap.get(playerId)?.emit('playAllTreasureComplete');
  };
  
  private async onCardTapped(playerId: PlayerId, cardId: CardId) {
    const player = getPlayerById(this.match, playerId)
    
    if (!player) {
      throw new Error('could not find player');
    }
    
    console.log(`[card interactivity] player ${player} tapped card ${this._cardLibrary.getCard(cardId)}`);
    
    if (this._gameOver) {
      console.log(`[card interactivity] game is over, not processing card tap`);
      return;
    }
    
    const phase = getTurnPhase(this.match.turnPhaseIndex);
    
    if (phase === 'buy') {
      const hand = this.match.playerHands[playerId];
      if (hand.includes(cardId)) {
        await this._matchController.runGameAction('playCard', { playerId, cardId });
      }
      else {
        await this._matchController.runGameAction('buyCard', { playerId, cardId });
      }
    }
    else if (phase === 'action') {
      await this._matchController.runGameAction('playCard', { playerId, cardId });
    }
    
    await this._matchController.runGameAction('checkForRemainingPlayerActions');
    
    this._socketMap.get(playerId)?.emit('cardTappedComplete', playerId, cardId);
  };
}
