import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { UserPromptKinds } from 'shared/types';
import { cofferStore } from '../../../state/resource-logic';
import { currentPlayerStore, playerTreasureStore } from '../../../state/turn-state';

type PromptOverpayContent = Extract<UserPromptKinds, { type: 'overpay' }>;

@Component({
  selector: 'app-prompt-overpay-content',
  templateUrl: './prompt-overpay-content.component.html',
  styleUrl: './prompt-overpay-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptOverpayContentComponent {
  private readonly _nanoService = inject(NanostoresService);

  content = input.required<PromptOverpayContent>();

  validationUpdated = output<boolean>();
  resultsUpdated = output<{ inTreasure: number; inCoffer: number }>();

  private readonly _currentPlayer = toSignal(this._nanoService.useStore(currentPlayerStore), {
    initialValue: currentPlayerStore.get(),
  });

  private readonly _coffers = toSignal(this._nanoService.useStore(cofferStore), {
    initialValue: cofferStore.get(),
  });

  private readonly _playerTreasure = toSignal(this._nanoService.useStore(playerTreasureStore), {
    initialValue: playerTreasureStore.get(),
  });

  private readonly _selectedOverpayAmount = signal(0);

  // Emits overpay split output whenever slider value or player resources change.
  private readonly _emitOverpayState = effect(() => {
    const maxValue = this.maxValue();
    const nextValue = Math.max(0, Math.min(this._selectedOverpayAmount(), maxValue));

    if (nextValue !== this._selectedOverpayAmount()) {
      this._selectedOverpayAmount.set(nextValue);
      return;
    }

    this.validationUpdated.emit(true);
    this.resultsUpdated.emit(this.toOverpayResult(nextValue));
  });

  // Maximum overpay amount available from current treasure + coffers after base cost.
  readonly maxValue = computed(() => {
    const currentPlayer = this._currentPlayer();
    if (!currentPlayer) {
      return 0;
    }

    const totalTreasure = this._playerTreasure() ?? 0;
    const totalCoffers = this._coffers()?.[currentPlayer.id] ?? 0;
    const max = totalTreasure + totalCoffers - this.content().cost;

    return Math.max(0, max);
  });

  // Current slider value shown in UI.
  readonly selectedOverpayAmount = computed(() => this._selectedOverpayAmount());

  // Treasure amount allocated to overpay.
  readonly inTreasure = computed(() => this.toOverpayResult(this._selectedOverpayAmount()).inTreasure);

  // Coffer amount allocated to overpay.
  readonly inCoffer = computed(() => this.toOverpayResult(this._selectedOverpayAmount()).inCoffer);

  // Updates overpay slider value from UI input.
  onSliderChanged(rawValue: string): void {
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      this._selectedOverpayAmount.set(0);
      return;
    }

    this._selectedOverpayAmount.set(Math.floor(parsedValue));
  }

  // Splits total overpay into treasure vs coffer components.
  private toOverpayResult(totalOverpay: number): { inTreasure: number; inCoffer: number } {
    const playerTreasure = this._playerTreasure() ?? 0;
    const extraTreasure = playerTreasure - this.content().cost;
    const inTreasure = Math.min(totalOverpay, extraTreasure);
    const inCoffer = totalOverpay > extraTreasure ? totalOverpay - extraTreasure : 0;

    return { inTreasure, inCoffer };
  }
}
