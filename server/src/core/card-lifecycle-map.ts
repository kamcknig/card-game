import { CardKey } from 'shared/shared-types.ts';
import { GameLifecycleCallbackMap, LifecycleCallbackMap } from '../types.ts';

export const cardLifecycleMap: Record<CardKey, LifecycleCallbackMap> =
  {};

export const gameLifeCycleMap: Record<CardKey, GameLifecycleCallbackMap> =
  {};
