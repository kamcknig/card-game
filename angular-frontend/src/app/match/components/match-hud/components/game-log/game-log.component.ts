import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { LogEntryMessage } from 'shared/shared-types';
import { DomSanitizer } from '@angular/platform-browser';
import { NanostoresService } from '@nanostores/angular';
import { logStore } from '../../../../../state/log-state';

@Component({
  selector: 'app-game-log',
  imports: [],
  templateUrl: './game-log.component.html',
  styleUrl: './game-log.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameLogComponent implements AfterViewInit {
  @ViewChild('content', { read: ElementRef }) content!: ElementRef;

  @Input() entries!: readonly LogEntryMessage[] | null;

  constructor(
    private _sanitizer: DomSanitizer,
    private _nanoService: NanostoresService,
  ) {
  }

  ngAfterViewInit() {
    this._nanoService.useStore(logStore).subscribe(logEntry => {
      console.log(this.content.nativeElement.scrollTop);
      console.log(this.content.nativeElement.scrollHeight);
      setTimeout(() => this.content.nativeElement.scrollTop = this.content.nativeElement.scrollHeight, 0);
    });
  }

  public sanitize(msg: string) {
    return this._sanitizer.bypassSecurityTrustHtml(msg);
  }
}
