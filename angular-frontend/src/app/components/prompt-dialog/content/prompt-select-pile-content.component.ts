import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { CardKey, UserPromptKinds } from 'shared/types';
import { validateCountSpec } from 'shared/validate-count-spec';
import { resolveMaxSelectable } from 'shared/resolve-count-spec';
import { selectedPileStore } from '../../../state/interactive-state';
import { createSelectionEmitter } from './selection-emitter';

type PromptSelectPileContent = Extract<UserPromptKinds, { type: 'select-pile' }>;

@Component({
  selector: 'app-prompt-select-pile-content',
  templateUrl: './prompt-select-pile-content.component.html',
  styleUrl: './prompt-select-pile-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptSelectPileContentComponent {
  private readonly _nanoService = inject(NanostoresService);

  content = input.required<PromptSelectPileContent>();

  validationUpdated = output<boolean>();
  resultsUpdated = output<CardKey[]>();

  private readonly _selectedPiles = toSignal(this._nanoService.useStore(selectedPileStore), {
    initialValue: selectedPileStore.get(),
  });

  // Shared dedup-and-emit machinery for results/validation; see
  // selection-emitter.ts.
  private readonly _selectionEmitter = createSelectionEmitter<CardKey[]>({
    resultsUpdated: this.resultsUpdated,
    validationUpdated: this.validationUpdated,
  });

  // Resets local emission signatures whenever prompt payload changes.
  private readonly _resetStateOnContentChange = effect(() => {
    this.content();
    this._selectionEmitter.reset();
  });

  // Emits result + validation updates. Submission is always explicit via the
  // host's Confirm button — this only tracks selection state.
  private readonly _emitSelectionState = effect(() => {
    const selectedPiles = this.selectedPiles();
    const valid = this.isValidSelection();

    this._selectionEmitter.emit({
      result: [...selectedPiles],
      isValid: valid,
    });
  });

  // Ordered selectable pile names from prompt payload.
  readonly pileNames = computed(() => this.content().pileNames ?? []);

  // Selected piles filtered to current selectable names.
  readonly selectedPiles = computed(() => {
    const pileNameSet = new Set(this.pileNames());
    return this._selectedPiles().filter((pileName) => pileNameSet.has(pileName));
  });

  // True when this prompt allows canceling without a valid selection.
  readonly isOptional = computed(() => this.content().optional ?? false);

  // Toggles one pile in the shared selection store used by board highlighting.
  togglePile(pileName: CardKey): void {
    if (!this.pileNames().includes(pileName)) {
      return;
    }

    const selected = [...this.selectedPiles()];
    const existingIndex = selected.indexOf(pileName);
    if (existingIndex >= 0) {
      selected.splice(existingIndex, 1);
    } else {
      // The count spec's maximum is a hard cap — ignore clicks that would
      // exceed it; the player must deselect a pile before picking another.
      if (selected.length >= resolveMaxSelectable(this.content().selectCount)) {
        return;
      }
      selected.push(pileName);
    }
    selectedPileStore.set(selected);
  }

  // Returns true when a pile is currently selected.
  isSelected(pileName: CardKey): boolean {
    return this.selectedPiles().includes(pileName);
  }

  // Validation state derived from prompt count spec and current selection length.
  private isValidSelection(): boolean {
    return validateCountSpec(this.content().selectCount, this.selectedPiles().length);
  }
}
