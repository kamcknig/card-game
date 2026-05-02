import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      // App uses provideZonelessChangeDetection; TestBed must match.
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('should be created', () => {
    expect(TestBed.inject(ThemeService)).toBeTruthy();
  });

  it('defaults to "dark" when localStorage has no stored value', () => {
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
  });

  it('restores a saved "light" mode from localStorage', () => {
    localStorage.setItem('dominion-theme', 'light');
    expect(TestBed.inject(ThemeService).mode()).toBe('light');
  });

  it('restores a saved "dark" mode from localStorage', () => {
    localStorage.setItem('dominion-theme', 'dark');
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
  });

  it('ignores an invalid stored value and defaults to "dark"', () => {
    localStorage.setItem('dominion-theme', 'bogus');
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
  });

  it('setMode updates the mode signal', () => {
    const service = TestBed.inject(ThemeService);
    service.setMode('light');
    expect(service.mode()).toBe('light');
  });

  it('setMode persists the chosen mode to localStorage', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem');
    const service = TestBed.inject(ThemeService);
    service.setMode('light');
    TestBed.flushEffects();
    expect(spy).toHaveBeenCalledWith('dominion-theme', 'light');
  });

  it('writes the active mode to data-theme on <html>', () => {
    localStorage.setItem('dominion-theme', 'light');
    TestBed.inject(ThemeService);
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('writes "dark" to data-theme on <html> when defaulting', () => {
    TestBed.inject(ThemeService);
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
