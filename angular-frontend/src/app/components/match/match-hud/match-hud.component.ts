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
import { playerIdStore, playerScoreStore, playerStore } from '../../../state/player-state';
import { combineLatest, combineLatestWith, map, Observable, switchMap } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { CardId, LogEntryMessage, Mats, PlayerId } from 'shared/shared-types';
import { logEntryIdsStore, logStore } from '../../../state/log-state';
import { matStore, playAreaStore, selfPlayerIdStore } from '../../../state/match-state';
import { MatZoneComponent } from './mat-zone/mat-zone.component';
import { CardComponent } from '../../card/card.component';
import { currentPlayerTurnIdStore } from '../../../state/turn-state';

@Component({
  selector: 'app-match-hud',
  imports: [
    ScoreComponent,
    GameLogComponent,
    AsyncPipe,
    MatZoneComponent,
    CardComponent
  ],
  templateUrl: './match-hud.component.html',
  styleUrl: './match-hud.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchHudComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scoreView', { read: ElementRef }) scoreView!: ElementRef;

  scoreViewResize = output<number>();
  scoreViewResizer: ResizeObserver | undefined;
  playerIds$: Observable<readonly PlayerId[]> | undefined;
  playerScore$!: Observable<{ id: PlayerId; score: number; name: string }[]> | null;
  logEntries$!: Observable<readonly LogEntryMessage[]> | null;
  mats$: Observable<{mat: Mats, cardIds: CardId[]}[]> | undefined;
  playAreaMat$: Observable<{ mat: 'playArea', cardIds: CardId[] }> | undefined;
  visibleMat: {mat: Mats | 'playArea'; cardIds: CardId[] } | undefined;

  constructor(private _nanoService: NanostoresService) {
  }

  ngOnInit() {
    this.playAreaMat$ = this._nanoService.useStore(playAreaStore).pipe(
      combineLatestWith(
        this._nanoService.useStore(selfPlayerIdStore),
        this._nanoService.useStore(currentPlayerTurnIdStore),
      ),
      map(([cardIds, selfId, currentId]) => {
        return { mat: 'playArea', cardIds: selfId === currentId ? [] : cardIds };
      })
    )

    this.mats$ = this._nanoService.useStore(matStore)
      .pipe(map(mats =>
        Object.entries(mats)
          .map(entry => ({ mat: entry[0] as Mats, cardIds: entry[1] }))/*.filter(e => e.cardIds.length > 0)*/));

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

  openMat(event: {mat: Mats | 'playArea', cardIds: CardId[]}) {
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
        this.scoreViewResize.emit(right);
      }
    });

    this.scoreViewResizer.observe(this.scoreView.nativeElement);
  }
}
