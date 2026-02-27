import { Injectable, computed, signal } from '@angular/core';
import { CardId, CardLikeId } from 'shared/types';
import { debugRuntimeContextStore } from '../../state/debug-runtime-state';

export type WayPickerOverlayState = {
  cardId: CardId;
  wayCardLikeIds: CardLikeId[];
  left: number;
  top: number;
};

@Injectable({
  providedIn: 'root',
})
export class WayPickerOverlayService {
  private static readonly DEFAULT_TOOLTIP_CLOSE_DELAY_MS = 160;

  private readonly _activePicker = signal<WayPickerOverlayState | null>(null);
  private _waySelectionHandler: ((cardId: CardId, wayId: CardLikeId) => void) | null = null;
  private _closeTimeout: ReturnType<typeof setTimeout> | null = null;
  private _panelHovering = false;

  // Current active way picker consumed by the Angular overlay component.
  readonly activePicker = computed(() => this._activePicker());

  // Shows/updates the way picker for one hovered card and registers the selection callback.
  public showPicker(
    picker: WayPickerOverlayState,
    onWaySelected: (cardId: CardId, wayId: CardLikeId) => void
  ): void {
    this.cancelScheduledClose();
    this._panelHovering = false;
    this._activePicker.set(picker);
    this._waySelectionHandler = onWaySelected;
  }

  // Hides the way picker immediately and clears selection handlers.
  public hidePicker(): void {
    this.cancelScheduledClose();
    this._panelHovering = false;
    this._activePicker.set(null);
    this._waySelectionHandler = null;
  }

  // Tracks whether the mouse is currently over the way picker panel.
  public setPanelHovering(hovering: boolean): void {
    this._panelHovering = hovering;
    if (hovering) {
      this.cancelScheduledClose();
    }
  }

  // Cancels any in-flight delayed close.
  public cancelScheduledClose(): void {
    if (this._closeTimeout) {
      clearTimeout(this._closeTimeout);
      this._closeTimeout = null;
    }
  }

  // Schedules delayed close so cursor travel from card-to-picker does not flicker.
  public scheduleClose(delayMsOverride?: number): void {
    this.cancelScheduledClose();
    if (this._panelHovering) {
      return;
    }
    const delayMs = this.resolveTooltipCloseDelayMs(delayMsOverride);
    this._closeTimeout = setTimeout(() => {
      this._closeTimeout = null;
      if (this._panelHovering) {
        return;
      }
      this.hidePicker();
    }, delayMs);
  }

  // Emits one selected way for the currently active card.
  public selectWay(wayId: CardLikeId): void {
    const activePicker = this._activePicker();
    if (!activePicker) {
      return;
    }
    const cardId = activePicker.cardId;
    const handler = this._waySelectionHandler;
    this.hidePicker();
    handler?.(cardId, wayId);
  }

  // Resolves close-delay precedence: call override -> server env payload -> default.
  private resolveTooltipCloseDelayMs(delayMsOverride?: number): number {
    if (delayMsOverride !== undefined) {
      return Math.max(0, Math.floor(delayMsOverride));
    }

    const configuredDelay = debugRuntimeContextStore.get()?.tooltipDefaultCloseDelayMs;
    if (configuredDelay !== undefined) {
      return Math.max(0, Math.floor(configuredDelay));
    }

    return WayPickerOverlayService.DEFAULT_TOOLTIP_CLOSE_DELAY_MS;
  }
}
