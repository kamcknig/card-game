import {Color, Container, Graphics, Text} from 'pixi.js';
import {ScrollBox} from '@pixi/ui';
import {STANDARD_GAP} from '../app-contants';
import {gameEvents} from '../core/event/events';

export class GameLogView extends Container {
    private readonly _scrollBox: ScrollBox;
    private readonly _expandCollapse: Graphics;
    private _collapsed: Boolean = false;

    constructor() {
        super();

        this._scrollBox = new ScrollBox({
            width: 350,
            height: 800,
            radius: 5,
            elementsMargin: STANDARD_GAP * .5,
            vertPadding: STANDARD_GAP,
            horPadding: STANDARD_GAP,
            background: new Color('0x000000cc')
        });
        this.addChild(this._scrollBox);
        
        this._expandCollapse = new Graphics();
        this._expandCollapse.eventMode = 'static';
        this._expandCollapse.on('pointerdown', this.onToggleCollapse.bind(this));
        this._expandCollapse
          .lineTo(10, 10)
          .lineTo(0, 20)
          .lineTo(0, 0)
          .fill('white');
        this._expandCollapse.x = this._scrollBox.width - this._expandCollapse.width - STANDARD_GAP;
        this._expandCollapse.y = STANDARD_GAP;
        this.addChild(this._expandCollapse);
        
        gameEvents.on('addLogEntry', (logEntry: string) => {
            this.addEntry(logEntry);
        });
    }

    public addEntry(entry: string) {
        const t = new Text({
            text: entry,
            style: { fontSize: 16, fill: 'white'}
        });

        const c = new Container();
        const g = c.addChild(new Graphics());
        g.rect(0, 0, this.width, t.height).fill(new Color('0x00000000'));

        t.y = g.height * .5 - t.height * .5
        c.addChild(t);

        this._scrollBox.addItem(c);
        this._scrollBox.scrollBottom();
    }
    
    private drawCollapseIcon() {
        this._expandCollapse.scale.x = this._collapsed ? -1 : 1;
        this._expandCollapse.x += this._collapsed ? 5 : -5
    }
    
    private onToggleCollapse() {
        this._collapsed = !this._collapsed;
        this._scrollBox.visible = this._collapsed ? false : true;
        this.drawCollapseIcon();
    }
}