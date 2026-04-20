import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { SocketService } from '../../core/socket-service/socket.service';
import { PromptDialogCoordinatorService } from '../../core/prompt-dialog/prompt-dialog-coordinator.service';
import { WayPickerOverlayService } from '../../core/way-picker/way-picker-overlay.service';
import { MatchScene } from './views/scenes/match-scene';
import { MatchSupplyComponent } from './supply/match-supply.component';
import { MatchLandscapesComponent } from './landscapes/match-landscapes.component';
import { MatchPlayerAreaComponent } from './player-area/match-player-area.component';
import { MatchNonSupplyComponent } from './non-supply/match-non-supply.component';
import { PileSelectionActionComponent } from './pile-selection/pile-selection-action.component';
import { MatchHudComponent } from './match-hud/match-hud.component';
import { matchStartedStore } from '../../state/match-state';

/** Container component for the active match screen. Manages MatchScene lifecycle. */
@Component({
  selector: 'app-match',
  standalone: true,
  imports: [
    NgClass,
    MatchSupplyComponent,
    MatchLandscapesComponent,
    MatchPlayerAreaComponent,
    MatchNonSupplyComponent,
    PileSelectionActionComponent,
    MatchHudComponent,
  ],
  templateUrl: './match.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchComponent implements OnInit, OnDestroy {
  private readonly _socketService = inject(SocketService);
  private readonly _promptDialogCoordinator = inject(PromptDialogCoordinatorService);
  private readonly _wayPickerOverlay = inject(WayPickerOverlayService);
  private readonly _nanoStores = inject(NanostoresService);

  /** Non-Angular controller managing game interaction and socket coordination. */
  readonly matchScene = signal<MatchScene | undefined>(undefined);

  /** Passed to match sub-components for layout-aware score view positioning. */
  readonly scoreViewRect = signal<{ x: number; y: number; width: number; height: number } | null>(null);

  readonly matchStarted = toSignal(this._nanoStores.useStore(matchStartedStore), { initialValue: false });

  /** Creates and initialises the MatchScene controller when the match route activates. */
  async ngOnInit(): Promise<void> {
    const scene = new MatchScene(
      this._socketService,
      this._promptDialogCoordinator,
      this._wayPickerOverlay,
    );
    await scene.initialize();
    this.matchScene.set(scene);
  }

  /** Destroys the MatchScene controller when leaving the match route. */
  ngOnDestroy(): void {
    this.matchScene()?.destroy();
    this.matchScene.set(undefined);
  }

  /** Relays score view resize events to sub-components and the match controller. */
  onScoreViewResize(rect: { x: number; y: number; width: number; height: number }): void {
    this.scoreViewRect.set(rect);
    this.matchScene()?.setScoreViewRect(rect);
  }

  /** Relays HUD next-phase actions to the active match controller. */
  onNextPhaseRequested(): void {
    this.matchScene()?.requestNextPhase();
  }

  /** Relays HUD play-all-treasures actions to the active match controller. */
  onPlayAllTreasuresRequested(): void {
    this.matchScene()?.requestPlayAllTreasures();
  }
}
