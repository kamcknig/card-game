import { Component, signal } from '@angular/core';
import { Player } from 'shared/shared-types';

@Component({
  selector: 'app-match-configuration',
  imports: [],
  templateUrl: './match-configuration.component.html',
  styleUrl: './match-configuration.component.scss'
})
export class MatchConfigurationComponent {
  players = [{name: 'Player 1', id: 1}, {name: 'Player 2', id: 2}, {name: 'Player 3', id: 3}];
  playerList = signal<Player[]>(this.players as Player[]);

  expansions = [{name: 'base-v2', title: 'Base'}, { name: 'intrigue', title: 'Intrigue'}];
  expansionList = signal(this.expansions);
}
