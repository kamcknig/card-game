import { OutputEmitterRef } from '@angular/core';

// Shared dedup-and-emit machinery for prompt selection content components
// (card select, pile select). Both components drive their own reactive
// `effect()` — reading whatever prompt-specific signals feed their
// selection — and call `emit()` once per effect tick with the latest
// derived state. This helper owns only the "did this value actually change"
// bookkeeping so `resultsUpdated` / `validationUpdated` / `finished` fire
// exactly once per distinct state, matching the two components' original
// hand-rolled dedup signatures.
//
// Deliberately NOT an `effect()` itself: prompt-select-content also emits a
// third, Way-selection-specific output from the same tick, and that ordering
// (results/validation settled before `finished` fires, all within one
// effect execution) must be preserved so the host's `submitResponse()` reads
// consistent signal state when `finished` triggers it synchronously.
export interface SelectionEmitterOutputs<TResult> {
  resultsUpdated: OutputEmitterRef<TResult>;
  validationUpdated: OutputEmitterRef<boolean>;
  finished: OutputEmitterRef<void>;
}

export interface SelectionEmitterTick<TResult> {
  // Current selection result payload for this tick.
  result: TResult;
  // Whether `result` currently satisfies the prompt's count spec.
  isValid: boolean;
  // Whether the prompt should auto-complete once `isValid` is true (e.g. a
  // non-optional exact-1 selection).
  shouldAutoFinish: boolean;
  // Extra material folded into the auto-finish dedup signature alongside the
  // result signature — prompt-select-content uses this for its selected
  // entry keys (order-sensitive, unlike the sourceId-only result payload).
  autoFinishSignatureExtra?: string;
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
  let lastAutoFinishSignature: string | null = null;

  return {
    emit({ result, isValid, shouldAutoFinish, autoFinishSignatureExtra = '' }) {
      const resultSignature = JSON.stringify(result);
      if (resultSignature !== lastResultSignature) {
        lastResultSignature = resultSignature;
        outputs.resultsUpdated.emit(result);
      }

      if (isValid !== lastValidationState) {
        lastValidationState = isValid;
        outputs.validationUpdated.emit(isValid);
      }

      if (shouldAutoFinish && isValid) {
        const finishSignature = `${resultSignature}:${autoFinishSignatureExtra}`;
        if (finishSignature !== lastAutoFinishSignature) {
          lastAutoFinishSignature = finishSignature;
          outputs.finished.emit();
        }
        return;
      }

      lastAutoFinishSignature = null;
    },
    reset() {
      lastValidationState = null;
      lastResultSignature = '';
      lastAutoFinishSignature = null;
    },
  };
}
