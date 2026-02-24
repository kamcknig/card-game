import { Container, Graphics } from 'pixi.js';
import { PileView } from './pile';
import { cardStore } from '../../../state/card-state';
import { matchStore } from '../../../state/match-state';
import { tokenDefinitionStore } from '../../../state/token-definition-state';
import { Card, CardKey, Match, TokenDefinition, TokenId, Trait } from 'shared/types';
import { SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH, STANDARD_GAP } from '../../../core/app-contants';
import { kingdomSupplies } from '../../../state/match-logic';
import { computed } from 'nanostores';
import { getCardSourceStore } from '../../../state/card-source-store';
import { getSupplyPileTokenVisualMap } from './token-utils';
import { createPanelShadowFilter } from './panel-shadow-filter';

export class KingdomSupplyView extends Container {
  private _background: Container;
  private readonly _backgroundGraphics: Graphics = new Graphics({ label: 'backgroundGraphics' });
  private _cardContainer: Container;
  private _traitByPile: Record<CardKey, Trait> = {};
  private _cleanup: (() => void)[] = [];

  constructor() {
    super();

    this._background = this.addChild(new Container());
    this._background.addChild(this._backgroundGraphics);
    // Kingdom supply panel uses a short board shadow for visual depth.
    this._backgroundGraphics.filters = [createPanelShadowFilter()];

    this._cardContainer = this.addChild(new Container({ x: STANDARD_GAP, y: STANDARD_GAP }));

    const pileCreationSub = computed(
      [kingdomSupplies, cardStore],
      (kingdomNames, cardById) => {
        const allCards = Object.values(cardById);
        return kingdomNames
          .map(kingdom => allCards.find(c => c.kingdom === kingdom))
          .sort((a, b) => {
            if (!a || !b) throw new Error(`failed to build kingdom, card not found in card store`);
            const result = b.cost.treasure - a.cost.treasure;
            if (result !== 0) return result;
            return b.cardName.localeCompare(a.cardName);
          })
          .filter(card => !!card)
          .map(card => ({
            kingdom: card!.kingdom,
            pileKey: card!.randomizerData?.randomizer ?? card!.cardKey
          }))
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
        [getCardSourceStore('kingdomSupply'), cardStore],
        (kingdom, cards) => kingdom.map(id => cards[id])
      ).subscribe((val => this.draw(val)))
    );
    
    this._cleanup.push(
      computed(
        [matchStore, tokenDefinitionStore],
        (match, tokenDefinitions) => ({ match, tokenDefinitions })
      ).subscribe(({ match, tokenDefinitions }) => {
        this.updateTraitBadges(match);
        this.updatePileTokenVisuals(match, tokenDefinitions);
      })
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
      prev[card.kingdom] ||= [];
      prev[card.kingdom].push(card);
      return prev;
    }, {} as Record<CardKey, Card[]>)

    Object.entries(piles).forEach(([cardKey, pile], idx) => {
      const pileKey = pile[0]?.randomizerData?.randomizer ?? pile[0]?.cardKey ?? cardKey;
      const p = this._cardContainer.getChildByLabel(`pile:${pileKey}`) as PileView;
      if (!p) {
        return;
      }
      p.pile = pile;
      p.trait = this._traitByPile[pileKey] ?? null;
    })

    this._backgroundGraphics.clear();
    this._backgroundGraphics.roundRect(
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

  private createKingdomPiles(cardKeys: readonly { kingdom: CardKey; pileKey: CardKey }[]) {
    this._cardContainer.removeChildren();

    const numColumns = 5;
    const traitTagWidth = 22;

    for (const [idx, cardKey] of cardKeys.entries()) {
      const p = new PileView({ size: 'half' });
      p.label = `pile:${cardKey.pileKey}`;
      p.pileKey = cardKey.pileKey;
      p.trait = this._traitByPile[cardKey.pileKey] ?? null;

      const col = numColumns - 1 - (idx % numColumns);
      const row = Math.floor(idx / numColumns);

      p.x = col * (SMALL_CARD_WIDTH + traitTagWidth + STANDARD_GAP);
      p.y = row * (SMALL_CARD_HEIGHT + STANDARD_GAP);
      this._cardContainer.addChild(p);
    }
  }

  // Returns only pile views created by this component.
  private getPileViews(): PileView[] {
    return this._cardContainer.children
      .filter((child) => typeof child.label === 'string' && child.label.startsWith('pile:'))
      .map((child) => child as PileView);
  }

  // Updates trait assignments for each pile key and refreshes rendered pile tags.
  private updateTraitBadges(match: Match | null) {
    this._traitByPile = {};
    for (const trait of match?.traits ?? []) {
      if (!trait.pileKey) {
        continue;
      }
      this._traitByPile[trait.pileKey] = trait;
    }

    const piles = this.getPileViews();
    for (const pile of piles) {
      if (!pile.pileKey) {
        continue;
      }
      pile.trait = this._traitByPile[pile.pileKey] ?? null;
    }
  }
  
  // Updates generic pile token visuals (badges + debt chips) based on match token state.
  private updatePileTokenVisuals(match: Match | null, tokenDefinitions: Record<TokenId, TokenDefinition>) {
    const piles = this.getPileViews();
    const visualByPile = getSupplyPileTokenVisualMap(match, tokenDefinitions);
    piles.forEach(pile => {
      const key = pile.pileKey;
      const visual = key ? visualByPile[key] : undefined;
      pile.tokenBadges = visual?.tokenBadges ?? [];
      pile.tokenChips = visual?.tokenChips ?? [];
    });
  }
}
