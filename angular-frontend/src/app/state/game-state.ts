import {atom} from "nanostores";
import { PlayerID } from "shared/shared-types";

export const $gamePaused = atom<boolean>(false);

export const gameOwnerIdStore = atom<PlayerID | undefined>();

export const sceneStore = atom<'configuration' | 'match'>('configuration');
