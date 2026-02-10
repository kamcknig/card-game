import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { batched } from 'nanostores';
import { OutlineFilter } from 'pixi-filters/outline';
import { STANDARD_GAP } from '../../../core/app-contants';
import { createAppButton } from '../../../core/create-app-button';
import { selfPlayerIdStore } from '../../../state/player-state';
import { villagerStore } from '../../../state/resource-logic';

// Displays Villagers and lets the current player spend them for +Actions.
export class VillagersSpendView extends Container {
  private _villagersIcon: Sprite | undefined;
  private readonly _countText: Text;
  private _controlsCollapsed = true;
  private _villagers: number = 0;

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
    ];

    this.addChild(this._countText);

    const drawSub = batched(
      [villagerStore, selfPlayerIdStore],
      (villagers, selfId) => ({ villagers, selfId })
    ).subscribe(({ villagers, selfId }) => {
      if (!selfId) {
        this._villagers = 0;
      }
      else {
        this._villagers = villagers[selfId] ?? 0;
      }

      void this.draw();
    });

    this.eventMode = 'static';

    this.on('removed', () => {
      drawSub();
      this._villagersIcon?.removeAllListeners();
    });
  }

  private async draw() {
    if (!this._villagersIcon) {
      this._villagersIcon = await this.createVillagersIcon();
      this.addChildAt(this._villagersIcon, 0);
    }

    this._villagersIcon.off('mouseenter');
    this._villagersIcon.off('mouseleave');
    this._villagersIcon.off('pointerdown');

    // Visibility is controlled by the parent view when spending is possible.
    this._villagersIcon.cursor = 'pointer';
    this._villagersIcon.eventMode = 'static';
    this._villagersIcon.on('mouseenter', () => {
      this._villagersIcon!.filters = [
        new OutlineFilter({
          color: 'white',
          thickness: 2
        })
      ];
    });
    this._villagersIcon.on('mouseleave', () => {
      this._villagersIcon!.filters = [];
    });
    this._villagersIcon.on('pointerdown', () => {
      void this.toggleControls();
    });

    const countText = this.getChildByLabel('count') as Text;
    if (countText) {
      countText.text = this._villagers;
      countText.x = Math.floor(this._villagersIcon.x + this._villagersIcon.width * .5 - countText.width * .5);
      countText.y = Math.floor(this._villagersIcon.y + this._villagersIcon.height * .5 - countText.height * .5);
    }
  }

  private async createVillagersIcon() {
    // Uses the Villagers icon asset provided in the UI icons set.
    const sprite = Sprite.from(await Assets.load('/assets/ui-icons/villagers.jpg'));
    sprite.cursor = 'pointer';
    sprite.eventMode = 'static';

    const maxSize = 45;
    sprite.scale = Math.min(maxSize / sprite.width, maxSize / sprite.height);

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

    let spendCount = 0;
    const controlsContainer = new Container({ label: 'controls' });

    const maxSize = 50;

    const villagerSprite = Sprite.from(await Assets.load('/assets/ui-icons/villagers.jpg'));
    villagerSprite.scale = Math.min(maxSize / villagerSprite.width, maxSize / villagerSprite.height);

    const villagerText = new Text({
      text: this._villagers,
      style: { fill: 0xffffff, fontSize: 38 },
      anchor: .5,
    });
    villagerText.filters = [
      new OutlineFilter({
        color: 'black',
        thickness: 3
      })
    ];

    const actionText = new Text({
      text: '+0 Actions',
      style: { fill: 0xffffff, fontSize: 32 },
      anchor: .5,
    });
    actionText.filters = [
      new OutlineFilter({
        color: 'black',
        thickness: 3
      })
    ];

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

    villagerSprite.y = Math.floor(-villagerSprite.height * .5);
    controlsContainer.addChild(villagerSprite);

    villagerText.x = Math.floor(villagerSprite.x + villagerSprite.width * .5);
    controlsContainer.addChild(villagerText);

    leftArrow.x = villagerSprite.x + villagerSprite.width + leftArrow.width + STANDARD_GAP;
    leftArrow.y = Math.floor(-leftArrow.height * .5);
    leftArrow.eventMode = 'static';
    leftArrow.cursor = 'pointer';
    leftArrow.on('pointerdown', () => {
      if (spendCount <= 0) {
        return;
      }

      spendCount--;
      villagerText.text = this._villagers - spendCount;
      actionText.text = `+${spendCount} Actions`;
      appButton.text(spendCount > 0 ? 'SPEND' : 'CANCEL');
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
      if (spendCount >= this._villagers) {
        return;
      }

      spendCount++;
      villagerText.text = this._villagers - spendCount;
      actionText.text = `+${spendCount} Actions`;
      appButton.text(spendCount > 0 ? 'SPEND' : 'CANCEL');
    });
    controlsContainer.addChild(rightArrow);

    actionText.x = rightArrow.x + rightArrow.width + STANDARD_GAP;
    actionText.y = Math.floor(-actionText.height * .5);
    controlsContainer.addChild(actionText);

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

      if (spendCount <= 0) {
        return;
      }

      this.emit('spend', spendCount);
    });

    controlsContainer.on('removed', () => {
      rightArrow.off('pointerdown');
      leftArrow.off('pointerdown');
      executeButton.off('pointerdown');
    });
  }

  // Collapses the spend controls when the view is hidden by the parent.
  public collapseControls() {
    if (this._controlsCollapsed) {
      return;
    }
    void this.toggleControls();
  }
}
