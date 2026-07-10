import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UiDialogComponent, UiDialogLayer, UiDialogSkin } from '../dialog/ui-dialog.component';

/**
 * Standard confirmation dialog: heading + optional message + Cancel/Confirm
 * footer, built on top of the shared `UiDialogComponent` shell.
 *
 * Dismissal (Escape/backdrop/close-X) always triggers `cancelled` — the same
 * handler as clicking the Cancel button — so callers never observe a
 * dismissal that skipped their cancel logic. Set `dismissable=false` for
 * dialogs that require an explicit choice; a dialog with no `cancelLabel`
 * is also never implicitly dismissable, regardless of the `dismissable`
 * input, since there would be no visible equivalent action to trigger.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [UiDialogComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  // Header heading text.
  heading = input.required<string>();
  // Optional message body rendered above any projected content.
  message = input<string | undefined>(undefined);
  // Confirm button label.
  confirmLabel = input('CONFIRM');
  // Cancel button label; omit to render without a Cancel button.
  cancelLabel = input<string | undefined>('CANCEL');
  // Styles the confirm button as a destructive action (.btn-danger).
  danger = input(false);
  // Visual skin passed through to the shell.
  skin = input<UiDialogSkin>('light');
  // Named z-index layer passed through to the shell.
  layer = input<UiDialogLayer>('base');
  // Gates Escape/backdrop/close-X dismissal; combined internally with the
  // presence of a Cancel button so a confirm-only dialog can never be
  // implicitly dismissed.
  dismissable = input(true);

  // Emitted when the Confirm button is clicked.
  confirmed = output<void>();
  // Emitted when the Cancel button is clicked, or the dialog is dismissed
  // via Escape/backdrop/close-X.
  cancelled = output<void>();
}
