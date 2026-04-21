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
import { CircleQuestionMark, Flag, LucideAngularModule, Settings } from 'lucide-angular';
import { ScoreComponent } from './score/score.component';
import { GameLogComponent } from './game-log/game-log.component';
import { NanostoresService } from '@nanostores/angular';
import { playerIdStore, playerStore, selfPlayerIdStore } from '../../../state/player-state';
import { combineLatest, combineLatestWith, filter, map, of, switchMap } from 'rxjs';
import { Card, CardLikeId, Match, Mats, PlayerId, SetAsideSourceDescriptor } from 'shared/types';
import { logEntryIdsStore, logStore } from '../../../state/log-state';
import { MatTabComponent, MatTabModel } from './mat-zone/mat-tab.component';
import { CardComponent } from '../../card/card.component';
import { CardLikeComponent } from '../../card-like/card-like.component';
import { playerScoreStore } from '../../../state/player-logic';
import { LogEntryMessage } from '../../../../types';
import { MatPlayerContent } from './types';
import { cardSourceStore, cardSourceTagMapStore, getCardSourceStore } from '../../../state/card-source-store';
import { disconnectedHumanIdsStore } from '../../../state/game-state';
import { SocketService } from '../../../core/socket-service/socket.service';
import { debugOverlayVisibleStore, debugRuntimeContextStore } from '../../../state/debug-runtime-state';
import { authIsAdminStore } from '../../../core/auth/auth.service';
import { UiDialogComponent } from '../../ui/dialog/ui-dialog.component';
import { cardStore } from '../../../state/card-state';
import { matchStore } from '../../../state/match-state';
import { findCardLikeEntryInMatch, MatchCardLikeEntry } from 'shared/find-card-like-in-match';
import { gamePausedStore } from '../../../state/game-logic';
import { waitingOnPlayerIdStore } from '../../../state/match-ui-overlay-state';
import { currentPlayerTurnIdStore, turnPhaseStore } from '../../../state/turn-state';
import { awaitingServerLockReleaseStore, promptInteractionLockStore } from '../../../state/interactive-state';
import {
  getSourceAccentColorForCard,
  getSourceAccentColorForCardLikeKind,
  getSourceAccentColorForSetAsideSourceKind
} from '../../../core/source-accent-colors';
import { environment } from '../../../../environments/environment';

type Mat = MatTabModel;
type RectLike = { x: number; y: number; width: number; height: number };

@Component({
  selector: 'app-match-hud',
  imports: [
    ScoreComponent,
    GameLogComponent,
    MatTabComponent,
    CardComponent,
    CardLikeComponent,
    UiDialogComponent,
    LucideAngularModule,
  ],
  templateUrl: './match-hud.component.html',
  styleUrl: './match-hud.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchHudComponent implements AfterViewInit, OnDestroy {
  private readonly _nanoService = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);

  // Lucide icon references exposed to the template for the HUD menu buttons.
  readonly FlagIcon = Flag;
  readonly SettingsIcon = Settings;
  readonly CircleQuestionMarkIcon = CircleQuestionMark;

  @ViewChild('scoreView', { read: ElementRef }) scoreView!: ElementRef;

  // Controls visibility of the resign confirmation dialog.
  readonly resignDialogVisible = signal(false);

  // Currently displayed mat in the modal.
  readonly visibleMat = signal<Mat | null>(null);
  stickyMat = false;

  private readonly _cards = toSignal(this._nanoService.useStore(cardStore), {
    initialValue: cardStore.get()
  });

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

  // Human-friendly title for the currently visible mat modal.
  readonly visibleMatTitle = computed(() => {
    const mat = this.visibleMat();
    return mat ? this.getMatLabel(mat) : '';
  });

  scoreViewResize = output<RectLike>();
  nextPhaseRequested = output<void>();
  playAllTreasuresRequested = output<void>();
  scoreViewResizer: ResizeObserver | undefined;

  private _disconnectedHumanIds: PlayerId[] = [];

  readonly playerIds = toSignal(this._nanoService.useStore(playerIdStore), {
    initialValue: playerIdStore.get()
  });

  readonly selfPlayerId = toSignal(this._nanoService.useStore(selfPlayerIdStore), {
    initialValue: selfPlayerIdStore.get(),
  });

  readonly currentPlayerTurnId = toSignal(this._nanoService.useStore(currentPlayerTurnIdStore), {
    initialValue: currentPlayerTurnIdStore.get(),
  });

  readonly turnPhase = toSignal(this._nanoService.useStore(turnPhaseStore), {
    initialValue: turnPhaseStore.get(),
  });

  readonly awaitingServerLockRelease = toSignal(this._nanoService.useStore(awaitingServerLockReleaseStore), {
    initialValue: awaitingServerLockReleaseStore.get(),
  });

  readonly promptInteractionLocked = toSignal(this._nanoService.useStore(promptInteractionLockStore), {
    initialValue: promptInteractionLockStore.get(),
  });

  readonly selfHandCardIds = toSignal(this.createSelfHandCardStream(), {
    initialValue: [] as number[],
  });

  // Keeps turn action controls limited to the active player while no prompt/server lock is active.
  readonly canUseTurnActions = computed(() => {
    const selfPlayerId = this.selfPlayerId();
    return (
      selfPlayerId !== undefined &&
      this.currentPlayerTurnId() === selfPlayerId &&
      !this.awaitingServerLockRelease() &&
      !this.promptInteractionLocked()
    );
  });

  readonly nextPhaseLabel = computed(() => {
    const phase = this.turnPhase();
    switch (phase) {
      case 'action':
        return 'END ACTIONS';
      case 'buy':
        return 'END BUYS';
      default:
        return 'NEXT';
    }
  });

  readonly showPlayAllTreasures = computed(() => {
    if (!this.canUseTurnActions() || this.turnPhase() !== 'buy') {
      return false;
    }
    const cardsById = this._cards() ?? {};
    return this.selfHandCardIds().some((cardId) => cardsById[cardId]?.type?.includes('TREASURE'));
  });

  readonly selfMats = toSignal(this.createSelfMatsStream(), {
    initialValue: [] as Mat[],
  });

  readonly setAsideMats = toSignal(
    this.createSetAsideMatsStream(),
    {
      initialValue: [] as {
        id: string;
        mat: 'set-aside';
        content: CardLikeId[];
        labelPrefix: string;
        labelSource: string;
        labelSuffix: string;
        sourceColor: string;
      }[]
    }
  );

  readonly trashMat = toSignal<Mat | undefined>(
    this._nanoService.useStore(getCardSourceStore('trash')).pipe(
      map((trash) => ({
        id: 'mat:trash',
        mat: 'trash' as const,
        content: trash,
        labelPrefix: 'Trash',
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

  // Controls match pause overlay when any human player is disconnected.
  readonly gamePaused = toSignal(this._nanoService.useStore(gamePausedStore), {
    initialValue: gamePausedStore.get(),
  });

  // Resolves current "waiting for player" display name for Angular HUD overlay.
  readonly waitingOnPlayerName = toSignal(this.createWaitingOnPlayerNameStream(), {
    initialValue: null as string | null,
  });

  // Current game + match identifiers provided by server debug context.
  readonly debugRuntimeContext = toSignal(this._nanoService.useStore(debugRuntimeContextStore), {
    initialValue: debugRuntimeContextStore.get()
  });

  // Controls whether the debug identity overlay is visible.
  readonly debugOverlayVisible = toSignal(this._nanoService.useStore(debugOverlayVisibleStore), {
    initialValue: debugOverlayVisibleStore.get()
  });

  // Whether the current user has admin privileges — gates the debug toggle button.
  readonly isAdmin = toSignal(this._nanoService.useStore(authIsAdminStore), {
    initialValue: authIsAdminStore.get(),
  });

  ngOnDestroy() {
    this.scoreViewResizer?.disconnect();
  }

  ngAfterViewInit() {
    this.scoreViewResizer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        this.scoreViewResize.emit({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      }
    });

    this.scoreViewResizer.observe(this.scoreView.nativeElement);
  }

  // Handles click behavior for mat tabs (toggle sticky on repeat click).
  onMatClick(mat: Mat) {
    if (this.visibleMat()?.id === mat.id) {
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
    if (!this.stickyMat && this.visibleMat()?.id === mat.id) {
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

  /**
   * Sends a POST to the debug end-game endpoint, forcibly ending the active
   * match and triggering the game-over flow on the server.
   */
  async debugEndGame(): Promise<void> {
    const ctx = debugRuntimeContextStore.get();
    if (!ctx?.gameId || !ctx.matchScopeId) return;
    await fetch(`${environment.wsHost}/debug/games/${ctx.gameId}/matches/${ctx.matchScopeId}/end`, {
      method: 'POST',
    });
  }

  // Forwards "next phase" requests to the active match scene via AppComponent output binding.
  onNextPhaseRequested() {
    this.nextPhaseRequested.emit();
  }

  // Forwards "play all treasures" requests to the active match scene via AppComponent output binding.
  onPlayAllTreasuresRequested() {
    this.playAllTreasuresRequested.emit();
  }

  // Returns true when the id is a concrete card instance (not a card-like).
  isCardInstance(cardLikeId: CardLikeId): boolean {
    return !!this._cards()?.[cardLikeId];
  }

  // Builds a stable label string from tab display segments.
  getMatLabel(mat: Mat): string {
    return `${mat.labelPrefix}${mat.labelSource ?? ''}${mat.labelSuffix ?? ''}`;
  }

  // Resolves display text for built-in mat keys.
  private formatMatName(matKey: string): string {
    if (matKey === 'set-aside') {
      return 'Set aside';
    }
    return matKey
      .split('-')
      .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
      .join(' ');
  }

  // Resolves a card-like entry by cardKey for setup metadata fallback names.
  private findCardLikeEntryByKey(match: Match | null, cardKey: string): MatchCardLikeEntry | undefined {
    if (!match) {
      return undefined;
    }
    const entry = [
      ...match.events.map((cardLike) => ({ kind: 'event' as const, cardLike })),
      ...match.allies.map((cardLike) => ({ kind: 'ally' as const, cardLike })),
      ...match.landmarks.map((cardLike) => ({ kind: 'landmark' as const, cardLike })),
      ...match.projects.map((cardLike) => ({ kind: 'project' as const, cardLike })),
      ...match.ways.map((cardLike) => ({ kind: 'way' as const, cardLike })),
      ...match.traits.map((cardLike) => ({ kind: 'trait' as const, cardLike })),
      ...(match.boons?.cards ?? []).map((cardLike) => ({ kind: 'boon' as const, cardLike })),
      ...(match.hexes?.cards ?? []).map((cardLike) => ({ kind: 'hex' as const, cardLike })),
      ...(match.states?.cards ?? []).map((cardLike) => ({ kind: 'state' as const, cardLike })),
      ...(match.artifacts?.cards ?? []).map((cardLike) => ({ kind: 'artifact' as const, cardLike })),
    ].find((candidate) => candidate.cardLike.cardKey === cardKey);
    return entry;
  }

  // Resolves source label/color for a set-aside entry from source metadata.
  private resolveSetAsideSourceDisplay(args: {
    cardId: CardLikeId;
    source: SetAsideSourceDescriptor | undefined;
    cardsById: Record<number, Card>;
    match: Match | null;
    ownerPlayerId?: PlayerId;
  }): { key: string; name: string; color: string } {
    const { source, cardsById, match, ownerPlayerId } = args;
    if (source?.sourceCardId !== undefined) {
      const sourceCard = cardsById[source.sourceCardId];
      return {
        key: `card:${source.sourceCardId}`,
        name: sourceCard?.cardName ?? `Card ${source.sourceCardId}`,
        color: getSourceAccentColorForCard(sourceCard),
      };
    }
    if (source?.sourceCardLikeId !== undefined) {
      const sourceCardLike = findCardLikeEntryInMatch(match, source.sourceCardLikeId);
      return {
        key: `card-like:${source.sourceCardLikeId}`,
        name: sourceCardLike?.cardLike.cardName ?? `Card-like ${source.sourceCardLikeId}`,
        color: getSourceAccentColorForCardLikeKind(sourceCardLike?.kind),
      };
    }
    if (source?.sourceCardKey) {
      const sourceCard = Object.values(cardsById).find((card) => card.cardKey === source.sourceCardKey);
      if (sourceCard) {
        return {
          key: `card-key:${source.sourceCardKey}`,
          name: sourceCard.cardName,
          color: getSourceAccentColorForCard(sourceCard),
        };
      }
      const sourceCardLike = this.findCardLikeEntryByKey(match, source.sourceCardKey);
      if (sourceCardLike) {
        return {
          key: `card-like-key:${source.sourceCardKey}`,
          name: sourceCardLike.cardLike.cardName,
          color: getSourceAccentColorForCardLikeKind(sourceCardLike.kind),
        };
      }
      return {
        key: `card-key:${source.sourceCardKey}`,
        name: source.sourceCardKey,
        color: getSourceAccentColorForSetAsideSourceKind(source.sourceKind),
      };
    }
    if (source?.sourceLabel) {
      return {
        key: `label:${source.sourceLabel}`,
        name: source.sourceLabel,
        color: getSourceAccentColorForSetAsideSourceKind(source.sourceKind),
      };
    }
    if (ownerPlayerId !== undefined) {
      return {
        key: `player:${ownerPlayerId}`,
        name: `Player ${ownerPlayerId}`,
        color: getSourceAccentColorForSetAsideSourceKind(source?.sourceKind),
      };
    }
    return {
      key: `card-id:${args.cardId}`,
      name: 'Set aside',
      color: getSourceAccentColorForSetAsideSourceKind(source?.sourceKind),
    };
  }

  // Opens the resign confirmation dialog.
  onResignMatch() {
    this.resignDialogVisible.set(true);
  }

  // Closes the resign dialog without resigning.
  onCancelResign() {
    this.resignDialogVisible.set(false);
  }

  // Confirms resign: emits the server event and closes the dialog.
  onConfirmResign() {
    this.resignDialogVisible.set(false);
    this._socketService.emit('resignMatch');
  }

  // Switches hand-source subscription when self player id becomes available.
  private createSelfHandCardStream() {
    return this._nanoService.useStore(selfPlayerIdStore).pipe(
      switchMap((selfPlayerId) => {
        if (selfPlayerId === undefined) {
          return of([] as number[]);
        }
        return this._nanoService.useStore(getCardSourceStore('playerHand', selfPlayerId));
      })
    );
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
              .map(([matKey, content]) => ({
                id: `mat:${matKey}`,
                mat: matKey,
                content,
                labelPrefix: this.formatMatName(matKey),
              }))
              .filter((mat) => Object.values(mat.content).some((playerContent) => playerContent.cardIds.length > 0)) as Mat[];
          })
        );
      })
    );
  }

  // Builds set-aside tabs grouped by owner + source, plus source-only groups.
  private createSetAsideMatsStream() {
    return this._nanoService.useStore(playerIdStore).pipe(
      switchMap((ids) => {
        const players$ = ids.length < 1
          ? of([] as { id: PlayerId; name: string }[])
          : combineLatest(ids.map((id) => this._nanoService.useStore(playerStore(id)).pipe(
            map((player) => ({
              id,
              name: player?.name ?? `Player ${id}`,
            }))
          )));

        return combineLatest([
          players$,
          this._nanoService.useStore(cardSourceStore),
          this._nanoService.useStore(matchStore),
          this._nanoService.useStore(cardStore),
        ]);
      }),
      map(([players, cardSources, match, cardsById]) => {
        const playerNameById = players.reduce((acc, player) => {
          acc[player.id] = player.name;
          return acc;
        }, {} as Record<PlayerId, string>);

        const grouped = new Map<string, {
          ownerPlayerId?: PlayerId;
          sourceName: string;
          sourceColor: string;
          cardIds: CardLikeId[];
        }>();

        for (const [sourceKey, cardIds] of Object.entries(cardSources ?? {})) {
          if (sourceKey !== 'set-aside' && !sourceKey.startsWith('set-aside:')) {
            continue;
          }

          const playerIdToken = sourceKey.split(':')[1];
          const zonePlayerId = playerIdToken === undefined ? undefined : Number(playerIdToken);
          const zoneOwnerPlayerId = Number.isFinite(zonePlayerId) ? zonePlayerId as PlayerId : undefined;

          for (const cardId of cardIds) {
            const source = match?.setAsideSourceById?.[cardId];
            const ownerPlayerId = source?.ownerPlayerId ?? zoneOwnerPlayerId;
            const sourceDisplay = this.resolveSetAsideSourceDisplay({
              cardId,
              source,
              cardsById,
              match,
              ownerPlayerId,
            });

            const groupKey = ownerPlayerId === undefined
              ? `source:${sourceDisplay.key}`
              : `player:${ownerPlayerId}:source:${sourceDisplay.key}`;

            const existing = grouped.get(groupKey);
            if (existing) {
              existing.cardIds.push(cardId);
              continue;
            }

            grouped.set(groupKey, {
              ownerPlayerId,
              sourceName: sourceDisplay.name,
              sourceColor: sourceDisplay.color,
              cardIds: [cardId],
            });
          }
        }

        const tabs = Array.from(grouped.entries()).map(([groupKey, group]) => {
          const playerName = group.ownerPlayerId === undefined
            ? undefined
            : (playerNameById[group.ownerPlayerId] ?? `Player ${group.ownerPlayerId}`);
          const sourceLabel = playerName ? `${playerName} - ${group.sourceName}` : group.sourceName;

          return {
            id: `mat:set-aside:${groupKey}`,
            mat: 'set-aside' as const,
            content: group.cardIds,
            labelPrefix: 'Set aside (',
            labelSource: sourceLabel,
            labelSuffix: ')',
            sourceColor: group.sourceColor,
          } satisfies Mat;
        });

        return tabs.sort((left, right) => this.getMatLabel(left).localeCompare(this.getMatLabel(right)));
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

  // Builds waiting overlay text from the active player id payload.
  private createWaitingOnPlayerNameStream() {
    return this._nanoService.useStore(waitingOnPlayerIdStore).pipe(
      switchMap((playerId) => {
        if (playerId === null) {
          return of(null);
        }
        return this._nanoService.useStore(playerStore(playerId)).pipe(
          map((player) => player?.name ?? `Player ${playerId}`),
        );
      })
    );
  }
}
