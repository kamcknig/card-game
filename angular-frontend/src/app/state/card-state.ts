import {map} from "nanostores";
import {Card} from "shared/shared-types";
import { pixiInstance } from '../core/pixi-application.factory';

export const cardStore = map<Record<number, Card>>({});

(globalThis as any).cardStore = cardStore;

export const cardOverrideStore = map<Record<string, Partial<Card>>>({});
