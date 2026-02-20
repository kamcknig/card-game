import { DropShadowFilter } from 'pixi-filters';

// Creates a compact panel shadow used for board-area containers.
export const createPanelShadowFilter = (): DropShadowFilter => {
  const filter = new DropShadowFilter();
  filter.color = 0x000000;
  filter.alpha = 0.48;
  filter.blur = 2;
  filter.offset = { x: 2, y: 7 };
  return filter;
};
