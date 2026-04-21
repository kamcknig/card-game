import { Injectable, signal, computed, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'dominion-theme';

/**
 * Owns app-wide theme state.
 * - `mode` is the user's choice: 'light' | 'dark' | 'auto'.
 * - `resolved` is what's actually applied ('light' or 'dark'), which
 *   follows the OS preference when mode is 'auto'.
 * - On every resolved change, writes `data-theme` to <html> so the CSS
 *   variables in app-theme.scss take effect app-wide.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.loadInitial());

  private readonly osPrefersDark = signal<boolean>(
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  readonly resolved = computed<ResolvedTheme>(() => {
    const m = this.mode();
    if (m === 'auto') return this.osPrefersDark() ? 'dark' : 'light';
    return m;
  });

  constructor() {
    // Apply the resolved theme to <html data-theme="..."> whenever it changes.
    effect(() => {
      document.documentElement.setAttribute('data-theme', this.resolved());
    });

    // Persist the user's chosen mode.
    effect(() => {
      try { localStorage.setItem(STORAGE_KEY, this.mode()); } catch {}
    });

    // React to OS preference flips while 'auto' is active.
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => this.osPrefersDark.set(e.matches);
      mq.addEventListener('change', handler);
    }
  }

  /** Set the user's preferred theme mode. */
  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private loadInitial(): ThemeMode {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
    } catch {}
    return 'auto';
  }
}
