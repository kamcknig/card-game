import {Container, Graphics, Text} from 'pixi.js';
import {$players, $playerScoreStore, PlayerState} from '../state/player-state';
import {batched} from 'nanostores';
import {$currentPlayerTurnIndex, $playerTurnOrder, $turnNumber} from '../state/turn-state';
import {STANDARD_GAP} from '../app-contants';

export class ScoreView extends Container {
    private _playerNameContainer: Container = new Container();
    private _currentPlayerHighlight: Container = new Container();
    private _turnLabel: Text = new Text({style: {fontSize: 18, fill: {color: 'black'}}});

    constructor() {
        super();
        this._currentPlayerHighlight.addChild(new Graphics());
        this.addChild(this._playerNameContainer);
        this.addChild(this._turnLabel);
        const tmp = batched([$players, $playerTurnOrder], (...arg) => arg);
        tmp.subscribe(this.onPlayersUpdated.bind(this));
        $players.subscribe(this.onTrackScores.bind(this));
        $currentPlayerTurnIndex.subscribe(this.onPlayerTurnUpdated.bind(this));
        $turnNumber.subscribe(this.onTurnNumberUpdated.bind(this));
        
        setTimeout(() => {this.onUpdateScore(1, 100)}, 5000)
    }

    private onTurnNumberUpdated(turn: number) {
        this._turnLabel.text = `TURN ${turn}`;
    }

    private _scoreListeners: (() => void)[] = [];

    private cleanupScoreListeners() {
        this._scoreListeners.forEach(c => c());
    }

    private onTrackScores(players: PlayerState) {
        this.cleanupScoreListeners();
        Object.values(players).forEach(player => {
            this._scoreListeners.push($playerScoreStore(player.id).subscribe(playerScore =>
                this.onUpdateScore(player.id, playerScore)))
        });
    }

    private onUpdateScore(playerId: number, score: number) {
        const scoreText = this._playerNameContainer.getChildByName(`player-${playerId}`)?.getChildByName('score-text') as Text;

        if (!scoreText) {
            return;
        }
        
        scoreText.x -= 50;
        scoreText.text = score;
        scoreText.x = 200 - scoreText.width - STANDARD_GAP;
    }

    private onPlayersUpdated([players, turnOrder]: readonly [PlayerState, number[]]) {
        const playerValues = Object.values(players);

        for (const [idx, playerId] of turnOrder.entries()) {
            const playerContainer = new Container({label: `player-${playerId}`});

            const player = playerValues.find(p => p.id === playerId);
            if (!player) {
                continue;
            }

            const t = new Text({
                text: player.name,
                style: {fontSize: 18, fill: {color: 'white'}}
            });

            const g = new Graphics();
            g.roundRect(0, 0, 200, t.height + STANDARD_GAP * 2, 5).fill({color: 'black', alpha: .6});
            playerContainer.addChild(g);

            t.x = STANDARD_GAP;
            t.y = playerContainer.height * .5 - t.height * .5;
            playerContainer.addChild(t);

            const scoreText = new Text({
                text: 0,
                label: 'score-text',
                style: {fontSize: 18, fill: {color: 'white'}}
            });
            scoreText.x = 200 - scoreText.width - STANDARD_GAP;
            scoreText.y = playerContainer.height * .5 - scoreText.height * .5;
            playerContainer.addChild(scoreText);

            playerContainer.y = this._playerNameContainer.height + STANDARD_GAP * .5 * idx;
            this._playerNameContainer.addChild(playerContainer);
        }

        this._playerNameContainer.y = this._turnLabel.y + this._turnLabel.height + STANDARD_GAP;
    }

    private onPlayerTurnUpdated(turnIndex: number) {
        const g = this._currentPlayerHighlight.getChildAt(0) as Graphics;

        const c: Container = this._playerNameContainer.getChildAt(turnIndex);

        if (!c) {
            return;
        }
        this._currentPlayerHighlight.x = c.x;
        this._currentPlayerHighlight.y = c.y;

        const {width, height} = c;
        g.roundRect(0, 0, width, height, 5);
        g.stroke({
            color: 0xffffff,
            width: 2,
            alignment: 0.5,
        });
        this._playerNameContainer.addChild(this._currentPlayerHighlight);
    }
}