import { STANDARD_GAP } from '../../../core/app-contants';

// Total outer dimensions (content + padding + border) of supply panels.
// Derived from 150px card widths/heights, CSS gaps, 10px padding, and 1px border.
// Keep in sync with app-theme.scss card dimension custom properties and supply overlay CSS.

// Basic panel: 2 columns × 150px + 10px gap + 20px padding + 2px border.
export const SUPPLY_BASIC_PANEL_WIDTH_PX = 332;
// Basic panel height (4-pile max): 4 × 150px + 3 × 10px + 20px padding + 2px border.
export const SUPPLY_BASIC_PANEL_HEIGHT_PX = 652;
// Kingdom panel: 5 columns × 150px + 4 × 32px column-gap + 20px padding + 2px border.
export const SUPPLY_KINGDOM_PANEL_WIDTH_PX = 900;
// Kingdom panel: 2 rows × 150px + 10px row-gap + 20px padding + 2px border.
export const SUPPLY_KINGDOM_PANEL_HEIGHT_PX = 332;

export const SUPPLY_PANEL_GAP_PX = STANDARD_GAP;
