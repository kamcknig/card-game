import { CardKey } from 'shared/types/index.ts';
import { CardLifecycleCallbackMap } from '@server-types/index.ts';

export const cardLifecycleMap: Record<CardKey, CardLifecycleCallbackMap> = {};
