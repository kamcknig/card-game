import {Container} from "pixi.js";
import {scenes} from "../../scenes";

export class Scene<D = unknown> extends Container {
    constructor() {
        super();
    }

    initialize(data?: D): void | Promise<void> {

    }
}

/**
 * A function that returns a Scene<S> must accept "data" of the same type S extends Scene<infer D>.
 */
export type SceneFactory<S extends Scene<any>> = (
    stage: Container,
    data?: S extends Scene<infer D> ? D : never,
    ...args: any[]
) => S;
export type SceneConstructor<D = unknown> = new (
    stage: Container,
    data: D,
  ...args: any[]
) => Scene<D>;
/**
 * A single scene entry can be:
 * 1) A Scene instance
 * 2) A Scene constructor
 * 3) A factory function returning a Scene
 */
export type SceneValue =
    | Scene<any>
    | SceneConstructor<any>
    | SceneFactory<Scene<any>>;
/**
 * Mapped type that rewrites each property, ensuring
 * the (stage, data) type unifies with the returned Scene's generic.
 */
type ScenesMap<T extends Record<string, SceneValue>> = {
    [K in keyof T]:
    T[K] extends SceneFactory<infer S>
        ? (stage: Container) => S
        : T[K];
};

export function isSceneCtor(value: unknown): value is SceneConstructor {
    return typeof value === "function" && value.prototype instanceof Scene;
}

// Helper type to extract the data parameter from the initialize method.
type ExtractInitData<S> = S extends { initialize(data?: infer D): any } ? D : never;

// Updated ExtractData type.
type ExtractData<T> =
// Case A: T is a factory function returning a Scene instance.
  T extends (stage: Container, ...args: any[]) => infer S
    ? ExtractInitData<S>
    // Case B: T is a constructor returning a Scene instance.
    : T extends new (stage: Container, ...args: any[]) => infer S
      ? ExtractInitData<S>
      // Case C: T is already a Scene instance.
      : T extends { initialize(data?: infer D): any }
        ? D
        : never;

export type SceneNames = keyof typeof scenes;

export type SceneData<K extends SceneNames> = ExtractData<(typeof scenes)[K]>;

export function registerScenes<T extends Record<string, SceneValue>>(scenes: T): ScenesMap<T> {
    return scenes as ScenesMap<T>;
}
