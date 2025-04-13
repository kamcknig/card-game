import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { currentPlayerTurnIdStore, turnNumberStore } from '../../../../../state/turn-state';
import { Observable } from 'rxjs';
import { AsyncPipe, NgClass, UpperCasePipe } from '@angular/common';
import { PlayerId } from 'shared/shared-types';

@Component({
  selector: 'app-score',
  imports: [
    AsyncPipe,
    UpperCasePipe,
    NgClass
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
  ngOnInit() {
    this.turnNumber$ = this._nanoService.useStore(turnNumberStore);
    this.currentPlayerTurnId$ = this._nanoService.useStore(currentPlayerTurnIdStore);

    this.currentPlayerTurnId$.subscribe((turnId: number) => {console.log(turnId)})
  }
}
