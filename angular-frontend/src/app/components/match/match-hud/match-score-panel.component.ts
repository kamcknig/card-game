import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { ScoreComponent } from './score/score.component';
import { playerIdStore, playerStore } from '../../../state/player-state';
import { playerScoreStore } from '../../../state/player-logic';
import { PlayerId } from 'shared/types';

/**
 * Renders the score panel inside the match left column.
 *
 * Owns its own nanostore subscriptions so it can be freely placed in
 * any layout without depending on MatchHudComponent for data.
 */
@Component({
  selector: 'app-match-score-panel',
  standalone: true,
  imports: [ScoreComponent],
  template: `<app-score [playerScores]="playerScore()"></app-score>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchScorePanelComponent {
  private readonly _nanoService = inject(NanostoresService);

  /** Ordered player score rows derived from the player-id store. */
  readonly playerScore = toSignal(
    this._nanoService.useStore(playerIdStore).pipe(
      switchMap((ids) => {
        if (!ids.length) {
          return of([] as { id: PlayerId; score: number; name: string }[]);
        }
        return combineLatest(
          ids.map((id) => {
            const score$ = this._nanoService.useStore(playerScoreStore(id));
            const player$ = this._nanoService.useStore(playerStore(id));
            return combineLatest([score$, player$]).pipe(
              map(([score, player]) => ({
                id,
                score,
                name: player?.name ?? `Player ${id}`,
              }))
            );
          })
        );
      })
    ),
    { initialValue: [] as { id: PlayerId; score: number; name: string }[] }
  );
}
