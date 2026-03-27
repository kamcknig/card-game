import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SceneBannerComponent } from '../scene-banner/scene-banner.component';

@Component({
  selector: 'app-scene-content',
  standalone: true,
  imports: [SceneBannerComponent],
  templateUrl: './scene-content.component.html',
  styleUrl: './scene-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneContentComponent {
  // Optional secondary line shown under the banner title.
  subtitle = input<string | null | undefined>(undefined);
}

