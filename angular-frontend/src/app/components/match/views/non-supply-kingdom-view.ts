import { Container, Graphics, Text } from 'pixi.js';
import { Card, CardNoId } from 'shared/types';
import { PileView } from './pile';
import { STANDARD_GAP } from '../../../core/app-contants';
import { nonSupplyKingdomMapStore } from '../../../state/card-source-logic';
import { capitalize } from 'es-toolkit';
import { concatMap, pipe, Subject, Subscription } from 'rxjs';
import { getPixiSceneTheme } from '../../../theme/pixi-theme';
import { createPanelShadowFilter } from './panel-shadow-filter';

type KingdomMap = Record<string, {
  startingCards: CardNoId[],
  cards: readonly Card[]
}>;

export class NonSupplyKingdomView extends Container {
  private readonly _pixiTheme = getPixiSceneTheme();
  private _container: Container;
  private _drawSubject: Subject<KingdomMap> = new Subject();
  private _drawSub: Subscription;

  constructor() {
    super();

    this._container = this.addChild(new Container());

    this._drawSub = this._drawSubject
      .pipe(concatMap(kingdomMap => this.draw(kingdomMap)))
      .subscribe();

    const nonSupplyUnsub = nonSupplyKingdomMapStore.subscribe(async kingdomMap => {
      this._drawSubject.next(kingdomMap);
    });

    this.on('removed', () => {
      nonSupplyUnsub();
      this._drawSub.unsubscribe();
    });
  }

  private _kingdomContainerMap = new Map<string, Container>();

  private async draw(kingdomMap: KingdomMap) {
    let colNumber = 1;
    for (const kingdomName of Object.keys(kingdomMap)) {
      if (this._kingdomContainerMap.has(kingdomName)) {
        await this.drawKingdom(kingdomName, kingdomMap[kingdomName], this._kingdomContainerMap.get(kingdomName)!);
        continue;
      }

      let colContainer = this._container.getChildByLabel(`column:${colNumber}`);

      while (true) {
        if (!colContainer) {
          colContainer = new Container({ label: `column:${colNumber}` });
          colContainer.x = (this.width + STANDARD_GAP * 3) * (colNumber - 1);
          this._container.addChild(colContainer);
        }

        if (colContainer.height > 425) {
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

  private async drawKingdom(kingdomName: string, kingdom: {
    startingCards: CardNoId[],
    cards: readonly Card[]
  }, parent: Container) {
    if (!kingdomName || !kingdom) {
      return;
    }

    let container = parent.getChildByLabel(kingdomName);

    if (!container) {
      container = new Container({ label: kingdomName });
      container.y = parent.height + STANDARD_GAP * Math.max(0, parent.children.length);
      this._container.addChild(container);
    }

    let background = container.getChildByLabel('background') as Graphics;
    if (!background) {
      background = new Graphics({ label: 'background' });
      // Non-supply panel keeps a compact drop shadow like other board panels.
      background.filters = [createPanelShadowFilter()];
      container.addChild(background);
    }

    let text = container.getChildByLabel('text') as Text;

    if (!text) {
      text = new Text({
        text: capitalize(kingdomName),
        label: 'text',
        style: { fontSize: 18, fill: this._pixiTheme.text.onOverlay }
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

    const isLootPile = kingdomName === 'loot';
    const displayRows = kingdom.startingCards;
    const rowIds = displayRows.map((card, idx) => isLootPile ? `loot:${idx}` : card.cardKey);

    // Remove stale rows that are no longer present in the current pile view model.
    for (const row of [...cardContainer.children]) {
      if (!row.label || rowIds.includes(row.label)) {
        continue;
      }
      row.destroy({ children: true });
    }

    for (const [idx, card] of displayRows.entries()) {
      const rowId = isLootPile ? `loot:${idx}` : card.cardKey;
      let pile = cardContainer.getChildByLabel(rowId) as PileView;
      if (!pile) {
        pile = new PileView({
          size: 'half',
          // Loot remains face-down while in the non-supply pile.
          facing: isLootPile ? 'back' : 'front',
        });
        pile.label = rowId;
        cardContainer.addChild(pile);
      }

      pile.y = isLootPile ? 0 : idx * 30;
      pile.pile = isLootPile
        ? [...kingdom.cards]
        : kingdom.cards.filter(c => c.cardKey === card.cardKey);
    }

    parent.addChild(container);

    return new Promise((resolve: (value: Container) => void) => {
      setTimeout(() => {
        background.clear();
        background.roundRect(0, 0, container.width + STANDARD_GAP * 2, container.height + STANDARD_GAP * 2, 5);
        background.stroke({ color: this._pixiTheme.ui.panelBorder, width: 1.5 });
        background.fill({ color: this._pixiTheme.overlay.color, alpha: this._pixiTheme.overlay.mediumAlpha });
        resolve(container);
      }, 50);
    });
  }
}
