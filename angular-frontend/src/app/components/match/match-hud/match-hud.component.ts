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
import { ScoreComponent } from './components/score/score.component';
import { GameLogComponent } from './components/game-log/game-log.component';
import { NanostoresService } from '@nanostores/angular';
import { playerIdStore, playerScoreStore, playerStore } from '../../../state/player-state';
import { combineLatest, combineLatestWith, map, Observable, switchMap } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { LogEntryMessage } from 'shared/shared-types';
import { logEntryIdsStore, logStore } from '../../../state/log-state';

@Component({
  selector: 'app-match-hud',
  imports: [
    ScoreComponent,
    GameLogComponent,
    AsyncPipe
  ],
  templateUrl: './match-hud.component.html',
  styleUrl: './match-hud.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchHudComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scoreView', { read: ElementRef}) scoreView!: ElementRef;

  scoreViewResize = output<number>();
  scoreViewResizer: ResizeObserver | undefined;
  playerIds$: Observable<readonly number[]> | undefined;
  playerScore$!: Observable<{ id: number; score: number; name: string }[]> | null;
  logEntries$!: Observable<readonly LogEntryMessage[]> | null;

  constructor(private _nanoService: NanostoresService) {
  }

  ngOnInit() {
    this.logEntries$ = this._nanoService.useStore(logEntryIdsStore).pipe(
      combineLatestWith(this._nanoService.useStore(logStore)),
      map(([logIds, logs]) => logIds.map(id => logs[id]))
    );

    this.playerIds$ = this._nanoService.useStore(playerIdStore);

    this.playerScore$ = this.playerIds$.pipe(
      switchMap(ids =>
        combineLatest(
          ids.map(id => {
            const score$ = this._nanoService.useStore(playerScoreStore(id));
            const player$ = this._nanoService.useStore(playerStore(id));

            return combineLatest([score$, player$]).pipe(
              map(([score, player]) => ({
                id: id,
                score,
                name: player!.name
              }))
            );
          })
        )
      )
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
        this.scoreViewResize.emit(right);
      }
    });

    this.scoreViewResizer.observe(this.scoreView.nativeElement);
  }
}
