import { CardId, CardLocation, CardLocations, PlayerId } from 'shared/shared-types';
import { atom, listenKeys, map, ReadableAtom } from 'nanostores';
import { compare } from 'fast-json-patch/';

const cardSourceStoreCache: Record<CardLocation, ReadableAtom<CardId[]>> = {};

export const cardSourceStore = map<Record<CardLocation, CardId[]>>({});

export const getCardSourceStore = (sourceKey: CardLocations, playerId: PlayerId = NaN) => {
  const key = sourceKey + (isNaN(playerId) ? '' : `:${playerId}`);
  if (cardSourceStoreCache[key]) {
    return cardSourceStoreCache[key];
  }

  const cachedAtom = atom<CardId[]>([]);
  listenKeys(cardSourceStore, [key], (newVal, oldVal, changed) => {
    const patch = compare(oldVal[key], newVal[key]);
    cachedAtom.set(newVal[key] ?? []);
  });

  cardSourceStoreCache[key] = cachedAtom;
  return cachedAtom;
}

(globalThis as any).cardSourceStore = cardSourceStore;
