import { Container } from 'pixi.js';

export class Scene<D = unknown> extends Container {
    constructor(protected stage: Container) {
        super();
    }

    initialize(data?: D): void | Promise<void> {

    }
}
