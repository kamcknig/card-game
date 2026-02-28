import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgClass, NgSwitch, NgSwitchCase } from '@angular/common';
import { SocketService } from './core/socket-service/socket.service';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { SceneNames, sceneStore } from './state/game-state';
import { MatchScene } from './components/match/views/scenes/match-scene';
import { MatchConfigurationComponent } from './components/match-configuration/match-configuration.component';
import { GameSummaryComponent } from './components/game-summary/game-summary.component';
import { MatchSummary } from 'shared/types';
import { matchStartedStore, matchSummaryStore } from './state/match-state';
import { MatchHudComponent } from './components/match/match-hud/match-hud.component';
import { LobbyComponent } from './components/lobby/lobby.component';
import { CardDetailDialogComponent } from './components/card-detail-dialog/card-detail-dialog.component';
import { PromptDialogHostComponent } from './components/prompt-dialog/prompt-dialog-host.component';
import { PromptDialogCoordinatorService } from './core/prompt-dialog/prompt-dialog-coordinator.service';
import { WayPickerOverlayComponent } from './components/way-picker-overlay/way-picker-overlay.component';
import { WayPickerOverlayService } from './core/way-picker/way-picker-overlay.service';
import { MatchSupplyOverlayComponent } from './components/match/supply/match-supply-overlay.component';
import { MatchLandscapesOverlayComponent } from './components/match/landscapes/match-landscapes-overlay.component';
import { MatchPlayerAreaOverlayComponent } from './components/match/player-area/match-player-area-overlay.component';
import { MatchNonSupplyOverlayComponent } from './components/match/non-supply/match-non-supply-overlay.component';
import { PileSelectionActionOverlayComponent } from './components/match/pile-selection/pile-selection-action-overlay.component';

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
    WayPickerOverlayComponent,
    MatchSupplyOverlayComponent,
    MatchLandscapesOverlayComponent,
    MatchPlayerAreaOverlayComponent,
    MatchNonSupplyOverlayComponent,
    PileSelectionActionOverlayComponent,
    NgClass,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly _socketService = inject(SocketService);
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _promptDialogCoordinator = inject(PromptDialogCoordinatorService);
  private readonly _wayPickerOverlay = inject(WayPickerOverlayService);

  title = 'Dominion Clone';
  matchScene = signal<MatchScene | undefined>(undefined);
  scoreViewRect = signal<{ x: number; y: number; width: number; height: number } | null>(null);
  scene = toSignal(this._nanoStores.useStore(sceneStore), { initialValue: sceneStore.get() as SceneNames });
  matchStarted = toSignal(this._nanoStores.useStore(matchStartedStore), { initialValue: false });
  matchSummary = toSignal<MatchSummary | undefined>(
    this._nanoStores.useStore(matchSummaryStore),
    { initialValue: undefined }
  );

  // Keep match controller lifecycle aligned to Angular scene state.
  private readonly _syncSceneEffect = effect(() => {
    const scene = this.scene();
    void this.syncScene(scene);
  });

  // Relays score view resize events to match overlays and controller state.
  onScoreViewResize(rect: { x: number; y: number; width: number; height: number }) {
    this.scoreViewRect.set({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
    this.matchScene()?.setScoreViewRect(rect);
  }

  // Relays HUD "next phase" actions to the active match controller.
  onNextPhaseRequested() {
    this.matchScene()?.requestNextPhase();
  }

  // Relays HUD "play all treasures" actions to the active match controller.
  onPlayAllTreasuresRequested() {
    this.matchScene()?.requestPlayAllTreasures();
  }

  // Creates/destroys the match controller when UI scene changes.
  private async syncScene(scene: SceneNames) {
    if (scene === 'match') {
      if (this.matchScene()) {
        return;
      }
      const sceneInstance = new MatchScene(
        this._socketService,
        this._promptDialogCoordinator,
        this._wayPickerOverlay,
      );
      await sceneInstance.initialize();
      this.matchScene.set(sceneInstance);
      return;
    }

    const existingScene = this.matchScene();
    if (existingScene) {
      existingScene.destroy();
      this.matchScene.set(undefined);
    }
  }
}
