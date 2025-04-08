import { Application, TexturePool } from 'pixi.js';

export let pixiInstance: Application = new Application();
(globalThis as any).__PIXI_APP__ = pixiInstance;

export const pixiFactory = async () => {
  TexturePool.textureOptions.scaleMode = 'nearest';
  TexturePool.textureOptions.antialias = true;
  await pixiInstance.init({
    antialias: true,
    background: "#1099bb"
  });
  pixiInstance.canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
}
