import { EffectBase } from './effect-base.ts';

type GainTreasureArgs = {
  count?: number;
}

export class GainTreasureEffect extends EffectBase {
  type = 'gainTreasure' as const;
  
  count: number = 1;
  
  constructor(args: GainTreasureArgs) {
    super();
    this.count = args.count ?? 1;
  }
}
