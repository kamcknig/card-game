import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { currentPlayerTurnIdStore } from '../../../../state/turn-state';
import { NgClass, NgOptimizedImage } from '@angular/common';
import { PlayerId, TokenInstance } from 'shared/types';
import { playerIdStore, playerStore } from '../../../../state/player-state';
import tinycolor from 'tinycolor2';
import { matchStore } from '../../../../state/match-state';

@Component({
  selector: 'app-score',
  imports: [
    NgClass,
    NgOptimizedImage,
  ],
  templateUrl: './score.component.html',
  styleUrl: './score.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScoreComponent {
  private readonly _nanoService = inject(NanostoresService);

  playerScores = input<{ id: number; score: number; name: string }[] | null>(null);

  private readonly _playerIds = toSignal(this._nanoService.useStore(playerIdStore), {
    initialValue: playerIdStore.get()
  });
  readonly currentPlayerTurnId = toSignal(this._nanoService.useStore(currentPlayerTurnIdStore));
  private readonly _match = toSignal(this._nanoService.useStore(matchStore), {
    initialValue: matchStore.get() ?? null
  });

  // Victory token counts keyed by player.
  readonly victoryTokens = computed<Partial<Record<PlayerId, number>>>(() => {
    const match = this._match();
    const victoryTokenId = 'prosperity:victory';
    const counts: Partial<Record<PlayerId, number>> = {};
    const tokens = Object.values(match?.tokens ?? {}) as TokenInstance[];
    for (const token of tokens) {
      if (token.tokenId !== victoryTokenId) continue;
      if (token.location.type !== 'player') continue;
      const tokenCount = token.counters ?? 1;
      counts[token.location.playerId] = (counts[token.location.playerId] ?? 0) + tokenCount;
    }
    return counts;
  });

  // Precomputed score row styles and ordering aligned to player order.
  readonly orderedPlayerScores = computed(() => {
    const scores = this.playerScores() ?? [];
    const playerIds = this._playerIds();
    return playerIds
      .map((id) => {
        const score = scores.find((entry) => entry.id === id);
        if (!score) return undefined;
        const playerColor = tinycolor(playerStore(id).get()?.color ?? '#000000');
        return {
          ...score,
          borderColor: playerColor.clone().lighten(15).toRgbString(),
          backgroundColor: playerColor.clone().setAlpha(.4).darken(15).toRgbString(),
        };
      })
      .filter((row): row is {
        id: number;
        score: number;
        name: string;
        borderColor: string;
        backgroundColor: string;
      } => row !== undefined);
  });
}
