import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NanostoresService } from '@nanostores/angular';
import { logStore } from '../../../../state/log-state';
import { LogEntryMessage } from '../../../../../types';
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
  private readonly _destroyRef = inject(DestroyRef);

  @ViewChild('logContent', { read: ElementRef }) logContent!: ElementRef;

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
    // Auto-scroll to bottom when new log entries arrive.
    this._nanoService.useStore(logStore)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        setTimeout(() => this.logContent.nativeElement.scrollTop = this.logContent.nativeElement.scrollHeight, 10);
      });
  }
}
