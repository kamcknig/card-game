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
import { playerIdStore, playerStore } from '../../../state/player-state';
import { combineLatest, combineLatestWith, filter, map, Observable, switchMap } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { CardId, Mats, PlayerId } from 'shared/shared-types';
import { logEntryIdsStore, logStore } from '../../../state/log-state';
import { MatTabComponent } from './mat-zone/mat-tab.component';
import { CardComponent } from '../../card/card.component';
import { playerScoreStore } from '../../../state/player-logic';
import { selfPlayerMatStore, setAsideStore, trashStore } from '../../../state/match-logic';
import { LogEntryMessage } from '../../../../types';
import { cardStore } from '../../../state/card-state';
import { MatPlayerContent } from './types';
import { selfPlayerIdStore } from '../../../state/match-state';
import { Rectangle } from 'pixi.js';

export interface Mat {
  mat: Mats | string;
  content: MatPlayerContent | CardId[];
}

@Component({
  selector: 'app-match-hud',
  imports: [
    ScoreComponent,
    GameLogComponent,
    AsyncPipe,
    MatTabComponent,
    CardComponent
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

  visibleMatContent: { id: PlayerId | null; playerName: string | null; cardIds: CardId[] }[] = [];

  scoreViewResize = output<Rectangle>();
  scoreViewResizer: ResizeObserver | undefined;
  playerIds$: Observable<readonly PlayerId[]> | undefined;
  playerScore$!: Observable<{ id: PlayerId; score: number; name: string }[]> | undefined;
  logEntries$!: Observable<readonly LogEntryMessage[]> | undefined;
  selfMats$: Observable<{ mat: Mats, content: MatPlayerContent }[]> | undefined;
  setAsideMat$: Observable<{ mat: Mats; content: MatPlayerContent } | undefined> | undefined;
  trashMat$: Observable<{ mat: string; content: CardId[]; }> | undefined;

  stickyMat: boolean = false;

  constructor(private _nanoService: NanostoresService) {
  }

  ngOnInit() {
    this.trashMat$ = this._nanoService.useStore(trashStore).pipe(
      map(trash => {
        return {
          mat: 'trash',
          content: trash
        }
      })
    );

    this.setAsideMat$ = this._nanoService.useStore(setAsideStore).pipe(
      combineLatestWith(
        this._nanoService.useStore(cardStore),
        this._nanoService.useStore(playerIdStore)
          .pipe(switchMap(ids => combineLatest(ids.map(id => this._nanoService.useStore(playerStore(id)))))),
      ),
      map(([setAsideCardIds, cardsById, players]) => {
        let matContent = setAsideCardIds.reduce((acc, nextCardId) => {
          const card = cardsById[nextCardId];
          const owner = card.owner;

          if (!owner) return acc;

          const playerName = players.find(p => p?.id === owner)?.name;

          if (!playerName) return acc;

          acc[owner] ??= {
            playerName: playerName,
            cardIds: []
          };
          acc[owner].cardIds.push(nextCardId);
          return acc;
        }, {} as MatPlayerContent);

        const cardCount = Object.values(matContent).reduce((acc, next) => acc + next.cardIds.length, 0);

        return cardCount > 0 ? {
          mat: 'set-aside',
          content: matContent
        } : undefined
      })
    );

    this.selfMats$ = this._nanoService.useStore(selfPlayerMatStore)
      .pipe(
        map(mats => Object.entries(mats).map(entry => ({ mat: entry[0] as Mats, cardIds: entry[1] }))),
        map(mats => mats.filter(mat => mat.cardIds.length > 0)),
        map(mats => mats.filter(mat => mat.mat !== 'set-aside')),
        combineLatestWith(
          this._nanoService.useStore(selfPlayerIdStore).pipe(filter(vale => vale !== undefined)),
          this._nanoService.useStore(playerIdStore)
            .pipe(switchMap(ids => combineLatest(ids.map(id => this._nanoService.useStore(playerStore(id)))))),
        ),
        map(([mats, selfId, players]) => mats.map(mat => {
            const playerName = players.find(p => p?.id === selfId)?.name;
            return {
              mat: mat.mat,
              content: {
                [selfId]: {
                  playerName: playerName ?? 'Unknown',
                  cardIds: mat.cardIds
                }
              }
            }
          })
        )
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
  }

  openMat(event: { mat: Mats, content: MatPlayerContent } | null) {
    this.visibleMat = event;
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

  protected readonly Array = Array;
}
