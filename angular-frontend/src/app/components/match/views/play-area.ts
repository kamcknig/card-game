import { Container, Graphics } from 'pixi.js';
import { createCardView } from '../../../core/card/create-card-view';
import { List } from '@pixi/ui';
import { STANDARD_GAP } from '../../../core/app-contants';
import { Card } from 'shared/shared-types';
import { ActiveDurationCardList } from './active-duration-card-list';
import { playedCardStore } from '../../../state/match-logic';

export class PlayAreaView extends Container {
  private _background: Graphics = new Graphics();
  private _cardView: List = new List({ elementsMargin: STANDARD_GAP });
  private _activeDurationCardList: ActiveDurationCardList = new ActiveDurationCardList({label: 'activeDurationCardList'});
  private readonly _cleanup: (() => void)[] = [];

  constructor() {
    super();

    this._cardView.label = 'cardView';

    this._background.roundRect(0, 0, 1000, 340, 5);
    this._background.fill({ color: 0, alpha: .6 });
    this.addChild(this._background);

    this._activeDurationCardList.x = STANDARD_GAP;
    this._activeDurationCardList.y = STANDARD_GAP;
    this.addChild(this._activeDurationCardList);

    this._cardView.x = STANDARD_GAP;
    this._cardView.y = STANDARD_GAP * 4;
    this.addChild(this._cardView);

    this._cleanup.push(playedCardStore.subscribe(val => this.drawCards(val)));

    this.on('removed', this.onRemoved);
  }

  private onRemoved = () => {
    this._cleanup.forEach(cb => cb());
    this.off('removed', this.onRemoved);
  }

  private drawCards(cards: ReadonlyArray<Card>) {
    this._cardView.removeChildren();

    for (const card of cards) {
      const view = this._cardView.addChild(createCardView(card));
      view.size = 'full';
    }
  }
}
