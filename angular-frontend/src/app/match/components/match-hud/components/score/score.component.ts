import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { currentPlayerTurnIdStore, turnNumberStore } from '../../../../../state/turn-state';
import { map, Observable } from 'rxjs';
import { AsyncPipe, NgClass, UpperCasePipe } from '@angular/common';
import { PlayerId } from 'shared/shared-types';
import { playerStore } from '../../../../../state/player-state';
import tinycolor from 'tinycolor2'

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
  currentPlayerTurnId$: Observable<PlayerId> | undefined;

  constructor(private _nanoService: NanostoresService) {

  }

  getPlayerColor(id: PlayerId) {
    return this._nanoService.useStore(playerStore(id)).pipe(
      map(player => tinycolor(player?.color).brighten(3) ?? 'black')
    );
  }

  getBackgroundColor(id: PlayerId) {
    return this._nanoService.useStore(playerStore(id)).pipe(
      map(player => tinycolor(player?.color).setAlpha(.2) ?? 'black')
    );
  }

  ngOnInit() {
    this.turnNumber$ = this._nanoService.useStore(turnNumberStore);
    this.currentPlayerTurnId$ = this._nanoService.useStore(currentPlayerTurnIdStore)
  }
}
