import { CardId, CardLocation, PlayerId } from 'shared/shared-types';
import { atom, listenKeys, map, ReadableAtom } from 'nanostores';

const cardSourceStoreCache: Record<CardLocation, ReadableAtom<CardId[]>> = {};

export const cardSourceStore = map<Record<CardLocation, CardId[]>>({});

export const getCardSourceStore = (sourceKey: CardLocation, playerId: PlayerId = NaN) => {
  const key = sourceKey + (isNaN(playerId) ? '' : `:${playerId}`);
  if (cardSourceStoreCache[key]) {
    return cardSourceStoreCache[key];
  }

  const cachedAtom = atom<CardId[]>([]);
  listenKeys(cardSourceStore, [key], (newVal, oldVal, changed) => {
    cachedAtom.set(newVal[key] ?? []);
  });

  cardSourceStoreCache[key] = cachedAtom;
  return cachedAtom;
}

(globalThis as any).cardSourceStore = cardSourceStore;
