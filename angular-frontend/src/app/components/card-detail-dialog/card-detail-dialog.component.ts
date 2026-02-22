import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { cardDetailDialogStore, closeCardDetailDialog } from '../../state/card-detail-dialog-state';
import { UiDialogComponent } from '../ui/dialog/ui-dialog.component';

@Component({
  selector: 'app-card-detail-dialog',
  imports: [UiDialogComponent],
  templateUrl: './card-detail-dialog.component.html',
  styleUrl: './card-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetailDialogComponent {
  private readonly _nanoService = inject(NanostoresService);
  private readonly _dialogState = toSignal(this._nanoService.useStore(cardDetailDialogStore), {
    initialValue: cardDetailDialogStore.get(),
  });

  // Current detail image paths for the global card detail dialog.
  readonly detailImagePaths = computed(() => this._dialogState().detailImagePaths);
  readonly isOpen = computed(() => this.detailImagePaths().length > 0);

  // Closes the global detail dialog.
  closeDetailDialog() {
    closeCardDetailDialog();
  }
}
