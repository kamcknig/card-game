import { Injectable } from '@angular/core';
import { atom } from 'nanostores';
import { environment } from '../../../environments/environment';

// A single runtime issue reported by the server health system.
export interface Issue {
  level: 'warning' | 'error';
  code: string;
  message: string;
}

// Point-in-time snapshot of server health returned by GET /status.
export interface ServerStatusSnapshot {
  status: 'healthy' | 'warning' | 'error';
  issues: Issue[];
  backend: string;
  startedAt: number;
}

// Module-level nanostore atom holding the last fetched server status snapshot.
// Undefined until fetchOnce() resolves for the first time.
export const serverStatusStore = atom<ServerStatusSnapshot | undefined>(undefined);

(globalThis as any).serverStatusStore = serverStatusStore;

/**
 * Fetches the server health snapshot from GET /status and populates
 * serverStatusStore. Used at bootstrap time to gate the app on server health.
 *
 * On a successful fetch, warning-level issues are logged via console.warn.
 * On a network error, a synthetic SERVER_UNREACHABLE error snapshot is set
 * so callers can treat unreachability the same as a reported error.
 */
@Injectable({ providedIn: 'root' })
export class ServerStatusService {
  /**
   * Fetches GET /status once and writes the result to serverStatusStore.
   * Resolves after the store is updated regardless of the outcome.
   * Network errors produce a synthetic error snapshot rather than throwing.
   */
  async fetchOnce(): Promise<void> {
    try {
      const res = await fetch(`${environment.wsHost}/status`);
      const data: ServerStatusSnapshot = await res.json();
      serverStatusStore.set(data);

      // Log each warning-level issue so developers see them in the console
      // without blocking the app.
      data.issues
        .filter(i => i.level === 'warning')
        .forEach(i => console.warn(`[server-status] ${i.code}: ${i.message}`));
    } catch {
      // Network failure or JSON parse error — treat server as unreachable.
      serverStatusStore.set({
        status: 'error',
        issues: [
          {
            level: 'error',
            code: 'SERVER_UNREACHABLE',
            message: 'Could not reach server.',
          },
        ],
        backend: 'unknown',
        startedAt: 0,
      });
    }
  }
}
