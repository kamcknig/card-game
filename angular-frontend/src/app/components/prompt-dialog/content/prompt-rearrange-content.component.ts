import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CdkDrag, CdkDropList, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { CardId, UserPromptKinds } from 'shared/types';
import { CardComponent } from '../../card/card.component';

type PromptRearrangeContent = Extract<UserPromptKinds, { type: 'rearrange' }>;

@Component({
  selector: 'app-prompt-rearrange-content',
  imports: [
    CdkDropList,
    CdkDrag,
    CardComponent,
  ],
  templateUrl: './prompt-rearrange-content.component.html',
  styleUrl: './prompt-rearrange-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptRearrangeContentComponent {
  content = input.required<PromptRearrangeContent>();

  validationUpdated = output<boolean>();
  resultsUpdated = output<CardId[]>();

  private readonly _orderedCardIds = signal<CardId[]>([]);

  // Rebuilds ordered cards whenever prompt payload changes.
  private readonly _resetOrderOnContentChange = effect(() => {
    this._orderedCardIds.set([...(this.content().cardIds ?? [])]);
  });

  // Emits validation and ordered card result payload for host actions.
  private readonly _emitPromptState = effect(() => {
    const orderedCardIds = this._orderedCardIds();
    this.validationUpdated.emit(true);
    this.resultsUpdated.emit(orderedCardIds);
  });

  // Ordered cards rendered by the drag/drop list.
  readonly orderedCardIds = computed(() => this._orderedCardIds());

  // Applies one drag-drop reorder operation.
  onDropped(event: CdkDragDrop<CardId[]>): void {
    const reordered = [...this._orderedCardIds()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this._orderedCardIds.set(reordered);
  }
}
