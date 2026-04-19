import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideAngularModule, UserCircle } from 'lucide-angular';
import { AuthService, authUsernameStore } from '../../core/auth/auth.service';
import { SocketService } from '../../core/socket-service/socket.service';
import { sceneStore } from '../../state/game-state';
import { profileTabStore } from '../../state/profile-state';

/**
 * Profile icon button with dropdown menu.
 *
 * Rendered inside the scene banner header when the user is logged in.
 * The dropdown is anchored below the icon button via absolute positioning.
 * Clicking outside the host element closes the dropdown.
 */
@Component({
  selector: 'app-profile-menu',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './profile-menu.component.html',
  styleUrl: './profile-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileMenuComponent {
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _authService = inject(AuthService);
  private readonly _socketService = inject(SocketService);
  private readonly _elementRef = inject(ElementRef);

  // Lucide icon reference for the profile trigger button.
  readonly UserCircleIcon = UserCircle;

  // Reactive username — used by the parent banner to decide whether to render
  // this component at all, but also referenced internally if needed.
  readonly username = toSignal(this._nanoStores.useStore(authUsernameStore));

  // Controls dropdown visibility.
  readonly dropdownOpen = signal(false);

  /**
   * Closes the dropdown when the user clicks anywhere outside this component.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this._elementRef.nativeElement.contains(event.target)) {
      this.dropdownOpen.set(false);
    }
  }

  /**
   * Toggles the dropdown open/closed when the trigger button is clicked.
   * Stops propagation so the document:click listener does not immediately
   * close the dropdown after opening it.
   */
  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.dropdownOpen.update(open => !open);
  }

  /**
   * Navigates to the profile scene with the Security tab active.
   */
  openProfile(): void {
    this.dropdownOpen.set(false);
    profileTabStore.set('security');
    sceneStore.set('profile');
  }

  /**
   * Navigates to the profile scene with the Settings tab active.
   */
  openSettings(): void {
    this.dropdownOpen.set(false);
    profileTabStore.set('settings');
    sceneStore.set('profile');
  }

  /**
   * Logs out the current user: invalidates the server session, disconnects
   * the socket, clears local auth state, and returns to the login scene.
   */
  async logout(): Promise<void> {
    this.dropdownOpen.set(false);
    await this._authService.logout();
    this._socketService.disconnect();
    sceneStore.set('login');
  }
}
