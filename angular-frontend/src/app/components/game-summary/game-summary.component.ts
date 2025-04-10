import { Component, Input } from '@angular/core';
import { MatchSummary } from 'shared/shared-types';

@Component({
  selector: 'app-game-summary',
  imports: [],
  templateUrl: './game-summary.component.html',
  styleUrl: './game-summary.component.scss'
})
export class GameSummaryComponent {
  @Input() matchSummary!: MatchSummary;
}
