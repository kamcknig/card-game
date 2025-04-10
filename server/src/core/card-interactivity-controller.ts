import { AppSocket, EffectGeneratorFn, GameEffectGenerator } from '../types.ts';
import { CardEffectController } from './card-effects-controller.ts';
import { Card, CardId, Match, Player, PlayerId, TurnPhaseOrderValues, } from 'shared/shared-types.ts';
import { isUndefined } from 'es-toolkit/compat';
import { getEffectiveCardCost } from '../utils/get-effective-card-cost.ts';
import { CardLibrary } from './card-library.ts';
import { MatchController } from './match-controller.ts';
import { getPlayerById } from '../utils/get-player-by-id.ts';

export class CardInteractivityController {
  private _gameOver: boolean = false;
  
  constructor(
    private readonly _cardEffectController: CardEffectController,
    private readonly match: Match,
    private readonly _socketMap: Map<PlayerId, AppSocket>,
    private readonly _cardLibrary: CardLibrary,
    private readonly _cardTapCompleteCallback: (
      card: Card,
      player: Player,
    ) => void,
    private readonly _matchController: MatchController,
    private readonly _effectGeneratorMap: Record<string, EffectGeneratorFn>,
  ) {
    this._socketMap.forEach((s) => {
      s.on('cardTapped', this.onCardTapped);
      s.on('playAllTreasure', this.onPlayAllTreasure);
    });
  }
  
  public playerAdded(socket: AppSocket | undefined) {
    socket?.on('cardTapped', this.onCardTapped);
    socket?.on('playAllTreasure', this.onPlayAllTreasure);
  }
  
  public playerRemoved(socket: AppSocket | undefined) {
    socket?.off('cardTapped', this.onCardTapped);
    socket?.off('playAllTreasure', this.onPlayAllTreasure);
  }
  
  public endGame() {
    console.log(
      `[CARD INTERACTIVITY] removing socket listeners and marking ended`,
    );
    this._socketMap.forEach((s) => {
      s.off('cardTapped');
      s.off('playAllTreasure');
    });
    this._gameOver = true;
  }
  
  public checkCardInteractivity(): void {
    if (this._gameOver) {
      console.log(
        `[CARD INTERACTIVITY] game is over, not processing match update`,
      );
      return;
    }
    
    const match = this.match;
    
    const prev = this._matchController.getMatchSnapshot();
    const currentPlayer = match.players[match.currentPlayerTurnIndex];
    const turnPhase = TurnPhaseOrderValues[match.turnPhaseIndex];
    
    console.log(
      `[CARD INTERACTIVITY] determining selectable cards - phase '${turnPhase}, player ${currentPlayer}', player Index '${match.currentPlayerTurnIndex}'`,
    );
    const selectableCards: number[] = [];
    
    const hand = match.playerHands[currentPlayer.id].map((id) =>
      this._cardLibrary.getCard(id)
    );
    
    if (turnPhase === 'buy') {
      const cardsAdded: string[] = [];
      const supply = match.supply.concat(match.kingdom).map((id) =>
        this._cardLibrary.getCard(id)
      );
      
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
        
        if (
          cardCost <= match.playerTreasure && match.playerBuys > 0
        ) {
          selectableCards.push(card.id);
          cardsAdded.push(card.cardKey);
        }
      }
      
      for (const card of hand) {
        if (card.type.includes('TREASURE')) {
          selectableCards.push(card.id);
        }
      }
    } else if (turnPhase === 'action') {
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
    
    console.log(`[CARD INTERACTIVITY] selectable cards`);
    
    for (const key of Object.keys(match.selectableCards)) {
      const tmp = match.selectableCards[+key]?.concat() ?? [];
      const p = getPlayerById(match, +key);
      console.log(`${p} can select ${tmp.length} cards`);
      if (tmp.length > 0) {
        console.log(`${p} can select ${
          tmp.map((c) => this._cardLibrary.getCard(c)).join(', ')
        }`);
      }
    }
    
    this._matchController.broadcastPatch(prev);
  }
  
  private onPlayAllTreasure = (playerId: number) => {
    console.log(
      '[CARD INTERACTIVITY] playing all treasures for current player',
    );
    
    if (this._gameOver) {
      console.log(`[CARD INTERACTIVITY] game is over, not playing treasures`);
      return;
    }
    
    const match = this.match;
    const player = getPlayerById(match, playerId);
    
    if (isUndefined(player)) {
      console.warn(`[CARD INTERACTIVITY] could not find current player`);
      return;
    }
    
    const hand = match.playerHands[player.id];
    const treasureCards = hand.filter((e) =>
      this._cardLibrary.getCard(e).type.includes('TREASURE')
    );
    console.log(
      `[CARD INTERACTIVITY] ${player} has ${treasureCards.length} treasure cards in hand`,
    );
    if (hand.length === 0 || treasureCards.length === 0) {
      return;
    }
    for (const cardId of treasureCards) {
      this.onCardTapped(player.id, cardId);
    }
    this._socketMap.get(playerId)?.emit('playAllTreasureComplete');
  };
  
  private onCardTapped = (triggerPlayerId: number, tappedCardId: number) => {
    const match = this.match;
    const player = match.players.find((player) =>
      player.id === triggerPlayerId
    );
    
    if (!player) {
      throw new Error('could not find player');
    }
    
    const card = this._cardLibrary.getCard(tappedCardId);
    
    console.log(`[CARD INTERACTIVITY] player ${player} tapped card ${card}`);
    
    if (this._gameOver) {
      console.log(`[CARD INTERACTIVITY] game is over, not processing card tap`);
      return;
    }
    
    const turnPhase = TurnPhaseOrderValues[match.turnPhaseIndex];
    
    // deno-lint-ignore no-this-alias
    const self = this; // ✅ for use inside generator
    const generator = function* (): GameEffectGenerator {
      if (turnPhase === 'action') {
        yield* self._effectGeneratorMap['playCard']({
          match,
          cardLibrary: self._cardLibrary,
          triggerPlayerId,
          triggerCardId: tappedCardId,
        });
      } else if (turnPhase === 'buy') {
        const hand = match.playerHands?.[triggerPlayerId];
        
        if (!hand) {
          console.warn(`[CARD INTERACTIVITY] no hand for player ${player}`);
          return;
        }
        
        const effect = hand.includes(tappedCardId) ? 'playCard' : 'buyCard';
        yield* self._effectGeneratorMap[effect]({
          match,
          cardLibrary: self._cardLibrary,
          triggerPlayerId,
          triggerCardId: tappedCardId,
        });
      }
      
      console.log(
        `[CARD INTERACTIVITY] card tapped handler complete ${card} for ${player}`,
      );
      self._cardTapCompleteCallback(card, player);
    };
    
    console.log(
      `[CARD INTERACTIVITY] card tapped handler complete ${card} for ${player}`,
    );
    
    this._cardEffectController.runGenerator(generator(), triggerPlayerId, tappedCardId);
  };
}
