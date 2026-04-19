import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { Eye, EyeOff, LucideAngularModule } from 'lucide-angular';

/**
 * Reusable pair of password inputs used whenever the user enters a new
 * password that must be confirmed — currently the Register form and the
 * Change Password dialog.
 *
 * Owns:
 *  - A primary password input with an optional show/hide toggle.
 *  - A confirm password input, disabled until the primary is non-empty.
 *  - An inline "Passwords do not match" error shown once the user has typed
 *    into confirm and the values disagree.
 *
 * Visuals are self-contained and built from the shared theme tokens
 * (--theme-border-action, --theme-surface-panel, ...) so the component
 * drops into any form on the dark tan theme without needing the host form
 * to pass styling down. The component's host is `display: contents` so its
 * two labels become direct children of the parent form's flex/grid layout
 * and inherit its `gap`.
 *
 * Parents retain ownership of the value signals via `model()` two-way
 * bindings so they can reset fields on dialog open/close, mode switch, or
 * after a successful submit. Parents gate their submit button by reading
 * {@link mismatch} through `viewChild` / `@ViewChild`.
 *
 * Defined in: src/app/components/ui/new-password-fields/new-password-fields.component.ts
 * Consumers: LoginComponent (register mode), LobbyComponent (change-password dialog).
 */
@Component({
  selector: 'app-new-password-fields',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './new-password-fields.component.html',
  styleUrl: './new-password-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewPasswordFieldsComponent {
  // Lucide icon references exposed to the template. Must be class fields
  // because Angular templates cannot reference module-level bindings.
  readonly EyeIcon = Eye;
  readonly EyeOffIcon = EyeOff;

  /** Visible label above the primary password input. */
  readonly primaryLabel = input<string>('Password');

  /** Visible label above the confirm password input. */
  readonly confirmLabel = input<string>('Confirm password');

  /** `autocomplete` attribute value for the primary input. */
  readonly primaryAutocomplete = input<string>('new-password');

  /** `autocomplete` attribute value for the confirm input. */
  readonly confirmAutocomplete = input<string>('new-password');

  /** Two-way bindable primary password value. */
  readonly primary = model<string>('');

  /** Two-way bindable confirm password value. */
  readonly confirm = model<string>('');

  /**
   * Controls whether the two inputs render as plain text. Local state —
   * parents don't need to observe or reset this since it resets naturally
   * when the component itself is re-created between dialog opens / mode
   * switches.
   */
  readonly showPassword = signal<boolean>(false);

  /**
   * True only when the user has typed something in the confirm field and it
   * does not match the primary. Gated on `confirm` being non-empty so the
   * error does not flash while the user types the first character. Parent
   * components read this through `viewChild` to gate submit.
   */
  readonly mismatch = computed(() =>
    this.confirm().length > 0 && this.primary() !== this.confirm()
  );

  /** Flips {@link showPassword}. Called by the show/hide toggle button. */
  toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }
}
