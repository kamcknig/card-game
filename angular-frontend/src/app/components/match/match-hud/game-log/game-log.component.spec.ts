import { provideExperimentalZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameLogComponent } from './game-log.component';
import { ThemeService } from '../../../../core/theme.service';
import { SoundService } from '../../../../core/sound.service';

class ThemeServiceStub {
  mode = signal<'light' | 'dark'>('dark');
  setMode = jest.fn((m: 'light' | 'dark') => this.mode.set(m));
}

class SoundServiceStub {
  enabled = signal(true);
  toggle = jest.fn(() => this.enabled.set(!this.enabled()));
  setEnabled = jest.fn((v: boolean) => this.enabled.set(v));
}

describe('GameLogComponent', () => {
  let component: GameLogComponent;
  let fixture: ComponentFixture<GameLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameLogComponent],
      providers: [
        provideExperimentalZonelessChangeDetection(),
        { provide: ThemeService, useClass: ThemeServiceStub },
        { provide: SoundService, useClass: SoundServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the GAME LOG header label', () => {
    expect(fixture.nativeElement.querySelector('.log-title').textContent).toContain('GAME LOG');
  });

  it('settings panel is closed by default', () => {
    expect(fixture.nativeElement.querySelector('.settings-panel')).toBeNull();
  });

  it('clicking the gear opens the settings panel', () => {
    fixture.nativeElement.querySelector('.settings-trigger').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.settings-panel')).not.toBeNull();
  });

  it('clicking the resign row emits resignRequested and closes the panel', () => {
    const handler = jest.fn();
    component.resignRequested.subscribe(handler);

    fixture.nativeElement.querySelector('.settings-trigger').click();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.settings-row.is-danger').click();
    fixture.detectChanges();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(component.settingsOpen()).toBe(false);
  });
});
