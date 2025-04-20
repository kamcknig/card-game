import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { LogEntryMessage } from 'shared/shared-types';
import { DomSanitizer } from '@angular/platform-browser';
import { NanostoresService } from '@nanostores/angular';
import { logStore } from '../../../../state/log-state';
import { fromEvent, switchMap, throttleTime } from 'rxjs';

@Component({
  selector: 'app-game-log',
  imports: [],
  templateUrl: './game-log.component.html',
  styleUrl: './game-log.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameLogComponent implements AfterViewInit {
  @ViewChild('logContent', { read: ElementRef }) logContent!: ElementRef;
  @ViewChild('resizeHandle') resizeHandle!: ElementRef;

  @Input() entries!: readonly LogEntryMessage[] | null;

  constructor(
    private _sanitizer: DomSanitizer,
    private _nanoService: NanostoresService,
  ) {
  }

  ngAfterViewInit() {
    this._nanoService.useStore(logStore).subscribe(_ => {
      setTimeout(() => this.logContent.nativeElement.scrollTop = this.logContent.nativeElement.scrollHeight, 10);
    });

    let startDragX: number;
    let startWidth: number;
    fromEvent<DragEvent>(this.resizeHandle.nativeElement, 'dragstart')
      .pipe(
        switchMap((event) => {
          startDragX = event.clientX;
          startWidth = this.logContent.nativeElement.clientWidth;

          console.log('startDragX', startDragX, 'startWidth', startWidth);

          return fromEvent<DragEvent>(this.resizeHandle.nativeElement, 'drag').pipe(throttleTime(50));
        }),
      )
      .subscribe((event) => {
        let diff = startDragX - event.clientX;

        let newWidth = 0;
        console.log(diff);
        if (diff > 0) {
          newWidth = Math.min(800, startWidth + diff);
        } else {
          newWidth = Math.max(300, startWidth + diff);
        }

        (this.logContent.nativeElement as HTMLElement).style.width = `${newWidth}px`;
      });
  }

  public sanitize(msg: string) {
    return this._sanitizer.bypassSecurityTrustHtml(msg);
  }
}
