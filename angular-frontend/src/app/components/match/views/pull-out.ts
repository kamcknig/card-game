import { Container, Graphics, Text } from 'pixi.js';
import { CARD_HEIGHT, CARD_WIDTH, STANDARD_GAP } from '../../../core/app-contants';
import { CountBadgeView } from './count-badge-view';

type PullOutArgs = {
  tabLabel: string;
}

export class PullOut extends Container {
  private _collapsed: boolean = true;

  constructor(private readonly args: PullOutArgs) {
    super();


    this.createTab();
  }

  private createTab() {
    const tabContainer = new Container();
    tabContainer.eventMode = 'static';
    tabContainer.on('pointerdown', () => this.togglePosition());

    const tabText = new Text({
      text: this.args.tabLabel,
      style: {
        fontSize: 18,
        fill: 'white',
      }
    });
    tabText.x = STANDARD_GAP;
    tabText.y = STANDARD_GAP;
    tabContainer.addChild(tabText);

    const badgeCount = new CountBadgeView();
    badgeCount.x = tabText.x + tabText.width + 5;
    badgeCount.y = Math.floor(tabText.y + tabText.height * .5 - badgeCount.height * .5);
    tabContainer.addChild(badgeCount);

    const tabContainerBg = new Graphics();
    tabContainerBg.roundRect(0, 0, tabContainer.width + STANDARD_GAP * 2, tabContainer.height + STANDARD_GAP * 2, 5);
    tabContainerBg.fill({color: 0, alpha: .6});
    tabContainer.addChildAt(tabContainerBg, 0);

    tabContainer.angle = -90;
    this.addChild(tabContainer);

    const contentBg = new Graphics();
    contentBg.roundRect(0, 0, CARD_WIDTH * 5 + STANDARD_GAP * 6, CARD_HEIGHT + STANDARD_GAP * 2, 5);
    contentBg.fill({color: 0, alpha: .6});
    contentBg.x = -contentBg.width;
    contentBg.y = Math.floor(-tabContainer.width);
    this.addChild(contentBg);
  }

  private togglePosition() {
    this._collapsed = !this._collapsed;

    this.x = this._collapsed ? 0 : this.getBounds().minX * -1
  }
}
