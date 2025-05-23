import { Container, Graphics } from 'pixi.js';
import { cardStore } from '../../../state/card-state';
import { Card, CardType } from 'shared/shared-types';
import { atom, computed } from 'nanostores';
import { CARD_HEIGHT, CARD_WIDTH, SMALL_CARD_WIDTH, STANDARD_GAP } from '../../../core/app-contants';
import { PhaseStatus } from './phase-status';
import { AppButton, createAppButton } from '../../../core/create-app-button';
import { currentPlayerTurnIdStore, turnPhaseStore } from '../../../state/turn-state';
import { CardStackView } from './card-stack';
import { List } from '@pixi/ui';
import { awaitingServerLockReleaseStore } from '../../../state/interactive-state';
import { SocketService } from '../../../core/socket-service/socket.service';
import { getCardSourceStore } from '../../../state/card-source-store';

export class PlayerHandView extends Container {
  private readonly _phaseStatus: PhaseStatus;
  private readonly _nextPhaseButton: AppButton = createAppButton({ text: 'NEXT' });
  private readonly _playAllTreasuresButton: AppButton = createAppButton(
    {
      text: 'PLAY ALL\nTREASURE',
      style: { align: 'center', fill: '#fff4e6', fontSize: 24 }
    },
    {
      color: '#c1aa1f'
    }
  );

  private readonly _cleanup: (() => void)[] = [];
  private readonly _background: Graphics = new Graphics({ label: 'background' });
  private readonly _cardList: List = new List({ type: 'horizontal', elementsMargin: STANDARD_GAP });

  constructor(
    private playerId: number,
    private readonly _socketService: SocketService,
  ) {
    super();

    this._phaseStatus = new PhaseStatus(this._socketService);

    this._cardList.label = `cardList`;
    this._cardList.elementsMargin = STANDARD_GAP;
    this._cardList.x = STANDARD_GAP;

    this.label = `player-hand-${this.playerId}`;

    this.addChild(this._background);
    this.addChild(this._phaseStatus);
    this.addChild(this._cardList);
    this.addChild(this._nextPhaseButton.button);

    this._background.y = this._phaseStatus.y + this._phaseStatus.height;
    this._cardList.y = this._background.y + STANDARD_GAP;

    this._background.clear();
    this._background.roundRect(0, 0, (CARD_WIDTH + STANDARD_GAP) * 6, CARD_HEIGHT + STANDARD_GAP * 4, 5);
    this._background.fill({ color: 0, alpha: .6 });

    this._cleanup.push(computed(
      [currentPlayerTurnIdStore, awaitingServerLockReleaseStore],
      (currentPlayerTurnId, waitingServerLockRelease) => currentPlayerTurnId === playerId && !waitingServerLockRelease
    ).subscribe(visible => {
      this._nextPhaseButton.button.visible = visible
    }));

    this._cleanup.push(
      computed(
        [awaitingServerLockReleaseStore, turnPhaseStore, currentPlayerTurnIdStore, getCardSourceStore('playerHand', playerId)],
        (waiting, turnPhase, currentPlayerTurnId, hand) => {
          if (
            waiting ||
            turnPhase !== 'buy' ||
            !playerId ||
            currentPlayerTurnId !== playerId ||
            !hand?.length
          ) return false;

          return hand.some(cardId => cardStore.get()[cardId].type.includes('TREASURE'));
        }
      ).subscribe(visible => this._playAllTreasuresButton.button.visible = visible)
    );

    this._cleanup.push(turnPhaseStore.subscribe((phase) => {
      switch (phase) {
        case 'action':
          this._nextPhaseButton.text('END ACTIONS');
          break;
        case 'buy':
          this._nextPhaseButton.text('END BUYS');
          break;
      }

      this._nextPhaseButton.button.x = this.width - this._nextPhaseButton.button.width - STANDARD_GAP;
      this._nextPhaseButton.button.y = Math.floor(this.height * .5 + this._nextPhaseButton.button.height * .5 + STANDARD_GAP);
    }));
    this.addChild(this._nextPhaseButton.button);

    this._playAllTreasuresButton.button.label = 'playAllTreasureButton';
    this._playAllTreasuresButton.button.visible = false;
    this._playAllTreasuresButton.button.on('pointerdown', () => {
      this.emit('playAllTreasure');
    });
    this._playAllTreasuresButton.button.x = this.width - this._playAllTreasuresButton.button.width - STANDARD_GAP;
    this._playAllTreasuresButton.button.y = Math.floor(this.height * .5 - this._playAllTreasuresButton.button.height * .5 - STANDARD_GAP);
    this.addChild(this._playAllTreasuresButton.button);

    this._cleanup.push(getCardSourceStore('playerHand', playerId).subscribe(this.drawHand));
    this._nextPhaseButton.button.on('pointerdown', () => {
      this.emit('nextPhase');
    });
    this.on('removed', this.onRemoved);
  }

  private onRemoved = () => {
    this._cleanup.forEach(c => c());
    this._nextPhaseButton.button.off('pointerdown');
    this._playAllTreasuresButton.button.off('pointerdown');
    this.off('removed');
  }

  private drawHand = (hand: ReadonlyArray<number>) => {
    this._cardList.removeChildren();

    const cardsById = cardStore.get();

    // first reduce the cards by card type, actions, then treasures, then victory cards
    const categoryMap: Record<string, number> = { ACTION: 0, TREASURE: 1, VICTORY: 2 };
    const categorized = hand.reduce(
      (acc, cardId) => {
        const category = Object.keys(categoryMap).find(type => cardsById[cardId].type.includes(type as CardType));
        if (category) {
          acc[categoryMap[category]].push(cardsById[cardId]);
        }
        return acc;
      },
      [[], [], []] as Card[][]
    );

    // now sort within each type. actions by name, treasure and victory by predefined rankings,
    // then flatten to a single dimensional array. probably better to type this array or something
    // elsewhere later on
    const treasureRankings = ['copper', 'silver', 'gold'];
    const treasureOrderRanking = treasureRankings.reduce(
      (acc, name, index) => ({ ...acc, [name]: index }),
      {} as Record<string, number>
    );

    const victoryRankings = ['estate', 'duchy', 'province'];
    const victoryOrderRanking = victoryRankings.reduce(
      (acc, name, index) => ({ ...acc, [name]: index }),
      {} as Record<string, number>
    );

    const sortedCards = [
      categorized[0].sort((a, b) => a.cardName.localeCompare(b.cardName)), // actions ordered by name
      categorized[1].sort((a, b) => {
        const aRank = treasureOrderRanking[a.cardKey] ?? Infinity;
        const bRank = treasureOrderRanking[b.cardKey] ?? Infinity;

        if (aRank !== bRank) {
          return aRank - bRank;
        }

        return a.cardName.localeCompare(b.cardName);
      }),
      categorized[2].sort((a, b) => {
        const aRank = victoryOrderRanking[a.cardKey] ?? Infinity;
        const bRank = victoryOrderRanking[b.cardKey] ?? Infinity;

        if (aRank !== bRank) {
          return aRank - bRank;
        }

        return a.cardName.localeCompare(b.cardName); // sort unknown victories alphabetically
      })
    ].flat();

    const cardStackCards = Object.values(
      sortedCards.reduce((acc, card) => {
        acc[card.cardKey] ??= [];
        acc[card.cardKey].push(card);
        return acc;
      }, {} as Record<string, Card[]>)
    );

    for (const cards of cardStackCards) {
      const c = new CardStackView({
        $cardIds: atom(cards.map(c => c.id)),
        cardFacing: 'front',
        showBackground: false,
      });
      this._cardList.addChild(c);
    }

    this._cardList.elementsMargin = cardStackCards.length > 5 ? -SMALL_CARD_WIDTH * .50 : STANDARD_GAP
  }
}
