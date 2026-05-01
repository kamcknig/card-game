import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SoundService } from './sound.service';

describe('SoundService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('defaults to enabled when nothing is persisted', () => {
    expect(TestBed.inject(SoundService).enabled()).toBe(true);
  });

  it('restores a saved disabled state', () => {
    localStorage.setItem('dominion-sound', '0');
    expect(TestBed.inject(SoundService).enabled()).toBe(false);
  });

  it('restores a saved enabled state', () => {
    localStorage.setItem('dominion-sound', '1');
    expect(TestBed.inject(SoundService).enabled()).toBe(true);
  });

  it('ignores invalid stored values and defaults to enabled', () => {
    localStorage.setItem('dominion-sound', 'bogus');
    expect(TestBed.inject(SoundService).enabled()).toBe(true);
  });

  it('setEnabled updates the signal', () => {
    const service = TestBed.inject(SoundService);
    service.setEnabled(false);
    expect(service.enabled()).toBe(false);
  });

  it('toggle flips the current value', () => {
    const service = TestBed.inject(SoundService);
    expect(service.enabled()).toBe(true);
    service.toggle();
    expect(service.enabled()).toBe(false);
    service.toggle();
    expect(service.enabled()).toBe(true);
  });

  it('persists the chosen value to localStorage', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem');
    const service = TestBed.inject(SoundService);
    service.setEnabled(false);
    TestBed.flushEffects();
    expect(spy).toHaveBeenCalledWith('dominion-sound', '0');
  });

  it('play() returns null when disabled without constructing Audio', async () => {
    const service = TestBed.inject(SoundService);
    service.setEnabled(false);
    expect(await service.play('./assets/sounds/your-turn.mp3', 0.3)).toBeNull();
  });
});
