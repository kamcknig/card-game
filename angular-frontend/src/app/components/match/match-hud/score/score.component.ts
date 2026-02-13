import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { currentPlayerTurnIdStore } from '../../../../state/turn-state';
import { map, Observable } from 'rxjs';
import { AsyncPipe, NgClass, NgOptimizedImage } from '@angular/common';
import { PlayerId, TokenInstance } from 'shared/types/index.ts';
import { playerIdStore, playerStore } from '../../../../state/player-state';
import tinycolor from 'tinycolor2'
import { matchStore } from '../../../../state/match-state';

@Component({
  selector: 'app-score',
  imports: [
    AsyncPipe,
    NgClass,
    NgOptimizedImage,
  ],
  templateUrl: './score.component.html',
  styleUrl: './score.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScoreComponent implements OnInit {
  @Input() playerScores!: { id: number; score: number; name: string }[] | null;

  currentPlayerTurnId$: Observable<PlayerId> | undefined;
  victoryTokens$: Observable<Record<PlayerId, number>> | undefined;

  constructor(private _nanoService: NanostoresService) {
    this.victoryTokens$ = this._nanoService.useStore(matchStore).pipe(
      map(match => {
        // Victory tokens are stored as token instances on the player.
        const victoryTokenId = 'prosperity:victory';
        const counts: Record<PlayerId, number> = {};
        const tokens = Object.values(match?.tokens ?? {}) as TokenInstance[];
        for (const token of tokens) {
          if (token.tokenId !== victoryTokenId) continue;
          if (token.location.type !== 'player') continue;
          const tokenCount = token.counters ?? 1;
          counts[token.location.playerId] = (counts[token.location.playerId] ?? 0) + tokenCount;
        }
        return counts;
      })
    )
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
    this.currentPlayerTurnId$ = this._nanoService.useStore(currentPlayerTurnIdStore)
  }
}
