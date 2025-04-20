import { EffectArgs, EffectBase } from './effect-base.ts';

export class EndTurnEffect extends EffectBase {
  type = 'endTurn' as const;
  
  constructor(args?: EffectArgs<void>) {
    super(args);
  }
}