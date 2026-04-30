import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { NanostoresService } from '@nanostores/angular';
import {
  combineLatest,
  combineLatestWith,
  filter,
  map,
  of,
  switchMap,
} from 'rxjs';
import { Card, CardLikeId, Match, Mats, PlayerId, SetAsideSourceDescriptor } from 'shared/types';
import { GameLogComponent } from './game-log/game-log.component';
import { MatTabComponent, MatTabModel } from './mat-zone/mat-tab.component';
import { CardComponent } from '../../card/card.component';
import { CardLikeComponent } from '../../card-like/card-like.component';
import { UiDialogComponent } from '../../ui/dialog/ui-dialog.component';
import { playerIdStore, playerStore } from '../../../state/player-state';
import { logEntryIdsStore, logStore } from '../../../state/log-state';
import { LogEntryMessage } from '../../../../types';
import { MatPlayerContent } from './types';
import { cardSourceStore, cardSourceTagMapStore, getCardSourceStore } from '../../../state/card-source-store';
import { debugOverlayVisibleStore, debugRuntimeContextStore } from '../../../state/debug-runtime-state';
import { authIsAdminStore, authTokenStore } from '../../../core/auth/auth.service';
import { cardStore } from '../../../state/card-state';
import { matchStore } from '../../../state/match-state';
import { findCardLikeEntryInMatch, MatchCardLikeEntry } from 'shared/find-card-like-in-match';
import {
  getSourceAccentColorForCard,
  getSourceAccentColorForCardLikeKind,
  getSourceAccentColorForSetAsideSourceKind,
} from '../../../core/source-accent-colors';
import { environment } from '../../../../environments/environment';

type Mat = MatTabModel;

/**
 * Right-column aside for the match screen.
 *
 * Renders the game log (which owns its own header, settings gear, resign
 * trigger, and admin debug-overlay toggle), mat tabs (trash, set-aside,
 * self mats), and the debug runtime overlay panel. All nanostore
 * subscriptions are owned locally so this component can be placed freely
 * in the layout without coupling to MatchHudComponent.
 *
 * Dialogs (waiting, paused, disconnect, resign confirmation, mat preview)
 * remain in MatchHudComponent because they are full-screen overlays that
 * need to be at the top of the stacking context.
 *
 * Outputs:
 * - `resignRequested` — relayed from GameLogComponent up to MatchComponent.
 */
@Component({
  selector: 'app-match-hud-aside',
  standalone: true,
  imports: [
    GameLogComponent,
    MatTabComponent,
    CardComponent,
    CardLikeComponent,
    UiDialogComponent,
    LucideAngularModule,
  ],
  templateUrl: './match-hud-aside.component.html',
  styleUrl: './match-hud-aside.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchHudAsideComponent {
  private readonly _nanoService = inject(NanostoresService);

  /** Emitted when the user requests to resign the match. */
  readonly resignRequested = output<void>();

  /** Currently displayed mat in the modal preview. */
  readonly visibleMat = signal<Mat | null>(null);
  stickyMat = false;

  private readonly _cards = toSignal(this._nanoService.useStore(cardStore), {
    initialValue: cardStore.get(),
  });

  /** Normalized mat content for modal display. */
  readonly visibleMatContent = (() => {
    // Using a getter-based signal via toSignal is not available here; the
    // mat content is derived synchronously from visibleMat() in the template.
    return this.visibleMat;
  })();

  // ---------------------------------------------------------------------------
  // Mat tabs
  // ---------------------------------------------------------------------------

  /** Player-owned mat tabs (e.g. Island, Native Village). */
  readonly selfMats = toSignal(this._createSelfMatsStream(), {
    initialValue: [] as Mat[],
  });

  /** Set-aside mat tabs grouped by owner + source. */
  readonly setAsideMats = toSignal(this._createSetAsideMatsStream(), {
    initialValue: [] as {
      id: string;
      mat: 'set-aside';
      content: CardLikeId[];
      labelPrefix: string;
      labelSource: string;
      labelSuffix: string;
      sourceColor: string;
    }[],
  });

  /** Trash mat tab. */
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

  // ---------------------------------------------------------------------------
  // Game log
  // ---------------------------------------------------------------------------

  /** Ordered log entries for the game-log component. */
  readonly logEntries = toSignal(
    this._nanoService.useStore(logEntryIdsStore).pipe(
      combineLatestWith(this._nanoService.useStore(logStore)),
      map(([logIds, logs]) => logIds.map((id) => logs[id]))
    ),
    { initialValue: [] as LogEntryMessage[] }
  );

  // ---------------------------------------------------------------------------
  // Debug overlay
  // ---------------------------------------------------------------------------

  /** Current game + match identifiers provided by server debug context. */
  readonly debugRuntimeContext = toSignal(
    this._nanoService.useStore(debugRuntimeContextStore),
    { initialValue: debugRuntimeContextStore.get() }
  );

  /** Controls whether the debug identity overlay is visible. */
  readonly debugOverlayVisible = toSignal(
    this._nanoService.useStore(debugOverlayVisibleStore),
    { initialValue: debugOverlayVisibleStore.get() }
  );

  /** Whether the current user has admin privileges — gates the debug toggle. */
  readonly isAdmin = toSignal(this._nanoService.useStore(authIsAdminStore), {
    initialValue: authIsAdminStore.get(),
  });

  // ---------------------------------------------------------------------------
  // Mat interaction handlers
  // ---------------------------------------------------------------------------

  /** Handles click behavior for mat tabs (toggle sticky on repeat click). */
  onMatClick(mat: Mat): void {
    if (this.visibleMat()?.id === mat.id) {
      this.stickyMat = !this.stickyMat;
      return;
    }
    this.visibleMat.set(mat);
  }

  /** Shows mat preview on hover when sticky mode is disabled. */
  onMatMouseEnter(mat: Mat): void {
    if (!this.stickyMat) {
      this.visibleMat.set(mat);
    }
  }

  /** Clears mat preview on hover out when sticky mode is disabled. */
  onMatMouseLeave(mat: Mat): void {
    if (!this.stickyMat && this.visibleMat()?.id === mat.id) {
      this.visibleMat.set(null);
    }
  }

  /** Closes the currently visible mat modal. */
  closeVisibleMat(): void {
    this.visibleMat.set(null);
    this.stickyMat = false;
  }

  // ---------------------------------------------------------------------------
  // Resign
  // ---------------------------------------------------------------------------

  /** Propagates the resign request up to MatchComponent, which forwards it to MatchHudComponent. */
  onResignMatch(): void {
    this.resignRequested.emit();
  }

  // ---------------------------------------------------------------------------
  // Debug
  // ---------------------------------------------------------------------------

  /**
   * Sends a POST to the debug end-game endpoint, forcibly ending the active
   * match and triggering the game-over flow on the server.
   */
  async debugEndGame(): Promise<void> {
    const ctx = debugRuntimeContextStore.get();
    if (!ctx?.gameId || !ctx.matchScopeId) return;
    const token = authTokenStore.get();
    await fetch(
      `${environment.wsHost}/debug/games/${ctx.gameId}/matches/${ctx.matchScopeId}/end`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Mat helpers
  // ---------------------------------------------------------------------------

  /** Returns true when the id is a concrete card instance (not a card-like). */
  isCardInstance(cardLikeId: CardLikeId): boolean {
    return !!this._cards()?.[cardLikeId];
  }

  /** Builds a stable label string from tab display segments. */
  getMatLabel(mat: Mat): string {
    return `${mat.labelPrefix}${mat.labelSource ?? ''}${mat.labelSuffix ?? ''}`;
  }

  /** Normalizes mat content for the mat-preview modal. */
  getVisibleMatContent(): { id: PlayerId | null; playerName: string | null; cardIds: CardLikeId[] }[] {
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
    return [{ id: null, playerName: null, cardIds: value.content }];
  }

  /** Returns the human-friendly title for the currently visible mat modal. */
  getVisibleMatTitle(): string {
    const mat = this.visibleMat();
    return mat ? this.getMatLabel(mat) : '';
  }

  // ---------------------------------------------------------------------------
  // Private stream builders (moved from MatchHudComponent)
  // ---------------------------------------------------------------------------

  /** Builds grouped per-player mats from tagged card source keys. */
  private _createSelfMatsStream() {
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
          taggedMatKeys.map((key) =>
            this._nanoService.useStore(getCardSourceStore(key)).pipe(
              map((source) => ({ cardIds: source, sourceKey: key }))
            )
          )
        );

        const players$ = combineLatest(
          playerIds.map((id) =>
            this._nanoService.useStore(playerStore(id)).pipe(
              map((player) => ({
                id,
                name: player?.name ?? `Player ${id}`,
              }))
            )
          )
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
                cardIds: source.cardIds,
              };
              acc[matKey] = matContent;
              return acc;
            }, {} as Record<string, MatPlayerContent>);

            return Object.entries(groupedByMat)
              .map(([matKey, content]) => ({
                id: `mat:${matKey}`,
                mat: matKey,
                content,
                labelPrefix: this._formatMatName(matKey),
              }))
              .filter((mat) =>
                Object.values(mat.content).some((playerContent) => playerContent.cardIds.length > 0)
              ) as Mat[];
          })
        );
      })
    );
  }

  /** Builds set-aside tabs grouped by owner + source, plus source-only groups. */
  private _createSetAsideMatsStream() {
    return this._nanoService.useStore(playerIdStore).pipe(
      switchMap((ids) => {
        const players$ =
          ids.length < 1
            ? of([] as { id: PlayerId; name: string }[])
            : combineLatest(
                ids.map((id) =>
                  this._nanoService.useStore(playerStore(id)).pipe(
                    map((player) => ({
                      id,
                      name: player?.name ?? `Player ${id}`,
                    }))
                  )
                )
              );

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

        const grouped = new Map<
          string,
          {
            ownerPlayerId?: PlayerId;
            sourceName: string;
            sourceColor: string;
            cardIds: CardLikeId[];
          }
        >();

        for (const [sourceKey, cardIds] of Object.entries(cardSources ?? {})) {
          if (sourceKey !== 'set-aside' && !sourceKey.startsWith('set-aside:')) {
            continue;
          }

          const playerIdToken = sourceKey.split(':')[1];
          const zonePlayerId = playerIdToken === undefined ? undefined : Number(playerIdToken);
          const zoneOwnerPlayerId = Number.isFinite(zonePlayerId)
            ? (zonePlayerId as PlayerId)
            : undefined;

          for (const cardId of cardIds) {
            const source = match?.setAsideSourceById?.[cardId];
            const ownerPlayerId = source?.ownerPlayerId ?? zoneOwnerPlayerId;
            const sourceDisplay = this._resolveSetAsideSourceDisplay({
              cardId,
              source,
              cardsById,
              match,
              ownerPlayerId,
            });

            const groupKey =
              ownerPlayerId === undefined
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
          const playerName =
            group.ownerPlayerId === undefined
              ? undefined
              : (playerNameById[group.ownerPlayerId] ?? `Player ${group.ownerPlayerId}`);
          const sourceLabel = playerName
            ? `${playerName} - ${group.sourceName}`
            : group.sourceName;

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

        return tabs.sort((left, right) =>
          this.getMatLabel(left).localeCompare(this.getMatLabel(right))
        );
      })
    );
  }

  /** Resolves display text for built-in mat keys. */
  private _formatMatName(matKey: string): string {
    if (matKey === 'set-aside') {
      return 'Set aside';
    }
    return matKey
      .split('-')
      .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
      .join(' ');
  }

  /** Resolves source label/color for a set-aside entry from source metadata. */
  private _resolveSetAsideSourceDisplay(args: {
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
      const sourceCard = Object.values(cardsById).find(
        (card) => card.cardKey === source.sourceCardKey
      );
      if (sourceCard) {
        return {
          key: `card-key:${source.sourceCardKey}`,
          name: sourceCard.cardName,
          color: getSourceAccentColorForCard(sourceCard),
        };
      }
      const sourceCardLike = this._findCardLikeEntryByKey(match, source.sourceCardKey);
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

  /** Resolves a card-like entry by cardKey for setup metadata fallback names. */
  private _findCardLikeEntryByKey(
    match: Match | null,
    cardKey: string
  ): MatchCardLikeEntry | undefined {
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
      ...(match.artifacts?.cards ?? []).map((cardLike) => ({
        kind: 'artifact' as const,
        cardLike,
      })),
    ].find((candidate) => candidate.cardLike.cardKey === cardKey);
    return entry;
  }
}
