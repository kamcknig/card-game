import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { Scene } from '../../core/scene/scene';
import { app } from '../../core/create-app';
import { LARGE_GAP, STANDARD_GAP } from '../../app-contants';
import { MatchSummary } from 'shared/types';
import { List } from '@pixi/ui';
import { $players } from '../../state/player-state';
import { AppList } from '../../app-list';
import { AdjustmentFilter } from 'pixi-filters';
import { $cardsById } from '../../state/card-state';

export class GameOverScene extends Scene {
  private _summary: MatchSummary;
  private _scoresContainer: List;
  private _divider: Graphics;
  private _deckContainer: List
  
  constructor(stage: Container) {
    super(stage);
  }
  
  initialize(data: MatchSummary) {
    super.initialize(data);
    
    this._summary = data;
    
    this._scoresContainer = new List({
      type: 'vertical',
      padding: STANDARD_GAP,
      elementsMargin: STANDARD_GAP,
    });
    this._scoresContainer.x = LARGE_GAP;
    this._scoresContainer.y = LARGE_GAP;
    this.addChild(this._scoresContainer);
    
    this._divider = new Graphics();
    this.addChild(this._divider);
    
    this._deckContainer = new List();
    this.addChild(this._deckContainer);
    
    void this.draw();
    
    app.renderer.on('resize', this.draw);
    this.on('removed', this.onRemoved);
  }
  
  private onRemoved = () => {
    app.renderer.off('resize', this.draw);
    this.off('removed', this.onRemoved);
  }
  
  private draw = async () => {
    await this.drawScores();
    this.drawDivider();
    void this.drawPlayerDecks();
  }
  
  private async drawScores() {
    for (const [idx, playerSummary] of this._summary.scores.entries()) {
      const playerInfoContainer: AppList = new AppList({
        type: 'horizontal',
        padding: STANDARD_GAP,
        elementsMargin: STANDARD_GAP
      });
      const player = $players.get()[playerSummary.playerId];
      
      const ordinalContainer = new Container();
      const ordinalText = new Text({
        text: `${idx + 1}`,
        style: {
          fontSize: 28,
          fill: 'white'
        },
      });
      const ordinalGraphics = new Graphics();
      ordinalGraphics
        .circle(
          Math.floor(ordinalText.width * .5),
          Math.floor(ordinalText.height * .5),
          ordinalText.height * .5)
        .stroke({width: 3, color: 'black'});
      ordinalContainer.addChild(ordinalGraphics);
      ordinalContainer.addChild(ordinalText);
      
      const nameText = new Text({
        text: player.name,
        style: {
          fontSize: 20,
          fill: 'black'
        },
      });
      
      const scoreContainer = new Container();
      const scoreText = new Text({
        text: playerSummary.score,
        style: {
          fontSize: 22,
          fill: 'white'
        },
      });
      const shield = Sprite.from(await Assets.load('./assets/ui-icons/victory-shield.png'));
      shield.scale = .9;
      scoreContainer.addChild(shield);
      shield.filters = new AdjustmentFilter({saturation: .5, brightness: .5 });
      scoreText.x = Math.floor(shield.width * .5 - scoreText.width * .5);
      scoreText.y = Math.floor(shield.height * .5 - scoreText.height * .5);
      scoreContainer.addChild(scoreText);
      
      const turnText = new Text({
        text: `Turns: ${playerSummary.turnsTaken}`,
        style: {
          fontSize: 20,
          fill: 'black'
        },
      });
      
      playerInfoContainer.addChild(ordinalContainer);
      playerInfoContainer.addChild(nameText);
      
      const sep = new Graphics();
      sep.lineTo(50, 0);
      sep.stroke({width: 3, color: 'black'});
      playerInfoContainer.addChild(sep);
      
      playerInfoContainer.addChild(scoreContainer);
      playerInfoContainer.addChild(turnText);
      
      this._scoresContainer.addChild(playerInfoContainer);
    }
  }
  
  private drawDivider() {
    this._divider.clear();
    const x = this._scoresContainer.getBounds().right + LARGE_GAP
    this._divider.moveTo(x, LARGE_GAP);
    this._divider.lineTo(x, app.renderer.height - LARGE_GAP);
    this._divider.stroke({color: 'black', width: 2});
  }
  
  private async drawPlayerDecks() {
    const cardsById = $cardsById.get();
    
    const playerDeckContainer = new List({type: 'vertical'});
    
    for (const playerSummary of this._summary.scores) {
      const playerId = playerSummary.playerId;
      
      const cardCounts = playerSummary.deck.map(cId => cardsById[cId]).reduce((prev, card) => {
        prev[card.cardKey] ??= 0;
        prev[card.cardKey]++;
        return prev;
      }, {} as Record<string, number>);
      
      const cardList: List = new List();
      for (const cardKey of Object.keys(cardCounts)) {
        const s = Sprite.from(await Assets.load(`./assets/card-images/full-size/${cardKey}.jpg`));
        const sMask = new Graphics()
          .rect(0, 0, s.width, s.height * .2)
          .fill('black');
        s.mask = sMask;
        const cardImageContainer = new Container();
        cardImageContainer.addChild(s);
        cardImageContainer.addChild(sMask);
        
        const cardCountList = new List({type: 'horizontal'});
        const countText = new Text({
          text: cardCounts[cardKey],
          style: {
            fontSize: 28,
            fill: 'black'
          }
        })
        cardCountList.addChild(countText);
        cardCountList.addChild(cardImageContainer);
      }
      playerDeckContainer.addChild(cardList);
    }
    
    this._deckContainer.addChild(playerDeckContainer);
    this._deckContainer.x = this._divider.getBounds().right + LARGE_GAP;
    this._deckContainer.y = LARGE_GAP;
  }
}
