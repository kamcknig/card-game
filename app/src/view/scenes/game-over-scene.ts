import { Container, Graphics } from 'pixi.js';
import { Scene } from '../../core/scene/scene';
import { app } from '../../core/create-app';
import { STANDARD_GAP } from '../../app-contants';
import { MatchSummary } from 'shared/types';

export class GameOverScene extends Scene {
  private _divider: Graphics;
  
  constructor(stage: Container) {
    super(stage);
  }
  
  initialize(data: MatchSummary) {
    super.initialize(data);
    
    this._divider = new Graphics();
    this.addChild(this._divider);
    
    this.draw();
    
    app.renderer.on('resize', this.draw.bind(this));
  }
  
  private draw() {
    this.drawDivider();
    this.drawScores();
  }
  
  private drawDivider() {
    this._divider.moveTo(app.renderer.width * .5, STANDARD_GAP);
    this._divider.lineTo(app.renderer.width * .5, app.renderer.height - STANDARD_GAP);
    this._divider.stroke({color: 'black', width: 2});
  }
  
  private drawScores() {
  
  }
}
