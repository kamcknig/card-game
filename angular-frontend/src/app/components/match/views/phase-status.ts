import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { batched } from 'nanostores';
import { playerActionsStore, playerBuysStore, playerPotionStore, playerTreasureStore } from '../../../state/turn-state';
import { STANDARD_GAP } from '../../../core/app-contants';
import { CoffersExchangeView } from './coffers-exchange-view';
import { cofferStore } from '../../../state/resource-logic';
import { selfPlayerIdStore } from '../../../state/player-state';
import { SocketService } from '../../../core/socket-service/socket.service';

export class PhaseStatus extends Container {
  private _background: Graphics = new Graphics();
  private _cleanup: (() => void)[] = [];
  private _treasureLabel: Text = new Text({ style: { fill: 0xffffff, fontSize: 18 } });
  private _buyLabel: Text = new Text({ style: { fill: 0xffffff, fontSize: 18 } });
  private _actionLabel: Text = new Text({ style: { fill: 0xffffff, fontSize: 18 } });
  private _potionsCountText: Text = new Text({ style: { fill: 0xffffff, fontSize: 18 } });
  private _potionView: Sprite = Sprite.from(Assets.get('potion-icon'));
  private _coffersExchangeView: CoffersExchangeView = new CoffersExchangeView();

  constructor(private readonly _socketService: SocketService) {
    super();

    this.addChild(this._background);
    this.addChild(this._treasureLabel);
    this.addChild(this._buyLabel);
    this.addChild(this._actionLabel);

    this._coffersExchangeView.on('exchange', (amount: number) => {
      const selfId = selfPlayerIdStore.get();
      if (!selfId) return;
      this._socketService.emit('exchangeCoffer', selfId, amount);
    });

    this.addChild(this._coffersExchangeView);

    this._background
      .roundRect(0, 0, 900, 50, 5)
      .fill({ color: 0, alpha: .6 });

    this._cleanup.push(
      batched(
        [playerTreasureStore, playerBuysStore, playerActionsStore, playerPotionStore, cofferStore, selfPlayerIdStore],
        (treasure, buys, actions, potions, coffers, selfId) => ({
          treasure,
          buys,
          actions,
          potions,
          coffers: selfId ? coffers[selfId] : 0
        })
      ).subscribe(vals => this.drawPhase(vals))
    );

    const maxSide = 32;
    this._potionView.scale = Math.min(maxSide / this._potionView.width, maxSide / this._potionView.height);

    this.on('removed', this.onRemoved);
  }

  private onRemoved = () => {
    this._cleanup.forEach(c => c());
    this.off('removed', this.onRemoved);
  }

  private drawPhase({ treasure, buys, actions, potions, coffers }: { treasure: number; buys: number; actions: number; potions: number; coffers: number; }) {
    this._buyLabel.text = `  BUYS ${buys}`;
    this._treasureLabel.text = `  TREASURE ${treasure}   /`;
    this._actionLabel.text = `ACTIONS ${actions}   /`;

    this._actionLabel.y = this._treasureLabel.y = this._buyLabel.y = this._potionView.y = this._potionsCountText.y = this.height * .5 - this._actionLabel.height * .5;

    this._actionLabel.x = STANDARD_GAP;

    this._treasureLabel.x = this._actionLabel.x + this._actionLabel.width;

    this._potionsCountText.text = ` X ${potions}   /`

    if (potions > 0) {
      this.addChild(this._potionView);
      this.addChild(this._potionsCountText);
      this._potionView.x = this._treasureLabel.x + this._treasureLabel.width + STANDARD_GAP;
      this._potionView.y = Math.floor(this._treasureLabel.y + this._treasureLabel.height * .5 - this._potionView.height * .5);
      this._potionsCountText.x = this._potionView.x + this._potionView.width + STANDARD_GAP;
    }
    else {
      this._potionView.removeFromParent();
      this._potionsCountText.removeFromParent();
    }

    const c = potions > 0 ? this._potionsCountText : this._treasureLabel;

    this._buyLabel.x = c.x + c.width + STANDARD_GAP;

    this._coffersExchangeView.visible = coffers > 0;
    if (coffers > 0) {
      this._coffersExchangeView.x = this.width - 40 - STANDARD_GAP;
      this._coffersExchangeView.y = Math.floor(this.height * .5 - 40 * .5);
    }
  }
}
