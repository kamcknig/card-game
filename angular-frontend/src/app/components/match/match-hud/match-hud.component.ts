import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  output,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ScoreComponent } from './score/score.component';
import { GameLogComponent } from './game-log/game-log.component';
import { NanostoresService } from '@nanostores/angular';
import { playerIdStore, playerStore } from '../../../state/player-state';
import { combineLatest, combineLatestWith, filter, map, of, switchMap } from 'rxjs';
import { CardLikeId, Mats, PlayerId } from 'shared/types';
import { logEntryIdsStore, logStore } from '../../../state/log-state';
import { MatTabComponent } from './mat-zone/mat-tab.component';
import { CardComponent } from '../../card/card.component';
import { CardLikeComponent } from '../../card-like/card-like.component';
import { playerScoreStore } from '../../../state/player-logic';
import { LogEntryMessage } from '../../../../types';
import { MatPlayerContent } from './types';
import { Rectangle } from 'pixi.js';
import { cardSourceTagMapStore, getCardSourceStore } from '../../../state/card-source-store';
import { disconnectedHumanIdsStore } from '../../../state/game-state';
import { SocketService } from '../../../core/socket-service/socket.service';
import { debugOverlayVisibleStore, debugRuntimeContextStore } from '../../../state/debug-runtime-state';

export interface Mat {
  // Mat identifier (standard mats or custom keys).
  mat: Mats | string;
  // Mat content can be grouped by player or flat for global piles.
  content: MatPlayerContent | CardLikeId[];
}

@Component({
  selector: 'app-match-hud',
  imports: [
    ScoreComponent,
    GameLogComponent,
    MatTabComponent,
    CardComponent,
    CardLikeComponent
  ],
  templateUrl: './match-hud.component.html',
  styleUrl: './match-hud.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchHudComponent implements AfterViewInit, OnDestroy {
  private readonly _nanoService = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);

  @ViewChild('scoreView', { read: ElementRef }) scoreView!: ElementRef;

  // Currently displayed mat in the modal.
  readonly visibleMat = signal<Mat | null>(null);
  stickyMat = false;

  // Normalized mat content for modal display.
  readonly visibleMatContent = computed<{ id: PlayerId | null; playerName: string | null; cardIds: CardLikeId[] }[]>(() => {
    const value = this.visibleMat();
    if (!value) return [];
    if (!Array.isArray(value.content)) {
      const content = value.content as MatPlayerContent;
      return Object.keys(content).map((playerId) => ({
        id: +playerId,
        playerName: content[+playerId].playerName ?? 'unknown',
        cardIds: content[+playerId].cardIds ?? [],
      }));
    }
    return [{
      id: null,
      playerName: null,
      cardIds: value.content,
    }];
  });

  scoreViewResize = output<Rectangle>();
  scoreViewResizer: ResizeObserver | undefined;

  private _disconnectedHumanIds: PlayerId[] = [];

  readonly playerIds = toSignal(this._nanoService.useStore(playerIdStore), {
    initialValue: playerIdStore.get()
  });

  readonly selfMats = toSignal(this.createSelfMatsStream(), {
    initialValue: [] as { mat: Mats | string; content: MatPlayerContent; }[],
  });

  readonly setAsideMat = toSignal<{ mat: 'set-aside'; content: MatPlayerContent; } | undefined>(
    this.createSetAsideMatStream(),
    { initialValue: undefined }
  );

  readonly trashMat = toSignal<{ mat: 'trash'; content: CardLikeId[]; } | undefined>(
    this._nanoService.useStore(getCardSourceStore('trash')).pipe(
      map((trash) => ({
        mat: 'trash' as const,
        content: trash
      }))
    ),
    { initialValue: undefined }
  );

  readonly logEntries = toSignal(
    this._nanoService.useStore(logEntryIdsStore).pipe(
      combineLatestWith(this._nanoService.useStore(logStore)),
      map(([logIds, logs]) => logIds.map((id) => logs[id]))
    ),
    { initialValue: [] as LogEntryMessage[] }
  );

  readonly playerScore = toSignal(this.createPlayerScoreStream(), {
    initialValue: [] as { id: PlayerId; score: number; name: string }[],
  });

  readonly disconnectedHumans = toSignal(this.createDisconnectedHumansStream(), {
    initialValue: [] as { id: PlayerId; name: string }[],
  });

  // Current game + match identifiers provided by server debug context.
  readonly debugRuntimeContext = toSignal(this._nanoService.useStore(debugRuntimeContextStore), {
    initialValue: debugRuntimeContextStore.get()
  });

  // Controls whether the debug identity overlay is visible.
  readonly debugOverlayVisible = toSignal(this._nanoService.useStore(debugOverlayVisibleStore), {
    initialValue: debugOverlayVisibleStore.get()
  });

  ngOnDestroy() {
    this.scoreViewResizer?.disconnect();
  }

  ngAfterViewInit() {
    this.scoreViewResizer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        this.scoreViewResize.emit(new Rectangle(rect.x, rect.y, rect.width, rect.height));
      }
    });

    this.scoreViewResizer.observe(this.scoreView.nativeElement);
  }

  // Handles click behavior for mat tabs (toggle sticky on repeat click).
  onMatClick(mat: Mat) {
    if (this.visibleMat()?.mat === mat.mat) {
      this.stickyMat = !this.stickyMat;
      return;
    }
    this.visibleMat.set(mat);
  }

  // Shows mat preview on hover when sticky mode is disabled.
  onMatMouseEnter(mat: Mat) {
    if (!this.stickyMat) {
      this.visibleMat.set(mat);
    }
  }

  // Clears mat preview on hover out when sticky mode is disabled.
  onMatMouseLeave(mat: Mat) {
    if (!this.stickyMat && this.visibleMat()?.mat === mat.mat) {
      this.visibleMat.set(null);
    }
  }

  // Closes the currently visible mat modal.
  closeVisibleMat() {
    this.visibleMat.set(null);
    this.stickyMat = false;
  }

  // Removes the oldest disconnected human player.
  onRemoveDisconnectedPlayer() {
    const targetId = this._disconnectedHumanIds[0];
    if (!targetId) return;
    this._socketService.emit('removeDisconnectedPlayer', targetId);
  }

  // Toggles the HUD debug identity overlay.
  toggleDebugOverlay() {
    debugOverlayVisibleStore.set(!debugOverlayVisibleStore.get());
  }

  // Prompts the user to confirm resigning from the current match.
  onResignMatch() {
    const confirmResign = window.confirm('Resign and leave this game?');
    if (!confirmResign) {
      return;
    }
    this._socketService.emit('resignMatch');
  }

  // Builds grouped per-player mats from tagged card source keys.
  private createSelfMatsStream() {
    return this._nanoService.useStore(cardSourceTagMapStore).pipe(
      filter((store) => store !== undefined),
      map<any, string[]>((store) => store['mat']),
      filter((sourceKeys) => sourceKeys !== undefined),
      combineLatestWith(this._nanoService.useStore(playerIdStore)),
      switchMap(([sourceKeys, playerIds]) => {
        const taggedMatKeys = [...new Set(sourceKeys)];
        if (taggedMatKeys.length < 1 || playerIds.length < 1) {
          return of([]);
        }

        const sources$ = combineLatest(
          taggedMatKeys.map((key) => this._nanoService.useStore(getCardSourceStore(key))
            .pipe(
              map((source) => {
                return { cardIds: source, sourceKey: key };
              })
            )
          )
        );

        const players$ = combineLatest(
          playerIds.map((id) => this._nanoService.useStore(playerStore(id)).pipe(
            map((player) => ({
              id,
              name: player?.name ?? `Player ${id}`
            }))
          ))
        );

        return combineLatest([sources$, players$]).pipe(
          map(([sources, players]) => {
            const playerNameMap = players.reduce((acc, player) => {
              acc[player.id] = player.name;
              return acc;
            }, {} as Record<PlayerId, string>);

            // Group tagged sources by mat key so all players' mats are visible together.
            const groupedByMat = sources.reduce((acc, source) => {
              if (source.cardIds.length < 1) {
                return acc;
              }

              const [matKey, playerIdRaw] = source.sourceKey.split(':');
              const playerId = Number(playerIdRaw);
              if (!Number.isFinite(playerId)) {
                return acc;
              }

              const matContent = acc[matKey] ?? {};
              matContent[playerId] = {
                playerName: playerNameMap[playerId] ?? `Player ${playerId}`,
                cardIds: source.cardIds
              };
              acc[matKey] = matContent;
              return acc;
            }, {} as Record<string, MatPlayerContent>);

            return Object.entries(groupedByMat)
              .map(([matKey, content]) => ({ mat: matKey, content }))
              .filter((mat) => Object.values(mat.content).some((playerContent) => playerContent.cardIds.length > 0));
          })
        );
      })
    );
  }

  // Builds set-aside mat content grouped by player id for card-like rendering.
  private createSetAsideMatStream() {
    return this._nanoService.useStore(playerIdStore).pipe(
      switchMap((ids) => combineLatest([
        combineLatest(ids.map((id) => this._nanoService.useStore(playerStore(id)))),
        combineLatest(ids.map((id) =>
          this._nanoService.useStore(getCardSourceStore('set-aside', id))
            .pipe(map((cardIds) => ({ playerId: id, cardIds })))
        )),
      ])),
      map(([players, setAsideSources]) => {
        const matContent = setAsideSources.reduce((acc, source) => {
          if (source.cardIds.length < 1) return acc;
          const playerName = players.find((p) => p?.id === source.playerId)?.name;
          if (!playerName) return acc;
          acc[source.playerId] = {
            playerName: playerName,
            cardIds: source.cardIds
          };
          return acc;
        }, {} as MatPlayerContent);

        const cardCount = Object.values(matContent).reduce((acc, next) => acc + next.cardIds.length, 0);

        return cardCount > 0 ? {
          mat: 'set-aside' as const,
          content: matContent
        } : undefined;
      })
    );
  }

  // Builds ordered player score view-model rows.
  private createPlayerScoreStream() {
    return this._nanoService.useStore(playerIdStore).pipe(
      switchMap((ids) => {
        if (!ids.length) {
          return of([] as { id: PlayerId; score: number; name: string }[]);
        }

        return combineLatest(ids.map((id) => {
          const score$ = this._nanoService.useStore(playerScoreStore(id));
          const player$ = this._nanoService.useStore(playerStore(id));

          return combineLatest([score$, player$]).pipe(
            map(([score, player]) => ({
              id: id,
              score,
              name: player?.name ?? `Player ${id}`
            }))
          );
        }));
      })
    );
  }

  // Builds disconnected human-player banner data.
  private createDisconnectedHumansStream() {
    return this._nanoService.useStore(disconnectedHumanIdsStore).pipe(
      switchMap((ids) => {
        this._disconnectedHumanIds = [...ids];
        if (!ids.length) return of([]);
        return combineLatest(ids.map((id) => this._nanoService.useStore(playerStore(id))));
      }),
      map((players) => players.filter((p) => !!p).map((p) => ({ id: p!.id, name: p!.name })))
    );
  }
}
