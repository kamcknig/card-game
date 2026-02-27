import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  ViewChild
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgClass, NgSwitch, NgSwitchCase } from '@angular/common';
import { SocketService } from './core/socket-service/socket.service';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { Application, Rectangle } from 'pixi.js';
import { SceneNames, sceneStore } from './state/game-state';
import { MatchScene } from './components/match/views/scenes/match-scene';
import { PIXI_APP } from './core/pixi-application.token';
import { MatchConfigurationComponent } from './components/match-configuration/match-configuration.component';
import { GameSummaryComponent } from './components/game-summary/game-summary.component';
import { MatchSummary } from 'shared/types';
import { matchStartedStore, matchSummaryStore } from './state/match-state';
import { MatchHudComponent } from './components/match/match-hud/match-hud.component';
import { LobbyComponent } from './components/lobby/lobby.component';
import { CardDetailDialogComponent } from './components/card-detail-dialog/card-detail-dialog.component';
import { PromptDialogHostComponent } from './components/prompt-dialog/prompt-dialog-host.component';
import { PromptDialogCoordinatorService } from './core/prompt-dialog/prompt-dialog-coordinator.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NgSwitch,
    NgSwitchCase,
    MatchConfigurationComponent,
    GameSummaryComponent,
    MatchHudComponent,
    LobbyComponent,
    CardDetailDialogComponent,
    PromptDialogHostComponent,
    NgClass,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements AfterViewInit {
  @ViewChild('pixiContainer', { static: true }) pixiContainer!: ElementRef;

  private readonly _socketService = inject(SocketService);
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _app = inject(PIXI_APP);
  private readonly _promptDialogCoordinator = inject(PromptDialogCoordinatorService);

  title = 'Dominion Clone';
  matchScene = signal<MatchScene | undefined>(undefined);
  scene = toSignal(this._nanoStores.useStore(sceneStore), { initialValue: sceneStore.get() as SceneNames });
  matchStarted = toSignal(this._nanoStores.useStore(matchStartedStore), { initialValue: false });
  matchSummary = toSignal<MatchSummary | undefined>(
    this._nanoStores.useStore(matchSummaryStore),
    { initialValue: undefined }
  );

  // Keep Pixi scene lifecycle aligned to Angular scene state.
  private readonly _syncSceneEffect = effect(() => {
    const scene = this.scene();
    void this.syncScene(scene);
  });

  async ngAfterViewInit() {
    if (!this._app) throw new Error('No app is initialized');
    this._app.resizeTo = this.pixiContainer.nativeElement;
    this.pixiContainer.nativeElement.appendChild(this._app.canvas);
  }

  // Relays score view resize events to the active Pixi match scene.
  onScoreViewResize(rect: Rectangle) {
    this.matchScene()?.setScoreViewRect(rect);
  }

  // Creates/destroys the Pixi match scene when UI scene changes.
  private async syncScene(scene: SceneNames) {
    if (scene === 'match') {
      if (this.matchScene()) {
        return;
      }
      const sceneInstance = new MatchScene(
        this._socketService,
        this._app as Application,
        this._promptDialogCoordinator,
      );
      await sceneInstance.initialize();
      this._app.stage.addChild(sceneInstance);
      this.matchScene.set(sceneInstance);
      return;
    }

    const existingScene = this.matchScene();
    if (existingScene) {
      this._app.stage.removeChild(existingScene);
      this.matchScene.set(undefined);
    }
  }
}
