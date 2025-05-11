import { Container, Graphics } from 'pixi.js';
import { createCardView } from '../../../core/card/create-card-view';
import { List } from '@pixi/ui';
import { STANDARD_GAP } from '../../../core/app-contants';
import { Card, Match } from 'shared/shared-types';
import { ActiveDurationCardList } from './active-duration-card-list';
import { computed } from 'nanostores';
import { matchStore } from '../../../state/match-state';
import { AdjustmentFilter } from 'pixi-filters';
import { playAreaStore } from '../../../state/card-source-logic';

export class PlayAreaView extends Container {
  private _background: Graphics = new Graphics();
  private _cardView: List = new List({ elementsMargin: STANDARD_GAP });
  private _activeDurationCardList: ActiveDurationCardList = new ActiveDurationCardList({ label: 'activeDurationCardList' });
  private readonly _cleanup: (() => void)[] = [];
  private _verticalSpace: number | undefined = undefined;

  set verticalSpace(val: number) {
    this._verticalSpace = val;
    this.drawCards(playAreaStore.get(), matchStore.get());
  }

  constructor() {
    super();

    this._cardView.label = 'cardView';

    this._background.roundRect(0, 0, 1000, 340, 5);
    this._background.fill({ color: 0, alpha: .4 });
    this.addChild(this._background);

    this._activeDurationCardList.x = STANDARD_GAP;
    this._activeDurationCardList.y = STANDARD_GAP;
    this.addChild(this._activeDurationCardList);

    this._cardView.x = STANDARD_GAP;
    this._cardView.y = STANDARD_GAP * 4;
    this.addChild(this._cardView);

    this._cleanup.push(
      computed(
        [playAreaStore, matchStore],
        (playArea, match) => ({ playArea, match })
      ).subscribe(({ playArea, match }) => this.drawCards(playArea, match)));

    this.on('removed', this.onRemoved);
  }

  private onRemoved = () => {
    this._cleanup.forEach(cb => cb());
    this.off('removed', this.onRemoved);
  }

  private drawCards(cards: ReadonlyArray<Card>, match: Match | null) {
    this._cardView.removeChildren();

    this._background.clear();
    this._background.roundRect(0, 0, 1000, this._verticalSpace ?? 400, 5);
    this._background.fill({ color: 0, alpha: .4 });

    for (const card of cards) {
      const view = this._cardView.addChild(createCardView(card));
      view.size = 'full';
      if (!match?.stats?.playedCards?.[card.id]) continue;
      if (card.type.includes('DURATION') && match.stats.playedCards[card.id].turnNumber < match.turnNumber) {
        view.filters = [new AdjustmentFilter({
          saturation: .4
        })]
      }
      else {
        view.filters = [];
      }
    }
  }
}
