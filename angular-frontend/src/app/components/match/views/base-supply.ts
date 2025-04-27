import { Container, Graphics } from 'pixi.js';
import { SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH, STANDARD_GAP } from '../../../core/app-contants';
import { computed } from 'nanostores';
import { supplyCardKeyStore, supplyStore } from '../../../state/match-logic';
import { cardStore } from '../../../state/card-state';
import { Card, CardKey } from 'shared/shared-types';
import { PileView } from './pile';

export class BaseSupplyView extends Container {
  private _background: Container;
  private _cardContainer: Container;
  private _cleanup: (() => void)[] = [];

  constructor() {
    super();

    this._background = this.addChild(new Container());
    this._background.addChild(new Graphics());

    this._cardContainer = this.addChild(new Container({ x: STANDARD_GAP, y: STANDARD_GAP }));

    this._cleanup.push(
      computed(
        [supplyCardKeyStore, cardStore], ([victorySupply, treasureSupply], cards) => {
          const allCards = Object.values(cards);
          return [
            victorySupply.map(key =>
              allCards.find(c => c.cardKey === key)?.cardKey),
            treasureSupply.map(key =>
              allCards.find(c => c.cardKey === key)?.cardKey)
          ]
        }
      ).subscribe(val => this.createSupplyPiles(val[0] as CardKey[], val[1] as CardKey[]))
    );

    this._cleanup.push(
      computed(
        [supplyStore, cardStore],
        (supply, cards) => supply.map(id => cards[id])
      ).subscribe((val => this.draw(val)))
    );
    this.off('removed', this.onRemoved);
  }

  private onRemoved = () => {
    this._cleanup.forEach(cb => cb());
    this.on('removed', this.onRemoved);
  }

  private createSupplyPiles(victoryCardKeys: readonly CardKey[], treasureCardKeys: readonly CardKey[]) {
    this._cardContainer.removeChildren();

    for (const [idx, cardKey] of victoryCardKeys.entries()) {
      const pileView = new PileView({ size: 'half' });
      pileView.y = idx * SMALL_CARD_HEIGHT + idx * STANDARD_GAP;
      pileView.label = `pile:${cardKey}`;
      console.log(`created supply pile ${pileView.label}`);
      this._cardContainer.addChild(pileView);
    }

    for (const [idx, cardKey] of treasureCardKeys.entries()) {
      const pileView = new PileView({ size: 'half' });
      pileView.x = SMALL_CARD_WIDTH + STANDARD_GAP;
      pileView.y = idx * SMALL_CARD_HEIGHT + idx * STANDARD_GAP;
      pileView.label = `pile:${cardKey}`;
      console.log(`created supply pile ${pileView.label}`);
      this._cardContainer.addChild(pileView);
    }
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
      console.log(`looking for pile:${cardKey} within supply`)
      console.log(this._cardContainer.children.length);
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
      5)
      .fill({
        color: 0,
        alpha: .6
      });
  }
}
