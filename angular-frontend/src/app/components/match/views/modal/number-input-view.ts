import { Application, Container, Graphics, Text } from 'pixi.js';
import { Input } from '@pixi/ui';
import { UserPromptKinds } from 'shared/types/index.ts';
import { STANDARD_GAP } from '../../../../core/app-contants';

export const numberInputView = (app: Application, args: UserPromptKinds) => {
  if (args.type !== 'number-input') throw new Error(`number input view requires type 'number-input'`);

  // Container that hosts the numeric input field and helper text.
  const container = new Container();
  // Resolve effective bounds for validation when min/max are omitted.
  const minValue = args.min ?? Number.NEGATIVE_INFINITY;
  const maxValue = args.max ?? Number.POSITIVE_INFINITY;

  // Build the input field background and text styling.
  const inputBg = new Graphics();
  inputBg.roundRect(0, 0, 220, 50, 5);
  inputBg.fill('white');

  const input = new Input({
    bg: inputBg,
    addMask: true,
    padding: STANDARD_GAP,
    // Show a range hint or generic placeholder when not provided.
    placeholder: args.placeholder ?? buildPlaceholder(args),
    textStyle: {
      fill: 'black',
      fontSize: 24,
    },
  });

  // Optional range helper to keep min/max visible to the player.
  const rangeTextValue = buildRangeText(args);
  let rangeText: Text | null = null;
  if (rangeTextValue) {
    rangeText = new Text({
      text: rangeTextValue,
      style: {
        fill: 'white',
        fontSize: 18,
      },
    });
    // Align the range helper below the input.
    rangeText.x = Math.floor(input.width * 0.5 - rangeText.width * 0.5);
    rangeText.y = input.height + STANDARD_GAP;
  }

  // Clamp the initial value into the allowed bounds if provided.
  if (args.value !== undefined) {
    // Clamp provided defaults into the effective range.
    const clamped = Math.min(Math.max(args.value, minValue), maxValue);
    input.value = `${clamped}`;
  }

  // Emit validation and results updates based on the current input value.
  const updateFromValue = (value: string) => {
    const sanitized = sanitizeNumberInput(value);
    if (sanitized !== value) {
      input.value = sanitized;
    }

    const numericValue = sanitized.length ? Number(sanitized) : Number.NaN;
    const isValid = Number.isFinite(numericValue) &&
      numericValue >= minValue &&
      numericValue <= maxValue;

    container.emit('validationUpdated', isValid);
    // Provide a number result only when the input is valid.
    container.emit('resultsUpdated', isValid ? numericValue : undefined);
  };

  // Listen for input changes to validate and propagate results.
  const inputChangeSignal = input.onChange.connect((value) => {
    updateFromValue(value);
  });

  // Validate once on initial render.
  updateFromValue(input.value ?? '');

  container.addChild(input);
  if (rangeText) {
    container.addChild(rangeText);
  }

  container.on('removed', () => {
    // Clean up signal listeners when the modal is dismissed.
    inputChangeSignal.disconnect();
    container.removeAllListeners();
  });

  return container;
};

// Build the optional min/max helper text shown under the input.
const buildRangeText = (args: Extract<UserPromptKinds, { type: 'number-input' }>) => {
  const hasMin = args.min !== undefined;
  const hasMax = args.max !== undefined;
  if (!hasMin && !hasMax) return '';
  if (hasMin && hasMax) return `Range: ${args.min}-${args.max}`;
  if (hasMin) return `Min: ${args.min}`;
  return `Max: ${args.max}`;
};

// Build a default placeholder based on available bounds.
const buildPlaceholder = (args: Extract<UserPromptKinds, { type: 'number-input' }>) => {
  if (args.placeholder) return args.placeholder;
  const hasMin = args.min !== undefined;
  const hasMax = args.max !== undefined;
  if (hasMin && hasMax) return `${args.min}-${args.max}`;
  if (hasMin) return `>= ${args.min}`;
  if (hasMax) return `<= ${args.max}`;
  return 'Enter number';
};

// Strip non-numeric characters while allowing a leading minus sign.
const sanitizeNumberInput = (value: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed === '-') return '-';
  const isNegative = trimmed.startsWith('-');
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits.length) return isNegative ? '-' : '';
  return `${isNegative ? '-' : ''}${digits}`;
};
