import {map} from "nanostores";
import { Card, CardId } from 'shared/shared-types';
import { pixiInstance } from '../core/pixi-application.factory';

export const cardStore = map<Record<CardId, Card>>({});
(globalThis as any).cardStore = cardStore;

export const cardOverrideStore = map<Record<string, Partial<Card>>>({});
(globalThis as any).cardOverrideStore = cardOverrideStore;
