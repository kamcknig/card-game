import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { batched } from 'nanostores';
import { debtStore } from '../../../state/resource-logic';
import { currentPlayerStore, playerTreasureStore } from '../../../state/turn-state';
import { selfPlayerIdStore } from '../../../state/player-state';
import { OutlineFilter } from 'pixi-filters/outline';
import { STANDARD_GAP } from '../../../core/app-contants';
import { createAppButton } from '../../../core/create-app-button';
import { getPixiSceneTheme } from '../../../theme/pixi-theme';

// UI control that displays current debt and lets the active player pay it down.
export class DebtPayView extends Container {
  private readonly _pixiTheme = getPixiSceneTheme();
  private _debtIcon: Sprite | undefined;
  private readonly _countText: Text;
  private _controlsCollapsed = true;
  private _debt = 0;
  private _treasure = 0;
  // Tracks if the local player is the current turn owner for interaction gating.
  private _isCurrentPlayerSelf = false;
  private _controlsContainer: Container | null = null;
  private _debtText: Text | null = null;
  private _treasureText: Text | null = null;
  private _leftArrow: Graphics | null = null;
  private _rightArrow: Graphics | null = null;
  private _appButton: { button: Container; text: (value: string) => void; } | null = null;
  private _executeButton: Container | null = null;
  private _payCount = 0;
  private _maxPayable = 0;
  private _onLeftArrow?: () => void;
  private _onRightArrow?: () => void;
  private _onExecute?: () => void;

  constructor() {
    super();

    this._countText = new Text({
      label: 'count',
      style: { fill: this._pixiTheme.text.onOverlay, fontSize: 32 },
      text: 0
    });
    this._countText.eventMode = 'none';
    this._countText.filters = [
      new OutlineFilter({
        color: this._pixiTheme.overlay.color,
        thickness: 3
      })
    ];

    this.addChild(this._countText);

    const drawSub = batched(
      [debtStore, playerTreasureStore, selfPlayerIdStore, currentPlayerStore],
      (debt, treasure, selfId, currentPlayer) => ({ debt, treasure, selfId, currentPlayer })
    ).subscribe(({ debt, treasure, selfId, currentPlayer }) => {
      if (!selfId) {
        this._debt = 0;
        this._treasure = 0;
        this._isCurrentPlayerSelf = false;
      }
      else {
        this._debt = debt[selfId] ?? 0;
        this._treasure = treasure;
        this._isCurrentPlayerSelf = currentPlayer?.id === selfId;
      }

      void this.draw();
    });

    this.eventMode = 'static';

    this.on('removed', () => {
      drawSub();
      this._debtIcon?.removeAllListeners();
    });
  }

  private async draw() {
    if (!this._debtIcon) {
      this._debtIcon = await this.createDebtIcon();
      this.addChildAt(this._debtIcon, 0);
    }

    this._debtIcon.off('mouseenter');
    this._debtIcon.off('mouseleave');
    this._debtIcon.off('pointerdown');

    if (this._isCurrentPlayerSelf) {
      this._debtIcon.on('mouseenter', () => {
        this._debtIcon!.filters = [
          new OutlineFilter({
            color: this._pixiTheme.text.onOverlay,
            thickness: 2
          })
        ];
      });
      this._debtIcon.on('mouseleave', () => {
        this._debtIcon!.filters = [];
      });

      this._debtIcon.on('pointerdown', () => {
        void this.toggleControls();
      });
    }

    const countText = this.getChildByLabel('count') as Text;
    if (countText) {
      countText.text = this._debt;
      countText.x = Math.floor(this._debtIcon.x + this._debtIcon.width * .5 - countText.width * .5);
      countText.y = Math.floor(this._debtIcon.y + this._debtIcon.height * .5 - countText.height * .5);
    }

    // If controls are open, keep them in sync with updated debt/treasure totals.
    if (this._controlsContainer) {
      this.syncControls();
    }
  }

  private async createDebtIcon() {
    const sprite = Sprite.from(await Assets.load('/assets/ui-icons/64px-debt.png'));
    sprite.cursor = 'pointer';
    sprite.eventMode = 'static';

    const maxSize = 45;
    sprite.scale = Math.min(maxSize / sprite.width, maxSize / sprite.height);

    return sprite;
  }

  private async toggleControls() {
    this._controlsCollapsed = !this._controlsCollapsed;

    if (this._controlsCollapsed) {
      this.cleanupControls();
      return;
    }

    // Only allow paying when the player can cover at least one debt.
    this._maxPayable = Math.min(this._debt, this._treasure);
    this._payCount = 0;
    const controlsContainer = new Container({ label: 'controls' });
    this._controlsContainer = controlsContainer;

    const maxSize = 50;

    const debtSprite = Sprite.from(await Assets.load('/assets/ui-icons/64px-debt.png'));
    debtSprite.scale = Math.min(maxSize / debtSprite.width, maxSize / debtSprite.height);

    const debtText = new Text({
      text: this._debt,
      style: { fill: this._pixiTheme.text.onOverlay, fontSize: 38 },
      anchor: .5,
    });
    this._debtText = debtText;
    debtText.filters = [
      new OutlineFilter({
        color: this._pixiTheme.overlay.color,
        thickness: 3
      })
    ];

    const treasureSprite = Sprite.from(await Assets.load('/assets/ui-icons/treasure-bg.png'));
    treasureSprite.scale = Math.min(maxSize / treasureSprite.width, maxSize / treasureSprite.height);

    const treasureText = new Text({
      text: 0,
      style: { fill: this._pixiTheme.text.onOverlay, fontSize: 38 },
      anchor: .5
    });
    this._treasureText = treasureText;
    treasureText.filters = [
      new OutlineFilter({
        color: this._pixiTheme.overlay.color,
        thickness: 3
      })
    ];

    const rightArrow = new Graphics();
    rightArrow.lineTo(40, 25);
    rightArrow.lineTo(0, 50);
    rightArrow.lineTo(15, 25);
    rightArrow.lineTo(0, 0);
    rightArrow.fill({ color: this._pixiTheme.text.onOverlay });

    const leftArrow = rightArrow.clone();
    leftArrow.scale.x = -1;

    const appButton = createAppButton({
      text: 'CANCEL',
      style: { fill: this._pixiTheme.ui.buttonText, fontSize: 24 },
    });
    const executeButton = appButton.button;
    this._leftArrow = leftArrow;
    this._rightArrow = rightArrow;
    this._appButton = appButton;
    this._executeButton = executeButton;

    debtSprite.y = Math.floor(-debtSprite.height * .5);
    controlsContainer.addChild(debtSprite);

    debtText.x = Math.floor(debtSprite.x + debtSprite.width * .5);
    controlsContainer.addChild(debtText);

    leftArrow.x = debtSprite.x + debtSprite.width + leftArrow.width + STANDARD_GAP;
    leftArrow.y = Math.floor(-leftArrow.height * .5);
    leftArrow.eventMode = 'static';
    leftArrow.cursor = 'pointer';
    this._onLeftArrow = () => {
      if (this._payCount <= 0) {
        return;
      }

      this._payCount--;
      this.syncControls();
    };
    leftArrow.on('pointerdown', this._onLeftArrow);
    controlsContainer.addChild(leftArrow);

    executeButton.y = Math.floor(-executeButton.height * .5);
    controlsContainer.addChild(executeButton);

    rightArrow.x = leftArrow.x + leftArrow.width + executeButton.width + STANDARD_GAP * 2;
    rightArrow.y = Math.floor(-rightArrow.height * .5);
    rightArrow.eventMode = 'static';
    rightArrow.cursor = 'pointer';
    this._onRightArrow = () => {
      if (this._payCount >= this._maxPayable) {
        return;
      }

      this._payCount++;
      this.syncControls();
    };
    rightArrow.on('pointerdown', this._onRightArrow);
    controlsContainer.addChild(rightArrow);

    // Center the button between arrow centers to avoid visual skew.
    const leftArrowCenter = leftArrow.x - leftArrow.width * .5;
    const rightArrowCenter = rightArrow.x + rightArrow.width * .5;
    executeButton.x = Math.floor((leftArrowCenter + rightArrowCenter) * .5 - executeButton.width * .5);

    treasureSprite.x = rightArrow.x + rightArrow.width + STANDARD_GAP;
    treasureSprite.y = Math.floor(-treasureSprite.height * .5);
    controlsContainer.addChild(treasureSprite);

    treasureText.x = Math.floor(treasureSprite.x + treasureSprite.width * .5);
    controlsContainer.addChild(treasureText);

    const background = new Graphics();
    background.roundRect(0, 0, controlsContainer.width + STANDARD_GAP * 2, controlsContainer.height + STANDARD_GAP * 2, 5);
    background.stroke({ color: this._pixiTheme.ui.panelBorder, width: 1.5 });
    background.fill({ color: this._pixiTheme.overlay.color, alpha: this._pixiTheme.overlay.strongAlpha });
    background.x = -STANDARD_GAP;
    background.y = Math.floor(-background.height * .5);
    controlsContainer.addChildAt(background, 0);

    controlsContainer.x = Math.floor(this.width * .5 - controlsContainer.width * .5);
    controlsContainer.y = Math.floor(-controlsContainer.height * .5 - STANDARD_GAP);
    this.addChild(controlsContainer);

    executeButton.cursor = 'pointer';
    this._onExecute = () => {
      const payCount = this._payCount;
      this.toggleControls();

      if (payCount <= 0) {
        return;
      }

      this.emit('pay', payCount);
    };
    executeButton.on('pointerdown', this._onExecute);

    this.syncControls();

    controlsContainer.on('removed', () => {
      if (this._onRightArrow) rightArrow.off('pointerdown', this._onRightArrow);
      if (this._onLeftArrow) leftArrow.off('pointerdown', this._onLeftArrow);
      if (this._onExecute) executeButton.off('pointerdown', this._onExecute);
    });
  }

  private syncControls() {
    if (!this._controlsContainer || !this._debtText || !this._treasureText) return;
    this._maxPayable = Math.min(this._debt, this._treasure);
    this._payCount = Math.min(this._payCount, this._maxPayable);
    this._debtText.text = this._debt - this._payCount;
    this._treasureText.text = this._payCount;
    this._appButton?.text(this._payCount > 0 ? 'PAY' : 'CANCEL');
    this.recenterExecuteButton();
    this.updateArrowState();
  }

  private recenterExecuteButton() {
    if (!this._leftArrow || !this._rightArrow || !this._executeButton) return;
    const leftArrowCenter = this._leftArrow.x - this._leftArrow.width * .5;
    const rightArrowCenter = this._rightArrow.x + this._rightArrow.width * .5;
    this._executeButton.x = Math.floor((leftArrowCenter + rightArrowCenter) * .5 - this._executeButton.width * .5);
  }

  private updateArrowState() {
    const leftEnabled = this._payCount > 0;
    const rightEnabled = this._payCount < this._maxPayable;
    if (this._leftArrow) {
      this._leftArrow.alpha = leftEnabled ? 1 : 0.35;
      this._leftArrow.eventMode = leftEnabled ? 'static' : 'none';
      this._leftArrow.cursor = leftEnabled ? 'pointer' : 'default';
    }
    if (this._rightArrow) {
      this._rightArrow.alpha = rightEnabled ? 1 : 0.35;
      this._rightArrow.eventMode = rightEnabled ? 'static' : 'none';
      this._rightArrow.cursor = rightEnabled ? 'pointer' : 'default';
    }
  }

  private cleanupControls() {
    const view = this._controlsContainer ?? this.getChildByLabel('controls');
    view?.removeFromParent();
    view?.destroy();
    this._controlsContainer = null;
    this._debtText = null;
    this._treasureText = null;
    this._leftArrow = null;
    this._rightArrow = null;
    this._appButton = null;
    this._executeButton = null;
    this._payCount = 0;
    this._maxPayable = 0;
  }
}
