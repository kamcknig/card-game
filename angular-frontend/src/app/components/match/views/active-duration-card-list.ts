import { Color, Container, ContainerOptions, Graphics, Point, Text } from 'pixi.js';
import { Card, PlayerId } from 'shared/shared-types';
import { activeDurationCardStore } from '../../../state/match-logic';
import { List } from '@pixi/ui';
import { STANDARD_GAP } from '../../../core/app-contants';
import { playerStore } from '../../../state/player-state';
import { createCardView } from '../../../core/card/create-card-view';
import { appStore } from '../../../state/app-state';

export class ActiveDurationCardList extends Container {
  private _tabContainer: Container = new Container({
    label: 'tabContainer',
    eventMode: 'static',
  });

  private _container: Container = new Container();

  private _playersList: List = new List({
    type: 'horizontal',
    elementsMargin: STANDARD_GAP
  });

  constructor(args?: ContainerOptions) {
    super(args);

    const playersListBackground = new Graphics({ label: 'playersListBackground' });
    this._container.addChild(playersListBackground);

    const tabText = new Text({
      label: 'tabText',
      text: 'Active duration cards',
      style: {
        fill: 'white',
        fontSize: 16
      }
    });
    tabText.x = 5;
    tabText.y = 5;

    const tabBackground = new Graphics({ label: 'tabBackground' });
    tabBackground.roundRect(0, 0, tabText.width + 10, tabText.height + 10, 5);
    tabBackground.fill(new Color('0x000000'));
    tabBackground.stroke('white');

    this._tabContainer.addChild(tabBackground);
    this._tabContainer.addChild(tabText);
    this.addChild(this._tabContainer);

    this._playersList.x = STANDARD_GAP;
    this._playersList.y = STANDARD_GAP;
    this._container.addChild(this._playersList);

    this._tabContainer.on('pointerdown', () => this.toggleCardList());

    const activeCardSubscription = activeDurationCardStore.subscribe(cards => this.drawCards(cards));

    this.on('removed', () => {
      activeCardSubscription();
      this._tabContainer.removeAllListeners();
    })
  }

  private toggleCardList() {
    if (this._container.parent) {
      this._container.removeFromParent();
    }
    else {
      appStore.get()?.stage.addChild(this._container);
    }
  }

  private drawCards(cards: ReadonlyArray<Card>) {
    this._tabContainer.visible = cards.length > 0;
    if (!cards.length) {
      return;
    }

    this._playersList.removeChildren();

    let cardHeight: number = NaN;

    const reducedCards = cards.reduce((acc, nextCard) => {
      acc[nextCard.owner ?? -1] ??= [];
      acc[nextCard.owner ?? -1].push(nextCard);
      return acc;
    }, {} as Record<PlayerId, Card[]>);

    for (const [playerId, cards] of Object.entries(reducedCards)) {
      const playerCardsContainer = new Container();
      const playerNameText = new Text({
        text: playerStore(+playerId).get()?.name,
        style: {
          fill: 'white',
          fontSize: 16
        }
      });
      playerCardsContainer.addChild(playerNameText);

      const cardViews = cards.map(createCardView);

      if (isNaN(cardHeight)) {
        cardHeight = cardViews[0].height;
      }

      const cardList = new List({ type: 'vertical', children: cardViews, elementsMargin: 40 - cardHeight });
      cardList.y = playerNameText.y + playerNameText.height + STANDARD_GAP;
      playerCardsContainer.addChild(cardList);

      this._playersList.addChild(playerCardsContainer);
    }

    const playersListBackground = this._container.getChildByLabel('playersListBackground') as Graphics;
    playersListBackground?.clear();
    playersListBackground?.roundRect(0, 0, this._playersList.width + STANDARD_GAP * 2, this._playersList.height + STANDARD_GAP * 2, 5);
    playersListBackground?.fill({color: 'black'});

    const app = appStore.get();

    this._container.x = Math.floor((app?.renderer.width ?? 0) * .5 - this._playersList.width * .5);
    this._container.y = Math.floor((app?.renderer.height ?? 0) * .5 - this._playersList.height * .5);
  }
}
