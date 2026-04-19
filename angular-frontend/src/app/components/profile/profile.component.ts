import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SceneContentComponent } from '../scene-content/scene-content.component';

/**
 * Profile scene — hosts the Security and Settings panes.
 * Rendered by AppComponent when sceneStore is 'profile'.
 * Full implementation added in Phase 4.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [SceneContentComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {}
