import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { CardKey, UserPromptKinds } from 'shared/types';
import { resolveCountSpec } from 'shared/resolve-count-spec';
import { validateCountSpec } from 'shared/validate-count-spec';
import { selectedPileStore } from '../../../state/interactive-state';

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
  finished = output<void>();

  private readonly _selectedPiles = toSignal(this._nanoService.useStore(selectedPileStore), {
    initialValue: selectedPileStore.get(),
  });

  private _lastValidationState: boolean | null = null;
  private _lastResultSignature = '';
  private _lastAutoFinishSignature: string | null = null;

  // Resets local emission signatures whenever prompt payload changes.
  private readonly _resetStateOnContentChange = effect(() => {
    this.content();
    this._lastValidationState = null;
    this._lastResultSignature = '';
    this._lastAutoFinishSignature = null;
  });

  // Emits result + validation updates and applies single-choice auto-finish semantics.
  private readonly _emitSelectionState = effect(() => {
    const selectedPiles = this.selectedPiles();
    const valid = this.isValidSelection();

    const resultSignature = JSON.stringify(selectedPiles);
    if (resultSignature !== this._lastResultSignature) {
      this._lastResultSignature = resultSignature;
      this.resultsUpdated.emit([...selectedPiles]);
    }

    if (valid !== this._lastValidationState) {
      this._lastValidationState = valid;
      this.validationUpdated.emit(valid);
    }

    if (this.shouldAutoFinish() && valid) {
      if (resultSignature !== this._lastAutoFinishSignature) {
        this._lastAutoFinishSignature = resultSignature;
        this.finished.emit();
      }
      return;
    }

    this._lastAutoFinishSignature = null;
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

  // Mirrors prior auto-complete behavior for non-optional single-pile selects.
  private shouldAutoFinish(): boolean {
    if (this.isOptional()) {
      return false;
    }

    const countSpec = resolveCountSpec(this.content().selectCount);
    if (countSpec.kind === 'fixed') {
      return countSpec.count === 1;
    }

    return countSpec.min === 1 && countSpec.max === 1;
  }
}
