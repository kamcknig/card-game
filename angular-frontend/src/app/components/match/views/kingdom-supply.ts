import { Container, Graphics } from 'pixi.js';
import { PileView } from './pile';
import { cardStore } from '../../../state/card-state';
import { Card, CardKey } from 'shared/shared-types';
import { SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH, STANDARD_GAP } from '../../../core/app-contants';
import { kingdomCardKeyStore, kingdomSupplyStore } from '../../../state/match-logic';
import { computed } from 'nanostores';

export class KingdomSupplyView extends Container {
  private _background: Container;
  private _cardContainer: Container;
  private _cleanup: (() => void)[] = [];

  constructor() {
    super();

    this._background = this.addChild(new Container());
    this._background.addChild(new Graphics());

    this._cardContainer = this.addChild(new Container({ x: STANDARD_GAP, y: STANDARD_GAP }));

    const pileCreationSub = computed(
      [kingdomCardKeyStore, cardStore], (kingdom, cards) => {
        const allCards = Object.values(cards);
        return kingdom
          .map(key => allCards.find(c => c.cardKey === key))
          .sort((a, b) => {
            if (!a || !b) throw new Error(`failed to build kingdom, card not found in card store`);
            const result = a.cost.treasure - b.cost.treasure;
            if (result !== 0) return result;
            return a.cardName.localeCompare(b.cardName);
          })
          .filter(key => !!key)
          .map(card => card?.cardKey)
      }
    ).subscribe(val => {
      if (val.length < 1) {
        return;
      }

      this.createKingdomPiles(val);
    });

    this._cleanup.push(pileCreationSub);

    this._cleanup.push(
      computed(
        [kingdomSupplyStore, cardStore],
        (kingdom, cards) => kingdom.map(id => cards[id])
      ).subscribe((val => this.draw(val)))
    );
    this.off('removed', this.onRemoved);
  }

  private onRemoved = () => {
    this._cleanup.forEach(cb => cb());
    this.on('removed', this.onRemoved);
  }

  private draw(cards: ReadonlyArray<Card>) {
    if (!cards || cards.length === 0) return;

    const piles = cards.reduce((prev, card) => {
      prev[card.cardKey] ||= [];
      prev[card.cardKey].push(card);
      return prev;
    }, {} as Record<CardKey, Card[]>)

    Object.entries(piles).forEach(([cardKey, pile], idx) => {
      const p = this._cardContainer.getChildByLabel(`pile:${cardKey}`) as PileView;
      if (!p) {
        return;
      }
      p.pile = pile;
    })

    const g = this._background.getChildAt(0) as Graphics;
    g.clear();
    g.roundRect(
      0,
      0,
      this._cardContainer.x + this._cardContainer.width + STANDARD_GAP,
      this._cardContainer.y + this._cardContainer.height + STANDARD_GAP,
      5
    )
      .fill({
        color: 0,
        alpha: .6
      });
  }

  private createKingdomPiles(cardKeys: readonly CardKey[]) {
    this._cardContainer.removeChildren();

    const numColumns = 5;

    for (const [idx, cardKey] of cardKeys.entries()) {
      const p = new PileView({ size: 'half' });
      p.label = `pile:${cardKey}`;

      const col = idx % numColumns;
      const row = Math.floor(idx / numColumns);

      p.x = col * (SMALL_CARD_WIDTH + STANDARD_GAP);
      p.y = row * (SMALL_CARD_HEIGHT + STANDARD_GAP);
      this._cardContainer.addChild(p);
    }
  }
}
