import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ServerStatusService, serverStatusStore } from '../core/server-status/server-status.service';
import { authTokenStore } from '../core/auth/auth.service';

// Polling interval for re-checking /status while the user is parked on the
// /server-status page. Short enough that a recovered server lets the user back
// in quickly, long enough to avoid hammering an unhealthy server.
const SERVER_STATUS_POLL_INTERVAL_MS = 10_000;

/**
 * Displays the current server health snapshot from serverStatusStore.
 * Shown when the server reports an error-level status or when the user
 * navigates directly to /server-status. Each issue is rendered with its
 * level, code, and message so the operator can diagnose startup failures.
 */
@Component({
  selector: 'app-server-status',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .server-status-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: var(--theme-font-body);
      background: #1a1a1a;
      color: #e0e0e0;
      padding: 2rem;
      box-sizing: border-box;
    }
    .server-status-page h1 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
      color: #ff6b6b;
    }
    .server-status-page .subtitle {
      margin: 0 0 2rem 0;
      color: #a0a0a0;
      font-size: 0.95rem;
    }
    .issue-list {
      list-style: none;
      margin: 0;
      padding: 0;
      width: 100%;
      max-width: 600px;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .issue-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border-radius: 6px;
      background: #2a2a2a;
    }
    .issue-item.level-error {
      border-left: 4px solid #ff6b6b;
    }
    .issue-item.level-warning {
      border-left: 4px solid #ffd93d;
    }
    .issue-level-chip {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 0.2rem 0.5rem;
      border-radius: 3px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .issue-level-chip.level-error {
      background: rgba(255, 107, 107, 0.13);
      color: #ff6b6b;
    }
    .issue-level-chip.level-warning {
      background: rgba(255, 217, 61, 0.13);
      color: #ffd93d;
    }
    .issue-code {
      font-family: var(--theme-font-mono);
      font-size: 0.85rem;
      color: #c0c0c0;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .issue-message {
      font-size: 0.9rem;
      line-height: 1.4;
    }
    .footer {
      margin: 2rem 0 0 0;
      color: #606060;
      font-size: 0.8rem;
    }
    .no-status {
      color: #a0a0a0;
    }
  `],
  template: `
    <div class="server-status-page">
      <h1>Server Unavailable</h1>
      <p class="subtitle">The server reported the following issues:</p>

      @let snapshot = status();
      @if (snapshot) {
        <ul class="issue-list">
          @for (issue of snapshot.issues; track issue.code) {
            <li class="issue-item" [class]="'level-' + issue.level">
              <span class="issue-level-chip" [class]="'level-' + issue.level">{{ issue.level }}</span>
              <span class="issue-code">{{ issue.code }}</span>
              <span class="issue-message">{{ issue.message }}</span>
            </li>
          }
        </ul>

        <p class="footer">
          Backend: {{ snapshot.backend }}
          @if (snapshot.startedAt) {
            &nbsp;&mdash;&nbsp;Started: {{ snapshot.startedAt | date:'medium' }}
          }
        </p>
      } @else {
        <p class="no-status">No status information available.</p>
      }
    </div>
  `,
})
export class ServerStatusComponent implements OnInit {
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _serverStatusService = inject(ServerStatusService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  // Reactive snapshot — updates if the store changes while the component is mounted.
  readonly status = toSignal(
    this._nanoStores.useStore(serverStatusStore),
    { initialValue: serverStatusStore.get() },
  );

  ngOnInit(): void {
    // Poll /status while the user is on this page so they are sent back to
    // the app as soon as the server recovers — without requiring a manual
    // refresh. The serverStatusRedirectGuard handles inbound navigation; this
    // interval covers users already parked here.
    const intervalId = setInterval(() => {
      void this.recheck();
    }, SERVER_STATUS_POLL_INTERVAL_MS);

    this._destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  // Re-fetches /status and, if the server is no longer in error, navigates to
  // the appropriate landing page (mirrors serverStatusRedirectGuard).
  private async recheck(): Promise<void> {
    await this._serverStatusService.fetchOnce();
    if (serverStatusStore.get()?.status !== 'error') {
      void this._router.navigate([authTokenStore.get() ? '/lobby' : '/login']);
    }
  }
}
