import { Assets, Color, Container, DestroyOptions, Graphics, Sprite, Text } from "pixi.js";
import { Scene } from "../../core/scene/scene";
import { $players, $selfPlayerId } from "../../state/player-state";
import { socket } from "../../client-socket";
import { $gameOwner } from "../../state/game-state";
import { $expansionList } from '../../state/expansion-list-state';
import { STANDARD_GAP } from '../../app-contants';
import { isUndefined } from 'es-toolkit';
import { $matchConfiguration } from '../../state/match-state';
import { MatchConfiguration } from 'shared/types';
import { CheckBox, Input, List } from "@pixi/ui";

export class MatchConfigurationScene extends Scene {
  private readonly _playerList: List = new List({
    type: 'vertical',
    padding: STANDARD_GAP,
    elementsMargin: STANDARD_GAP,
  });
  private readonly _cleanup: (() => void)[] = [];
  private _expansionContainer: Container = new Container({ x: 700, y: 20 });
  private _expansionHighlight: Graphics = new Graphics();
  private _updateNameTimeout: any;
  
  constructor(stage: Container) {
    super(stage);
  }
  
  destroy(options?: DestroyOptions) {
    super.destroy(options);
    
    this._cleanup.forEach(cb => cb());
  }
  
  initialize() {
    super.initialize();
    
    this._cleanup.push($players.subscribe(this.updatePlayerList.bind(this)));
    this._playerList.x = 300;
    this._playerList.y = STANDARD_GAP;
    this.addChild(this._playerList);
    
    this._cleanup.push($expansionList.subscribe(this.createExpansionList.bind(this)))
    this._cleanup.push($matchConfiguration.subscribe(this.onMatchConfigurationUpdated.bind(this)))
  }
  
  private updateName(val: string) {
    clearTimeout(this._updateNameTimeout);
    
    this._updateNameTimeout = setTimeout(() => {
      socket.emit('updatePlayerName', $selfPlayerId.get(), val)
    }, 200);
  }
  
  private async createExpansionList(val: readonly any[]) {
    if (!val || val.length === 0) {
      return;
    }
    
    this._expansionContainer.removeChildren()
      .forEach(c => c.destroy({children: true}));
    
    let maxWidth: number = 0;
    
    for (const [idx, expansion] of val.entries()) {
      const c = new Container({
        y: this._expansionContainer.height + (STANDARD_GAP * 3) * idx
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
      
      if ($selfPlayerId.get() === $gameOwner.get()) {
        c.on('pointerdown', () => {
          let expansions = $matchConfiguration.get().expansions;
          const expansionIdx = expansions.findIndex(e => e === c.label);
          
          if (expansionIdx === -1) {
            expansions.push(c.label);
          } else {
            expansions = expansions.filter(e => e !== c.label);
          }
          
          socket.emit('matchConfigurationUpdated', { expansions });
        });
        c.on('destroyed', () => {
          c.removeAllListeners();
        })
      }
      
      const texture = await Assets.load(`./assets/expansion-icons/${expansion.expansionName}.png`)
      const s = Sprite.from(texture);
      const maxSide = 30;
      s.scale = Math.min(maxSide / s.width, maxSide / s.height);
      s.x = t.x + t.width + STANDARD_GAP;
      s.y = Math.floor(t.y + t.height * .5 - s.height * .5);
      c.addChild(s);
      
      maxWidth = Math.max(maxWidth, c.width);
      
      this._expansionContainer.addChild(c);
    }
    
    for (const expansionContainer of this._expansionContainer.children) {
      const highlight = new Graphics({ label: 'highlight' });
      highlight.roundRect(0, 0, maxWidth + STANDARD_GAP * 2, expansionContainer.height + STANDARD_GAP * 2, 5)
        .stroke({
          color: 0xffffff,
          width: 2,
        });
      highlight.visible = $matchConfiguration.get()
        .expansions
        .includes(expansionContainer.label);
      
      expansionContainer.addChild(highlight);
    }
    
    if ($gameOwner.get() === $selfPlayerId.get()) {
      socket.emit('matchConfigurationUpdated', {
        expansions: $matchConfiguration.get().expansions.length ? $matchConfiguration.get().expansions : ['base-v2'],
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
  }
  
  private async updatePlayerList() {
    const players = $players.get();
    
    this._playerList.removeChildren()
      .forEach(c => c.destroy({children: true}));
    const selfId = $selfPlayerId.get();
    
    if (isUndefined(players)) {
      return;
    }
    
    for (const player of Object.values(players)) {
      let item: List = new List({
        type: 'horizontal',
        elementsMargin: STANDARD_GAP
      });
      
      const checked = Sprite.from(await Assets.load('./assets/ui-icons/check-box-checked.png'));
      const unchecked = Sprite.from(await Assets.load('./assets/ui-icons/check-box-unchecked.png'));
      
      const readyCheck = new CheckBox({
        checked: player.ready,
        style: {
          checked,
          unchecked
        }
      });
      
      let readyCheckSignal;
      if (selfId === player.id) {
        readyCheckSignal = readyCheck.onChange.connect((checked) => {
          $players.set({
            ...$players.get(),
            [selfId]: {
              ...$players.get()[selfId],
              ready: checked as boolean
            }
          });
          socket.emit('ready', selfId, checked as boolean);
        });
      } else {
        // i don't see a way in the docs to disable the switcher. so instead when it's switched by someone
        // who it's not just change it back immediately
        readyCheckSignal = readyCheck.onChange.connect(() => {
          readyCheck.forceCheck(!readyCheck.checked)
        });
      }
      
      readyCheck.on('destroyed', () => {
        readyCheckSignal.disconnect();
      });
      
      item.addChild(readyCheck);
      
      let nameItem: Container;
      
      if (player.id === selfId) {
        nameItem = new Input({
          textStyle: {
            fontSize: 24,
            fill: 'black'
          },
          addMask: true,
          bg: new Graphics().roundRect(0, 0, 200, 40, 5)
            .fill('white'),
          placeholder: player.name,
          padding: STANDARD_GAP
        });
        const s = (nameItem as Input).onChange.connect(this.updateName.bind(this));
        nameItem.on('destroyed', () => s.disconnect());
      } else {
        nameItem = new Container();
        const g = new Graphics().roundRect(0, 0, 200, 40, 5)
          .fill(new Color('0x00000000'));
        nameItem.addChild(g);
        const t = new Text({
          x: STANDARD_GAP,
          text: `${player.name}${player.connected ? '' : ' - disconnected'}`,
          style: {
            fontSize: 24,
            fill: 'black'
          }
        });
        t.y = nameItem.height * .5 - t.height * .5;
        nameItem.addChild(t);
      }
      
      item.addChild(nameItem);
      checked.y = unchecked.y = Math.floor(item.height * .5 - checked.height * .5);
      
      this._playerList.addChild(item);
    }
  }
}
