import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { currentPlayerTurnIdStore, turnNumberStore } from '../../../../state/turn-state';
import { map, Observable } from 'rxjs';
import { AsyncPipe, NgClass, UpperCasePipe } from '@angular/common';
import { PlayerId } from 'shared/shared-types';
import { playerIdStore, playerStore } from '../../../../state/player-state';
import tinycolor from 'tinycolor2'
import { roundNumberStore } from '../../../../state/turn-logic';

@Component({
  selector: 'app-score',
  imports: [
    AsyncPipe,
    UpperCasePipe,
    NgClass,
  ],
  templateUrl: './score.component.html',
  styleUrl: './score.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScoreComponent implements OnInit {
  @Input() playerScores!: { id: number; score: number; name: string }[] | null;

  turnNumber$: Observable<number> | undefined;
  roundNumber$: Observable<number> | undefined;
  currentPlayerTurnId$: Observable<PlayerId> | undefined;

  constructor(private _nanoService: NanostoresService) {

  }

  getOrderedPlayerScores() {
    return this._nanoService.useStore(playerIdStore)
      .pipe(
        map(ids => ids.map(id =>
          this.playerScores?.find(pScore => pScore.id === id)))
      );
  }

  getPlayerColor(id: PlayerId) {
    return this._nanoService.useStore(playerStore(id)).pipe(
      map(player => tinycolor(player?.color).lighten(15) ?? 'black')
    );
  }

  getBackgroundColor(id: PlayerId) {
    return this._nanoService.useStore(playerStore(id)).pipe(
      map(player => tinycolor(player?.color).setAlpha(.4).darken(15) ?? 'black')
    );
  }

  ngOnInit() {
    this.turnNumber$ = this._nanoService.useStore(turnNumberStore);
    this.roundNumber$ = this._nanoService.useStore(roundNumberStore);
    this.currentPlayerTurnId$ = this._nanoService.useStore(currentPlayerTurnIdStore)
  }
}
