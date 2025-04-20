import { atom } from 'nanostores';
import { Application } from 'pixi.js';

export const appStore = atom<Application | null>(null);
