import {Assets, Container, DestroyOptions, Graphics, Sprite, Text} from "pixi.js";
import { createAppButton } from "../core/create-app-button";
import { Scene } from "../core/scene/scene";
import { $players, $selfPlayerId } from "../state/player-state";
import { socket } from "../client-socket";
import { $gameOwner } from "../state/game-state";
import {$expansionList, $selectedExpansions} from '../state/expansion-list-state';
import { STANDARD_GAP } from '../app-contants';
import { isUndefined } from 'es-toolkit';

export class MatchConfigurationScene extends Scene {
    private readonly _playerNameContainer: Container = new Container({x: 300, y: 20});
    private readonly _cleanup: (() => void)[] = [];
    private readonly _startGameBtn = createAppButton({text: 'START', style: {fontSize: 24}});
    private _expansionContainer: Container = new Container({x:600, y:20});
    private _expansionHighlight: Graphics = new Graphics();

    constructor(stage: Container) {
        super(stage);
    }

    destroy(options?: DestroyOptions) {
        super.destroy(options);

        this._cleanup.forEach(c => c());
        this._startGameBtn.removeAllListeners();
    }

    initialize(data?: unknown) {
        super.initialize(data);

        this._cleanup.push($players.subscribe(this.draw.bind(this)));
        this._cleanup.push($gameOwner.subscribe(this.draw.bind(this)));

        this.addChild(this._playerNameContainer);

        this._startGameBtn.x = 20;
        this._startGameBtn.y = 20;
        this._startGameBtn.on('pointerdown', this.onStartGame.bind(this));
        
        $expansionList.subscribe(this.createExpansionList.bind(this));
        $selectedExpansions.subscribe(this.setSelectedExpansion.bind(this));
    }

    private async createExpansionList(val: readonly any[]) {
        if (!val || val.length === 0)  {
            return;
        }

        this._expansionContainer.removeChildren().forEach(c => c.destroy());

        for (const [idx, expansion] of val.entries()) {
            const t = new Text({
                y: this._expansionContainer.height + (STANDARD_GAP * 2) * idx,
                style: { fontSize: 24, fill: 'black' },
                text: expansion.title,
                label: expansion.expansionName
            });
            this._expansionContainer.addChild(t);
            t.eventMode = 'static';
            t.on('pointerdown', () => {
                $selectedExpansions.set([t.label]);
                socket.emit('expansionSelected', [t.label]);
            });
            t.on('destroyed', () => {
                t.removeAllListeners();
            })
            
            const texture = await Assets.load(`./assets/expansion-icons/${expansion.expansionName}.png`)
            const s = Sprite.from(texture);
            s.scale = .7;
            s.x = t.x + t.width + STANDARD_GAP;
            s.y = Math.floor(t.y + t.height * .5 - s.height * .5);
            this._expansionContainer.addChild(s);
        }

        if ($gameOwner.get() === $selfPlayerId.get()) {
            const expansion = $selectedExpansions.get().length ? $selectedExpansions.get()[0] : 'base-v2';
            $selectedExpansions.set([expansion]);
            socket.emit('expansionSelected', [expansion]);
        }

        this.addChild(this._expansionContainer);
    }
    
    private setSelectedExpansion(val: readonly string[], oldVal: readonly string[]) {
        if (!val || !val.length) {
            return;
        }
        
        if (oldVal) {
            this._expansionHighlight.clear();
        }

        /*const t = this._expansionContainer.getChildByLabel(val[0]);
        const point = t.getGlobalPosition();
        this._expansionHighlight.x = point.x;
        this._expansionHighlight.y = point.y;
        this._expansionHighlight.roundRect(-STANDARD_GAP, -STANDARD_GAP, this._expansionContainer.width + STANDARD_GAP * 2, t.height + STANDARD_GAP * 2, 5).stroke('white');*/
        this.addChild(this._expansionHighlight);
    }
    
    private onStartGame() {
        socket.emit('startMatch', {
            expansions: ['base-v2']
        });
    }

    private draw() {
        const players = $players.get();
        if (!isUndefined(players)) {
            this._playerNameContainer.removeChildren().forEach(c => c.destroy());
            Object.values(players).forEach((player, idx) => {
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
            this._startGameBtn.removeFromParent();

            if (ownerId === $selfPlayerId.get()) {
                this.addChild(this._startGameBtn);
            }
        }
    }
}
