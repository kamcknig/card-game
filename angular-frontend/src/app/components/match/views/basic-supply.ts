import { Container, Graphics } from 'pixi.js';
import { SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH, STANDARD_GAP } from '../../../core/app-contants';
import { computed } from 'nanostores';
import { basicSupplies } from '../../../state/match-logic';
import { cardStore } from '../../../state/card-state';
import { Card, CardKey } from 'shared/shared-types';
import { PileView } from './pile';
import { getCardSourceStore } from '../../../state/card-source-store';

export class BasicSupplyView extends Container {
  private _background: Container;
  private _cardContainer: Container;
  private _cleanup: (() => void)[] = [];

  constructor() {
    super();

    this._background = this.addChild(new Container());
    this._background.addChild(new Graphics());

    this._cardContainer = this.addChild(new Container({ x: STANDARD_GAP, y: STANDARD_GAP }));


    const pileCreationSub = computed(
      [basicSupplies, cardStore], ([victorySupply, treasureSupply], cards) => {
        const allCards = Object.values(cards);
        return [
          victorySupply.map(key =>
            allCards.find(c => c.cardKey === key)),
          treasureSupply.map(key =>
            allCards.find(c => c.cardKey === key))
        ]
      }
    ).subscribe(val => {
      if (val[0].length < 1) {
        return;
      }
      this.createSupplyPiles(val[0] as Card[], val[1] as Card[]);
    });

    this._cleanup.push(pileCreationSub);

    this._cleanup.push(
      computed(
        [getCardSourceStore('basicSupply'), basicSupplies, cardStore],
        (supply, supplyNames, cards) => {
          const supplyCards = supply.map(id => cards[id]);

          const ob = {} as Record<CardKey, Card[]>;
          for (const cardKey of supplyNames.flat()) {
            ob[cardKey] = supplyCards.filter(card => card.cardKey === cardKey);
          }
          return ob;
        }
      ).subscribe((val => this.draw(val)))
    );

    this.on('removed', this.onRemoved);
  }

  private onRemoved = () => {
    this._cleanup.forEach(cb => cb());
    this.off('removed', this.onRemoved);
  }

  private createSupplyPiles(victoryCards: readonly Card[], treasureCards: readonly Card[]) {
    this._cardContainer.removeChildren();

    // Sort victory cards by descending cost
    const sortedVictoryCards = [...victoryCards].sort((cardA, cardB) => {
      return (cardB?.cost.treasure ?? 0) - (cardA?.cost.treasure ?? 0);
    });

    for (const [idx, card] of sortedVictoryCards.entries()) {
      const pileView = new PileView({ size: 'half' });
      pileView.y = idx * SMALL_CARD_HEIGHT + idx * STANDARD_GAP;
      pileView.label = `pile:${card.cardKey}`;
      this._cardContainer.addChild(pileView);
    }

    // Sort treasure cards by descending cost
    const sortedTreasureKeys = [...treasureCards].sort((cardA, cardB) => {
      return (cardB?.cost.treasure ?? 0) - (cardA?.cost.treasure ?? 0);
    });

    for (const [idx, card] of sortedTreasureKeys.entries()) {
      const pileView = new PileView({ size: 'half' });
      pileView.x = SMALL_CARD_WIDTH + STANDARD_GAP;
      pileView.y = idx * SMALL_CARD_HEIGHT + idx * STANDARD_GAP;
      pileView.label = `pile:${card.cardKey}`;
      this._cardContainer.addChild(pileView);
    }
  }

  private draw(piles: Record<CardKey, Card[]>) {
    if (!piles) return;

    for (const [cardKey, pile] of Object.entries(piles)) {
      const p = this._cardContainer.getChildByLabel(`pile:${cardKey}`) as PileView;
      if (!p) {
        return;
      }
      p.pile = pile;
    }

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
}
