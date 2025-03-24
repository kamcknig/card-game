import { Assets, Container, DestroyOptions, Graphics, Sprite, Text } from "pixi.js";
import { AppButton, createAppButton } from "../core/create-app-button";
import { Scene } from "../core/scene/scene";
import { $players, $selfPlayerId } from "../state/player-state";
import { socket } from "../client-socket";
import { $gameOwner } from "../state/game-state";
import { $expansionList } from '../state/expansion-list-state';
import { STANDARD_GAP } from '../app-contants';
import { isUndefined } from 'es-toolkit';
import { $matchConfiguration } from '../state/match-state';
import { MatchConfiguration } from 'shared/types';

export class MatchConfigurationScene extends Scene {
  private readonly _playerNameContainer: Container = new Container({ x: 300, y: 20 });
  private readonly _cleanup: (() => void)[] = [];
  private readonly _startGameBtn: AppButton = createAppButton({ text: 'START', style: { fontSize: 24 } });
  private _expansionContainer: Container = new Container({ x: 600, y: 20 });
  private _expansionHighlight: Graphics = new Graphics();
  
  constructor(stage: Container) {
    super(stage);
  }
  
  destroy(options?: DestroyOptions) {
    super.destroy(options);
    
    this._cleanup.forEach(c => c());
    this._startGameBtn.button.removeAllListeners();
  }
  
  initialize(data?: unknown) {
    super.initialize(data);
    
    this._cleanup.push($players.subscribe(this.draw.bind(this)));
    this._cleanup.push($gameOwner.subscribe(this.draw.bind(this)));
    
    this.addChild(this._playerNameContainer);
    
    this._startGameBtn.button.x = 20;
    this._startGameBtn.button.y = 20;
    this._startGameBtn.button.on('pointerdown', this.onStartGame.bind(this));
    
    $expansionList.subscribe(this.createExpansionList.bind(this));
    
    $matchConfiguration.subscribe(this.onMatchConfigurationUpdated.bind(this));
  }
  
  private async createExpansionList(val: readonly any[]) {
    if (!val || val.length === 0) {
      return;
    }
    
    this._expansionContainer.removeChildren()
      .forEach(c => c.destroy());
    
    let maxWidth: number = 0;
    
    for (const [idx, expansion] of val.entries()) {
      const c = new Container({
        y: this._expansionContainer.height + (STANDARD_GAP * 2) * idx
      });
      c.eventMode = 'static';
      c.label = expansion.expansionName;
      
      const t = new Text({
        x: STANDARD_GAP,
        y: STANDARD_GAP,
        style: { fontSize: 24, fill: 'black' },
        text: expansion.title,
        label: expansion.expansionName
      });
      c.addChild(t);
      
      c.on('pointerdown', () => {
        let expansions = $matchConfiguration.get().expansions;
        const expansionIdx = expansions.findIndex(e => e === c.label);
        
        if (expansionIdx === -1) {
          expansions.push(c.label);
        } else {
          expansions = expansions.splice(idx, 1);
        }
        
        socket.emit('matchConfigurationUpdated', {expansions});
      });
      c.on('destroyed', () => {
        c.removeAllListeners();
      })
      
      const texture = await Assets.load(`./assets/expansion-icons/${expansion.expansionName}.png`)
      const s = Sprite.from(texture);
      s.scale = .7;
      s.x = t.x + t.width + STANDARD_GAP;
      s.y = Math.floor(t.y + t.height * .5 - s.height * .5);
      c.addChild(s);
      
      maxWidth = Math.max(maxWidth, c.width);
      
      this._expansionContainer.addChild(c);
    }
    
    for (const expansionContainer of this._expansionContainer.children) {
      const highlight = new Graphics({label: 'highlight'});
      highlight.roundRect(0, 0, maxWidth + STANDARD_GAP * 2, expansionContainer.height + STANDARD_GAP * 2, 5)
        .stroke({
          color: 0xffffff,
          width: 2,
        });
      highlight.visible = false;
      expansionContainer.addChild(highlight);
    }
    
    if ($gameOwner.get() === $selfPlayerId.get()) {
      socket.emit('matchConfigurationUpdated', {
        expansions: ['base-v2'],
      });
    }
    
    this.addChild(this._expansionContainer);
  }
  
  private onMatchConfigurationUpdated(val: Readonly<Pick<MatchConfiguration, 'expansions'>>) {
    this._expansionHighlight.clear();
    if (!val) {
      return;
    }
    
    for (const c of this._expansionContainer.children) {
      c.getChildByLabel('highlight').visible = val.expansions.includes(c.label);
    }
    
    /*this._expansionContainer.*/
    
    /*this.addChild(this._expansionHighlight);*/
  }
  
  private onStartGame() {
    socket.emit('startMatch', {
      expansions: ['base-v2']
    });
  }
  
  private draw() {
    const players = $players.get();
    if (!isUndefined(players)) {
      this._playerNameContainer.removeChildren()
        .forEach(c => c.destroy());
      Object.values(players)
        .forEach((player, idx) => {
          const t = new Text({
            y: idx * 30,
            text: `${player.name}${player.connected ? '' : ' - disconnected'}`,
            style: {
              fontSize: 24,
              fill: 'black'
            }
          });
          this._playerNameContainer.addChild(t);
        });
    }
    
    const ownerId = $gameOwner.get();
    if (!isUndefined(ownerId)) {
      this._startGameBtn.button.removeFromParent();
      
      if (ownerId === $selfPlayerId.get()) {
        this.addChild(this._startGameBtn.button);
      }
    }
  }
}
