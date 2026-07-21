import { ChangeDetectionStrategy, Component, HostListener, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import {
  CardDetailDialogEntry,
  cardDetailDialogStore,
  closeCardDetailDialog,
  promoteCardDetailSibling,
} from '../../state/card-detail-dialog-state';
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

  // Current dialog state (primary card, pile siblings, non-swappable extras).
  readonly state = computed(() => this._dialogState());
  readonly isOpen = computed(() => this.state().primary !== null);

  // Closes the global detail dialog.
  closeDetailDialog() {
    closeCardDetailDialog();
  }

  // Promotes a sibling image to the primary/large position. The previous
  // primary rejoins the sibling column in its place.
  onSiblingContextMenu(event: MouseEvent, entry: CardDetailDialogEntry): void {
    event.preventDefault();
    // Stop this from bubbling to the document-level contextmenu handler
    // that closes the dialog on any right-click.
    event.stopPropagation();
    promoteCardDetailSibling(entry);
  }

  // Closes the dialog on primary/secondary mouse clicks inside the detail panel.
  onPanelMouseDown(event: MouseEvent) {
    if (event.button !== 0 && event.button !== 2) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.closeDetailDialog();
  }

  // Prevents native context menu while still allowing right-click to close.
  onPanelContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent) {
    if (!this.isOpen() || event.button !== 2) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.closeDetailDialog();
  }

  @HostListener('document:contextmenu', ['$event'])
  onDocumentContextMenu(event: MouseEvent) {
    if (!this.isOpen()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  // Escape dismissal is provided by the shell (UiDialogComponent); no local
  // listener needed.
}
