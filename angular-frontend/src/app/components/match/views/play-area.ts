import { Container, Graphics } from 'pixi.js';
import { createCardView } from '../../../core/card/create-card-view';
import { matchStatsStore, playAreaStore } from '../../../state/match-state';
import { cardStore } from '../../../state/card-state';
import { List } from '@pixi/ui';
import { STANDARD_GAP } from '../../../core/app-contants';
import { batched } from 'nanostores';
import { Card, MatchStats } from 'shared/shared-types';
import { currentPlayerTurnIdStore, turnNumberStore } from '../../../state/turn-state';

export class PlayAreaView extends Container {
  private _background: Graphics = new Graphics();
  private _cardView: List = new List({ elementsMargin: STANDARD_GAP });
  private _persistentCardView: List = new List({ elementsMargin: STANDARD_GAP });
  private readonly _cleanup: (() => void)[] = [];

  constructor() {
    super();

    this._cardView.label = 'cardView';

    this._background.roundRect(0, 0, 1000, 340);
    this._background.fill({ color: 0, alpha: .6 });

    this.addChild(this._background);

    this._cardView.x = STANDARD_GAP;
    this._cardView.y = STANDARD_GAP * 3;
    this.addChild(this._cardView);

    this.addChild(this._persistentCardView);

    this._cleanup.push(
      batched(
        [playAreaStore, matchStatsStore, turnNumberStore, currentPlayerTurnIdStore],
        (cardIds, matchStats, turnNumber, currentPlayerTurnId) => ({ cardIds, matchStats, turnNumber, currentPlayerTurnId })
      ).subscribe(({ cardIds, matchStats, turnNumber, currentPlayerTurnId }) => {
        // hack because I was getting flicker
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.drawCards(cardIds, turnNumber, currentPlayerTurnId, matchStats);
          });
        });
      })
    );

    this.on('removed', this.onRemoved);
  }

  private onRemoved = () => {
    this._cleanup.forEach(cb => cb());
    this.off('removed', this.onRemoved);
  }

  private drawCards(val: ReadonlyArray<number>, turnNumber: number, currentPlayerTurnId: number, matchStats?: MatchStats) {
    this._cardView.removeChildren();
    this._persistentCardView.removeChildren();
    this._persistentCardView.y = -100

    const currentTurnPlays = matchStats?.cardsPlayed?.[turnNumber];
    const cards = val.map(id => cardStore.get()[id])
      .reduce((acc, nextCard) => {
        if (!matchStats || !nextCard.type.includes('DURATION')) {
          acc[0].push(nextCard);
        } else if (currentTurnPlays?.[currentPlayerTurnId]?.includes(nextCard.id)) {
          acc[0].push(nextCard); // just played it this turn
        } else {
          acc[1].push(nextCard); // was played earlier, still lingering
        }
        return acc;
      }, [[], []] as Card[][]);

    for (const card of cards[0]) {
      const view = this._cardView.addChild(createCardView(card));
      view.size = 'full';
    }

    if (cards[1].length) {

      for (const card of cards[1]) {
        const view = this._persistentCardView.addChild(createCardView(card));
        view.size = 'half';
        view.scale = .5;
      }
    }
  }
}
