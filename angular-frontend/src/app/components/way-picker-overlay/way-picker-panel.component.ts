import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CardLikeId } from 'shared/types';
import { CardLikeComponent, CardLikeKind } from '../card-like/card-like.component';

// Shared Way-picker panel chrome + entry list, used by both the board-level
// hover flyout (`WayPickerOverlayComponent`, positioned via its own service)
// and the modal-embedded tooltip inside `PromptSelectContentComponent`
// (positioned relative to the hovered card). This component owns only the
// panel/list/entry markup and styling — position (fixed vs. absolute),
// z-index, and open/close/hover timing stay with each consumer since those
// differ between the canvas flyout and the in-dialog tooltip.
@Component({
  selector: 'app-way-picker-panel',
  imports: [
    CardLikeComponent,
  ],
  templateUrl: './way-picker-panel.component.html',
  styleUrl: './way-picker-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WayPickerPanelComponent {
  // Ordered Way card-like ids to render as entries.
  wayIds = input.required<CardLikeId[]>();

  // Currently selected Way id, if any — applies the `.selected-way` glow.
  // Only the modal-embedded tooltip tracks a persisted selection; the board
  // flyout leaves this unset.
  selectedWayId = input<CardLikeId | null>(null);

  // `app-card-like` kind passed through to each entry. The board flyout
  // passes `'way'` for the accent strip; the modal tooltip omits it,
  // matching its pre-extraction rendering.
  wayKind = input<CardLikeKind | undefined>(undefined);

  // When true, the entry list scrolls past a max-height instead of growing
  // unbounded (the modal tooltip's list can outgrow the viewport; the board
  // flyout's cannot).
  scrollable = input(false);

  waySelected = output<CardLikeId>();

  // Returns true when the given Way id is the currently selected one.
  isSelected(wayId: CardLikeId): boolean {
    return this.selectedWayId() === wayId;
  }

  // Forwards an entry click as the selected Way id.
  onSelectWay(wayId: CardLikeId): void {
    this.waySelected.emit(wayId);
  }
}
