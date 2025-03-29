import { PreinitializedWritableAtom } from 'nanostores';
import { AppSocket, PlayerID } from './types.ts';
import { CardEffectController } from './card-effects-controller.ts';
import { Match, TurnPhaseOrderValues } from 'shared/shared-types.ts';
import { isUndefined } from 'es-toolkit/compat';
import { CardLibrary } from './match-controller.ts';

export class CardInteractivityController {
  private _gameOver: boolean = false;

  constructor(
    private readonly _cardEffectController: CardEffectController,
    private readonly _$matchState: PreinitializedWritableAtom<Match>,
    private readonly _socketMap: Map<PlayerID, AppSocket>,
    private readonly _cardLibrary: CardLibrary,
  ) {
    _$matchState.subscribe(this.onMatchStateUpdated.bind(this));

    this._socketMap.forEach((s) => {
      s.on('cardTapped', this.onCardTapped);
      s.on('playAllTreasure', this.onPlayAllTreasure);
    });
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

  private onPlayAllTreasure = async () => {
    console.log(
      '[CARD INTERACTIVITY] playing all treasures for current player',
    );

    if (this._gameOver) {
      console.log(`[CARD INTERACTIVITY] game is over, not playing treasures`);
      return;
    }

    const match = this._$matchState.get();
    const currentPlayer = match.players[match.currentPlayerTurnIndex];

    if (isUndefined(currentPlayer)) {
      console.warn(`[CARD INTERACTIVITY] could not find current player`);
      return;
    }

    const hand = match.playerHands[currentPlayer.id];
    const treasureCards = hand.filter((e) =>
      this._cardLibrary.getCard(e).type.includes('TREASURE')
    );
    if (hand.length === 0 || treasureCards.length === 0) {
      console.debug(
        `[CARD INTERACTIVITY] ${currentPlayer} has no cards or no treasures in hand`,
      );
      return;
    }
    for (const cardId of treasureCards) {
      await this.onCardTapped(currentPlayer.id, cardId);
    }
  }

  private onCardTapped = async (triggerPlayerId: number, tappedCardId: number) => {
    const match = this._$matchState.get();
    const player = match.players.find(player => player.id === triggerPlayerId);

    const card = this._cardLibrary.getCard(tappedCardId);

    console.log(`[CARD INTERACTIVITY] player ${player} tapped card ${card}`);

    if (this._gameOver) {
      console.debug(
        `[CARD INTERACTIVITY] game is over, not processing card tap`,
      );
      return;
    }

    const turnPhase = TurnPhaseOrderValues[match.turnPhaseIndex];

    if (turnPhase === 'action') {
      await this._cardEffectController.runGameActionEffects(
        'playCard',
        match,
        triggerPlayerId,
        tappedCardId,
      );
    } else if (turnPhase === 'buy') {
      if (!match.playerHands?.[triggerPlayerId]) {
        console.debug(
          `[CARD INTERACTIVITY] could not find player hand for ${
          match.players.find(player => player.id === triggerPlayerId)
          }`,
        );
        return;
      }
      if (match.playerHands[triggerPlayerId].includes(tappedCardId)) {
        await this._cardEffectController.runGameActionEffects(
          'playCard',
          match,
          triggerPlayerId,
          tappedCardId,
        );
      } else {
        await this._cardEffectController.runGameActionEffects(
          'buyCard',
          match,
          triggerPlayerId,
          tappedCardId,
        );
      }
    }

    console.log(
      `[CARD INTERACTIVITY] card tapped handler complete ${card} for ${player}`,
    );
  }

  private onMatchStateUpdated(match: Match, _oldMatch?: Match): void {
    if (!match) {
      return;
    }

    if (this._gameOver) {
      console.debug(
        `[CARD INTERACTIVITY] game is over, not processing match update`,
      );
      return;
    }

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

        if (
          card.cost.treasure <= match.playerTreasure && match.playerBuys > 0
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

    this._socketMap.forEach((s, playerId) =>
      s.emit(
        'selectableCardsUpdated',
        playerId === currentPlayer.id ? selectableCards : [],
      )
    );
  }
}
