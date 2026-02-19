import { Container, ContainerOptions, FederatedPointerEvent } from 'pixi.js';
import { CardLikeId } from 'shared/types';

export abstract class CardLikeView extends Container {
  public cardId: CardLikeId;

  protected constructor(args: ContainerOptions & { id: CardLikeId }) {
    super(args);

    this.cardId = args.id;

    this.eventMode = 'static';
    this.on('pointerdown', (event) => {
      // Prevent browser context menu when using right-click for in-game detail actions.
      if (event.button === 2) {
        event.preventDefault?.();
        event.stopPropagation?.();
        const nativeEvent = (event as FederatedPointerEvent & { nativeEvent?: MouseEvent }).nativeEvent;
        nativeEvent?.preventDefault?.();
      }
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
