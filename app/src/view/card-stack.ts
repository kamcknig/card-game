import { Container, DestroyOptions, Graphics, Text } from "pixi.js";
import { CountBadgeView } from "./count-badge-view";
import { createCardView } from "../core/card/create-card-view";
import { $playerDiscardStore } from "../state/player-state";
import { $cardsById } from "../state/card-state";
import { CARD_HEIGHT, CARD_WIDTH, STANDARD_GAP } from '../app-contants';
import { PreinitializedWritableAtom } from 'nanostores';
import { isUndefined } from 'es-toolkit';
import { Card } from 'shared/types';
import { CardView } from './card-view';
import { $selectedCards } from '../state/interactive-state';

export type CardStackArgs = {
  scale?: number;
  label?: string;
  cardStore: PreinitializedWritableAtom<number[]>;
  showCountBadge?: boolean;
  cardFacing: CardView['facing'];
  showBackground?: boolean;
}

export class CardStackView extends Container {
  private readonly _background: Container = new Container();
  private readonly _cardContainer: Container = new Container({ x: STANDARD_GAP * .8, y: STANDARD_GAP * .8 });
  private readonly _cleanup: () => void;
  
  private readonly _cardStore: PreinitializedWritableAtom<number[]>;
  private readonly _cardScale: number;
  private readonly _showCountBadge: boolean = true;
  private readonly _label: string;
  private readonly _labelText: Text;
  
  // todo: probably need the server to handle which way cards are facing later on
  private readonly _cardFacing: CardView['facing'];
  
  private readonly _showBackground: boolean;
  
  constructor(private args: CardStackArgs) {
    super();
    
    const {
      cardStore,
      scale,
      showCountBadge,
      label,
      cardFacing,
      showBackground
    } = args;
    this._cardFacing = cardFacing;
    this._showCountBadge = showCountBadge ?? true;
    this._cardStore = cardStore;
    this._cardScale = scale ?? 1;
    this._label = label;
    this._showBackground = showBackground ?? true;
    
    if (this._showBackground) {
      this._background.addChild(
        new Graphics()
          .roundRect(
            0,
            0,
            CARD_WIDTH * this._cardScale + STANDARD_GAP * this._cardScale * 2,
            CARD_HEIGHT * this._cardScale + STANDARD_GAP * this._cardScale * 2
          )
          .fill({
            color: 0x000000,
            alpha: .6
          })
      );
      
      this.addChild(this._background);
    }
    
    if (!isUndefined(this._label)) {
      this._labelText = new Text({
        x: STANDARD_GAP * this._cardScale,
        y: STANDARD_GAP * this._cardScale,
        text: this._label,
        style: {
          fontSize: 14,
          fill: 'white'
        }
      });
      this.addChild(this._labelText);
    }
    
    this._cardContainer.y = STANDARD_GAP * this._cardScale;
    
    if (this._labelText) {
      this._cardContainer.y = this._labelText.y + this._labelText.height + STANDARD_GAP * this._cardScale;
    }
    
    this._cardContainer.x = STANDARD_GAP * this._cardScale;
    
    this.addChild(this._cardContainer);
    this._cleanup = this._cardStore.subscribe(this.drawDeck.bind(this));
  }
  
  destroy(options?: DestroyOptions) {
    super.destroy(options);
    this._cleanup();
  }
  
  private drawDeck(val: ReadonlyArray<number>) {
    this._cardContainer.removeChildren()
      .forEach(c => c.destroy());
    
    const selectedCards = $selectedCards.get();
    
    const sorted = val.concat()
      .sort((a, b) => selectedCards.includes(a) && selectedCards.includes(b) ? 0 : selectedCards.includes(
        a) ? -1 : selectedCards.includes(b) ? 1 : 0)
    
    for (const cardId of sorted) {
      const c = this._cardContainer.addChild(createCardView($cardsById.get()[cardId]));
      if (selectedCards.includes(cardId)) {
        c.y -= 60;
      }
      c.facing = this._cardFacing
      c.scale = this._cardScale;
      c.size = 'full';
    }
    
    const selectedCardCountInStack = val.filter(e => selectedCards.includes(e)).length
    if (this._showCountBadge && val.length - selectedCardCountInStack > 0) {
      const b = new CountBadgeView(val.length - selectedCardCountInStack);
      this._cardContainer.addChild(b);
    }
    
    if (selectedCardCountInStack > 1) {
      const b = new CountBadgeView(selectedCardCountInStack);
      b.y -= 60;
      this._cardContainer.addChild(b);
    }
    
    this._cardContainer.x = STANDARD_GAP * this._cardScale;
    this._cardContainer.y = STANDARD_GAP * this._cardScale;
    if (this._labelText) {
      this._cardContainer.y = this._labelText.y + this._labelText.height + STANDARD_GAP * this._cardScale;
    }
  }
}