import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-scene-banner',
  standalone: true,
  templateUrl: './scene-banner.component.html',
  styleUrl: './scene-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneBannerComponent {
  // Optional secondary line shown under the main title.
  subtitle = input<string | null | undefined>(undefined);
}
