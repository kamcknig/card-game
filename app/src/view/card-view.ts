import { Assets, Container, ContainerChild, DestroyOptions, Graphics, Sprite, Text } from 'pixi.js';
import { $selectableCards, $selectedCards } from "../state/interactive-state";
import { Card } from "shared/shared-types";
import { CARD_HEIGHT, CARD_WIDTH, SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH } from '../app-contants';
import { gameEvents } from '../core/event/events';
import { batched } from 'nanostores';

type CardArgs = Card;

export class CardView extends Container<ContainerChild> {
    private readonly _highlight: Container = new Container({label: 'highlight'});
    private readonly _cardView: Container = new Container({label: 'cardView'});
    private readonly _frontView: Sprite;
    private readonly _backView: Sprite;
    private readonly _costView: Container = new Container({label: 'costView'});
    
    private _size: 'full' | 'normal';

    private readonly _cleanup: (() => void)[] = [];

    private _facing: 'back' | 'front' = 'back';
    public set facing(value: 'front' | 'back') {
        if (!this._frontView || !this._backView) return;
        
        this._cardView.getChildByLabel('view')?.removeFromParent();
        this._cardView.addChildAt(value === 'front' ? this._frontView : this._backView, 1);
        this._facing = value;
        this.onCardUpdated();
    }
    public get facing(): 'front' | 'back' {
        return this._facing;
    }

    public set size(value: 'full' | 'normal') {
        this._size = value;
        
        if (this._frontView) {
            this._frontView.texture = Assets.get(`${this.card.cardKey}${value === 'full' ? '-full' : ''}`);
            this._frontView.width = value === 'full' ? CARD_WIDTH : SMALL_CARD_WIDTH;
            this._frontView.height = value === 'full' ? CARD_HEIGHT : SMALL_CARD_HEIGHT;
        }
        

        if (this._backView) {
            this._backView.width = value === 'full' ? CARD_WIDTH : SMALL_CARD_WIDTH;
            this._backView.height = value === 'full' ? CARD_HEIGHT : SMALL_CARD_HEIGHT;
        }
        
        this._costView.visible = this.facing === 'front';
        this._size = value;
        this.onCardUpdated();
    }
    public get size(): 'full' | 'normal' {
        return this._size;
    }

    constructor(public card: CardArgs) {
        super();

        this.label = this.card.toString();
        
        this.eventMode = 'static';

        this._highlight.addChild(new Graphics({label: 'highlight'}));
        
        this.addChild(this._cardView);
        this._cardView.addChildAt(this._highlight, 0);

        try {
            this._frontView = Sprite.from(Assets.get(card.cardKey));
            this._frontView.label = 'cardView';
        } catch {
            console.log("could not find asset for card", card.cardKey);
        }

        this._backView = Sprite.from(Assets.get('card-back'));
        this._backView.label = 'cardView';

        const costBgSprite = Sprite.from(Assets.get('treasure-bg'));
        const maxSide = 32;
        costBgSprite.scale = Math.min(maxSide / costBgSprite.width, maxSide / costBgSprite.height);
        this._costView.addChild(costBgSprite);
        
        const costText = new Text({
            text: card.cost.treasure,
            style: {
                fill: 'black'
            },
            anchor: .5,
        });
        costText.x = Math.floor(costBgSprite.width * .5);
        costText.y = Math.floor(costBgSprite.height * .5);
        this._costView.addChild(costText);
        this.addChild(this._costView)
        
        this.facing = 'front';
        this.size  = 'normal'

        this._cleanup.push(batched([$selectableCards, $selectedCards], (...args) => args).subscribe(this.onCardUpdated.bind(this)));

        this.on('pointerdown', this.onPressed);
        this._cleanup.push(() => this.off('pointerdown', this.onPressed));
        this.off('removed', this.onRemoved);
    }

    private onPressed = (e: PointerEvent) => {
        if (e.button === 2 && this.facing !== 'back') {
            gameEvents.emit('displayCardDetail', this.card.id);
        }
    }
    
    private onRemoved = () => {
        this._cleanup.forEach(cb => cb());
        this.off('removed', this.onRemoved);
    }

    private onCardUpdated([selectable, selected]: ReadonlyArray<number[]> = [[],[]]) {
        if (!selectable?.length) {
            selectable = $selectableCards.get();
        }
        
        if (!selected?.length) {
            selected = $selectedCards.get();
        }
        
        selectable = selectable.filter(s => !selected.includes(s));

        (this._highlight.getChildAt(0) as Graphics).clear();
        for (const cardId of selectable) {
            if (cardId === this.card.id) {
                (this._highlight.getChildAt(0) as Graphics)
                  .roundRect(-3, -3, this._cardView.width + 6, this._cardView.height + 6, 5)
                  .fill(0xffaaaa);
            }
        }
        for (const cardId of selected) {
            if (cardId === this.card.id) {
                (this._highlight.getChildAt(0) as Graphics)
                  .roundRect(-3, -3, this._cardView.width + 6, this._cardView.height + 6, 5)
                  .fill(0x6DFF8C);
            }
        }
        
        this._costView.x = 2;
        this._costView.y = this.height - this._costView.height - 12 ;
    }
}