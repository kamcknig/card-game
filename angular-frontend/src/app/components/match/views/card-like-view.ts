import { Container, ContainerOptions, FederatedPointerEvent } from 'pixi.js';

export abstract class CardLikeView extends Container {
  protected constructor(args: ContainerOptions) {
    super(args);

    this.eventMode = 'static';
    this.on('pointerdown', (event) => {
      this.onPointerdown(event);
    });

    this.on('removed', () => {
      this.off('pointerdown');
      this.off('removed');
    })
  }

  abstract onPointerdown(event: FederatedPointerEvent): void;
}
