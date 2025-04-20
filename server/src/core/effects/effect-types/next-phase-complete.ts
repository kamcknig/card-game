import { EffectBase } from './effect-base.ts';

export class NextPhaseCompleteEffect extends EffectBase {
  type = 'nextPhaseComplete' as const;
}
