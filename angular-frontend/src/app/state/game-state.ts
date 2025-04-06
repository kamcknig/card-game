import {atom} from "nanostores";
import { PlayerId } from "shared/shared-types";

export const gamePausedStore = atom<boolean>(false);

export const gameOwnerIdStore = atom<PlayerId | undefined>();

export const sceneStore = atom<'configuration' | 'match'>('configuration');
