import { AfterViewInit, Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AsyncPipe, NgSwitch, NgSwitchCase } from '@angular/common';
import { SocketService } from './core/socket-service/socket.service';
import { NanostoresService } from '@nanostores/angular';
import { catchError, Observable, of, tap } from 'rxjs';
import { Application } from 'pixi.js';
import { SceneNames, sceneStore } from './state/game-state';
import { MatchScene } from './components/match/views/scenes/match-scene';
import { PIXI_APP } from './core/pixi-application.token';
import { MatchConfigurationComponent } from './components/match-configuration/match-configuration.component';
import { GameSummaryComponent } from './components/game-summary/game-summary.component';
import { MatchSummary, Player } from 'shared/shared-types';
import { matchStore } from './state/match-state';
import { cardStore } from './state/card-state';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NgSwitch,
    NgSwitchCase,
    AsyncPipe,
    MatchConfigurationComponent,
    GameSummaryComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit, OnInit {
  @ViewChild('pixiContainer', { static: true }) pixiContainer!: ElementRef;

  title = 'Dominion Clone';
  matchSummary: MatchSummary | undefined;
  scene$: Observable<SceneNames> | undefined;

  private _matchScene: MatchScene | undefined;

  constructor(
    private _socketService: SocketService,
    private _nanoStores: NanostoresService,
    @Inject(PIXI_APP) private _app: Application,
  ) {
  }

  ngOnInit() {
    this.scene$ = this._nanoStores.useStore(sceneStore).pipe(
      tap(async scene => {
        if (scene === 'match') {
          if (!this._app) throw new Error('App not found');
          this._matchScene = new MatchScene(this._socketService, this._app);
          await this._matchScene.initialize();
          this._app.stage.addChild(this._matchScene);

          const match = matchStore.get();
          const cardsById = cardStore.get();
          const cardIds = Object.keys(cardsById).map(id => +id);

          setTimeout(() => {
            this.matchSummary = {
              playerSummary: match!.players.concat({id: 2, name: 'Kyle'} as Player).map(p => ({
                playerId: p.id,
                score: Math.floor(Math.random() * 50) + 1,
                turnsTaken: Math.floor(Math.random() * 20) + 1,
                deck: new Array(20).fill(0).map(_ => cardsById[cardIds[Math.floor(Math.random() * cardIds.length) + 1]].id)
              }))
            }
            sceneStore.set('gameSummary');
          }, 3000);
        } else if (scene === 'gameSummary') {
          !!this._matchScene && this._app.stage.removeChild(this._matchScene);
        }
      }),
      catchError(err => {
        console.error(err);
        return of(err);
      })
    );
  }

  async ngAfterViewInit() {
    if (!this._app) throw new Error('No app is initialized');
    this._app.resizeTo = this.pixiContainer.nativeElement;
    this.pixiContainer.nativeElement.appendChild(this._app.canvas);
  }
}
