import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ScoreComponent } from './components/score/score.component';
import { GameLogComponent } from './components/game-log/game-log.component';
import { NanostoresService } from '@nanostores/angular';
import { playerIdStore, playerScoreStore } from '../../../state/player-state';
import { combineLatest, map, Observable, switchMap } from 'rxjs';

@Component({
  selector: 'app-match-hud',
  imports: [
    ScoreComponent,
    GameLogComponent
  ],
  templateUrl: './match-hud.component.html',
  styleUrl: './match-hud.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchHudComponent implements OnInit {
  constructor(private _nanoService: NanostoresService) {
  }

  ngOnInit() {
    const playerIds$ = this._nanoService.useStore(playerIdStore);

    const playerScores$: Observable<{ playerId: number; score: number }[]> = playerIds$.pipe(
      switchMap(ids =>
        combineLatest(ids.map(id =>
          this._nanoService.useStore(playerScoreStore(id)).pipe(map(score => ({ playerId: id, score })))
        ))
      )
    )
  }
}
