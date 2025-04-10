import {atom} from "nanostores";
import { PlayerId } from "shared/shared-types";
import { playerActionsStore } from './turn-state';

export const gamePausedStore = atom<boolean>(false);
(globalThis as any).gamePausedStore = gamePausedStore;

export const gameOwnerIdStore = atom<PlayerId | undefined>();
(globalThis as any).gameOwnerIdStore = gameOwnerIdStore;

export const sceneStore = atom<'configuration' | 'match'>('configuration');
(globalThis as any).sceneStore = sceneStore;
