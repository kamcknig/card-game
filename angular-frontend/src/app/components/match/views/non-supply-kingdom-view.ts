import { Container, Graphics, Text } from 'pixi.js';
import { Card, CardNoId } from 'shared/shared-types';
import { PileView } from './pile';
import { STANDARD_GAP } from '../../../core/app-contants';
import { nonSupplyKingdomMapStore } from '../../../state/card-source-logic';
import { capitalize } from 'es-toolkit';

export class NonSupplyKingdomView extends Container {
  private _container: Container;

  constructor() {
    super();

    this._container = this.addChild(new Container());

    const nonSupplyUnsub = nonSupplyKingdomMapStore.subscribe(kingdomMap => {
      this.draw(kingdomMap);
    });

    this.on('removed', () => {
      nonSupplyUnsub();
    });
  }

  private draw(kingdomMap: Readonly<Record<string, { startingCards: CardNoId[]; cards: readonly Card[]}>>) {
    for (const kingdomName of Object.keys(kingdomMap)) {
      const kingdom = this.drawKingdom(kingdomName, kingdomMap[kingdomName]);
    }
  }

  private drawKingdom(kingdomName: string, kingdom: { startingCards: CardNoId[], cards: readonly Card[] }) {
    if (!kingdomName || !kingdom) {
      return;
    }

    let container = this._container.getChildByLabel(kingdomName);

    if (!container) {
      container = new Container({ label: kingdomName });
      this._container.addChild(container);
    }

    let background = container.getChildByLabel('background') as Graphics;
    if (!background) {
      background = new Graphics({ label: 'background' });
      container.addChild(background);
    }

    let text = container.getChildByLabel('text') as Text;

    if (!text) {
      text = new Text({
        text: capitalize(kingdomName),
        label: 'text',
        style: { fontSize: 18, fill: 'white' }
      });
      text.x = STANDARD_GAP;
      text.y = STANDARD_GAP;
      container.addChild(text);
    }

    let cardContainer = container.getChildByLabel('cardContainer');

    if (!cardContainer) {
      cardContainer = new Container({ label: 'cardContainer' });
      cardContainer.y = text.y + text.height + STANDARD_GAP;
      cardContainer.x = STANDARD_GAP;
      container.addChild(cardContainer);
    }

    for (const [idx, card] of kingdom.startingCards.entries()) {
      const cardKey = card.cardKey;
      let pile = cardContainer.getChildByLabel(cardKey) as PileView;
      if (!pile) {
        pile = new PileView({
          size: 'half',
          facing: 'front',
        });
        pile.label = cardKey;
        pile.y = idx * 30;
        cardContainer.addChild(pile);
      }

      pile.pile = kingdom.cards.filter(c => c.cardKey === cardKey);
    }

    return Promise.resolve((resolve: (value: Container) => void) => {
      setTimeout(() => {
        background.clear();
        background.roundRect(0, 0, container.width + STANDARD_GAP * 2, container.height + STANDARD_GAP * 2, 5);
        background.fill({ color: 0, alpha: .6 });
        resolve(container);
      }, 200);
    });
  }
}
