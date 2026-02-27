import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { pileSelectionOverlayActionStore, pileSelectionOverlayStore } from '../../../state/pile-selection-overlay-state';

@Component({
  selector: 'app-pile-selection-action-overlay',
  templateUrl: './pile-selection-action-overlay.component.html',
  styleUrl: './pile-selection-action-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PileSelectionActionOverlayComponent {
  private readonly _nanoStores = inject(NanostoresService);
  private _nonce = 0;

  readonly state = toSignal(this._nanoStores.useStore(pileSelectionOverlayStore), {
    initialValue: pileSelectionOverlayStore.get(),
  });

  onSubmit(): void {
    if (!this.state().visible || !this.state().submitEnabled) {
      return;
    }
    pileSelectionOverlayActionStore.set({
      action: 'submit',
      nonce: ++this._nonce,
    });
  }

  onCancel(): void {
    if (!this.state().visible || !this.state().optional) {
      return;
    }
    pileSelectionOverlayActionStore.set({
      action: 'cancel',
      nonce: ++this._nonce,
    });
  }
}
