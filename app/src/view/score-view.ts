import { Container, Graphics, Text } from 'pixi.js';
import { $player, $playerIds, $players, $playerScoreStore, PlayerState } from '../state/player-state';
import { $currentPlayerTurnIndex, $playerTurnOrder, $turnNumber } from '../state/turn-state';
import { STANDARD_GAP } from '../app-contants';
import { Player } from 'shared/shared-types';

export class ScoreView extends Container {
  private _playerNameContainer: Container = new Container();
  private _currentPlayerHighlight: Container = new Container();
  private _turnLabel: Text = new Text({ style: { fontSize: 18, fill: { color: 'black' } } });
  private _cleanup: (() => void)[] = [];
  private _scoreListeners: (() => void)[] = [];
  
  constructor() {
    super();
    this._currentPlayerHighlight.addChild(new Graphics());
    this.addChild(this._turnLabel);
    
    this.addChild(this._playerNameContainer);
    this._playerNameContainer.y = this._turnLabel.y + this._turnLabel.height + STANDARD_GAP;
    
    this._cleanup.push($playerTurnOrder.subscribe(this.onPlayersUpdated.bind(this)));
    this._cleanup.push($currentPlayerTurnIndex.subscribe(this.onPlayerTurnUpdated.bind(this)));
    this._cleanup.push($turnNumber.subscribe(this.onTurnNumberUpdated.bind(this)));
    
    this._cleanup.push($playerIds.subscribe(this.onTrackScores));
    
    this.on('removed', this.onRemoved);
  }
  
  private onRemoved = () => {
    this._cleanup.forEach(cb => cb());
    this._scoreListeners.forEach(cb => cb());
    this.off('removed', this.onRemoved);
  }
  
  private onTurnNumberUpdated(turn: number) {
    this._turnLabel.text = `TURN ${turn}`;
  }
  
  private cleanupScoreListeners() {
    this._scoreListeners.forEach(c => c());
  }
  
  private onTrackScores = (playerIds: readonly number[]) => {
    this.cleanupScoreListeners();
    
    for (const playerId of playerIds) {
      this._scoreListeners.push($playerScoreStore(playerId).subscribe(playerScore =>
        this.onUpdateScore(playerId, playerScore)))
    }
  }
  
  private onUpdateScore(playerId: number, score: number) {
    let scoreText;
    try {
      scoreText = this._playerNameContainer.getChildByName(`player-${playerId}`)?.getChildByName('score-text') as Text;
    } catch {
      // meh
    }
    
    if (!scoreText) {
      return;
    }
    
    scoreText.x -= 50;
    scoreText.text = score;
    scoreText.x = 200 - scoreText.width - STANDARD_GAP;
  }
  
  private onPlayersUpdated(turnOrder: readonly Player[]) {
    this._playerNameContainer.removeChildren();
    
    for (const [idx, player] of turnOrder.entries()) {
      const playerContainer = new Container({ label: `player-${player.id}` });
      
      if (!player) {
        continue;
      }
      
      const t = new Text({
        text: player.name,
        style: { fontSize: 18, fill: { color: 'white' } }
      });
      
      const g = new Graphics();
      g.roundRect(0, 0, 200, t.height + STANDARD_GAP * 2, 5).fill({ color: 'black', alpha: .6 });
      playerContainer.addChild(g);
      
      t.x = STANDARD_GAP;
      t.y = playerContainer.height * .5 - t.height * .5;
      playerContainer.addChild(t);
      
      const scoreText = new Text({
        text: 0,
        label: 'score-text',
        style: { fontSize: 18, fill: { color: 'white' } }
      });
      scoreText.x = 200 - scoreText.width - STANDARD_GAP;
      scoreText.y = playerContainer.height * .5 - scoreText.height * .5;
      playerContainer.addChild(scoreText);
      
      playerContainer.y = playerContainer.height * idx + STANDARD_GAP * idx;
      this._playerNameContainer.addChild(playerContainer);
    }
  }
  
  private onPlayerTurnUpdated(turnIndex: number) {
    const g = this._currentPlayerHighlight.getChildAt(0) as Graphics;
    
    if (!this._playerNameContainer.children.length) return;
    
    const c: Container = this._playerNameContainer?.getChildAt(turnIndex);
    
    if (!c || !g) {
      return;
    }
    
    this._currentPlayerHighlight.x = c.x;
    this._currentPlayerHighlight.y = c.y;
    
    const { width, height } = c;
    g.roundRect(0, 0, width, height, 5);
    g.stroke({
      color: 0xffffff,
      width: 2,
      alignment: 0.5,
    });
    this._playerNameContainer.addChild(this._currentPlayerHighlight);
  }
}