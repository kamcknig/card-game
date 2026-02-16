import { Container, Graphics } from 'pixi.js';

export interface CubeTokenViewArgs {
  size: number;
  color: number;
}

// Renders a cube-like token with a slight 3D tilt.
export class CubeTokenView extends Container {
  private readonly _cube: Graphics = new Graphics({ label: 'cube' });

  constructor({ size, color }: CubeTokenViewArgs) {
    super({ label: 'cube-token' });

    // Draw the cube face with a black outline.
    this._cube
      .roundRect(0, 0, size, size, Math.max(2, Math.floor(size * 0.15)))
      .fill({ color })
      .stroke({ color: 'black', width: Math.max(1, Math.floor(size * 0.1)) });

    // Center the cube for rotation and skew.
    this._cube.pivot.set(size * 0.5, size * 0.5);
    this._cube.x = size * 0.5;
    this._cube.y = size * 0.5;
    // Apply slight 3D tilt using skew/rotation.
    this._cube.rotation = -0.2;
    this._cube.skew.set(0.25, -0.2);

    this.addChild(this._cube);
  }
}
