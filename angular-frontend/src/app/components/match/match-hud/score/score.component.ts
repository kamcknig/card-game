import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { currentPlayerTurnIdStore } from '../../../../state/turn-state';
import { NgClass } from '@angular/common';
import { playerIdStore, playerStore } from '../../../../state/player-state';
import tinycolor from 'tinycolor2';

@Component({
  selector: 'app-score',
  imports: [
    NgClass,
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

  // Precomputed score row styles and ordering aligned to player order.
  readonly orderedPlayerScores = computed(() => {
    const scores = this.playerScores() ?? [];
    const playerIds = this._playerIds();
    return playerIds
      .map((id) => {
        const score = scores.find((entry) => entry.id === id);
        if (!score) return undefined;
        const playerColor = tinycolor(playerStore(id).get()?.color ?? '#7f6746');
        // Soft glow halo around the active row's dot — the player's own
        // color at higher alpha so the layered box-shadow reads as a
        // prominent lit halo rather than a faint tint.
        const accentGlow = playerColor.clone().setAlpha(.75).toRgbString();
        // The score-row dot uses brightness to signal active turn ownership.
        const accentDotInactive = playerColor.clone().darken(24).setAlpha(.55).toRgbString();
        const accentDotActive = playerColor.clone().brighten(16).setAlpha(.95).toRgbString();
        return {
          ...score,
          accentGlow,
          accentDotInactive,
          accentDotActive,
        };
      })
      .filter((row): row is {
        id: number;
        score: number;
        name: string;
        accentGlow: string;
        accentDotInactive: string;
        accentDotActive: string;
      } => row !== undefined);
  });
}
