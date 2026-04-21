import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

/** Stub window.matchMedia — jsdom does not implement the MediaQueryList API. */
const mockMatchMedia = (matches: boolean) =>
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockReturnValue({
      matches,
      media: '(prefers-color-scheme: dark)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMatchMedia(false);
    TestBed.configureTestingModule({
      // App uses provideExperimentalZonelessChangeDetection; TestBed must match.
      providers: [provideExperimentalZonelessChangeDetection()],
    });
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('should be created', () => {
    expect(TestBed.inject(ThemeService)).toBeTruthy();
  });

  it('defaults to "auto" when localStorage has no stored value', () => {
    expect(TestBed.inject(ThemeService).mode()).toBe('auto');
  });

  it('restores a saved "light" mode from localStorage', () => {
    localStorage.setItem('dominion-theme', 'light');
    expect(TestBed.inject(ThemeService).mode()).toBe('light');
  });

  it('restores a saved "dark" mode from localStorage', () => {
    localStorage.setItem('dominion-theme', 'dark');
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
  });

  it('ignores an invalid stored value and defaults to "auto"', () => {
    localStorage.setItem('dominion-theme', 'bogus');
    expect(TestBed.inject(ThemeService).mode()).toBe('auto');
  });

  it('setMode updates the mode signal', () => {
    const service = TestBed.inject(ThemeService);
    service.setMode('dark');
    expect(service.mode()).toBe('dark');
  });

  it('resolved returns "light" when mode is explicitly "light"', () => {
    localStorage.setItem('dominion-theme', 'light');
    expect(TestBed.inject(ThemeService).resolved()).toBe('light');
  });

  it('resolved returns "dark" when mode is explicitly "dark"', () => {
    localStorage.setItem('dominion-theme', 'dark');
    expect(TestBed.inject(ThemeService).resolved()).toBe('dark');
  });

  it('resolved returns "dark" in auto mode when the OS prefers dark', () => {
    mockMatchMedia(true);
    expect(TestBed.inject(ThemeService).resolved()).toBe('dark');
  });

  it('resolved returns "light" in auto mode when the OS does not prefer dark', () => {
    mockMatchMedia(false);
    expect(TestBed.inject(ThemeService).resolved()).toBe('light');
  });

  it('setMode persists the chosen mode to localStorage', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem');
    const service = TestBed.inject(ThemeService);
    service.setMode('light');
    TestBed.flushEffects();
    expect(spy).toHaveBeenCalledWith('dominion-theme', 'light');
  });

  it('writes the resolved theme to data-theme on <html>', () => {
    localStorage.setItem('dominion-theme', 'dark');
    TestBed.inject(ThemeService);
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
