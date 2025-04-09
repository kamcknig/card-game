import { EffectBase, EffectBaseArgs } from './effect-base.ts';

export class GainTreasureEffect extends EffectBase {
  type = 'gainTreasure' as const;
  count: number;
  
  constructor({ count, ...arg }: { count: number } & EffectBaseArgs) {
    super(arg);
    this.count = count ?? 1;
  }
}
