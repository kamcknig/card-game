import { Injectable, computed, signal, effect } from '@angular/core';

// Legacy boolean mute key, written by older builds where sound was a simple
// on/off toggle. Kept for one-shot migration into the unified `volume` model.
const LEGACY_ENABLED_STORAGE_KEY = 'dominion-sound';
const VOLUME_STORAGE_KEY = 'dominion-sound-volume';
// Tracks the volume to restore when the user un-mutes via the binary HUD
// toggle, so a refresh while muted doesn't lose the prior level.
const PRE_MUTE_VOLUME_STORAGE_KEY = 'dominion-sound-pre-mute-volume';
// Default user volume (0–100). 100 preserves the loudness of the hard-coded
// caller volumes (e.g. match-scene's 0.3 → 0.3 * 1.0) when no preference has
// been saved yet.
const DEFAULT_VOLUME = 100;

/**
 * Owns app-wide sound preference state.
 *
 * `volume` (0–100) is the single source of truth: `0` is the muted state,
 * any positive value plays. `enabled` is a derived boolean so older binary
 * UIs (the in-match HUD's mute toggle) and the new volume slider stay in
 * lockstep — toggling mute moves `volume` to/from `0` instead of being a
 * separate flag.
 *
 * - `play(src, volume)` resolves to a started <audio> element when the user
 *   master volume is non-zero and playback is permitted by the browser; it
 *   returns null otherwise. Errors are swallowed and logged at debug level
 *   so callers don't need to wrap each invocation in try/catch.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  // User master volume on a 0–100 integer scale. 0 is the muted state.
  readonly volume = signal<number>(this._loadInitialVolume());

  // Most recent positive volume; used to restore a sensible level when the
  // user un-mutes via toggle()/setEnabled(true). Persisted so refreshing
  // mid-mute keeps the prior level rather than snapping back to default.
  private readonly _preMuteVolume = signal<number>(this._loadInitialPreMuteVolume());

  // Derived "is sound on" — read by template/menu UIs that show a binary
  // mute switch. Backed by volume so the HUD toggle and the volume slider
  // share state.
  readonly enabled = computed(() => this.volume() > 0);

  // Holds strong refs to in-flight Audio objects. Without this, the only
  // reference disappears when the caller's `await soundService.play(...)`
  // resolves — which can let Chromium GC the Audio mid-playback so the user
  // hears nothing on the second-and-later invocation. Each entry is removed
  // when the audio finishes (or errors) so the set never grows unbounded.
  private readonly _activeAudios = new Set<HTMLAudioElement>();

  constructor() {
    // Persist the user's volume on every change.
    effect(() => {
      try { localStorage.setItem(VOLUME_STORAGE_KEY, String(this.volume())); } catch {}
    });
    // Persist the pre-mute restore level so refreshing while muted keeps it.
    effect(() => {
      try { localStorage.setItem(PRE_MUTE_VOLUME_STORAGE_KEY, String(this._preMuteVolume())); } catch {}
    });
  }

  /**
   * Force the binary "sound on/off" state. `true` un-mutes (restoring the
   * prior volume), `false` mutes (saving the current volume for restore).
   */
  setEnabled(enabled: boolean): void {
    if (enabled) {
      this._unmute();
    } else {
      this._mute();
    }
  }

  /** Flip the muted state, preserving prior volume across mute/unmute cycles. */
  toggle(): void {
    if (this.enabled()) {
      this._mute();
    } else {
      this._unmute();
    }
  }

  /**
   * Set the user's master volume preference. Non-finite inputs are ignored;
   * valid values are clamped to [0, 100] and rounded to an integer. Any
   * positive value is also captured as the future un-mute restore level so
   * a subsequent HUD mute toggle has a sensible value to come back to.
   */
  setVolume(value: number): void {
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    this.volume.set(clamped);
    if (clamped > 0) {
      this._preMuteVolume.set(clamped);
    }
  }

  /**
   * Plays the asset at `src` when the user master volume is non-zero. The
   * caller-supplied `volume` (0–1) is scaled by the user volume preference
   * (`volume() / 100`) before being applied to the underlying <audio>
   * element. A user volume of `0` short-circuits playback entirely (no
   * Audio is constructed). Swallows playback errors (autoplay restrictions,
   * missing asset) so callers stay focused on the action that triggered the
   * sound.
   */
  async play(src: string, volume: number): Promise<HTMLAudioElement | null> {
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

  /** Move volume to 0, remembering the current level for the next un-mute. */
  private _mute(): void {
    const current = this.volume();
    if (current > 0) {
      this._preMuteVolume.set(current);
    }
    this.volume.set(0);
  }

  /** Restore volume from the saved pre-mute level (or DEFAULT_VOLUME). */
  private _unmute(): void {
    const restore = this._preMuteVolume();
    this.volume.set(restore > 0 ? restore : DEFAULT_VOLUME);
  }

  /**
   * Read the saved volume. Falls back to DEFAULT_VOLUME when absent or
   * invalid; if no volume has ever been persisted but the legacy boolean
   * mute key is `'0'`, migrates that single previous mute state into a
   * volume of 0 so existing users don't lose their muted preference.
   */
  private _loadInitialVolume(): number {
    try {
      const savedVolume = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (savedVolume !== null) {
        const parsed = Number(savedVolume);
        if (Number.isFinite(parsed)) {
          return Math.max(0, Math.min(100, Math.round(parsed)));
        }
        return DEFAULT_VOLUME;
      }
      // Migration path: only consulted on the first load after upgrading
      // from the boolean-only model. Once a volume is saved, the legacy
      // key is ignored on subsequent loads.
      const legacyEnabled = localStorage.getItem(LEGACY_ENABLED_STORAGE_KEY);
      if (legacyEnabled === '0') return 0;
    } catch {}
    return DEFAULT_VOLUME;
  }

  /**
   * Read the saved pre-mute restore level; clamped to [1, 100] (a stored
   * 0 would defeat the purpose of "restore to a hearable level"). Falls
   * back to DEFAULT_VOLUME when absent or invalid.
   */
  private _loadInitialPreMuteVolume(): number {
    try {
      const saved = localStorage.getItem(PRE_MUTE_VOLUME_STORAGE_KEY);
      if (saved === null) return DEFAULT_VOLUME;
      const parsed = Number(saved);
      if (!Number.isFinite(parsed)) return DEFAULT_VOLUME;
      return Math.max(1, Math.min(100, Math.round(parsed)));
    } catch {}
    return DEFAULT_VOLUME;
  }
}
