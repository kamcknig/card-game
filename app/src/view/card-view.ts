import { Assets, Container, ContainerChild, DestroyOptions, Graphics, Sprite } from "pixi.js";
import { $selectableCards } from "../state/interactive-state";
import { Card } from "shared/types";
import { CARD_HEIGHT, CARD_WIDTH, SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH } from '../app-contants';
import { gameEvents } from '../core/event/events';

type CardArgs = Card;

export class CardView extends Container<ContainerChild> {
    private readonly _highlight: Container = new Container();
    private readonly _cardView: Container = new Container();
    private readonly _frontView: Sprite;
    private readonly _backView: Sprite;
    private _size: 'full' | 'normal';

    private readonly _cleanup: () => void;

    private _facing: 'back' | 'front' = 'back';
    public set facing(value: 'front' | 'back') {
        this._cardView.removeChildren();
        this._cardView.addChild(value === 'front' ? this._frontView : this._backView);
        this.onCardUpdated();
        this._facing = value;
    }
    public get facing(): 'front' | 'back' {
        return this._facing;
    }

    public set size(value: 'full' | 'normal') {
        this._size = value;
        this._frontView.texture = Assets.get(`${this.card.cardKey}${value === 'full' ? '-full' : ''}`);

        this._frontView.width = value === 'full' ? CARD_WIDTH : SMALL_CARD_WIDTH;
        this._frontView.height = value === 'full' ? CARD_HEIGHT : SMALL_CARD_HEIGHT;

        this._backView.width = value === 'full' ? CARD_WIDTH : SMALL_CARD_WIDTH;
        this._backView.height = value === 'full' ? CARD_HEIGHT : SMALL_CARD_HEIGHT;
        this.onCardUpdated();
        this._size = value;
    }
    public get size(): 'full' | 'normal' {
        return this._size;
    }

    constructor(public card: CardArgs) {
        super();

        this.label = this.card.toString();
        this.eventMode = 'static';

        this._highlight.addChild(new Graphics());
        this.addChild(this._highlight);
        this.addChild(this._cardView);

        try {
            this._frontView = Sprite.from(Assets.get(card.cardKey));
        } catch {
            console.log("could not find asset for card", card.cardKey);
        }

        this._backView = Sprite.from(Assets.get('card-back'));

        this.facing = 'front';
        this.size  = 'normal'

        this._cleanup = $selectableCards.subscribe(this.onCardUpdated.bind(this));

        this.on('pointerdown', (e) => {
            if (e.button === 2 && this.facing !== 'back') {
                gameEvents.emit('displayCardDetail', this.card.id);
            }
        })
    }

    destroy(options?: DestroyOptions) {
        super.destroy(options);
        this._cleanup();
        this.removeAllListeners();
    }

    private onCardUpdated(cardIds?: ReadonlyArray<number>) {

        if (!cardIds?.length) {
            cardIds = $selectableCards.get();
        }

        (this._highlight.getChildAt(0) as Graphics).clear();
        for (const cardId of cardIds) {
            if (cardId === this.card.id) {
                (this._highlight.getChildAt(0) as Graphics).roundRect(-3, -3, this._cardView.width + 6, this._cardView.height + 6, 5).fill(0xffaaaa);
            }
        }
    }
}