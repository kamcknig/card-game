import { Injectable, signal, effect } from '@angular/core';

const STORAGE_KEY = 'dominion-sound';
const VOLUME_STORAGE_KEY = 'dominion-sound-volume';
// Default user volume (0–100). 100 preserves the loudness of the hard-coded
// caller volumes (e.g. match-scene's 0.3 → 0.3 * 1.0) when no preference has
// been saved yet.
const DEFAULT_VOLUME = 100;

/**
 * Owns app-wide sound preference state.
 * - `enabled` is the user's choice; defaults to `true` when nothing is
 *   persisted.
 * - `volume` is the user's master output level on a 0–100 scale; `0` means
 *   muted (playback is skipped entirely rather than emitting silence).
 *   Persisted to localStorage and used to scale every `play()` call.
 * - `play(src, volume)` resolves to a started <audio> element when sound
 *   is enabled and playback is permitted by the browser; returns null
 *   otherwise. Errors are swallowed and logged at debug level so callers
 *   don't need to wrap each invocation in try/catch.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  readonly enabled = signal<boolean>(this._loadInitial());
  // User master volume on a 0–100 integer scale. 0 is treated as muted.
  readonly volume = signal<number>(this._loadInitialVolume());

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
    // Persist the user's volume on every change.
    effect(() => {
      try { localStorage.setItem(VOLUME_STORAGE_KEY, String(this.volume())); } catch {}
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
   * Set the user's master volume preference. Non-finite inputs are ignored;
   * valid values are clamped to [0, 100] and rounded to an integer.
   */
  setVolume(value: number): void {
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    this.volume.set(clamped);
  }

  /**
   * Plays the asset at `src` when sound is enabled and the user master
   * volume is non-zero. The caller-supplied `volume` (0–1) is scaled by the
   * user volume preference (`volume() / 100`) before being applied to the
   * underlying <audio> element. A user volume of `0` short-circuits playback
   * entirely (no Audio is constructed). Swallows playback errors (autoplay
   * restrictions, missing asset) so callers stay focused on the action that
   * triggered the sound.
   */
  async play(src: string, volume: number): Promise<HTMLAudioElement | null> {
    if (!this.enabled()) return null;
    if (this.volume() === 0) return null;
    const audio = new Audio(src);
    const settingsScale = this.volume() / 100;
    audio.volume = Math.max(0, Math.min(1, volume * settingsScale));
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

  /**
   * Read the saved volume; falls back to DEFAULT_VOLUME when absent, invalid,
   * or out of range. The persisted value is integer 0–100.
   */
  private _loadInitialVolume(): number {
    try {
      const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (saved === null) return DEFAULT_VOLUME;
      const parsed = Number(saved);
      if (!Number.isFinite(parsed)) return DEFAULT_VOLUME;
      return Math.max(0, Math.min(100, Math.round(parsed)));
    } catch {}
    return DEFAULT_VOLUME;
  }
}
