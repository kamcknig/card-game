import { atom } from 'nanostores';
import { Application } from 'pixi.js';

export const applicationStore = atom<Application | null>(null);
