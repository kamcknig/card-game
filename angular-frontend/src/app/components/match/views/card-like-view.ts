import { Container, ContainerOptions, FederatedPointerEvent } from 'pixi.js';
import { CardLikeId } from 'shared/shared-types';

export abstract class CardLikeView extends Container {
  public cardId: CardLikeId;

  protected constructor(args: ContainerOptions & { id: CardLikeId }) {
    super(args);

    this.cardId = args.id;

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

  abstract draw(): void;
}
