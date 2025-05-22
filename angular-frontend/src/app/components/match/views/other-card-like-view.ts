import { Container, ContainerOptions, Graphics } from 'pixi.js';
import { events } from '../../../state/match-logic';
import { EventNoId } from 'shared/shared-types';
import { EVENT_WIDTH, STANDARD_GAP } from '../../../core/app-contants';
import { CardLikeView } from './card-like-view';

export class OtherCardLikeView extends Container {
  private background: Graphics = new Graphics({ label: 'background' });
  private cardContainer: Container = new Container({ label: 'cardContainer' });

  constructor(args: ContainerOptions) {
    super(args);

    const eventsSub = events.subscribe(events => this.drawEvents(events));

    this.addChild(this.background);

    this.cardContainer.x = STANDARD_GAP;
    this.cardContainer.y = STANDARD_GAP;
    this.addChild(this.cardContainer);

    this.on('removed', () => {
      eventsSub();
    });
  }

  private drawEvents(events: readonly EventNoId[]) {
    for (const event of events) {
      let cardContainer = this.cardContainer.getChildByLabel(event.cardKey) as CardLikeView;

      if (!cardContainer) {
        cardContainer = new CardLikeView({ label: event.cardKey, event });
        cardContainer.x = this.cardContainer.children.length * (EVENT_WIDTH + STANDARD_GAP);
        this.cardContainer.addChild(cardContainer);
      }

      cardContainer.event = event;
    }

    this.background.clear();

    if (events.length > 0) {
      this.background.roundRect(0, 0, this.cardContainer.width + STANDARD_GAP * 2, this.cardContainer.height + STANDARD_GAP * 2, 5);
      this.background.fill({ color: 'black', alpha: .6 });
    }
  }
}
