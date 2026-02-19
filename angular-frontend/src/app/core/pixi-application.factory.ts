import { Application, TexturePool } from 'pixi.js';
import { applicationStore } from '../state/app-state';
import { initDevtools } from '@pixi/devtools';
import { getPixiAppTheme } from '../theme/pixi-theme';

export let pixiInstance: Application = new Application();

export const pixiFactory = async () => {
  const pixiTheme = getPixiAppTheme();
  TexturePool.textureOptions.scaleMode = 'nearest';
  TexturePool.textureOptions.antialias = true;
  await pixiInstance.init({
    antialias: true,
    background: pixiTheme.surface.canvasBackground,
  });
  // Prevent browser context-menu on the Pixi surface so right-click can be used for in-game card detail interactions.
  pixiInstance.canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
  // Suppress default browser actions for right-click directly on the canvas.
  pixiInstance.canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 2) {
      event.preventDefault();
    }
  });
  // Some browsers can still surface context menu via global bubbling; block it while right-clicking the Pixi canvas.
  window.addEventListener('contextmenu', (event) => {
    const eventPath = event.composedPath?.() ?? [];
    const canvas = pixiInstance.canvas;
    const canvasContainer = canvas.parentElement;
    const target = event.target as Node | null;
    const inCanvasContainer = !!(canvasContainer && target && canvasContainer.contains(target));
    if (event.target === canvas || eventPath.includes(canvas) || inCanvasContainer) {
      event.preventDefault();
    }
  }, { capture: true });
  await initDevtools({
    app: pixiInstance,
    // If you are not using a pixi app, you can pass the renderer and stage directly
    // renderer: myRenderer,
    // stage: myStage,
  });
  applicationStore.set(pixiInstance);
}
