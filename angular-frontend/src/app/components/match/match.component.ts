import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
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
import { SoundService } from '../../core/sound.service';
import { MatchScene } from './views/scenes/match-scene';
import { MatchSupplyComponent } from './supply/match-supply.component';
import { MatchLandscapesComponent } from './landscapes/match-landscapes.component';
import { MatchPlayerAreaComponent } from './player-area/match-player-area.component';
import { MatchNonSupplyComponent } from './non-supply/match-non-supply.component';
import { MatchHudComponent } from './match-hud/match-hud.component';
import { MatchScorePanelComponent } from './match-hud/match-score-panel.component';
import { MatchHudAsideComponent } from './match-hud/match-hud-aside.component';
import { matchStartedStore, matchSummaryStore } from '../../state/match-state';
import { selfPlayerIdStore } from '../../state/player-state';
import { activeLobbyGameIdStore } from '../../state/lobby-state';
import { CardImagePreloadService } from '../../core/card-image-preload.service';
import { undoAvailableStore, undoInFlightStore } from '../../state/undo-state';

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
    MatchHudComponent,
    MatchScorePanelComponent,
    MatchHudAsideComponent,
  ],
  templateUrl: './match.component.html',
  styleUrl: './match.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchComponent implements OnDestroy {
  private readonly _socketService = inject(SocketService);
  private readonly _promptDialogCoordinator = inject(PromptDialogCoordinatorService);
  private readonly _wayPickerOverlay = inject(WayPickerOverlayService);
  private readonly _soundService = inject(SoundService);
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _imagePreload = inject(CardImagePreloadService);

  /** Reference to the HUD component so resign requests from the aside can open its dialog. */
  @ViewChild(MatchHudComponent) private readonly _hud?: MatchHudComponent;

  /** Non-Angular controller managing game interaction and socket coordination. */
  readonly matchScene = signal<MatchScene | undefined>(undefined);

  readonly matchStarted = toSignal(this._nanoStores.useStore(matchStartedStore), { initialValue: false });

  /** Tracks when the server has identified the local player. Drives MatchScene creation. */
  readonly selfPlayerId = toSignal(
    this._nanoStores.useStore(selfPlayerIdStore),
    { initialValue: selfPlayerIdStore.get() },
  );

  /** True once the server has sent a matchSummary (game over). */
  private readonly _gameOver = toSignal(
    this._nanoStores.useStore(matchSummaryStore),
    { initialValue: matchSummaryStore.get() },
  );

  /** True while the local user has an undo request in flight. */
  private readonly _undoInFlight = toSignal(
    this._nanoStores.useStore(undoInFlightStore),
    { initialValue: undoInFlightStore.get() },
  );

  /** True when the server has at least one snapshot available to restore. */
  private readonly _undoAvailable = toSignal(
    this._nanoStores.useStore(undoAvailableStore),
    { initialValue: undoAvailableStore.get() },
  );

  /**
   * True when undo is available — the game has not ended, no undo vote is
   * already in flight from this client, and the server has a snapshot to pop.
   */
  readonly canUndo = computed(() => !this._gameOver() && !this._undoInFlight() && this._undoAvailable());

  constructor() {
    // Begin background image preloading immediately. matchStore and cardStore
    // are guaranteed populated before SocketEventMapService navigates to /match.
    this._imagePreload.preloadMatchImages();

    // If the user is returning to an already-running match (e.g. they pressed
    // the browser back arrow and are now navigating forward again), tell the
    // server to mark Player.connected = true and cancel any pending
    // vote-to-remove. This is the mirror of the leftMatch emit in ngOnDestroy.
    // - activeLobbyGameIdStore remains set throughout the match (Phase 2).
    // - matchStartedStore is true once the server confirmed the match is live.
    // - matchSummaryStore is undefined while the game is still running.
    // When player.connected is already true on the server the handler returns
    // early, so this emit is safe to fire on every fresh /match mount.
    if (activeLobbyGameIdStore.get() && matchStartedStore.get() && !matchSummaryStore.get()) {
      this._socketService.emit('enteredMatch');
    }

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

  /**
   * Destroys the MatchScene controller when leaving the match route.
   *
   * If the user navigates away while the match is still running (e.g. via the
   * browser back arrow), emit `leftMatch` so the server marks this player as
   * disconnected and queues the vote-to-remove modal on every other client.
   * The socket itself stays alive, which is how returning to /match (forward
   * arrow or "Return to game" button) can reverse the state via `enteredMatch`.
   *
   * Guards:
   * - activeLobbyGameIdStore must be set (stays set throughout the match, see Phase 2).
   * - matchSummaryStore must be undefined — a defined summary means the game has
   *   ended and the navigate-away is the normal post-game flow, not a mid-game exit.
   */
  ngOnDestroy(): void {
    // Treat navigation away from /match mid-game as a logical disconnect.
    // Other clients receive the existing playerDisconnected + vote-to-remove flow.
    if (activeLobbyGameIdStore.get() && !matchSummaryStore.get()) {
      this._socketService.emit('leftMatch');
    }

    this.matchScene()?.destroy();
    this.matchScene.set(undefined);
  }

  /** Instantiates and initialises the MatchScene controller. */
  private async _initMatchScene(): Promise<void> {
    const scene = new MatchScene(
      this._socketService,
      this._promptDialogCoordinator,
      this._wayPickerOverlay,
      this._soundService,
    );
    await scene.initialize();
    this.matchScene.set(scene);
  }

  /**
   * Relays resign requests from MatchHudAsideComponent to MatchHudComponent.
   *
   * The aside emits `resignRequested` when the user clicks the resign button.
   * MatchHudComponent owns the resign confirmation dialog and remains the
   * authoritative handler for the resign flow.
   */
  onResignRequested(): void {
    this._hud?.requestResign();
  }

  /**
   * Relays undo requests from MatchHudAsideComponent to MatchHudComponent.
   *
   * MatchHudComponent owns the undo waiting dialog and emits the socket event.
   */
  onUndoRequested(): void {
    this._hud?.requestUndo();
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
