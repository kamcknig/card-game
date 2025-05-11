import { CardId, CardLocation, PlayerId } from 'shared/shared-types';
import { atom, listenKeys, map, ReadableAtom } from 'nanostores';

export const cardSourceTagMapStore = map<Record<string, CardLocation[]>>({});

export const cardSourceStore = map<Record<CardLocation, CardId[]>>({});

const cardSourceStoreCache: Record<CardLocation, ReadableAtom<CardId[]>> = {};
/**
 * Returns or creates and returns a readable nanostores store for the given key. The key should match a property
 * name of the cardSourceStore.
 *
 * If a playerId is given, a composite key is created by concatenating the sourceKey and playerId with a colon, so
 * take care if the key already has that concatenation
 */
export const getCardSourceStore = (sourceKey: CardLocation, playerId: PlayerId = NaN) => {
  const key = sourceKey + (isNaN(playerId) ? '' : `:${playerId}`);

  if (key.split(':').length > 2) {
    console.warn(`Card source key '${key}' appears to be wrong format. Did you intend to append the playerId?`);
  }

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
(globalThis as any).cardSourceTagStore = cardSourceTagMapStore;
