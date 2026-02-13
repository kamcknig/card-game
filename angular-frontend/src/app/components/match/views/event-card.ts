import { Event } from 'shared/types/index.ts';
import { Assets, Container, ContainerOptions, FederatedPointerEvent, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { displayCardDetail } from './modal/display-card-detail';
import { CardLikeView } from './card-like-view';
import { selectableCardStore } from 'src/app/state/interactive-logic';

export interface EventCardArgs {
  event: Event;
}

export class EventCard extends CardLikeView {
  private readonly _highlight: Graphics = new Graphics({ label: 'highlight' });
  private readonly _costView: Container = new Container({ label: 'costView' });
  private _event: Event | undefined;
  private _cardImage: Texture | undefined;
  private _cardSprite: Sprite = new Sprite({ label: 'cardSprite' });

  public set event(value: Event) {
    if (this._event?.cardKey === value.cardKey) return;

    this._event = value;
    this._cardImage = Assets.get(`${value.cardKey}-full`);

    if (this._cardImage) {
      this._cardSprite.texture = this._cardImage;
    }

    this.draw();
  }

  constructor({ event, ...args }: ContainerOptions & EventCardArgs) {
    super({ ...args, id: event.id });
    this.addChild(this._highlight);
    this.addChild(this._cardSprite);
    this.addChild(this._costView);
    this.event = event;

    const selectableCardSub = selectableCardStore.subscribe(() => this.draw());
    this.on('removed', () => {
      selectableCardSub();
    });
  }

  private buildCostView(event: Event) {
    this._costView.removeChildren();

    const costBgSprite = Sprite.from(Assets.get('treasure-bg'));
    const maxSide = 32;
    costBgSprite.scale = Math.min(maxSide / costBgSprite.width, maxSide / costBgSprite.height);
    this._costView.addChild(costBgSprite);

    const costText = new Text({
      label: 'costText',
      text: event.cost.treasure,
      style: {
        fill: 'black'
      },
      anchor: .5,
    });
    costText.x = Math.floor(costBgSprite.width * .5);
    costText.y = Math.floor(costBgSprite.height * .5);
    this._costView.addChild(costText);

    // Track the next cost element position as we add potion/debt icons.
    let nextCostX = costBgSprite.x + costBgSprite.width + 3;

    if ((event.cost?.potion ?? 0) > 0) {
      const potion = Sprite.from(Assets.get('potion-icon'));
      const potionMaxSide = 32;
      potion.scale = Math.min(potionMaxSide / potion.width, potionMaxSide / potion.height);
      potion.x = nextCostX;
      potion.y = Math.floor(costBgSprite.y + costBgSprite.height - potion.height);
      this._costView.addChild(potion);
      nextCostX = potion.x + potion.width + 3;
    }

    if ((event.cost?.debt ?? 0) > 0) {
      const debt = Sprite.from(Assets.get('debt-icon'));
      const debtMaxSide = 32;
      debt.scale = Math.min(debtMaxSide / debt.width, debtMaxSide / debt.height);
      debt.x = nextCostX;
      debt.y = Math.floor(costBgSprite.y + costBgSprite.height - debt.height);
      this._costView.addChild(debt);

      const debtText = new Text({
        label: 'debtText',
        text: event.cost.debt,
        style: {
          fill: 'black'
        },
        anchor: .5,
      });
      debtText.x = Math.floor(debt.x + debt.width * .5);
      debtText.y = Math.floor(debt.y + debt.height * .5);
      this._costView.addChild(debtText);
    }
  }

  override onPointerdown(event: FederatedPointerEvent) {
    if (this._event) {
      if (event.ctrlKey) {
        console.debug(this._event);
        return;
      }

      if (event.button === 2) {
        void displayCardDetail(this._event);
        return;
      }
    }
  }

  public draw() {
    this._highlight.clear();

    const selectableCards = selectableCardStore.get();
    if (this._event && selectableCards.includes(this._event.id)) {
      this._highlight
        .roundRect(-3, -3, this._cardSprite.width + 6, this._cardSprite.height + 6, 5)
        .fill(0xffaaaa);
    }

    if (this._event) {
      this.buildCostView(this._event);
      this._costView.x = 2;
      this._costView.y = this._cardSprite.y + this._cardSprite.height - this._costView.height - 5;
    }
  }
}
