import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideAngularModule, UserCircle } from 'lucide-angular';
import { AuthService, authUsernameStore } from '../../core/auth/auth.service';
import { SocketService } from '../../core/socket-service/socket.service';

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
  private readonly _router = inject(Router);
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

  /** Navigates to the Security tab of the profile route. */
  openProfile(): void {
    this.dropdownOpen.set(false);
    void this._router.navigate(['/profile/security']);
  }

  /** Navigates to the Settings tab of the profile route. */
  openSettings(): void {
    this.dropdownOpen.set(false);
    void this._router.navigate(['/profile/settings']);
  }

  /**
   * Logs out the current user: invalidates the server session, disconnects
   * the socket, clears local auth state, and returns to the login scene.
   */
  async logout(): Promise<void> {
    this.dropdownOpen.set(false);
    await this._authService.logout();
    this._socketService.disconnect();
    void this._router.navigate(['/login']);
  }
}
