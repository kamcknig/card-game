import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatchSummary, PlayerId } from 'shared/shared-types';
import { playerStore } from '../../state/player-state';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-game-summary',
  imports: [
    NgOptimizedImage
  ],
  templateUrl: './game-summary.component.html',
  styleUrl: './game-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameSummaryComponent {
  @Input() matchSummary!: MatchSummary;

  getPlayerName(playerId: PlayerId): string {
    console.log(playerStore(playerId).get()?.name);
    return playerStore(playerId).get()?.name!;
  }
}
