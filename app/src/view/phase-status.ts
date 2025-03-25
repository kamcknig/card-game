import { Container, DestroyOptions, Graphics, Text } from 'pixi.js';
import { batched } from 'nanostores';
import { $playerActions, $playerBuys, $playerTreasure } from '../state/turn-state';
import { STANDARD_GAP } from '../app-contants';

export class PhaseStatus extends Container {
  private _background: Graphics = new Graphics();
  private _cleanup: (() => void)[] = [];
  private _treasureLabel: Text = new Text({style: { fill: 0xffffff, fontSize: 24 }});
  private _buyLabel: Text = new Text({style: { fill: 0xffffff, fontSize: 24 }});
  private _actionLabel: Text = new Text({style: { fill: 0xffffff, fontSize: 24 }});
  
  constructor() {
    super();
    
    this.addChild(this._background);
    this.addChild(this._treasureLabel);
    this.addChild(this._buyLabel);
    this.addChild(this._actionLabel);
    
    this._background
      .roundRect(0, 0, 900, 50, 5)
      .fill({color: 0, alpha: .7});
    
    this._cleanup.push(batched([$playerTreasure, $playerBuys, $playerActions], (treasure, buys, actions) => ({
      treasure,
      buys,
      actions,
    })).subscribe(this.drawPhase.bind(this)));
  }
  
  destroy(options?: DestroyOptions) {
    super.destroy(options);
    this._cleanup.forEach(c => c());
  }
  
  private drawPhase({treasure, buys, actions}: { treasure: number; buys: number; actions: number;}) {
    this._buyLabel.text = `BUYS ${buys}`;
    this._treasureLabel.text = `TREASURE ${treasure}    /   `;
    this._actionLabel.text = `ACTIONS ${actions}    /   `;
    
    this._actionLabel.y = this._treasureLabel.y = this._buyLabel.y = this.height * .5 - this._actionLabel.height * .5;
    this._actionLabel.x = STANDARD_GAP;
    this._treasureLabel.x = this._actionLabel.x + this._actionLabel.width;
    this._buyLabel.x = this._treasureLabel.x + this._treasureLabel.width;
  }
}