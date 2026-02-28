import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardLikeId } from 'shared/types';
import { CardLikeComponent } from '../card-like/card-like.component';
import { WayPickerOverlayService } from '../../core/way-picker/way-picker-overlay.service';

@Component({
  selector: 'app-way-picker-overlay',
  imports: [
    CardLikeComponent,
  ],
  templateUrl: './way-picker-overlay.component.html',
  styleUrl: './way-picker-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WayPickerOverlayComponent {
  private readonly _wayPickerOverlay = inject(WayPickerOverlayService);

  // Current active board-level way picker state.
  readonly activePicker = this._wayPickerOverlay.activePicker;

  // Applies a chosen way for the active card.
  onSelectWay(wayId: CardLikeId): void {
    this._wayPickerOverlay.selectWay(wayId);
  }

  // Keeps picker visible while pointer is over the overlay.
  onPanelMouseEnter(): void {
    this._wayPickerOverlay.setPanelHovering(true);
  }

  // Schedules close after pointer leaves the overlay.
  onPanelMouseLeave(): void {
    this._wayPickerOverlay.setPanelHovering(false);
    this._wayPickerOverlay.scheduleClose();
  }
}
