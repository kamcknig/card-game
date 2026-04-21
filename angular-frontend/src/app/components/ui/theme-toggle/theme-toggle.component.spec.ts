import { signal } from '@angular/core';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThemeService, ThemeMode } from '../../../core/theme.service';
import { ThemeToggleComponent } from './theme-toggle.component';

/**
 * Minimal ThemeService stub — exposes a writable mode signal and a setMode spy
 * so component tests remain isolated from ThemeService internals.
 */
class ThemeServiceStub {
  mode = signal<ThemeMode>('auto');
  setMode = jest.fn((m: ThemeMode) => this.mode.set(m));
}

describe('ThemeToggleComponent', () => {
  let component: ThemeToggleComponent;
  let fixture: ComponentFixture<ThemeToggleComponent>;
  let themeStub: ThemeServiceStub;

  beforeEach(async () => {
    themeStub = new ThemeServiceStub();

    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
      providers: [
        // App uses provideExperimentalZonelessChangeDetection; TestBed must match.
        provideExperimentalZonelessChangeDetection(),
        { provide: ThemeService, useValue: themeStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders three mode buttons — Light, Dark, and Auto', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.theme-opt');
    expect(buttons).toHaveLength(3);
    expect(buttons[0].textContent).toContain('Light');
    expect(buttons[1].textContent).toContain('Dark');
    expect(buttons[2].textContent).toContain('Auto');
  });

  it('applies is-active only to the button matching the current mode', () => {
    themeStub.mode.set('dark');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.theme-opt');
    expect(buttons[0].classList).not.toContain('is-active'); // Light
    expect(buttons[1].classList).toContain('is-active');     // Dark
    expect(buttons[2].classList).not.toContain('is-active'); // Auto
  });

  it('clicking a button calls theme.setMode with the correct value', () => {
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.theme-opt');
    buttons[0].click(); // Light
    expect(themeStub.setMode).toHaveBeenCalledWith('light');
  });

  it('each button passes its own mode value to setMode when clicked', () => {
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.theme-opt');
    const modes: ThemeMode[] = ['light', 'dark', 'auto'];
    modes.forEach((mode, i) => {
      buttons[i].click();
      expect(themeStub.setMode).toHaveBeenCalledWith(mode);
    });
  });
});
