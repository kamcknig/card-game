import { Color, Container, ContainerOptions, Graphics, Point, Text } from 'pixi.js';
import { Card, PlayerId } from 'shared/types';
import { List } from '@pixi/ui';
import { STANDARD_GAP } from '../../../core/app-contants';
import { playerStore } from '../../../state/player-state';
import { createCardView } from '../../../core/card/create-card-view';
import { applicationStore } from '../../../state/app-state';
import { getCardSourceStore } from '../../../state/card-source-store';
import { cardStore } from '../../../state/card-state';
import { getPixiSceneTheme } from '../../../theme/pixi-theme';
import { AppButton, createAppButton } from '../../../core/create-app-button';

export class ActiveDurationCardList extends Container {
  private readonly _pixiTheme = getPixiSceneTheme();
  private readonly _closeButton: AppButton = createAppButton({
    text: 'X',
    style: { fill: this._pixiTheme.ui.buttonText, fontSize: 18 }
  });
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
        fill: this._pixiTheme.text.onOverlay,
        fontSize: 16
      }
    });
    tabText.x = 5;
    tabText.y = 5;

    const tabBackground = new Graphics({ label: 'tabBackground' });
    tabBackground.roundRect(0, 0, tabText.width + 10, tabText.height + 10, 5);
    tabBackground.fill({ color: this._pixiTheme.overlay.color, alpha: this._pixiTheme.overlay.mediumAlpha });
    tabBackground.stroke({ color: this._pixiTheme.ui.panelBorder, width: 1.5 });

    this._tabContainer.addChild(tabBackground);
    this._tabContainer.addChild(tabText);
    this.addChild(this._tabContainer);

    this._playersList.x = STANDARD_GAP;
    this._playersList.y = STANDARD_GAP;
    this._container.addChild(this._playersList);

    // Close button mirrors the in-canvas modal close pattern used by other prompt overlays.
    this._closeButton.button.on('pointerdown', () => this.hideCardList());
    this._closeButton.button.on('removed', () => this._closeButton.button.removeAllListeners());
    this._container.addChild(this._closeButton.button);

    this._tabContainer.on('pointerdown', () => this.toggleCardList());

    const cardsById = cardStore.get();

    const activeCardSubscription = getCardSourceStore('activeDuration')
      .subscribe(cards => this.drawCards(cards.map(id => cardsById[id])));

    this.on('removed', () => {
      activeCardSubscription();
      this._tabContainer.removeAllListeners();
    })
  }

  private toggleCardList() {
    if (this._container.parent) {
      this.hideCardList();
    }
    else {
      applicationStore.get()?.stage.addChild(this._container);
    }
  }

  // Hides the active duration cards modal if currently mounted on stage.
  private hideCardList() {
    this._container.removeFromParent();
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
          fill: this._pixiTheme.text.onOverlay,
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
    playersListBackground?.stroke({ color: this._pixiTheme.ui.panelBorder, width: 1.5 });
    playersListBackground?.fill({ color: this._pixiTheme.overlay.color, alpha: this._pixiTheme.overlay.mediumAlpha });

    this._closeButton.button.x = Math.floor(playersListBackground.width - this._closeButton.button.width - STANDARD_GAP);
    this._closeButton.button.y = STANDARD_GAP;

    const app = applicationStore.get();

    this._container.x = Math.floor((app?.renderer.width ?? 0) * .5 - this._playersList.width * .5);
    this._container.y = Math.floor((app?.renderer.height ?? 0) * .5 - this._playersList.height * .5);
  }
}
