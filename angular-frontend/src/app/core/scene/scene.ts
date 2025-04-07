import { Container } from 'pixi.js';

export class Scene<D = unknown> extends Container {
    constructor() {
        super();
    }

    initialize(data?: D): void | Promise<void> {

    }
}
