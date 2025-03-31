import { Assets, Container, ContainerChild, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { $selectableCards, $selectedCards } from '../state/interactive-state';
import { Card, CardFacing, CardSize } from 'shared/shared-types';
import { gameEvents } from '../core/event/events';
import { batched } from 'nanostores';
import { $cardOverrides } from '../state/card-state';

type CardArgs = Card;

type CardViewArgs = {
    size?: CardSize;
    facing?: CardFacing;
}

export class CardView extends Container<ContainerChild> {
    private readonly _highlight: Graphics = new Graphics({label: 'highlight'});
    private readonly _cardView: Sprite = new Sprite({label: 'caredView'});
    private _frontImage: Texture;
    private readonly _backImage: Texture;
    private readonly _costView: Container = new Container({label: 'costView'});
    private readonly _cleanup: (() => void)[] = [];
    
    private _facing: CardFacing = 'back';
    private _size: CardSize;
    
    public card: Card;
    
    public set facing(value: CardFacing) {
        if (!this._frontImage || !this._backImage) return;
        this._cardView.texture = value === 'front' ? this._frontImage : this._backImage;
        this._facing = value;
        this.onDraw();
    }
    public get facing(): CardFacing {
        return this._facing;
    }

    public set size(value: CardSize) {
        this._size = value;
        
        this._frontImage = Assets.get(`${this.card.cardKey}${this.size === 'full' ? '-full' : ''}`);
        this._cardView.texture = this._facing === 'front' ? this._frontImage : this._backImage;
        this._size = value;
        this.onDraw();
    }
    public get size(): CardSize {
        return this._size;
    }

    constructor({ size, facing, ...card }: CardArgs & CardViewArgs) {
        super();
        
        this.card = card;
        
        this.label = `${card.cardKey}-${card.id}`;
        
        this.eventMode = 'static';

        this.addChild(this._highlight);
        this.addChild(this._cardView);
        
        try {
            this._frontImage = Assets.get(`${card.cardKey}${size === 'full' ? '-full' : ''}`);
            this._frontImage.label = 'frontImageSprite';
        } catch {
            console.log("could not find asset for card", card.cardKey);
        }

        this._backImage = Assets.get('card-back');
        this._backImage.label = 'backImageSprite';

        const costBgSprite = Sprite.from(Assets.get('treasure-bg'));
        const maxSide = 32;
        costBgSprite.scale = Math.min(maxSide / costBgSprite.width, maxSide / costBgSprite.height);
        this._costView.addChild(costBgSprite);
        
        const costText = new Text({
            label: 'costText',
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
        this.size  = 'full'

        this._cleanup.push(batched([$selectableCards, $selectedCards], (...args) => args).subscribe(this.onDraw));
        this._cleanup.push($cardOverrides.subscribe(this.onDraw));
        
        this.on('removed', this.onRemoved);
    }

    private onRemoved = () => {
        this._cleanup.forEach(cb => cb());
        this.off('removed');
    }
    
    private onDraw = () => {
        const selected = $selectedCards.get();
        const selectable = $selectableCards.get().filter(s => !selected.includes(s));
        const overrides = $cardOverrides.get();
        
        this._highlight.clear();
        for (const cardId of selectable) {
            if (cardId === this.card.id) {
                this._highlight
                  .roundRect(-3, -3, this._cardView.width + 6, this._cardView.height + 6, 5)
                  .fill(0xffaaaa);
            }
        }
        for (const cardId of selected) {
            if (cardId === this.card.id) {
                this._highlight
                  .roundRect(-3, -3, this._cardView.width + 6, this._cardView.height + 6, 5)
                  .fill(0x6DFF8C);
            }
        }
        
        const costText = this._costView.getChildByLabel('costText') as Text;
        if (costText) {
            costText.text = overrides?.[this.card.id]?.cost?.treasure ?? this.card.cost.treasure;
        }
        
        this._costView.x = 2;
        this._costView.y = this._cardView.y + this._cardView.height - this._costView.height - 5 ;
        this._costView.visible = this.facing === 'front';
    }
}