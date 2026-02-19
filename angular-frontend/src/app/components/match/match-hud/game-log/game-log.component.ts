import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NanostoresService } from '@nanostores/angular';
import { logStore } from '../../../../state/log-state';
import { finalize, fromEvent, merge, switchMap, takeUntil, throttleTime } from 'rxjs';
import { LogEntryMessage } from '../../../../../types';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type SanitizedLogEntry = LogEntryMessage & { safeMessage: SafeHtml; };

@Component({
  selector: 'app-game-log',
  imports: [],
  templateUrl: './game-log.component.html',
  styleUrl: './game-log.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameLogComponent implements AfterViewInit {
  private readonly _sanitizer = inject(DomSanitizer);
  private readonly _nanoService = inject(NanostoresService);
  private readonly _document = inject(DOCUMENT);
  private readonly _destroyRef = inject(DestroyRef);

  @ViewChild('logContent', { read: ElementRef }) logContent!: ElementRef;
  @ViewChild('resizeHandle') resizeHandle!: ElementRef;

  entries = input<readonly LogEntryMessage[] | null>(null);

  // Sanitized log entries ready for innerHTML binding.
  readonly sanitizedEntries = computed<readonly SanitizedLogEntry[]>(() => {
    const entries = this.entries() ?? [];
    return entries.map((entry) => ({
      ...entry,
      safeMessage: this._sanitizer.bypassSecurityTrustHtml(entry.message),
    }));
  });

  ngAfterViewInit() {
    this._nanoService.useStore(logStore)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
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
        takeUntilDestroyed(this._destroyRef),
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
}
