import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatchConfigurationComponent } from './match-configuration/match-configuration.component';
import { AsyncPipe, NgSwitch, NgSwitchCase } from '@angular/common';
import { SocketService } from './core/socket-service/socket.service';
import { NanostoresService } from '@nanostores/angular';
import { catchError, Observable, of, tap } from 'rxjs';
import { Application, TexturePool } from 'pixi.js';
import { sceneStore } from './state/game-state';
import { MatchScene } from './view/scenes/match-scene';

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
  app: Application | undefined;
  view: string = 'match-configuration';
  title = 'Dominion Clone';
  scene$: Observable<'configuration' | 'match'> | undefined;

  private _matchScene: MatchScene | undefined;

  constructor(
    private _socketService: SocketService,
    private _nanoStores: NanostoresService,
  ) {
  }

  ngOnInit() {
    this.scene$ = this._nanoStores.useStore(sceneStore).pipe(
      tap(async scene => {
        if (scene === 'match') {
          if (!this.app) throw new Error('App not found');
          this._matchScene = new MatchScene(this.app!.stage, this._socketService, this.app);
          await this._matchScene.initialize();
          this.app.stage.addChild(this._matchScene);
        }
      }),
      catchError(err => {
        console.error(err);
        return of(err);
      })
    );
  }

  async ngAfterViewInit() {
    TexturePool.textureOptions.scaleMode = 'nearest';
    TexturePool.textureOptions.antialias = true;
    this.app = new Application();
    await this.app.init({
      antialias: true,
      background: "#1099bb",
      resizeTo: this.pixiContainer.nativeElement
    });
    this.app.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    if (!this.app) throw new Error('No app is initialized');
    this.pixiContainer.nativeElement.appendChild(this.app.canvas);
  }
}
