import { EffectBase } from './effect-base.ts';

type GainActionArgs = {
  count?: number;
}

export class GainActionEffect extends EffectBase {
  type = 'gainAction' as const;
  
  count: number = 1;
  
  constructor(args: GainActionArgs) {
    super()
    this.count = args.count ?? 1;
  }
}
