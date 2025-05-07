import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { cofferStore } from '../../../state/resource-logic';
import { batched } from 'nanostores';
import { selfPlayerIdStore } from '../../../state/player-state';
import { OutlineFilter } from 'pixi-filters/outline';
import { STANDARD_GAP } from '../../../core/app-contants';
import { createAppButton } from '../../../core/create-app-button';

export class CoffersExchangeView extends Container {
  private _coffersIcon: Sprite | undefined;
  private readonly _countText: Text;
  private _controlsCollapsed = true;
  private _coffers: number = 0;

  constructor() {
    super();

    this._countText = new Text({
      label: 'count',
      style: { fill: 0xffffff, fontSize: 32 },
      text: 0
    });
    this._countText.eventMode = 'none';
    this._countText.filters = [
      new OutlineFilter({
        color: 'black',
        thickness: 3
      })
    ]

    this.addChild(this._countText);

    const drawSub = batched(
      [cofferStore, selfPlayerIdStore],
      (coffers, selfId) => ({ coffers, selfId })
    ).subscribe(({ coffers, selfId }) => {
      if (!selfId) {
        this._coffers = 0;
      }
      else {
        this._coffers = coffers[selfId] ?? 0;
      }

      void this.draw();
    });

    this.eventMode = 'static';

    this.on('removed', () => {
      drawSub();
      this._coffersIcon?.removeAllListeners();
    });
  }

  private async draw() {
    if (!this._coffersIcon) {
      this._coffersIcon = await this.createCoffersIcon();
      this.addChildAt(this._coffersIcon, 0);
    }

    const countText = this.getChildByLabel('count') as Text;
    if (countText) {
      countText.text = this._coffers;
      countText.x = Math.floor(this._coffersIcon.x + this._coffersIcon.width * .5 - countText.width * .5);
      countText.y = Math.floor(this._coffersIcon.y + this._coffersIcon.height * .5 - countText.height * .5);
    }
  }

  private async createCoffersIcon() {
    const sprite = Sprite.from(await Assets.load('/assets/ui-icons/coffers.jpg'));
    sprite.cursor = 'pointer';
    sprite.eventMode = 'static';

    const maxSize = 45;
    sprite.scale = Math.min(maxSize / sprite.width, maxSize / sprite.height);

    sprite.on('mouseenter', () => {
      sprite.filters = [
        new OutlineFilter({
          color: 'white',
          thickness: 2
        })
      ]
    });
    sprite.on('mouseleave', () => {
      sprite.filters = [];
    });

    sprite.on('pointerdown', () => {
      void this.toggleControls();
    });

    return sprite;
  }

  private async toggleControls() {
    this._controlsCollapsed = !this._controlsCollapsed;

    if (this._controlsCollapsed) {
      const view = this.getChildByLabel('controls');
      view?.removeFromParent();
      view?.destroy();
      return;
    }

    let exchangeCount = 0;
    const controlsContainer = new Container({label: 'controls'});

    const maxSize = 50;

    const cofferSprite = Sprite.from(await Assets.load('/assets/ui-icons/coffers.jpg'));
    cofferSprite.scale = Math.min(maxSize / cofferSprite.width, maxSize / cofferSprite.height);

    const cofferText = new Text({
      text: this._coffers,
      style: { fill: 0xffffff, fontSize: 38 },
      anchor: .5,
    });
    cofferText.filters = [
      new OutlineFilter({
        color: 'black',
        thickness: 3
      })
    ];

    const treasureSprite = Sprite.from(await Assets.load('/assets/ui-icons/treasure-bg.png'));
    treasureSprite.scale = Math.min(maxSize / treasureSprite.width, maxSize / treasureSprite.height);

    const treasureText = new Text({
      text: 0,
      style: { fill: 0xffffff, fontSize: 38 },
      anchor: .5
    });
    treasureText.filters = [
      new OutlineFilter({
        color: 'black',
        thickness: 3
      })
    ]

    const rightArrow = new Graphics();
    rightArrow.lineTo(40, 25);
    rightArrow.lineTo(0, 50);
    rightArrow.lineTo(15, 25);
    rightArrow.lineTo(0, 0);
    rightArrow.fill({ color: 0xffffff });

    const leftArrow = rightArrow.clone();
    leftArrow.scale.x = -1;

    const appButton = createAppButton({
      text: 'CANCEL',
      style: { fill: 0xffffff, fontSize: 24 },
    });
    const executeButton = appButton.button;

    cofferSprite.y = Math.floor(-cofferSprite.height * .5);
    controlsContainer.addChild(cofferSprite);

    cofferText.x = Math.floor(cofferSprite.x + cofferSprite.width * .5);
    controlsContainer.addChild(cofferText);

    leftArrow.x = cofferSprite.x + cofferSprite.width + leftArrow.width + STANDARD_GAP;
    leftArrow.y = Math.floor(-leftArrow.height * .5);
    leftArrow.eventMode = 'static';
    leftArrow.cursor = 'pointer';
    leftArrow.on('pointerdown', () => {
      if (exchangeCount <= 0) {
        return;
      }

      exchangeCount--;
      cofferText.text = this._coffers - exchangeCount;
      treasureText.text = exchangeCount;
      appButton.text(exchangeCount > 0 ? 'EXCHANGE' : 'CANCEL');
    });
    controlsContainer.addChild(leftArrow);

    executeButton.x = leftArrow.x + STANDARD_GAP * 4;
    executeButton.y = Math.floor(-executeButton.height * .5);
    controlsContainer.addChild(executeButton);

    rightArrow.x = executeButton.x + executeButton.width + STANDARD_GAP * 5;
    rightArrow.y = Math.floor(-rightArrow.height * .5);
    rightArrow.eventMode = 'static';
    rightArrow.cursor = 'pointer';
    rightArrow.on('pointerdown', () => {
      if (exchangeCount >= this._coffers) {
        return;
      }

      exchangeCount++;
      cofferText.text = this._coffers - exchangeCount;
      treasureText.text = exchangeCount;
      appButton.text(exchangeCount > 0 ? 'EXCHANGE' : 'CANCEL');
    });
    controlsContainer.addChild(rightArrow);

    treasureSprite.x = rightArrow.x + rightArrow.width + STANDARD_GAP;
    treasureSprite.y = Math.floor(-treasureSprite.height * .5);
    controlsContainer.addChild(treasureSprite);

    treasureText.x = Math.floor(treasureSprite.x + treasureSprite.width * .5);
    controlsContainer.addChild(treasureText);

    const background = new Graphics();
    background.roundRect(0, 0, controlsContainer.width + STANDARD_GAP * 2, controlsContainer.height + STANDARD_GAP * 2, 5);
    background.fill({ color: 0, alpha: .8 });
    background.x = -STANDARD_GAP;
    background.y = Math.floor(-background.height * .5);
    controlsContainer.addChildAt(background, 0);

    controlsContainer.x = Math.floor(this.width * .5 - controlsContainer.width * .5);
    controlsContainer.y = Math.floor(-controlsContainer.height * .5 - STANDARD_GAP);
    this.addChild(controlsContainer);

    executeButton.cursor = 'pointer';
    executeButton.on('pointerdown', () => {
      this.toggleControls();

      if (exchangeCount <= 0) {
        return;
      }

      this.emit('exchange', exchangeCount);
    });

    controlsContainer.on('removed', () => {
      rightArrow.off('pointerdown');
      leftArrow.off('pointerdown');
      executeButton.off('pointerdown');
    });
  }
}
