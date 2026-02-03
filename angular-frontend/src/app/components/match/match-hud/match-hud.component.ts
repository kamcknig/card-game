import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  output,
  ViewChild
} from '@angular/core';
import { ScoreComponent } from './score/score.component';
import { GameLogComponent } from './game-log/game-log.component';
import { NanostoresService } from '@nanostores/angular';
import { playerIdStore, playerStore, selfPlayerIdStore } from '../../../state/player-state';
import { combineLatest, combineLatestWith, filter, map, Observable, of, switchMap } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { CardLikeId, Mats, PlayerId } from 'shared/shared-types';
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
    AsyncPipe,
    MatTabComponent,
    CardComponent,
    CardLikeComponent
  ],
  templateUrl: './match-hud.component.html',
  styleUrl: './match-hud.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchHudComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scoreView', { read: ElementRef }) scoreView!: ElementRef;

  _visibleMat: Mat | null = null;

  public get visibleMat() {
    return this._visibleMat;
  }

  public set visibleMat(value: Mat | null) {
    this._visibleMat = value;

    if (!Array.isArray(value?.content)) {
      const content = value?.content as MatPlayerContent;
      this.visibleMatContent = Object.keys(value?.content ?? {})?.map(playerId => {
        return {
          id: +playerId,
          playerName: content[+playerId].playerName ?? 'unknown',
          cardIds: content[+playerId].cardIds ?? [],
        }
      }) ?? [];
    }
    else {
      this.visibleMatContent = [{
        id: null,
        playerName: null,
        cardIds: value?.content ?? []
      }];
    }
  }

  // Normalized mat content for modal display.
  visibleMatContent: { id: PlayerId | null; playerName: string | null; cardIds: CardLikeId[] }[] = [];

  scoreViewResize = output<Rectangle>();
  scoreViewResizer: ResizeObserver | undefined;
  playerIds$: Observable<readonly PlayerId[]> | undefined;
  playerScore$!: Observable<{ id: PlayerId; score: number; name: string }[]> | undefined;
  logEntries$!: Observable<readonly LogEntryMessage[]> | undefined;
  selfMats$: Observable<{ mat: Mats, content: MatPlayerContent }[]> | undefined;
  setAsideMat$: Observable<{ mat: Mats; content: MatPlayerContent } | undefined> | undefined;
  trashMat$: Observable<{ mat: string; content: CardLikeId[]; }> | undefined;
  disconnectedHumans$: Observable<{ id: PlayerId; name: string }[]> | undefined;
  private _disconnectedHumanIds: PlayerId[] = [];

  stickyMat: boolean = false;

  constructor(
    private _nanoService: NanostoresService,
    private _socketService: SocketService,
  ) {
  }

  ngOnInit() {
    this.selfMats$ = this._nanoService.useStore(cardSourceTagMapStore).pipe(
      filter(store => store !== undefined),
      map<any, Mats[]>(store => store['mat']),
      filter(sourceKeys => sourceKeys !== undefined),
      combineLatestWith(this._nanoService.useStore(selfPlayerIdStore)),
      switchMap(([sourceKeys, selfId]) => {
        sourceKeys = sourceKeys.filter(key => +key.split(':')[1] === selfId);

        return combineLatest(
          sourceKeys.map(key => this._nanoService.useStore(getCardSourceStore(key))
            .pipe(
              map(source => {
                return { cardIds: source, sourceKey: key }
              })
            )
          )
        ).pipe(
          map(sources => {
            return sources.filter(source => source.cardIds.length > 0)
          }),
          map(sources => {
            return sources.map(source => ({
              mat: source.sourceKey,
              content: {
                [selfId!]: {
                  playerName: 'hello',
                  cardIds: source.cardIds
                }
              },
            }))
          })
        )
      })
    );

    this.trashMat$ = this._nanoService.useStore(getCardSourceStore('trash')).pipe(
      map(trash => {
        return {
          mat: 'trash',
          content: trash
        }
      })
    );

    // Build set-aside mat content grouped by player id for card-like rendering.
    this.setAsideMat$ = this._nanoService.useStore(playerIdStore).pipe(
      switchMap(ids => combineLatest([
        combineLatest(ids.map(id => this._nanoService.useStore(playerStore(id)))),
        combineLatest(ids.map(id =>
          this._nanoService.useStore(getCardSourceStore('set-aside', id))
            .pipe(map(cardIds => ({ playerId: id, cardIds })))
        )),
      ])),
      map(([players, setAsideSources]) => {
        const matContent = setAsideSources.reduce((acc, source) => {
          if (source.cardIds.length < 1) return acc;
          const playerName = players.find(p => p?.id === source.playerId)?.name;
          if (!playerName) return acc;
          acc[source.playerId] = {
            playerName: playerName,
            cardIds: source.cardIds
          };
          return acc;
        }, {} as MatPlayerContent);

        const cardCount = Object.values(matContent).reduce((acc, next) => acc + next.cardIds.length, 0);

        return cardCount > 0 ? {
          mat: 'set-aside',
          content: matContent
        } : undefined;
      })
    );

    this.logEntries$ = this._nanoService.useStore(logEntryIdsStore).pipe(
      combineLatestWith(this._nanoService.useStore(logStore)),
      map(([logIds, logs]) => logIds.map(id => logs[id]))
    );

    this.playerIds$ = this._nanoService.useStore(playerIdStore);

    this.playerScore$ = this.playerIds$.pipe(
      switchMap(ids => combineLatest(ids.map(id => {
        const score$ = this._nanoService.useStore(playerScoreStore(id));
        const player$ = this._nanoService.useStore(playerStore(id));

        return combineLatest([score$, player$]).pipe(
          map(([score, player]) => ({
            id: id,
            score,
            name: player!.name
          }))
        );
      })))
    );

    this.disconnectedHumans$ = this._nanoService.useStore(disconnectedHumanIdsStore).pipe(
      switchMap(ids => {
        this._disconnectedHumanIds = [...ids];
        if (!ids.length) return of([]);
        return combineLatest(ids.map(id => this._nanoService.useStore(playerStore(id))));
      }),
      map(players => players.filter(p => !!p).map(p => ({ id: p!.id, name: p!.name })))
    );
  }

  ngOnDestroy() {
    this.scoreViewResizer?.disconnect();
  }

  ngAfterViewInit() {
    this.scoreViewResizer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        const right = rect.right;
        this.scoreViewResize.emit(new Rectangle(rect.x, rect.y, rect.width, rect.height));
      }
    });

    this.scoreViewResizer.observe(this.scoreView.nativeElement);
  }

  onRemoveDisconnectedPlayer() {
    const targetId = this._disconnectedHumanIds[0];
    if (!targetId) return;
    this._socketService.emit('removeDisconnectedPlayer', targetId);
  }

  protected readonly Array = Array;
}
