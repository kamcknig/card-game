import { Container, Graphics, Text } from 'pixi.js';
import { playerIdStore, playerScoreStore } from '../state/player-state';
import { currentPlayerTurnIndexStore, playerTurnOrder, turnNumberStore } from '../state/turn-state';
import { STANDARD_GAP } from '../core/app-contants';
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

    this._cleanup.push(playerTurnOrder.subscribe(this.onPlayersUpdated.bind(this)));
    this._cleanup.push(currentPlayerTurnIndexStore.subscribe(this.onPlayerTurnUpdated.bind(this)));
    this._cleanup.push(turnNumberStore.subscribe(this.onTurnNumberUpdated.bind(this)));

    this._cleanup.push(playerIdStore.subscribe(this.onTrackScores));

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
      this._scoreListeners.push(playerScoreStore(playerId).subscribe(playerScore =>
        this.onUpdateScore(playerId, playerScore)))
    }
  }

  private onUpdateScore(playerId: number, score: number) {
    let scoreText;
    try {
      scoreText = this._playerNameContainer.getChildByName(`player-${playerId}`)?.getChildByName('scoreText') as Text;
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
    for (const [idx, player] of turnOrder.entries()) {
      const label = `player-${player.id}`;

      const playerContainer = this._playerNameContainer.getChildByLabel(label) ??
        new Container({ label });

      const playerNameText = playerContainer.getChildByLabel('playerNameText') ??
        new Text({
          label: 'playerNameText',
          text: player.name,
          style: { fontSize: 18, fill: { color: 'white' } }
        });

      const scoreText = playerContainer.getChildByLabel('scoreText') ??
        new Text({
          text: 0,
          label: 'scoreText',
          style: { fontSize: 18, fill: { color: 'white' } }
        });

      const g = playerContainer.getChildByName('background') as Graphics ??
        new Graphics({label: 'background'});
      g.clear();
      g.roundRect(0, 0, 200, playerNameText.height + STANDARD_GAP * 2, 5).fill({ color: 'black', alpha: .6 });

      playerContainer.addChild(g);

      playerNameText.x = STANDARD_GAP;
      playerNameText.y = playerContainer.height * .5 - playerNameText.height * .5;
      playerContainer.addChild(playerNameText);

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
