import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { UserPromptKinds } from 'shared/types';
import { cofferStore } from '../../../state/resource-logic';
import { currentPlayerStore, playerTreasureStore } from '../../../state/turn-state';

type PromptSliderContent = Extract<UserPromptKinds, { type: 'overpay' | 'blind-rearrange' }>;

// Overpay result payload: split between treasure and coffer allocation.
export type OverpayResult = { inTreasure: number; inCoffer: number };

// Single range-slider prompt shared by the two structurally-identical
// "pick a number bounded by resources/count" prompts: overpay (buy price +
// spare treasure/coffers) and blind-rearrange (split point in a hidden
// card stack). Switches presentation and result shape on `content.type`;
// wire payloads to the server are unchanged from the two components this
// replaces (`PromptOverpayContentComponent` /
// `PromptBlindRearrangeContentComponent`).
@Component({
  selector: 'app-prompt-slider-content',
  templateUrl: './prompt-slider-content.component.html',
  styleUrl: './prompt-slider-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptSliderContentComponent {
  private readonly _nanoService = inject(NanostoresService);

  content = input.required<PromptSliderContent>();

  validationUpdated = output<boolean>();
  resultsUpdated = output<OverpayResult | number>();

  private readonly _currentPlayer = toSignal(this._nanoService.useStore(currentPlayerStore), {
    initialValue: currentPlayerStore.get(),
  });

  private readonly _coffers = toSignal(this._nanoService.useStore(cofferStore), {
    initialValue: cofferStore.get(),
  });

  private readonly _playerTreasure = toSignal(this._nanoService.useStore(playerTreasureStore), {
    initialValue: playerTreasureStore.get(),
  });

  private readonly _selectedValue = signal(0);

  // Seeds the slider whenever a new prompt payload arrives: blind-rearrange
  // starts at the midpoint of the card count (mirrors legacy
  // PromptBlindRearrangeContentComponent behavior); overpay starts at 0 and
  // is clamped to available resources by the emit effect below.
  private readonly _resetOnContentChange = effect(() => {
    const content = this.content();
    if (content.type === 'blind-rearrange') {
      const cardCount = content.cardIds?.length ?? 0;
      this._selectedValue.set(Math.floor(cardCount * 0.5));
    } else {
      this._selectedValue.set(0);
    }
  });

  // Emits result + validation whenever the slider value or, for overpay,
  // available player resources change. Re-clamps the value to the current
  // max on every tick so a shrinking maxValue (overpay only) can't leave a
  // stale out-of-range selection.
  private readonly _emitSliderState = effect(() => {
    const maxValue = this.maxValue();
    const nextValue = Math.max(0, Math.min(this._selectedValue(), maxValue));

    if (nextValue !== this._selectedValue()) {
      this._selectedValue.set(nextValue);
      return;
    }

    this.validationUpdated.emit(true);
    this.resultsUpdated.emit(this.isOverpay() ? this.toOverpayResult(nextValue) : nextValue);
  });

  // True when this prompt is the overpay variant (vs. blind-rearrange).
  readonly isOverpay = computed(() => this.content().type === 'overpay');

  // Maximum slider bound: overpay derives from treasure + coffers minus
  // cost; blind-rearrange derives from the card count being split.
  readonly maxValue = computed(() => {
    const content = this.content();
    if (content.type === 'blind-rearrange') {
      return content.cardIds?.length ?? 0;
    }

    const currentPlayer = this._currentPlayer();
    if (!currentPlayer) {
      return 0;
    }

    const totalTreasure = this._playerTreasure() ?? 0;
    const totalCoffers = this._coffers()?.[currentPlayer.id] ?? 0;
    const max = totalTreasure + totalCoffers - content.cost;

    return Math.max(0, max);
  });

  // Current slider value shown in UI.
  readonly selectedValue = computed(() => this._selectedValue());

  // Treasure amount allocated to overpay (overpay prompts only).
  readonly inTreasure = computed(() => this.toOverpayResult(this._selectedValue()).inTreasure);

  // Coffer amount allocated to overpay (overpay prompts only).
  readonly inCoffer = computed(() => this.toOverpayResult(this._selectedValue()).inCoffer);

  // Updates slider value from UI input.
  onSliderChanged(rawValue: string): void {
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      this._selectedValue.set(0);
      return;
    }

    const boundedValue = Math.max(0, Math.min(Math.floor(parsedValue), this.maxValue()));
    this._selectedValue.set(boundedValue);
  }

  // Splits total overpay into treasure vs coffer components. No-op cost of
  // 0 for blind-rearrange content since this is only read by overpay's
  // template bindings, but stays total-safe for any tick timing.
  private toOverpayResult(totalOverpay: number): OverpayResult {
    const content = this.content();
    const cost = content.type === 'overpay' ? content.cost : 0;
    const playerTreasure = this._playerTreasure() ?? 0;
    const extraTreasure = playerTreasure - cost;
    const inTreasure = Math.min(totalOverpay, extraTreasure);
    const inCoffer = totalOverpay > extraTreasure ? totalOverpay - extraTreasure : 0;

    return { inTreasure, inCoffer };
  }
}
