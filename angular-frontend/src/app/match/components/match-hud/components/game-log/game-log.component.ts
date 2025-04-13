import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { LogEntryMessage } from 'shared/shared-types';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-game-log',
  imports: [],
  templateUrl: './game-log.component.html',
  styleUrl: './game-log.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameLogComponent {
  @Input() entries!: readonly LogEntryMessage[] | null;

  constructor(private _sanitizer: DomSanitizer) {
  }

  public sanitize(msg: string) {
    return this._sanitizer.bypassSecurityTrustHtml(msg);
  }
}
