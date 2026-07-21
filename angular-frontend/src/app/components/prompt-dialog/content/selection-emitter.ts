import { OutputEmitterRef } from '@angular/core';

// Shared dedup-and-emit machinery for prompt selection content components
// (card select, pile select). Both components drive their own reactive
// `effect()` — reading whatever prompt-specific signals feed their
// selection — and call `emit()` once per effect tick with the latest
// derived state. This helper owns only the "did this value actually change"
// bookkeeping so `resultsUpdated` / `validationUpdated` fire exactly once per
// distinct state, matching the two components' original hand-rolled dedup
// signatures. Submission is always an explicit host action (Confirm button /
// floating bar) — this helper never submits on its own.
export interface SelectionEmitterOutputs<TResult> {
  resultsUpdated: OutputEmitterRef<TResult>;
  validationUpdated: OutputEmitterRef<boolean>;
}

export interface SelectionEmitterTick<TResult> {
  // Current selection result payload for this tick.
  result: TResult;
  // Whether `result` currently satisfies the prompt's count spec.
  isValid: boolean;
}

export interface SelectionEmitter<TResult> {
  // Runs one dedup-and-emit pass; call from within the consuming component's
  // own effect on every reactive read of the underlying selection state.
  emit(tick: SelectionEmitterTick<TResult>): void;
  // Clears all dedup signatures — call when the prompt payload changes so a
  // fresh prompt doesn't inherit stale dedup state from the prior one.
  reset(): void;
}

// Builds a `SelectionEmitter` bound to the given component outputs.
export function createSelectionEmitter<TResult>(
  outputs: SelectionEmitterOutputs<TResult>,
): SelectionEmitter<TResult> {
  let lastValidationState: boolean | null = null;
  let lastResultSignature = '';

  return {
    emit({ result, isValid }) {
      const resultSignature = JSON.stringify(result);
      if (resultSignature !== lastResultSignature) {
        lastResultSignature = resultSignature;
        outputs.resultsUpdated.emit(result);
      }

      if (isValid !== lastValidationState) {
        lastValidationState = isValid;
        outputs.validationUpdated.emit(isValid);
      }
    },
    reset() {
      lastValidationState = null;
      lastResultSignature = '';
    },
  };
}
