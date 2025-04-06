import { AfterViewInit, Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatchConfigurationComponent } from './match-configuration/match-configuration.component';
import { AsyncPipe, NgSwitch, NgSwitchCase } from '@angular/common';
import { SocketService } from './core/socket-service/socket.service';
import { NanostoresService } from '@nanostores/angular';
import { catchError, Observable, of, tap } from 'rxjs';
import { Application, TexturePool } from 'pixi.js';
import { sceneStore } from './state/game-state';
import { MatchScene } from './view/scenes/match-scene';
import { PIXI_APP } from './core/pixi-application.token';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    MatchConfigurationComponent,
    NgSwitch,
    NgSwitchCase,
    AsyncPipe
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit, OnInit {
  @ViewChild('pixiContainer', { static: true })
  pixiContainer!: ElementRef;
  view: string = 'match-configuration';
  title = 'Dominion Clone';
  scene$: Observable<'configuration' | 'match'> | undefined;

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
          this._matchScene = new MatchScene(this._app.stage, this._socketService, this._app);
          await this._matchScene.initialize();
          this._app.stage.addChild(this._matchScene);
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
