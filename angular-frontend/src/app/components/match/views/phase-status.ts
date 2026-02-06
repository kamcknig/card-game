import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { batched } from 'nanostores';
import { playerActionsStore, playerBuysStore, playerPotionStore, playerTreasureStore } from '../../../state/turn-state';
import { STANDARD_GAP } from '../../../core/app-contants';
import { CoffersExchangeView } from './coffers-exchange-view';
import { cofferStore, debtStore, villagerStore } from '../../../state/resource-logic';
import { selfPlayerIdStore } from '../../../state/player-state';
import { SocketService } from '../../../core/socket-service/socket.service';
import { DebtPayView } from './debt-pay-view';
import { VillagersSpendView } from './villagers-spend-view';

export class PhaseStatus extends Container {
  private _background: Graphics = new Graphics();
  private _cleanup: (() => void)[] = [];
  private _treasureLabel: Text = new Text({ style: { fill: 0xffffff, fontSize: 18 } });
  private _buyLabel: Text = new Text({ style: { fill: 0xffffff, fontSize: 18 } });
  private _actionLabel: Text = new Text({ style: { fill: 0xffffff, fontSize: 18 } });
  private _potionsCountText: Text = new Text({ style: { fill: 0xffffff, fontSize: 18 } });
  private _potionView: Sprite = Sprite.from(Assets.get('potion-icon'));
  private _coffersExchangeView: CoffersExchangeView = new CoffersExchangeView();
  // Displays Villagers and allows spending them for actions.
  private _villagersSpendView: VillagersSpendView = new VillagersSpendView();
  // Displays debt and allows paying it down.
  private _debtPayView: DebtPayView = new DebtPayView();
  // Fixed widths to avoid layout shifts when controls expand.
  private static readonly COFFER_ICON_SIZE = 45;
  private static readonly VILLAGER_ICON_SIZE = 45;
  private static readonly DEBT_ICON_SIZE = 45;
  private static readonly BAR_WIDTH = 900;
  private static readonly BAR_HEIGHT = 50;
  private _onExchangeCoffer = (amount: number) => {
    const selfId = selfPlayerIdStore.get();
    if (!selfId) return;
    this._socketService.emit('exchangeCoffer', selfId, amount);
  };
  private _onPayDebt = (amount: number) => {
    const selfId = selfPlayerIdStore.get();
    if (!selfId) return;
    this._socketService.emit('payDebt', selfId, amount);
  };
  // Spends Villagers to gain actions.
  private _onSpendVillager = (amount: number) => {
    const selfId = selfPlayerIdStore.get();
    if (!selfId) return;
    this._socketService.emit('spendVillager', selfId, amount);
  };

  constructor(private readonly _socketService: SocketService) {
    super();

    this.addChild(this._background);
    this.addChild(this._treasureLabel);
    this.addChild(this._buyLabel);
    this.addChild(this._actionLabel);

    this._coffersExchangeView.on('exchange', this._onExchangeCoffer);
    this._villagersSpendView.on('spend', this._onSpendVillager);

    this.addChild(this._coffersExchangeView);
    this.addChild(this._villagersSpendView);
    this.addChild(this._debtPayView);

    this._debtPayView.on('pay', this._onPayDebt);

    this._background
      .roundRect(0, 0, PhaseStatus.BAR_WIDTH, PhaseStatus.BAR_HEIGHT, 5)
      .fill({ color: 0, alpha: .6 });

    this._cleanup.push(
      batched(
        [playerTreasureStore, playerBuysStore, playerActionsStore, playerPotionStore, cofferStore, villagerStore, debtStore, selfPlayerIdStore],
        (treasure, buys, actions, potions, coffers, villagers, debt, selfId) => ({
          treasure,
          buys,
          actions,
          potions,
          coffers: selfId ? coffers[selfId] : 0,
          villagers: selfId ? villagers[selfId] : 0,
          debt: selfId ? debt[selfId] : 0
        })
      ).subscribe(vals => this.drawPhase(vals))
    );

    const maxSide = 32;
    this._potionView.scale = Math.min(maxSide / this._potionView.width, maxSide / this._potionView.height);

    this.on('removed', this.onRemoved);
  }

  private onRemoved = () => {
    this._cleanup.forEach(c => c());
    this._coffersExchangeView.off('exchange', this._onExchangeCoffer);
    this._debtPayView.off('pay', this._onPayDebt);
    this._villagersSpendView.off('spend', this._onSpendVillager);
    this.off('removed', this.onRemoved);
  }

  private drawPhase({ treasure, buys, actions, potions, coffers, villagers, debt }: { treasure: number; buys: number; actions: number; potions: number; coffers: number; villagers: number; debt: number; }) {
    this._buyLabel.text = `  BUYS ${buys}`;
    this._treasureLabel.text = `  TREASURE ${treasure}   /`;
    this._actionLabel.text = `ACTIONS ${actions}   /`;

    const centerY = PhaseStatus.BAR_HEIGHT * .5;
    this._actionLabel.y = this._treasureLabel.y = this._buyLabel.y = this._potionView.y = this._potionsCountText.y = centerY - this._actionLabel.height * .5;

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
    this._villagersSpendView.visible = villagers > 0;
    // Debt is shown when present and right-aligned with other resource controls.
    this._debtPayView.visible = debt > 0;
    let rightEdge = PhaseStatus.BAR_WIDTH - STANDARD_GAP;

    if (this._debtPayView.visible) {
      // Use fixed icon width so expanded controls don't shift layout.
      this._debtPayView.x = Math.floor(rightEdge - PhaseStatus.DEBT_ICON_SIZE);
      this._debtPayView.y = Math.floor(centerY - PhaseStatus.DEBT_ICON_SIZE * .5);
      rightEdge = this._debtPayView.x - STANDARD_GAP;
    }

    if (coffers > 0) {
      // Use fixed icon width so expanded controls don't shift layout.
      this._coffersExchangeView.x = Math.floor(rightEdge - PhaseStatus.COFFER_ICON_SIZE);
      this._coffersExchangeView.y = Math.floor(centerY - PhaseStatus.COFFER_ICON_SIZE * .5);
      rightEdge = this._coffersExchangeView.x - STANDARD_GAP;
    }

    if (villagers > 0) {
      // Villagers are shown to the left of coffers.
      // Use fixed icon width so expanded controls don't shift layout.
      this._villagersSpendView.x = Math.floor(rightEdge - PhaseStatus.VILLAGER_ICON_SIZE);
      this._villagersSpendView.y = Math.floor(centerY - PhaseStatus.VILLAGER_ICON_SIZE * .5);
    }
  }
}
