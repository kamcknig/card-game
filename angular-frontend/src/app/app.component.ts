import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  OnInit,
  ViewChild
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AsyncPipe, NgClass, NgSwitch, NgSwitchCase } from '@angular/common';
import { SocketService } from './core/socket-service/socket.service';
import { NanostoresService } from '@nanostores/angular';
import { catchError, Observable, of, tap } from 'rxjs';
import { Application } from 'pixi.js';
import { SceneNames, sceneStore } from './state/game-state';
import { MatchScene } from './components/match/views/scenes/match-scene';
import { PIXI_APP } from './core/pixi-application.token';
import { MatchConfigurationComponent } from './components/match-configuration/match-configuration.component';
import { GameSummaryComponent } from './components/game-summary/game-summary.component';
import { MatchSummary } from 'shared/shared-types';
import { matchStartedStore, matchSummaryStore } from './state/match-state';
import { MatchHudComponent } from './components/match/match-hud/match-hud.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NgSwitch,
    NgSwitchCase,
    AsyncPipe,
    MatchConfigurationComponent,
    GameSummaryComponent,
    MatchHudComponent,
    NgClass,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements AfterViewInit, OnInit {
  @ViewChild('pixiContainer', { static: true }) pixiContainer!: ElementRef;

  title = 'Dominion Clone';
  matchSummary: MatchSummary | undefined;
  scene$: Observable<SceneNames> | undefined;
  matchScene: MatchScene | undefined;
  matchStarted$: Observable<boolean> | undefined;

  constructor(
    private _socketService: SocketService,
    private _nanoStores: NanostoresService,
    @Inject(PIXI_APP) private _app: Application,
  ) {
  }

  ngOnInit() {
    this.matchStarted$ = this._nanoStores.useStore(matchStartedStore);

    this.scene$ = this._nanoStores.useStore(sceneStore).pipe(
      tap(async scene => {
        if (scene === 'match') {
          if (!this._app) throw new Error('App not found');
          this.matchScene = new MatchScene(this._socketService, this._app);
          await this.matchScene.initialize();
          this._app.stage.addChild(this.matchScene);
        } else if (scene === 'gameSummary') {
          this.matchSummary = matchSummaryStore.get();
          !!this.matchScene && this._app.stage.removeChild(this.matchScene);
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
