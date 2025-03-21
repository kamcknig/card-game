import {atom} from 'nanostores';

export const $selectableCards = atom<{ playerId: number; cardId: number; }[]>([]);
