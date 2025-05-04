import { CardKey } from 'shared/shared-types.ts';
import { CardGameLifecycleCallbackMap, LifecycleCallbackMap } from '../types.ts';

export const cardLifecycleMap: Record<CardKey, LifecycleCallbackMap> =
  {};

export const cardGameLifeCycleMap: Record<CardKey, CardGameLifecycleCallbackMap> =
  {};
