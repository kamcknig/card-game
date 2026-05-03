import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SoundService } from '../../../core/sound.service';

/**
 * Settings pane routed at /settings (Settings tab in the profile shell).
 * Currently surfaces a Sound section with a master volume control (slider
 * + numeric text input) bound directly to SoundService.volume so changes
 * take effect immediately and persist to localStorage via the service.
 */
@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [],
  templateUrl: './profile-settings.component.html',
  styleUrl: './profile-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSettingsComponent {
  private readonly _soundService = inject(SoundService);

  // Live volume (0–100). The slider and number input both bind [value] to
  // this signal, so writes from either input propagate back to the other on
  // the next change-detection tick.
  readonly volume = this._soundService.volume;

  /**
   * Handle a slider or number-input change. Empty/non-finite values are
   * ignored so the slider doesn't snap to 0 while the user is mid-edit
   * (e.g. clearing the number input before typing a new value). Clamping
   * and rounding live in SoundService.setVolume.
   */
  onVolumeChanged(rawValue: string): void {
    const trimmed = rawValue.trim();
    if (trimmed === '') return;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    this._soundService.setVolume(parsed);
  }
}
