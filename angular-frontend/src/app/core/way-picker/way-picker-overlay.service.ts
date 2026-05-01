import { Injectable, computed, signal } from '@angular/core';
import { CardId, CardLikeId } from 'shared/types';
import { STANDARD_GAP } from '../app-contants';
import { debugRuntimeContextStore } from '../../state/debug-runtime-state';

// Panel width matches calc(var(--card-landscape-width) + 2 * var(--theme-space-sm) + 2px) at default theme (238 + 16 + 2).
// Exported so callers can use it for horizontal viewport clamping before calling showPicker.
export const WAY_PICKER_PANEL_WIDTH_PX = 256;
// Default --card-landscape-height; drives the panel height estimate for vertical clamping.
const WAY_PICKER_CARD_HEIGHT_PX = 149;
// --theme-space-sm gap between way entries.
const WAY_PICKER_CARD_GAP_PX = 8;
// Panel overhead: 2×8px padding + 2px border.
const WAY_PICKER_PANEL_OVERHEAD_PX = 18;

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
  // Clamps the supplied top so the panel stays within the visible viewport.
  public showPicker(
    picker: WayPickerOverlayState,
    onWaySelected: (cardId: CardId, wayId: CardLikeId) => void
  ): void {
    this.cancelScheduledClose();
    this._panelHovering = false;
    this._activePicker.set({ ...picker, top: this.clampTop(picker.top, picker.wayCardLikeIds.length) });
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

  // Clamps the panel top so it stays within the visible viewport, based on an
  // estimated panel height derived from the number of way entries.
  private clampTop(top: number, wayCount: number): number {
    const estimatedHeight = WAY_PICKER_CARD_HEIGHT_PX * wayCount
      + WAY_PICKER_CARD_GAP_PX * Math.max(0, wayCount - 1)
      + WAY_PICKER_PANEL_OVERHEAD_PX;
    return Math.max(
      STANDARD_GAP,
      Math.min(top, window.innerHeight - estimatedHeight - STANDARD_GAP)
    );
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
