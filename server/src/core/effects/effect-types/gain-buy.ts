import { EffectBase } from './effect-base.ts';

type GainBuyArgs = {
  count?: number;
}

export class GainBuyEffect extends EffectBase {
  type = 'gainBuy' as const;
  
  count: number = 1;
  
  constructor(args: GainBuyArgs) {
    super();
    this.count = args.count ?? 1;
  }
}
