import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnDestroy,
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
import { selfPlayerIdStore } from '../../state/player-state';
import { CardImagePreloadService } from '../../core/card-image-preload.service';

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
export class MatchComponent implements OnDestroy {
  private readonly _socketService = inject(SocketService);
  private readonly _promptDialogCoordinator = inject(PromptDialogCoordinatorService);
  private readonly _wayPickerOverlay = inject(WayPickerOverlayService);
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _imagePreload = inject(CardImagePreloadService);

  /** Non-Angular controller managing game interaction and socket coordination. */
  readonly matchScene = signal<MatchScene | undefined>(undefined);

  /** Passed to match sub-components for layout-aware score view positioning. */
  readonly scoreViewRect = signal<{ x: number; y: number; width: number; height: number } | null>(null);

  readonly matchStarted = toSignal(this._nanoStores.useStore(matchStartedStore), { initialValue: false });

  /** Tracks when the server has identified the local player. Drives MatchScene creation. */
  readonly selfPlayerId = toSignal(
    this._nanoStores.useStore(selfPlayerIdStore),
    { initialValue: selfPlayerIdStore.get() },
  );

  constructor() {
    // Begin background image preloading immediately. matchStore and cardStore
    // are guaranteed populated before SocketEventMapService navigates to /match.
    this._imagePreload.preloadMatchImages();

    // Defer MatchScene creation until selfPlayerIdStore is populated. On
    // fresh match entry the store is already set (from when the user joined
    // the lobby game); on page refresh it starts undefined and gets set when
    // the socket reconnects and the server emits setPlayer. Creating the
    // scene earlier would throw because MatchScene's constructor requires
    // selfPlayerIdStore. MatchScene.initialize then emits clientReady, which
    // is what tells the server to emit matchStarted — so waiting for
    // matchStarted instead would deadlock fresh match starts.
    effect(() => {
      if (this.selfPlayerId() !== undefined && !this.matchScene()) {
        void this._initMatchScene();
      }
    });
  }

  /** Destroys the MatchScene controller when leaving the match route. */
  ngOnDestroy(): void {
    this.matchScene()?.destroy();
    this.matchScene.set(undefined);
  }

  /** Instantiates and initialises the MatchScene controller. */
  private async _initMatchScene(): Promise<void> {
    const scene = new MatchScene(
      this._socketService,
      this._promptDialogCoordinator,
      this._wayPickerOverlay,
    );
    await scene.initialize();
    this.matchScene.set(scene);
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
