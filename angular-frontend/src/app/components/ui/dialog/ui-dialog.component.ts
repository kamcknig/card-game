import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgClass, NgStyle } from '@angular/common';

export type UiDialogBackdropVariant = 'none' | 'soft' | 'strong';

@Component({
  selector: 'app-ui-dialog',
  imports: [NgClass, NgStyle],
  templateUrl: './ui-dialog.component.html',
  styleUrl: './ui-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiDialogComponent {
  // Controls whether clicking the backdrop dismisses the dialog.
  closeOnBackdrop = input(true);
  // Controls z-index stacking for dialog ordering.
  zIndex = input(3000);
  // Backdrop intensity variant used by dialog overlays.
  backdropVariant = input<UiDialogBackdropVariant>('soft');
  // Optional panel class for per-dialog layout customization.
  panelClass = input<string | undefined>(undefined);

  close = output<void>();

  // Handles backdrop clicks while preserving panel interactions.
  onBackdropClick() {
    if (!this.closeOnBackdrop()) {
      return;
    }
    this.close.emit();
  }
}
