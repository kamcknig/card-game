import { map } from 'nanostores';
import { Card, CardId } from 'shared/types';

export const cardStore = map<Record<CardId, Card>>({});
(globalThis as any).cardStore = cardStore;


