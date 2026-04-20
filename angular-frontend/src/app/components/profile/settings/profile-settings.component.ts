import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Settings pane routed at /profile/settings — placeholder for user preferences. */
@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [],
  templateUrl: './profile-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSettingsComponent {}
