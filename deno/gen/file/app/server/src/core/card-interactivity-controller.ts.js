import { TurnPhaseOrderValues } from 'shared/shared-types.ts';
import { isUndefined } from 'es-toolkit/compat';
import { getPlayerById } from '../utils/get-player-by-id.ts';
import { getTurnPhase } from '../utils/get-turn-phase.ts';
import { cardActionConditionMapFactory } from './actions/card-action-condition-map-factory.ts';
export class CardInteractivityController {
  _cardSourceController;
  _cardPriceController;
  match;
  _socketMap;
  _cardLibrary;
  runGameDelegate;
  _findCards;
  _gameOver;
  constructor(_cardSourceController, _cardPriceController, match, _socketMap, _cardLibrary, runGameDelegate, _findCards){
    this._cardSourceController = _cardSourceController;
    this._cardPriceController = _cardPriceController;
    this.match = match;
    this._socketMap = _socketMap;
    this._cardLibrary = _cardLibrary;
    this.runGameDelegate = runGameDelegate;
    this._findCards = _findCards;
    this._gameOver = false;
    this._socketMap.forEach((s)=>{
      s.on('cardTapped', (pId, cId)=>this.onCardTapped(pId, cId));
      s.on('cardLikeTapped', (pId, cId)=>this.onCardLikeTapped(pId, cId));
      s.on('playAllTreasure', async (pId)=>await this.onPlayAllTreasure(pId));
    });
  }
  playerAdded(s) {
    s?.on('cardTapped', (pId, cId)=>this.onCardTapped(pId, cId));
    s?.on('cardLikeTapped', (pId, cId)=>this.onCardLikeTapped(pId, cId));
    s?.on('playAllTreasure', async (pId)=>await this.onPlayAllTreasure(pId));
  }
  playerRemoved(socket) {
    socket?.off('cardTapped');
    socket?.off('cardLikeTapped');
    socket?.off('playAllTreasure');
  }
  endGame() {
    console.log(`[card interactivity] removing socket listeners and marking ended`);
    this._socketMap.forEach((s)=>{
      s.off('cardTapped');
      s.off('cardLikeTapped');
      s.off('playAllTreasure');
    });
    this._gameOver = true;
  }
  checkCardInteractivity() {
    if (this._gameOver) {
      console.log(`[card interactivity] game is over, not processing match update`);
      return;
    }
    const match = this.match;
    const currentPlayer = match.players[match.currentPlayerTurnIndex];
    const turnPhase = TurnPhaseOrderValues[match.turnPhaseIndex];
    console.log(`[card interactivity] determining selectable cards - phase '${turnPhase}, player ${currentPlayer}', player Index '${match.currentPlayerTurnIndex}'`);
    const selectableCards = [];
    const hand = this._cardSourceController.getSource('playerHand', currentPlayer.id).map((id)=>this._cardLibrary.getCard(id));
    if (turnPhase === 'buy' && match.playerBuys > 0) {
      const cardKeysAdded = [];
      const supply = this._findCards({
        location: [
          'basicSupply',
          'kingdomSupply'
        ]
      });
      // a loop going backwards through the supply and kingdom. we only mark the last one as selectable (this should
      // be the top of any pile). a bit hacky to assume that.
      for(let i = supply.length - 1; i >= 0; i--){
        const card = supply[i];
        // we already marked this type of card as selectable based on cost
        if (cardKeysAdded.includes(card.cardKey)) {
          continue;
        }
        if (cardActionConditionMapFactory[card.cardKey]?.canBuy) {
          if (!cardActionConditionMapFactory[card.cardKey].canBuy?.({
            match: this.match,
            cardLibrary: this._cardLibrary,
            playerId: currentPlayer.id
          })) {
            continue;
          }
        }
        const { restricted, cost } = this._cardPriceController.applyRules(card, {
          playerId: currentPlayer.id
        });
        // if the player has enough treasure and buys
        if (!restricted && cost.treasure <= match.playerTreasure && (cost.potion === undefined || cost.potion <= match.playerPotions)) {
          selectableCards.push(card.id);
          cardKeysAdded.push(card.cardKey);
        }
      }
      // loop over the player's hand; in the buy phase, one can play treasure as long as you haven't already
      // bought a card
      if (!Object.values(match.stats.cardsBought).concat(Object.values(match.stats.cardLikesBought)).some((stats)=>stats.playerId === currentPlayer.id && stats.turnNumber === match.turnNumber)) {
        for (const card of hand){
          if (card.type.includes('TREASURE')) {
            selectableCards.push(card.id);
          }
        }
      }
      const events = this.match.events;
      for (const event of events){
        const { restricted, cost } = this._cardPriceController.applyRules(event, {
          playerId: currentPlayer.id
        });
        if (!restricted && cost.treasure <= this.match.playerTreasure) {
          selectableCards.push(event.id);
        }
      }
    } else if (turnPhase === 'action') {
      for (const card of hand){
        if (card.type.includes('ACTION') && match.playerActions > 0) {
          selectableCards.push(card.id);
        }
      }
    }
    match.selectableCards = match.players.reduce((prev, { id })=>{
      prev[id] = id === currentPlayer.id ? selectableCards : [];
      return prev;
    }, {});
    console.log(`[card interactivity] selectable cards`);
    for (const key of Object.keys(match.selectableCards)){
      const tmp = match.selectableCards[+key]?.concat() ?? [];
      const p = getPlayerById(match, +key);
      console.log(`${p} can select ${tmp.length} cards`);
    }
  }
  async onPlayAllTreasure(playerId) {
    console.log('[card interactivity] playing all treasures for current player');
    if (this._gameOver) {
      console.log(`[card interactivity] game is over, not playing treasures`);
      return;
    }
    const player = getPlayerById(this.match, playerId);
    if (isUndefined(player)) {
      console.warn(`[card interactivity] could not find current player`);
      return;
    }
    const hand = this._cardSourceController.getSource('playerHand', player.id);
    const treasureCards = hand.filter((e)=>this._cardLibrary.getCard(e).type.includes('TREASURE'));
    console.log(`[card interactivity] ${player} has ${treasureCards.length} treasure cards in hand`);
    if (hand.length === 0 || treasureCards.length === 0) {
      return;
    }
    for (const cardId of treasureCards){
      await this.runGameDelegate('playCard', {
        playerId,
        cardId
      });
    }
    this._socketMap.get(playerId)?.emit('playAllTreasureComplete');
  }
  async onCardLikeTapped(playerId, cardId) {
    const player = getPlayerById(this.match, playerId);
    if (!player) {
      throw new Error('could not find player');
    }
    console.log(`[card interactivity] ${player} tapped card-like ${cardId}`);
    if (this._gameOver) {
      console.log(`[card interactivity] game is over, not processing card-like tap`);
      return;
    }
    const phase = getTurnPhase(this.match.turnPhaseIndex);
    if (phase === 'buy') {
      console.log(`[card interactivity] ${player} tapped card-like ${cardId} in phase ${phase}, processing`);
      await this.runGameDelegate('buyCardLike', {
        playerId,
        cardLikeId: cardId
      });
    } else {
      console.log(`[card interactivity] ${player} tapped card-like ${cardId} in phase ${phase}, not processing`);
    }
    await this.runGameDelegate('checkForRemainingPlayerActions');
    this._socketMap.get(playerId)?.emit('cardTappedComplete', playerId, cardId);
  }
  async onCardTapped(playerId, cardId) {
    const player = getPlayerById(this.match, playerId);
    if (!player) {
      throw new Error('could not find player');
    }
    console.log(`[card interactivity] pl${player} tapped card ${this._cardLibrary.getCard(cardId)}`);
    if (this._gameOver) {
      console.log(`[card interactivity] game is over, not processing card tap`);
      return;
    }
    const phase = getTurnPhase(this.match.turnPhaseIndex);
    if (phase === 'buy') {
      let overpay = {
        inTreasure: 0,
        inCoffer: 0
      };
      const hand = this._cardSourceController.getSource('playerHand', playerId);
      if (hand.includes(cardId)) {
        await this.runGameDelegate('playCard', {
          playerId,
          cardId
        });
      } else {
        const card = this._cardLibrary.getCard(cardId);
        const { cost } = this._cardPriceController.applyRules(card, {
          playerId
        });
        if (card.tags?.includes('overpay')) {
          if (this.match.playerTreasure > cost.treasure) {
            const result = await this.runGameDelegate('userPrompt', {
              prompt: 'Overpay?',
              actionButtons: [
                {
                  label: 'DONE',
                  action: 1
                }
              ],
              playerId: playerId,
              content: {
                type: 'overpay',
                cost: cost.treasure
              }
            });
            overpay = result.result;
          }
        }
        await this.runGameDelegate('buyCard', {
          playerId,
          cardId,
          overpay,
          cardCost: cost
        });
      }
    } else if (phase === 'action') {
      await this.runGameDelegate('playCard', {
        playerId,
        cardId
      });
    }
    await this.runGameDelegate('checkForRemainingPlayerActions');
    this._socketMap.get(playerId)?.emit('cardTappedComplete', playerId, cardId);
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvY29yZS9jYXJkLWludGVyYWN0aXZpdHktY29udHJvbGxlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHBTb2NrZXQsIEZpbmRDYXJkc0ZuLCBSdW5HYW1lQWN0aW9uRGVsZWdhdGUgfSBmcm9tICcuLi90eXBlcy50cyc7XG5pbXBvcnQge1xuICBDYXJkLFxuICBDYXJkSWQsXG4gIENhcmRMaWtlLFxuICBDYXJkTGlrZUlkLFxuICBDYXJkU3RhdHMsXG4gIE1hdGNoLFxuICBQbGF5ZXJJZCxcbiAgVHVyblBoYXNlT3JkZXJWYWx1ZXMsXG59IGZyb20gJ3NoYXJlZC9zaGFyZWQtdHlwZXMudHMnO1xuaW1wb3J0IHsgaXNVbmRlZmluZWQgfSBmcm9tICdlcy10b29sa2l0L2NvbXBhdCc7XG5pbXBvcnQgeyBNYXRjaENhcmRMaWJyYXJ5IH0gZnJvbSAnLi9tYXRjaC1jYXJkLWxpYnJhcnkudHMnO1xuaW1wb3J0IHsgZ2V0UGxheWVyQnlJZCB9IGZyb20gJy4uL3V0aWxzL2dldC1wbGF5ZXItYnktaWQudHMnO1xuaW1wb3J0IHsgZ2V0VHVyblBoYXNlIH0gZnJvbSAnLi4vdXRpbHMvZ2V0LXR1cm4tcGhhc2UudHMnO1xuaW1wb3J0IHsgQ2FyZFByaWNlUnVsZXNDb250cm9sbGVyIH0gZnJvbSAnLi9jYXJkLXByaWNlLXJ1bGVzLWNvbnRyb2xsZXIudHMnO1xuaW1wb3J0IHsgY2FyZEFjdGlvbkNvbmRpdGlvbk1hcEZhY3RvcnkgfSBmcm9tICcuL2FjdGlvbnMvY2FyZC1hY3Rpb24tY29uZGl0aW9uLW1hcC1mYWN0b3J5LnRzJztcbmltcG9ydCB7IENhcmRTb3VyY2VDb250cm9sbGVyIH0gZnJvbSAnLi9jYXJkLXNvdXJjZS1jb250cm9sbGVyLnRzJztcblxuZXhwb3J0IGNsYXNzIENhcmRJbnRlcmFjdGl2aXR5Q29udHJvbGxlciB7XG4gIHByaXZhdGUgX2dhbWVPdmVyOiBib29sZWFuID0gZmFsc2U7XG4gIFxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9jYXJkU291cmNlQ29udHJvbGxlcjogQ2FyZFNvdXJjZUNvbnRyb2xsZXIsXG4gICAgcHJpdmF0ZSByZWFkb25seSBfY2FyZFByaWNlQ29udHJvbGxlcjogQ2FyZFByaWNlUnVsZXNDb250cm9sbGVyLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgbWF0Y2g6IE1hdGNoLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgX3NvY2tldE1hcDogTWFwPFBsYXllcklkLCBBcHBTb2NrZXQ+LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgX2NhcmRMaWJyYXJ5OiBNYXRjaENhcmRMaWJyYXJ5LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcnVuR2FtZURlbGVnYXRlOiBSdW5HYW1lQWN0aW9uRGVsZWdhdGUsXG4gICAgcHJpdmF0ZSByZWFkb25seSBfZmluZENhcmRzOiBGaW5kQ2FyZHNGblxuICApIHtcbiAgICB0aGlzLl9zb2NrZXRNYXAuZm9yRWFjaCgocykgPT4ge1xuICAgICAgcy5vbignY2FyZFRhcHBlZCcsIChwSWQsIGNJZCkgPT4gdGhpcy5vbkNhcmRUYXBwZWQocElkLCBjSWQpKTtcbiAgICAgIHMub24oJ2NhcmRMaWtlVGFwcGVkJywgKHBJZCwgY0lkKSA9PiB0aGlzLm9uQ2FyZExpa2VUYXBwZWQocElkLCBjSWQpKTtcbiAgICAgIHMub24oJ3BsYXlBbGxUcmVhc3VyZScsIGFzeW5jIChwSWQpID0+IGF3YWl0IHRoaXMub25QbGF5QWxsVHJlYXN1cmUocElkKSk7XG4gICAgfSk7XG4gIH1cbiAgXG4gIHB1YmxpYyBwbGF5ZXJBZGRlZChzOiBBcHBTb2NrZXQgfCB1bmRlZmluZWQpIHtcbiAgICBzPy5vbignY2FyZFRhcHBlZCcsIChwSWQsIGNJZCkgPT4gdGhpcy5vbkNhcmRUYXBwZWQocElkLCBjSWQpKTtcbiAgICBzPy5vbignY2FyZExpa2VUYXBwZWQnLCAocElkLCBjSWQpID0+IHRoaXMub25DYXJkTGlrZVRhcHBlZChwSWQsIGNJZCkpO1xuICAgIHM/Lm9uKCdwbGF5QWxsVHJlYXN1cmUnLCBhc3luYyAocElkKSA9PiBhd2FpdCB0aGlzLm9uUGxheUFsbFRyZWFzdXJlKHBJZCkpO1xuICB9XG4gIFxuICBwdWJsaWMgcGxheWVyUmVtb3ZlZChzb2NrZXQ6IEFwcFNvY2tldCB8IHVuZGVmaW5lZCkge1xuICAgIHNvY2tldD8ub2ZmKCdjYXJkVGFwcGVkJyk7XG4gICAgc29ja2V0Py5vZmYoJ2NhcmRMaWtlVGFwcGVkJyk7XG4gICAgc29ja2V0Py5vZmYoJ3BsYXlBbGxUcmVhc3VyZScpO1xuICB9XG4gIFxuICBwdWJsaWMgZW5kR2FtZSgpIHtcbiAgICBjb25zb2xlLmxvZyhgW2NhcmQgaW50ZXJhY3Rpdml0eV0gcmVtb3Zpbmcgc29ja2V0IGxpc3RlbmVycyBhbmQgbWFya2luZyBlbmRlZGAsKTtcbiAgICB0aGlzLl9zb2NrZXRNYXAuZm9yRWFjaCgocykgPT4ge1xuICAgICAgcy5vZmYoJ2NhcmRUYXBwZWQnKTtcbiAgICAgIHMub2ZmKCdjYXJkTGlrZVRhcHBlZCcpO1xuICAgICAgcy5vZmYoJ3BsYXlBbGxUcmVhc3VyZScpO1xuICAgIH0pO1xuICAgIHRoaXMuX2dhbWVPdmVyID0gdHJ1ZTtcbiAgfVxuICBcbiAgcHVibGljIGNoZWNrQ2FyZEludGVyYWN0aXZpdHkoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2dhbWVPdmVyKSB7XG4gICAgICBjb25zb2xlLmxvZyhgW2NhcmQgaW50ZXJhY3Rpdml0eV0gZ2FtZSBpcyBvdmVyLCBub3QgcHJvY2Vzc2luZyBtYXRjaCB1cGRhdGVgLCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IG1hdGNoID0gdGhpcy5tYXRjaDtcbiAgICBcbiAgICBjb25zdCBjdXJyZW50UGxheWVyID0gbWF0Y2gucGxheWVyc1ttYXRjaC5jdXJyZW50UGxheWVyVHVybkluZGV4XTtcbiAgICBjb25zdCB0dXJuUGhhc2UgPSBUdXJuUGhhc2VPcmRlclZhbHVlc1ttYXRjaC50dXJuUGhhc2VJbmRleF07XG4gICAgXG4gICAgY29uc29sZS5sb2coYFtjYXJkIGludGVyYWN0aXZpdHldIGRldGVybWluaW5nIHNlbGVjdGFibGUgY2FyZHMgLSBwaGFzZSAnJHt0dXJuUGhhc2V9LCBwbGF5ZXIgJHtjdXJyZW50UGxheWVyfScsIHBsYXllciBJbmRleCAnJHttYXRjaC5jdXJyZW50UGxheWVyVHVybkluZGV4fSdgKTtcbiAgICBcbiAgICBjb25zdCBzZWxlY3RhYmxlQ2FyZHM6IG51bWJlcltdID0gW107XG4gICAgXG4gICAgY29uc3QgaGFuZCA9IHRoaXMuX2NhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGN1cnJlbnRQbGF5ZXIuaWQpXG4gICAgICAubWFwKChpZCkgPT4gdGhpcy5fY2FyZExpYnJhcnkuZ2V0Q2FyZChpZCkpO1xuICAgIFxuICAgIGlmICh0dXJuUGhhc2UgPT09ICdidXknICYmIG1hdGNoLnBsYXllckJ1eXMgPiAwKSB7XG4gICAgICBjb25zdCBjYXJkS2V5c0FkZGVkOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgXG4gICAgICBjb25zdCBzdXBwbHk6IENhcmRMaWtlW10gPSB0aGlzLl9maW5kQ2FyZHMoeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSk7XG4gICAgICBcbiAgICAgIC8vIGEgbG9vcCBnb2luZyBiYWNrd2FyZHMgdGhyb3VnaCB0aGUgc3VwcGx5IGFuZCBraW5nZG9tLiB3ZSBvbmx5IG1hcmsgdGhlIGxhc3Qgb25lIGFzIHNlbGVjdGFibGUgKHRoaXMgc2hvdWxkXG4gICAgICAvLyBiZSB0aGUgdG9wIG9mIGFueSBwaWxlKS4gYSBiaXQgaGFja3kgdG8gYXNzdW1lIHRoYXQuXG4gICAgICBmb3IgKGxldCBpID0gc3VwcGx5Lmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGNvbnN0IGNhcmQgPSBzdXBwbHlbaV07XG4gICAgICAgIC8vIHdlIGFscmVhZHkgbWFya2VkIHRoaXMgdHlwZSBvZiBjYXJkIGFzIHNlbGVjdGFibGUgYmFzZWQgb24gY29zdFxuICAgICAgICBpZiAoY2FyZEtleXNBZGRlZC5pbmNsdWRlcyhjYXJkLmNhcmRLZXkpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkQWN0aW9uQ29uZGl0aW9uTWFwRmFjdG9yeVtjYXJkLmNhcmRLZXldPy5jYW5CdXkpIHtcbiAgICAgICAgICBpZiAoIWNhcmRBY3Rpb25Db25kaXRpb25NYXBGYWN0b3J5W2NhcmQuY2FyZEtleV0uY2FuQnV5Py4oe1xuICAgICAgICAgICAgbWF0Y2g6IHRoaXMubWF0Y2gsXG4gICAgICAgICAgICBjYXJkTGlicmFyeTogdGhpcy5fY2FyZExpYnJhcnksXG4gICAgICAgICAgICBwbGF5ZXJJZDogY3VycmVudFBsYXllci5pZFxuICAgICAgICAgIH0pKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHsgcmVzdHJpY3RlZCwgY29zdCB9ID0gdGhpcy5fY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmQgYXMgQ2FyZCwge1xuICAgICAgICAgIHBsYXllcklkOiBjdXJyZW50UGxheWVyLmlkXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgLy8gaWYgdGhlIHBsYXllciBoYXMgZW5vdWdoIHRyZWFzdXJlIGFuZCBidXlzXG4gICAgICAgIGlmIChcbiAgICAgICAgICAhcmVzdHJpY3RlZCAmJlxuICAgICAgICAgIGNvc3QudHJlYXN1cmUgPD0gbWF0Y2gucGxheWVyVHJlYXN1cmUgJiZcbiAgICAgICAgICAoY29zdC5wb3Rpb24gPT09IHVuZGVmaW5lZCB8fCBjb3N0LnBvdGlvbiA8PSBtYXRjaC5wbGF5ZXJQb3Rpb25zKVxuICAgICAgICApIHtcbiAgICAgICAgICBzZWxlY3RhYmxlQ2FyZHMucHVzaChjYXJkLmlkKTtcbiAgICAgICAgICBjYXJkS2V5c0FkZGVkLnB1c2goY2FyZC5jYXJkS2V5KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBsb29wIG92ZXIgdGhlIHBsYXllcidzIGhhbmQ7IGluIHRoZSBidXkgcGhhc2UsIG9uZSBjYW4gcGxheSB0cmVhc3VyZSBhcyBsb25nIGFzIHlvdSBoYXZlbid0IGFscmVhZHlcbiAgICAgIC8vIGJvdWdodCBhIGNhcmRcbiAgICAgIGlmICghT2JqZWN0LnZhbHVlczxDYXJkU3RhdHM+KG1hdGNoLnN0YXRzLmNhcmRzQm91Z2h0KS5jb25jYXQoT2JqZWN0LnZhbHVlcyhtYXRjaC5zdGF0cy5jYXJkTGlrZXNCb3VnaHQpKVxuICAgICAgICAuc29tZShzdGF0cyA9PiBzdGF0cy5wbGF5ZXJJZCA9PT0gY3VycmVudFBsYXllci5pZCAmJiBzdGF0cy50dXJuTnVtYmVyID09PSBtYXRjaC50dXJuTnVtYmVyKSkge1xuICAgICAgICBmb3IgKGNvbnN0IGNhcmQgb2YgaGFuZCkge1xuICAgICAgICAgIGlmIChjYXJkLnR5cGUuaW5jbHVkZXMoJ1RSRUFTVVJFJykpIHtcbiAgICAgICAgICAgIHNlbGVjdGFibGVDYXJkcy5wdXNoKGNhcmQuaWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBldmVudHMgPSB0aGlzLm1hdGNoLmV2ZW50cztcbiAgICAgIGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKSB7XG4gICAgICAgIGNvbnN0IHsgcmVzdHJpY3RlZCwgY29zdCB9ID0gdGhpcy5fY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGV2ZW50LCB7XG4gICAgICAgICAgcGxheWVySWQ6IGN1cnJlbnRQbGF5ZXIuaWRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXJlc3RyaWN0ZWQgJiYgY29zdC50cmVhc3VyZSA8PSB0aGlzLm1hdGNoLnBsYXllclRyZWFzdXJlKSB7XG4gICAgICAgICAgc2VsZWN0YWJsZUNhcmRzLnB1c2goZXZlbnQuaWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKHR1cm5QaGFzZSA9PT0gJ2FjdGlvbicpIHtcbiAgICAgIGZvciAoY29uc3QgY2FyZCBvZiBoYW5kKSB7XG4gICAgICAgIGlmIChjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpICYmIG1hdGNoLnBsYXllckFjdGlvbnMgPiAwKSB7XG4gICAgICAgICAgc2VsZWN0YWJsZUNhcmRzLnB1c2goY2FyZC5pZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgbWF0Y2guc2VsZWN0YWJsZUNhcmRzID0gbWF0Y2gucGxheWVycy5yZWR1Y2UoKHByZXYsIHsgaWQgfSkgPT4ge1xuICAgICAgcHJldltpZF0gPSBpZCA9PT0gY3VycmVudFBsYXllci5pZCA/IHNlbGVjdGFibGVDYXJkcyA6IFtdO1xuICAgICAgcmV0dXJuIHByZXY7XG4gICAgfSwge30gYXMgUmVjb3JkPFBsYXllcklkLCBDYXJkSWRbXT4pO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbY2FyZCBpbnRlcmFjdGl2aXR5XSBzZWxlY3RhYmxlIGNhcmRzYCk7XG4gICAgXG4gICAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMobWF0Y2guc2VsZWN0YWJsZUNhcmRzKSkge1xuICAgICAgY29uc3QgdG1wID0gbWF0Y2guc2VsZWN0YWJsZUNhcmRzWytrZXldPy5jb25jYXQoKSA/PyBbXTtcbiAgICAgIGNvbnN0IHAgPSBnZXRQbGF5ZXJCeUlkKG1hdGNoLCAra2V5KTtcbiAgICAgIGNvbnNvbGUubG9nKGAke3B9IGNhbiBzZWxlY3QgJHt0bXAubGVuZ3RofSBjYXJkc2ApO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBvblBsYXlBbGxUcmVhc3VyZShwbGF5ZXJJZDogUGxheWVySWQpIHtcbiAgICBjb25zb2xlLmxvZygnW2NhcmQgaW50ZXJhY3Rpdml0eV0gcGxheWluZyBhbGwgdHJlYXN1cmVzIGZvciBjdXJyZW50IHBsYXllcicpO1xuICAgIFxuICAgIGlmICh0aGlzLl9nYW1lT3Zlcikge1xuICAgICAgY29uc29sZS5sb2coYFtjYXJkIGludGVyYWN0aXZpdHldIGdhbWUgaXMgb3Zlciwgbm90IHBsYXlpbmcgdHJlYXN1cmVzYCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcGxheWVyID0gZ2V0UGxheWVyQnlJZCh0aGlzLm1hdGNoLCBwbGF5ZXJJZCk7XG4gICAgXG4gICAgaWYgKGlzVW5kZWZpbmVkKHBsYXllcikpIHtcbiAgICAgIGNvbnNvbGUud2FybihgW2NhcmQgaW50ZXJhY3Rpdml0eV0gY291bGQgbm90IGZpbmQgY3VycmVudCBwbGF5ZXJgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgaGFuZCA9IHRoaXMuX2NhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllci5pZCk7XG4gICAgY29uc3QgdHJlYXN1cmVDYXJkcyA9IGhhbmQuZmlsdGVyKChlKSA9PlxuICAgICAgdGhpcy5fY2FyZExpYnJhcnkuZ2V0Q2FyZChlKS50eXBlLmluY2x1ZGVzKCdUUkVBU1VSRScpXG4gICAgKTtcbiAgICBjb25zb2xlLmxvZyhgW2NhcmQgaW50ZXJhY3Rpdml0eV0gJHtwbGF5ZXJ9IGhhcyAke3RyZWFzdXJlQ2FyZHMubGVuZ3RofSB0cmVhc3VyZSBjYXJkcyBpbiBoYW5kYCk7XG4gICAgaWYgKGhhbmQubGVuZ3RoID09PSAwIHx8IHRyZWFzdXJlQ2FyZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGZvciAoY29uc3QgY2FyZElkIG9mIHRyZWFzdXJlQ2FyZHMpIHtcbiAgICAgIGF3YWl0IHRoaXMucnVuR2FtZURlbGVnYXRlKCdwbGF5Q2FyZCcsIHsgcGxheWVySWQsIGNhcmRJZCB9KTtcbiAgICB9XG4gICAgXG4gICAgdGhpcy5fc29ja2V0TWFwLmdldChwbGF5ZXJJZCk/LmVtaXQoJ3BsYXlBbGxUcmVhc3VyZUNvbXBsZXRlJyk7XG4gIH07XG4gIFxuICBwcml2YXRlIGFzeW5jIG9uQ2FyZExpa2VUYXBwZWQocGxheWVySWQ6IFBsYXllcklkLCBjYXJkSWQ6IENhcmRMaWtlSWQpIHtcbiAgICBjb25zdCBwbGF5ZXIgPSBnZXRQbGF5ZXJCeUlkKHRoaXMubWF0Y2gsIHBsYXllcklkKVxuICAgIFxuICAgIGlmICghcGxheWVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvdWxkIG5vdCBmaW5kIHBsYXllcicpO1xuICAgIH1cbiAgICBcbiAgICBjb25zb2xlLmxvZyhgW2NhcmQgaW50ZXJhY3Rpdml0eV0gJHtwbGF5ZXJ9IHRhcHBlZCBjYXJkLWxpa2UgJHtjYXJkSWR9YCk7XG4gICAgXG4gICAgaWYgKHRoaXMuX2dhbWVPdmVyKSB7XG4gICAgICBjb25zb2xlLmxvZyhgW2NhcmQgaW50ZXJhY3Rpdml0eV0gZ2FtZSBpcyBvdmVyLCBub3QgcHJvY2Vzc2luZyBjYXJkLWxpa2UgdGFwYCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHBoYXNlID0gZ2V0VHVyblBoYXNlKHRoaXMubWF0Y2gudHVyblBoYXNlSW5kZXgpO1xuICAgIFxuICAgIGlmIChwaGFzZSA9PT0gJ2J1eScpIHtcbiAgICAgIGNvbnNvbGUubG9nKGBbY2FyZCBpbnRlcmFjdGl2aXR5XSAke3BsYXllcn0gdGFwcGVkIGNhcmQtbGlrZSAke2NhcmRJZH0gaW4gcGhhc2UgJHtwaGFzZX0sIHByb2Nlc3NpbmdgKTtcbiAgICAgIGF3YWl0IHRoaXMucnVuR2FtZURlbGVnYXRlKCdidXlDYXJkTGlrZScsIHsgcGxheWVySWQsIGNhcmRMaWtlSWQ6IGNhcmRJZCB9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZyhgW2NhcmQgaW50ZXJhY3Rpdml0eV0gJHtwbGF5ZXJ9IHRhcHBlZCBjYXJkLWxpa2UgJHtjYXJkSWR9IGluIHBoYXNlICR7cGhhc2V9LCBub3QgcHJvY2Vzc2luZ2ApO1xuICAgIH1cbiAgICBcbiAgICBhd2FpdCB0aGlzLnJ1bkdhbWVEZWxlZ2F0ZSgnY2hlY2tGb3JSZW1haW5pbmdQbGF5ZXJBY3Rpb25zJyk7XG4gICAgXG4gICAgdGhpcy5fc29ja2V0TWFwLmdldChwbGF5ZXJJZCk/LmVtaXQoJ2NhcmRUYXBwZWRDb21wbGV0ZScsIHBsYXllcklkLCBjYXJkSWQpO1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIG9uQ2FyZFRhcHBlZChwbGF5ZXJJZDogUGxheWVySWQsIGNhcmRJZDogQ2FyZElkKSB7XG4gICAgY29uc3QgcGxheWVyID0gZ2V0UGxheWVyQnlJZCh0aGlzLm1hdGNoLCBwbGF5ZXJJZClcbiAgICBcbiAgICBpZiAoIXBsYXllcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb3VsZCBub3QgZmluZCBwbGF5ZXInKTtcbiAgICB9XG4gICAgXG4gICAgY29uc29sZS5sb2coYFtjYXJkIGludGVyYWN0aXZpdHldIHBsJHtwbGF5ZXJ9IHRhcHBlZCBjYXJkICR7dGhpcy5fY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfWApO1xuICAgIFxuICAgIGlmICh0aGlzLl9nYW1lT3Zlcikge1xuICAgICAgY29uc29sZS5sb2coYFtjYXJkIGludGVyYWN0aXZpdHldIGdhbWUgaXMgb3Zlciwgbm90IHByb2Nlc3NpbmcgY2FyZCB0YXBgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgcGhhc2UgPSBnZXRUdXJuUGhhc2UodGhpcy5tYXRjaC50dXJuUGhhc2VJbmRleCk7XG4gICAgXG4gICAgaWYgKHBoYXNlID09PSAnYnV5Jykge1xuICAgICAgbGV0IG92ZXJwYXkgPSB7IGluVHJlYXN1cmU6IDAsIGluQ29mZmVyOiAwIH07XG4gICAgICBcbiAgICAgIGNvbnN0IGhhbmQgPSB0aGlzLl9jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGlmIChoYW5kLmluY2x1ZGVzKGNhcmRJZCkpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5ydW5HYW1lRGVsZWdhdGUoJ3BsYXlDYXJkJywgeyBwbGF5ZXJJZCwgY2FyZElkIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnN0IGNhcmQgPSB0aGlzLl9jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgIGNvbnN0IHsgY29zdCB9ID0gdGhpcy5fY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmQsIHtcbiAgICAgICAgICBwbGF5ZXJJZFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkLnRhZ3M/LmluY2x1ZGVzKCdvdmVycGF5JykpIHtcbiAgICAgICAgICBpZiAodGhpcy5tYXRjaC5wbGF5ZXJUcmVhc3VyZSA+IGNvc3QudHJlYXN1cmUpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucnVuR2FtZURlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgICAgICBwcm9tcHQ6ICdPdmVycGF5PycsXG4gICAgICAgICAgICAgIGFjdGlvbkJ1dHRvbnM6IFt7IGxhYmVsOiAnRE9ORScsIGFjdGlvbjogMSB9XSxcbiAgICAgICAgICAgICAgcGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICAgICAgICBjb250ZW50OiB7IHR5cGU6ICdvdmVycGF5JywgY29zdDogY29zdC50cmVhc3VyZSB9XG4gICAgICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IHsgaW5UcmVhc3VyZTogbnVtYmVyOyBpbkNvZmZlcjogbnVtYmVyOyB9IH07XG4gICAgICAgICAgICBvdmVycGF5ID0gcmVzdWx0LnJlc3VsdDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHRoaXMucnVuR2FtZURlbGVnYXRlKCdidXlDYXJkJywgeyBwbGF5ZXJJZCwgY2FyZElkLCBvdmVycGF5LCBjYXJkQ29zdDogY29zdCB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAocGhhc2UgPT09ICdhY3Rpb24nKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bkdhbWVEZWxlZ2F0ZSgncGxheUNhcmQnLCB7IHBsYXllcklkLCBjYXJkSWQgfSk7XG4gICAgfVxuICAgIFxuICAgIGF3YWl0IHRoaXMucnVuR2FtZURlbGVnYXRlKCdjaGVja0ZvclJlbWFpbmluZ1BsYXllckFjdGlvbnMnKTtcbiAgICBcbiAgICB0aGlzLl9zb2NrZXRNYXAuZ2V0KHBsYXllcklkKT8uZW1pdCgnY2FyZFRhcHBlZENvbXBsZXRlJywgcGxheWVySWQsIGNhcmRJZCk7XG4gIH07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsU0FRRSxvQkFBb0IsUUFDZix5QkFBeUI7QUFDaEMsU0FBUyxXQUFXLFFBQVEsb0JBQW9CO0FBRWhELFNBQVMsYUFBYSxRQUFRLCtCQUErQjtBQUM3RCxTQUFTLFlBQVksUUFBUSw2QkFBNkI7QUFFMUQsU0FBUyw2QkFBNkIsUUFBUSxpREFBaUQ7QUFHL0YsT0FBTyxNQUFNOzs7Ozs7OztFQUNILFVBQTJCO0VBRW5DLFlBQ0UsQUFBaUIscUJBQTJDLEVBQzVELEFBQWlCLG9CQUE4QyxFQUMvRCxBQUFpQixLQUFZLEVBQzdCLEFBQWlCLFVBQW9DLEVBQ3JELEFBQWlCLFlBQThCLEVBQy9DLEFBQWlCLGVBQXNDLEVBQ3ZELEFBQWlCLFVBQXVCLENBQ3hDO1NBUGlCLHdCQUFBO1NBQ0EsdUJBQUE7U0FDQSxRQUFBO1NBQ0EsYUFBQTtTQUNBLGVBQUE7U0FDQSxrQkFBQTtTQUNBLGFBQUE7U0FUWCxZQUFxQjtJQVczQixJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO01BQ3ZCLEVBQUUsRUFBRSxDQUFDLGNBQWMsQ0FBQyxLQUFLLE1BQVEsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLO01BQ3hELEVBQUUsRUFBRSxDQUFD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
// denoCacheMetadata=9882749684007046047,10959825598456812906