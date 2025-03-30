import { Assets, Color, Container, DestroyOptions, Graphics, Sprite, Text } from "pixi.js";
import { Scene } from "../../core/scene/scene";
import { $players, $selfPlayerId } from "../../state/player-state";
import { socket } from "../../client-socket";
import { $gameOwner } from "../../state/game-state";
import { $expansionList } from '../../state/expansion-list-state';
import { STANDARD_GAP } from '../../app-contants';
import { isUndefined } from 'es-toolkit';
import { $matchConfiguration } from '../../state/match-state';
import { MatchConfiguration, Player } from 'shared/shared-types';
import { CheckBox, Input, List } from "@pixi/ui";
import { AppList } from '../../app-list';

export class MatchConfigurationScene extends Scene {
  private readonly _playerList: List = new List({
    type: 'vertical',
    padding: STANDARD_GAP,
    elementsMargin: STANDARD_GAP,
  });
  private readonly _cleanup: (() => void)[] = [];
  private _expansionList: List = new List({type: 'vertical', padding: STANDARD_GAP, elementsMargin: STANDARD_GAP});
  private _expansionHighlight: Graphics = new Graphics();
  private _updateNameTimeout: any;
  
  constructor(stage: Container) {
    super(stage);
    this.on('removed', this.onRemoved);
  }
  
  private onRemoved = () => {
    this._cleanup.forEach(cb => cb());
    this.off('removed', this.onRemoved);
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
    this._expansionList.removeChildren();
    
    if (!val || val.length === 0) {
      return;
    }
    
    for (const expansion of val) {
      const expansionList = new AppList({ type:'horizontal', elementsMargin: STANDARD_GAP});
      expansionList.eventMode = 'static';
      expansionList.label = expansion.expansionName;
      
      const texture = await Assets.load(`./assets/expansion-icons/${expansion.expansionName}.png`)
      const s = Sprite.from(texture);
      s.label = 'expansionIcon';
      const maxSide = 25;
      s.scale = Math.min(maxSide / s.width, maxSide / s.height);
      const spriteContainer = new Container({label: 'expansionIconContainer'});
      spriteContainer.addChild(s);
      expansionList.addChild(spriteContainer);
      
      const t = new Text({
        style: { fontSize: 24, fill: 'black' },
        text: expansion.title,
        label: expansion.expansionName
      });
      expansionList.addChild(t);
      
      if ($selfPlayerId.get() === $gameOwner.get()) {
        expansionList.on('pointerdown', () => {
          let expansions = $matchConfiguration.get().expansions;
          const expansionIdx = expansions.findIndex(e => e === expansionList.label);
          
          if (expansionIdx === -1) {
            expansions.push(expansionList.label);
          } else {
            expansions = expansions.filter(e => e !== expansionList.label);
          }
          
          socket.emit('matchConfigurationUpdated', { expansions });
        });
        expansionList.on('removed', () => {
          expansionList.removeAllListeners();
        })
      }
      
      this._expansionList.addChild(expansionList);
      this._expansionList.y = STANDARD_GAP;
      this._expansionList.x = 700;
    }
    
    for (const expansionContainer of this._expansionList.children) {
      const expansionIconContainer = expansionContainer.getChildByLabel('expansionIconContainer');
      if (!expansionIconContainer) continue;
      
      const sprite = expansionIconContainer.getChildByLabel('expansionIcon');
      if (!sprite) continue;
      
      const highlight = new Graphics({ label: 'highlight' });
      highlight.roundRect(0, 0, sprite.width, sprite.height, 5);
      highlight.stroke({
        color: 0xffffff,
        width: 2,
        alignment: -3,
      });
      highlight.visible = $matchConfiguration.get()
        .expansions
        .includes(expansionContainer.label);
      
      expansionIconContainer.addChild(highlight);
    }
    
    if ($gameOwner.get() === $selfPlayerId.get()) {
      socket.emit('matchConfigurationUpdated', {
        expansions: $matchConfiguration.get().expansions.length ? $matchConfiguration.get().expansions : ['base-v2'],
      });
    }
    
    this.addChild(this._expansionList);
  }
  
  private onMatchConfigurationUpdated(val: Readonly<Pick<MatchConfiguration, 'expansions'>>) {
    this._expansionHighlight.clear();
    if (!val) {
      return;
    }
    
    for (const c of this._expansionList.children) {
      const highlight = c.getChildByLabel('expansionIconContainer')?.getChildByLabel('highlight');
      if (highlight) {
        highlight.visible = val.expansions.includes(c.label);
      }
    }
  }
  
  private async updatePlayerList() {
    const players = $players.get();
    
    this._playerList.removeChildren();
    const selfId = $selfPlayerId.get();
    
    if (isUndefined(players)) {
      return;
    }
    
    for (const player of Object.values(players)) {
      let item: List = new List({
        type: 'horizontal',
        elementsMargin: STANDARD_GAP
      });
      
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
      
      await this.drawReadySelect(player, item);
      
      this._playerList.addChild(item);
    }
  }
  
  private async drawReadySelect(player: Player, item: List) {
    const checked = Sprite.from(await Assets.load('./assets/ui-icons/check-box-checked.png'));
    const unchecked = Sprite.from(await Assets.load('./assets/ui-icons/check-box-unchecked.png'));
    const selfId = $selfPlayerId.get();
    
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
        socket.emit('playerReady', selfId, checked as boolean);
      });
    } else {
      // i don't see a way in the docs to disable the switcher. so instead when it's switched by someone
      // who it's not just change it back immediately
      readyCheckSignal = readyCheck.onChange.connect(() => {
        readyCheck.forceCheck(!readyCheck.checked)
      });
    }
    
    this._cleanup.push(() => readyCheckSignal.disconnect());
    
    readyCheck.visible = selfId === player.id;
    item.addChildAt(readyCheck, 0);
    checked.y = unchecked.y = Math.floor(item.height * .5 - checked.height * .5);
  }
}
