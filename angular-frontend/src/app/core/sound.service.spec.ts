import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SoundService } from './sound.service';

const VOLUME_KEY = 'dominion-sound-volume';
const PRE_MUTE_KEY = 'dominion-sound-pre-mute-volume';
const LEGACY_ENABLED_KEY = 'dominion-sound';

describe('SoundService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  describe('initial state', () => {
    it('defaults to volume 100 and enabled when nothing is persisted', () => {
      const service = TestBed.inject(SoundService);
      expect(service.volume()).toBe(100);
      expect(service.enabled()).toBe(true);
    });

    it('restores a saved volume', () => {
      localStorage.setItem(VOLUME_KEY, '42');
      expect(TestBed.inject(SoundService).volume()).toBe(42);
    });

    it('restores a saved volume of 0 (muted) and reports disabled', () => {
      localStorage.setItem(VOLUME_KEY, '0');
      const service = TestBed.inject(SoundService);
      expect(service.volume()).toBe(0);
      expect(service.enabled()).toBe(false);
    });

    it('clamps a saved out-of-range volume to [0, 100]', () => {
      localStorage.setItem(VOLUME_KEY, '250');
      expect(TestBed.inject(SoundService).volume()).toBe(100);
    });

    it('rounds a saved decimal volume to an integer', () => {
      localStorage.setItem(VOLUME_KEY, '33.7');
      expect(TestBed.inject(SoundService).volume()).toBe(34);
    });

    it('falls back to default volume when the saved value is unparseable', () => {
      localStorage.setItem(VOLUME_KEY, 'bogus');
      expect(TestBed.inject(SoundService).volume()).toBe(100);
    });
  });

  describe('legacy migration', () => {
    it('migrates legacy enabled="0" into volume=0 when no volume is saved', () => {
      localStorage.setItem(LEGACY_ENABLED_KEY, '0');
      const service = TestBed.inject(SoundService);
      expect(service.volume()).toBe(0);
      expect(service.enabled()).toBe(false);
    });

    it('ignores the legacy key when a volume is already saved', () => {
      localStorage.setItem(LEGACY_ENABLED_KEY, '0');
      localStorage.setItem(VOLUME_KEY, '33');
      const service = TestBed.inject(SoundService);
      expect(service.volume()).toBe(33);
      expect(service.enabled()).toBe(true);
    });

    it('treats legacy enabled="1" as no-op (default volume)', () => {
      localStorage.setItem(LEGACY_ENABLED_KEY, '1');
      expect(TestBed.inject(SoundService).volume()).toBe(100);
    });
  });

  describe('setVolume', () => {
    it('clamps values above 100', () => {
      const service = TestBed.inject(SoundService);
      service.setVolume(250);
      expect(service.volume()).toBe(100);
    });

    it('clamps negative values to 0', () => {
      const service = TestBed.inject(SoundService);
      service.setVolume(-25);
      expect(service.volume()).toBe(0);
    });

    it('rounds decimals to the nearest integer', () => {
      const service = TestBed.inject(SoundService);
      service.setVolume(33.6);
      expect(service.volume()).toBe(34);
    });

    it('ignores non-finite values', () => {
      const service = TestBed.inject(SoundService);
      service.setVolume(50);
      service.setVolume(NaN);
      service.setVolume(Infinity);
      expect(service.volume()).toBe(50);
    });

    it('captures positive values as the future un-mute restore level', () => {
      const service = TestBed.inject(SoundService);
      service.setVolume(33);
      service.toggle();
      expect(service.volume()).toBe(0);
      service.toggle();
      expect(service.volume()).toBe(33);
    });

    it('a setVolume(0) does not overwrite the prior pre-mute restore level', () => {
      const service = TestBed.inject(SoundService);
      service.setVolume(60);
      service.setVolume(0);
      service.toggle();
      expect(service.volume()).toBe(60);
    });
  });

  describe('toggle / setEnabled (mute model)', () => {
    it('toggle mutes when currently audible (volume → 0)', () => {
      const service = TestBed.inject(SoundService);
      service.setVolume(80);
      service.toggle();
      expect(service.volume()).toBe(0);
      expect(service.enabled()).toBe(false);
    });

    it('toggle un-mutes by restoring the pre-mute level', () => {
      const service = TestBed.inject(SoundService);
      service.setVolume(45);
      service.toggle();
      service.toggle();
      expect(service.volume()).toBe(45);
      expect(service.enabled()).toBe(true);
    });

    it('toggle un-mutes to DEFAULT_VOLUME when no pre-mute level exists', () => {
      localStorage.setItem(VOLUME_KEY, '0');
      const service = TestBed.inject(SoundService);
      expect(service.volume()).toBe(0);
      service.toggle();
      expect(service.volume()).toBe(100);
    });

    it('setEnabled(false) mutes', () => {
      const service = TestBed.inject(SoundService);
      service.setEnabled(false);
      expect(service.volume()).toBe(0);
      expect(service.enabled()).toBe(false);
    });

    it('setEnabled(true) when already audible is a no-op', () => {
      const service = TestBed.inject(SoundService);
      service.setVolume(70);
      service.setEnabled(true);
      expect(service.volume()).toBe(70);
    });
  });

  describe('persistence', () => {
    it('persists the chosen volume to localStorage', () => {
      const spy = jest.spyOn(Storage.prototype, 'setItem');
      const service = TestBed.inject(SoundService);
      service.setVolume(33);
      TestBed.flushEffects();
      expect(spy).toHaveBeenCalledWith(VOLUME_KEY, '33');
    });

    it('persists the pre-mute restore level so a refresh keeps it', () => {
      const spy = jest.spyOn(Storage.prototype, 'setItem');
      const service = TestBed.inject(SoundService);
      service.setVolume(60);
      service.toggle();
      TestBed.flushEffects();
      expect(spy).toHaveBeenCalledWith(PRE_MUTE_KEY, '60');
    });
  });

  describe('play()', () => {
    it('returns null at volume 0 without constructing an Audio element', async () => {
      const audioSpy = jest.spyOn(window, 'Audio' as never);
      const service = TestBed.inject(SoundService);
      service.setVolume(0);
      const result = await service.play('./assets/sounds/your-turn.mp3', 0.3);
      expect(result).toBeNull();
      expect(audioSpy).not.toHaveBeenCalled();
    });
  });
});
