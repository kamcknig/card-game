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
  pixiInstance.canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
  await initDevtools({
    app: pixiInstance,
    // If you are not using a pixi app, you can pass the renderer and stage directly
    // renderer: myRenderer,
    // stage: myStage,
  });
  applicationStore.set(pixiInstance);
}
