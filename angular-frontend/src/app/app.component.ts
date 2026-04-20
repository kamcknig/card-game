import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SocketService } from './core/socket-service/socket.service';
import { CardDetailDialogComponent } from './components/card-detail-dialog/card-detail-dialog.component';
import { PromptDialogHostComponent } from './components/prompt-dialog/prompt-dialog-host.component';
import { WayPickerOverlayComponent } from './components/way-picker-overlay/way-picker-overlay.component';
import { SceneNavigationService } from './core/navigation/scene-navigation.service';

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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly _socketService = inject(SocketService);
  // Injected to activate the sceneStore <-> Router bridge on app startup.
  private readonly _sceneNavigation = inject(SceneNavigationService);

  title = 'Dominion Clone';
}
