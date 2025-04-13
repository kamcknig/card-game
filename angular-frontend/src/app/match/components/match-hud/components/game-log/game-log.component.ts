import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { LogEntryMessage } from 'shared/shared-types';

@Component({
  selector: 'app-game-log',
  imports: [],
  templateUrl: './game-log.component.html',
  styleUrl: './game-log.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameLogComponent {
  @Input() entries!: readonly LogEntryMessage[] | null;
}
