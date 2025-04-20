import { EffectArgs, EffectBase } from './effect-base.ts';

type GainActionArgs = {
  count?: number;
}

export class GainActionEffect extends EffectBase {
  type = 'gainAction' as const;
  
  count: number = 1;
  
  constructor(args: EffectArgs<GainActionArgs>) {
    super(args)
    this.count = args.count ?? 1;
  }
}
