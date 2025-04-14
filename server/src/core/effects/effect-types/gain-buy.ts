import { EffectBase, EffectBaseArgs } from './effect-base.ts';

export class GainBuyEffect extends EffectBase {
  type = 'gainBuy' as const;
  count: number;
  
  constructor({ count, ...arg }: { count: number } & EffectBaseArgs) {
    super(arg);
    this.count = count;
  }
}
