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

    const nonSupplyUnsub = nonSupplyKingdomMapStore.subscribe(async kingdomMap => {
      await this.draw(kingdomMap);
    });

    this.on('removed', () => {
      nonSupplyUnsub();
    });
  }

  private _kingdomContainerMap = new Map<string, Container>();

  private async draw(kingdomMap: Readonly<Record<string, { startingCards: CardNoId[]; cards: readonly Card[]}>>) {
    let colNumber = 1;
    for (const [idx, kingdomName] of Object.keys(kingdomMap).entries()) {
      console.log('draw', kingdomName);
      if (this._kingdomContainerMap.has(kingdomName)) {
        console.log('found previous colum', this._kingdomContainerMap.get(kingdomName)!.label);
        await this.drawKingdom(kingdomName, kingdomMap[kingdomName], this._kingdomContainerMap.get(kingdomName)!);
        continue;
      }

      let colContainer = this._container.getChildByLabel(`column:${colNumber}`);

      while (true) {
        if (!colContainer) {
          colContainer = new Container({ label: `column:${colNumber}` });
          console.log('created new column', colContainer.label);
          colContainer.x = this.width + STANDARD_GAP;
          console.log('setting x to', colContainer.x);
          this._container.addChild(colContainer);
        }

        console.log(colContainer.height);
        if (colContainer.height > 300) {
          console.log('col container is full, increasing col number to', colNumber + 1);
          colNumber++;
          colContainer = null;
        }
        else {
          break;
        }
      }

      await this.drawKingdom(kingdomName, kingdomMap[kingdomName], colContainer);
      this._kingdomContainerMap.set(kingdomName, colContainer);
    }
  }

  private async drawKingdom(kingdomName: string, kingdom: { startingCards: CardNoId[], cards: readonly Card[] }, parent: Container) {
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

    container.y = parent.height + STANDARD_GAP;
    parent.addChild(container);

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
