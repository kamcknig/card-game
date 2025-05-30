import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Inject, Input, ViewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NanostoresService } from '@nanostores/angular';
import { logStore } from '../../../../state/log-state';
import { finalize, fromEvent, merge, switchMap, takeUntil, throttleTime } from 'rxjs';
import { LogEntryMessage } from '../../../../../types';
import { DOCUMENT } from '@angular/common';

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
    @Inject(DOCUMENT) private _document: Document
  ) {
  }

  ngAfterViewInit() {
    this._nanoService.useStore(logStore).subscribe(_ => {
      setTimeout(() => this.logContent.nativeElement.scrollTop = this.logContent.nativeElement.scrollHeight, 10);
    });

    let startDragX: number;
    let startWidth: number;
    fromEvent<MouseEvent>(this.resizeHandle.nativeElement, 'mousedown')
      .pipe(
        switchMap((event) => {
          this._document.body.style.userSelect = 'none';
          startDragX = event.clientX;
          startWidth = this.logContent.nativeElement.clientWidth;

          return fromEvent<MouseEvent>(window, 'mousemove').pipe(
            takeUntil(merge(
              fromEvent<MouseEvent>(window, 'mouseup')
            )),
            throttleTime(50),
            finalize(() => {
              this._document.body.style.userSelect = '';
            })
          );
        }),
      )
      .subscribe((event) => {
        let diff = startDragX - event.clientX;

        let newWidth = 0;
        if (diff > 0) {
          newWidth = Math.min(800, startWidth + diff);
        }
        else {
          newWidth = Math.max(300, startWidth + diff);
        }

        (this.logContent.nativeElement as HTMLElement).style.width = `${newWidth}px`;
      });
  }

  public sanitize(msg: string) {
    return this._sanitizer.bypassSecurityTrustHtml(msg);
  }
}
