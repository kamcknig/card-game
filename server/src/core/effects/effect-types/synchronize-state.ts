import { EffectBase } from './effect-base.ts';

export class SynchronizeStateEffect extends EffectBase {
  type = 'synchronizeState' as const;
  
  constructor() {
    super();
  }
}