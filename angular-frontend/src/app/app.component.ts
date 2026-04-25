import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CardDetailDialogComponent } from './components/card-detail-dialog/card-detail-dialog.component';
import { PromptDialogHostComponent } from './components/prompt-dialog/prompt-dialog-host.component';
import { WayPickerOverlayComponent } from './components/way-picker-overlay/way-picker-overlay.component';
import { ThemeService } from './core/theme.service';
import { SocketService } from './core/socket-service/socket.service';
import { authTokenStore } from './core/auth/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';

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
  private readonly _socketService = inject(SocketService);
  private readonly _nanoStores = inject(NanostoresService);

  private readonly _authToken = toSignal(this._nanoStores.useStore(authTokenStore), {
    initialValue: authTokenStore.get(),
  });

  // Show the reconnecting banner only when authenticated, the socket has previously been
  // connected, and is now down. Avoids a false positive on initial load before the socket
  // has had a chance to connect for the first time.
  readonly showReconnecting = computed(
    () => !!this._authToken() && this._socketService.hasEverConnected() && !this._socketService.connected(),
  );
}
