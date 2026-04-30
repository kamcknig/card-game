import { Injectable, signal, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'dominion-theme';

/**
 * Owns app-wide theme state.
 * - `mode` is the user's choice: 'light' | 'dark'. Defaults to 'dark' when
 *   nothing is persisted.
 * - On every mode change, writes `data-theme` to <html> so the CSS variables
 *   in app-theme.scss take effect app-wide.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.loadInitial());

  constructor() {
    // Apply the active theme to <html data-theme="..."> whenever it changes.
    effect(() => {
      document.documentElement.setAttribute('data-theme', this.mode());
    });

    // Persist the user's chosen mode.
    effect(() => {
      try { localStorage.setItem(STORAGE_KEY, this.mode()); } catch {}
    });
  }

  /** Set the user's preferred theme mode. */
  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  /** Read the saved mode, falling back to 'dark' when nothing valid is stored. */
  private loadInitial(): ThemeMode {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  }
}
