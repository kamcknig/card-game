import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { boardSelectionOverlayActionStore, boardSelectionOverlayStore } from '../../../state/board-selection-overlay-state';

@Component({
  selector: 'app-board-selection-action',
  templateUrl: './board-selection-action.component.html',
  styleUrl: './board-selection-action.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardSelectionActionComponent {
  private readonly _nanoStores = inject(NanostoresService);
  private _nonce = 0;

  readonly state = toSignal(this._nanoStores.useStore(boardSelectionOverlayStore), {
    initialValue: boardSelectionOverlayStore.get(),
  });

  onSubmit(): void {
    if (!this.state().visible || !this.state().submitEnabled) {
      return;
    }
    boardSelectionOverlayActionStore.set({
      action: 'submit',
      nonce: ++this._nonce,
    });
  }

  onCancel(): void {
    if (!this.state().visible || !this.state().optional) {
      return;
    }
    boardSelectionOverlayActionStore.set({
      action: 'cancel',
      nonce: ++this._nonce,
    });
  }
}
