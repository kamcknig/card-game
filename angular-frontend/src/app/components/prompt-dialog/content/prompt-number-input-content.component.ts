import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { UserPromptKinds } from 'shared/types';

type PromptNumberInputContent = Extract<UserPromptKinds, { type: 'number-input' }>;

@Component({
  selector: 'app-prompt-number-input-content',
  templateUrl: './prompt-number-input-content.component.html',
  styleUrl: './prompt-number-input-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptNumberInputContentComponent {
  content = input.required<PromptNumberInputContent>();

  validationUpdated = output<boolean>();
  resultsUpdated = output<number | undefined>();

  private readonly _rawValue = signal('');

  // Re-initializes local input state whenever prompt payload changes.
  private readonly _resetStateOnContentChange = effect(() => {
    const content = this.content();
    if (content.value === undefined || content.value === null) {
      this._rawValue.set('');
      return;
    }

    const minValue = content.min ?? Number.NEGATIVE_INFINITY;
    const maxValue = content.max ?? Number.POSITIVE_INFINITY;
    const clampedValue = Math.min(Math.max(content.value, minValue), maxValue);
    this._rawValue.set(`${clampedValue}`);
  });

  // Emits validation + result payload each time the input value changes.
  private readonly _emitValidationState = effect(() => {
    const numericValue = this.numericValue();
    const valid = this.isValid();

    this.validationUpdated.emit(valid);
    this.resultsUpdated.emit(valid ? numericValue : undefined);
  });

  // Current numeric value parsed from sanitized raw input.
  readonly numericValue = computed(() => {
    const value = this._rawValue().trim();
    if (!value.length || value === '-') {
      return Number.NaN;
    }
    return Number(value);
  });

  // Effective minimum bound for this prompt.
  readonly minValue = computed(() => this.content().min ?? Number.NEGATIVE_INFINITY);

  // Effective maximum bound for this prompt.
  readonly maxValue = computed(() => this.content().max ?? Number.POSITIVE_INFINITY);

  // Validation state for the current numeric input.
  readonly isValid = computed(() => {
    const value = this.numericValue();
    if (!Number.isFinite(value)) {
      return false;
    }
    return value >= this.minValue() && value <= this.maxValue();
  });

  // Range helper text shown below the input field.
  readonly rangeText = computed(() => {
    const content = this.content();
    const hasMin = content.min !== undefined;
    const hasMax = content.max !== undefined;

    if (!hasMin && !hasMax) {
      return '';
    }
    if (hasMin && hasMax) {
      return `Range: ${content.min}-${content.max}`;
    }
    if (hasMin) {
      return `Min: ${content.min}`;
    }
    return `Max: ${content.max}`;
  });

  // Placeholder text shown when prompt payload does not provide one explicitly.
  readonly placeholder = computed(() => {
    const content = this.content();
    if (content.placeholder) {
      return content.placeholder;
    }

    const hasMin = content.min !== undefined;
    const hasMax = content.max !== undefined;

    if (hasMin && hasMax) {
      return `${content.min}-${content.max}`;
    }
    if (hasMin) {
      return `>= ${content.min}`;
    }
    if (hasMax) {
      return `<= ${content.max}`;
    }
    return 'Enter number';
  });

  // Template binding for raw input value.
  readonly rawValue = computed(() => this._rawValue());

  // Updates local raw value using numeric sanitization.
  onInputChanged(rawValue: string): void {
    this._rawValue.set(this.sanitizeNumberInput(rawValue));
  }

  // Restricts input to an optional leading minus sign and digits.
  private sanitizeNumberInput(value: string): string {
    if (!value) {
      return '';
    }

    const trimmed = value.trim();
    if (trimmed === '-') {
      return '-';
    }

    const isNegative = trimmed.startsWith('-');
    const digits = trimmed.replace(/[^0-9]/g, '');

    if (!digits.length) {
      return isNegative ? '-' : '';
    }

    return `${isNegative ? '-' : ''}${digits}`;
  }
}
