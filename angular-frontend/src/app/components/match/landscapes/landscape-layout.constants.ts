import { EVENT_HEIGHT, EVENT_WIDTH, STANDARD_GAP } from '../../../core/app-contants';

export const LANDSCAPE_MAX_COLUMNS = 4;
export const LANDSCAPE_CARD_WIDTH_PX = EVENT_WIDTH;
export const LANDSCAPE_CARD_HEIGHT_PX = EVENT_HEIGHT;
export const LANDSCAPE_PANEL_PADDING_PX = STANDARD_GAP;
export const LANDSCAPE_PANEL_GAP_PX = STANDARD_GAP;

export function getLandscapeRowCount(landscapeCount: number): number {
  if (landscapeCount < 1) {
    return 0;
  }
  return Math.ceil(landscapeCount / LANDSCAPE_MAX_COLUMNS);
}

export function getLandscapePanelHeightPx(landscapeCount: number): number {
  const rowCount = getLandscapeRowCount(landscapeCount);
  if (rowCount < 1) {
    return 0;
  }
  return (
    (rowCount * LANDSCAPE_CARD_HEIGHT_PX)
    + (Math.max(0, rowCount - 1) * LANDSCAPE_PANEL_GAP_PX)
    + (LANDSCAPE_PANEL_PADDING_PX * 2)
  );
}
