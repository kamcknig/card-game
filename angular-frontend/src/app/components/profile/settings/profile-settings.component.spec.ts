import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SoundService } from '../../../core/sound.service';
import { ProfileSettingsComponent } from './profile-settings.component';

/**
 * Stub SoundService — exposes the same `volume` signal-callable surface the
 * real service does, plus a Jest-spy `setVolume` so tests can assert the
 * exact value forwarded by the component without exercising clamp/round
 * (those are covered in sound.service.spec.ts).
 */
class SoundServiceStub {
  volume = signal<number>(80);
  setVolume = jest.fn((value: number) => this.volume.set(value));
}

describe('ProfileSettingsComponent', () => {
  let component: ProfileSettingsComponent;
  let fixture: ComponentFixture<ProfileSettingsComponent>;
  let soundStub: SoundServiceStub;

  beforeEach(async () => {
    soundStub = new SoundServiceStub();

    await TestBed.configureTestingModule({
      imports: [ProfileSettingsComponent],
      providers: [
        // App uses provideZonelessChangeDetection; TestBed must match.
        provideZonelessChangeDetection(),
        { provide: SoundService, useValue: soundStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes the SoundService volume signal directly', () => {
    expect(component.volume()).toBe(80);
    soundStub.volume.set(25);
    expect(component.volume()).toBe(25);
  });

  it('onVolumeChanged forwards a parsed numeric value to soundService.setVolume', () => {
    component.onVolumeChanged('33');
    expect(soundStub.setVolume).toHaveBeenCalledWith(33);
  });

  it('onVolumeChanged forwards decimals as parsed (clamping/rounding lives in the service)', () => {
    component.onVolumeChanged('33.7');
    expect(soundStub.setVolume).toHaveBeenCalledWith(33.7);
  });

  it('onVolumeChanged ignores empty input so transient typing does not snap the slider', () => {
    component.onVolumeChanged('');
    component.onVolumeChanged('   ');
    expect(soundStub.setVolume).not.toHaveBeenCalled();
  });

  it('onVolumeChanged ignores non-numeric input', () => {
    component.onVolumeChanged('abc');
    expect(soundStub.setVolume).not.toHaveBeenCalled();
  });

  it('renders both the slider and the number input bound to the volume value', () => {
    const slider: HTMLInputElement = fixture.nativeElement.querySelector('input[type="range"]');
    const number: HTMLInputElement = fixture.nativeElement.querySelector('input[type="number"]');
    expect(slider).not.toBeNull();
    expect(number).not.toBeNull();
    expect(slider.value).toBe('80');
    expect(number.value).toBe('80');
  });

  it('shows the muted note only when volume is 0', () => {
    expect(fixture.nativeElement.querySelector('.volume-muted-note')).toBeNull();
    soundStub.volume.set(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.volume-muted-note')?.textContent).toContain('Muted');
  });
});
