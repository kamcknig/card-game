import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { UserPromptKinds } from 'shared/types';

type PromptBlindRearrangeContent = Extract<UserPromptKinds, { type: 'blind-rearrange' }>;

@Component({
  selector: 'app-prompt-blind-rearrange-content',
  templateUrl: './prompt-blind-rearrange-content.component.html',
  styleUrl: './prompt-blind-rearrange-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptBlindRearrangeContentComponent {
  content = input.required<PromptBlindRearrangeContent>();

  validationUpdated = output<boolean>();
  resultsUpdated = output<number>();

  private readonly _selectedSplitIndex = signal(0);

  // Initializes split index whenever prompt payload changes.
  private readonly _resetSplitOnContentChange = effect(() => {
    const cardCount = this.content().cardIds?.length ?? 0;
    this._selectedSplitIndex.set(Math.floor(cardCount * 0.5));
  });

  // Emits validation and split result for host actions.
  private readonly _emitPromptState = effect(() => {
    this.validationUpdated.emit(true);
    this.resultsUpdated.emit(this._selectedSplitIndex());
  });

  // Max slider bound from card count.
  readonly maxValue = computed(() => this.content().cardIds?.length ?? 0);

  // Current slider value shown in UI.
  readonly selectedSplitIndex = computed(() => this._selectedSplitIndex());

  // Updates selected split index from slider input.
  onSplitChanged(rawValue: string): void {
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      this._selectedSplitIndex.set(0);
      return;
    }

    const boundedValue = Math.max(0, Math.min(Math.floor(parsedValue), this.maxValue()));
    this._selectedSplitIndex.set(boundedValue);
  }
}
