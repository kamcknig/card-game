import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CardDetailDialogComponent } from './components/card-detail-dialog/card-detail-dialog.component';
import { PromptDialogHostComponent } from './components/prompt-dialog/prompt-dialog-host.component';
import { WayPickerOverlayComponent } from './components/way-picker-overlay/way-picker-overlay.component';
import { ThemeService } from './core/theme.service';

/** Root shell component. Renders the active route and app-wide overlays. */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    CardDetailDialogComponent,
    PromptDialogHostComponent,
    WayPickerOverlayComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  title = 'Dominion Clone';

  // Eagerly instantiate ThemeService so its data-theme effect runs on every
  // route, including /match which has no SceneBannerComponent to trigger it.
  private readonly _theme = inject(ThemeService);
}
