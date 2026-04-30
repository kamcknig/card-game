import { Injectable, signal, effect } from '@angular/core';

const STORAGE_KEY = 'dominion-sound';

/**
 * Owns app-wide sound preference state.
 * - `enabled` is the user's choice; defaults to `true` when nothing is
 *   persisted.
 * - `play(src, volume)` resolves to a started <audio> element when sound
 *   is enabled and playback is permitted by the browser; returns null
 *   otherwise. Errors are swallowed and logged at debug level so callers
 *   don't need to wrap each invocation in try/catch.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  readonly enabled = signal<boolean>(this._loadInitial());

  // Holds strong refs to in-flight Audio objects. Without this, the only
  // reference disappears when the caller's `await soundService.play(...)`
  // resolves — which can let Chromium GC the Audio mid-playback so the user
  // hears nothing on the second-and-later invocation. Each entry is removed
  // when the audio finishes (or errors) so the set never grows unbounded.
  private readonly _activeAudios = new Set<HTMLAudioElement>();

  constructor() {
    // Persist the user's choice on every change.
    effect(() => {
      try { localStorage.setItem(STORAGE_KEY, this.enabled() ? '1' : '0'); } catch {}
    });
  }

  /** Set the user's sound-enabled preference. */
  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
  }

  /** Toggle the current sound-enabled preference. */
  toggle(): void {
    this.enabled.set(!this.enabled());
  }

  /**
   * Plays the asset at `src` at the given `volume` (clamped 0–1) when sound
   * is enabled. Swallows playback errors (autoplay restrictions, missing
   * asset) so callers stay focused on the action that triggered the sound.
   */
  async play(src: string, volume: number): Promise<HTMLAudioElement | null> {
    if (!this.enabled()) return null;
    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, volume));
    this._activeAudios.add(audio);
    const release = () => this._activeAudios.delete(audio);
    audio.addEventListener('ended', release, { once: true });
    audio.addEventListener('error', release, { once: true });
    try {
      await audio.play();
      return audio;
    } catch (error) {
      release();
      console.debug('[sound-service] playback failed', src, error);
      return null;
    }
  }

  /** Read the saved preference; default to enabled when absent or invalid. */
  private _loadInitial(): boolean {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === '0') return false;
      if (saved === '1') return true;
    } catch {}
    return true;
  }
}
