import { EffectBase, EffectBaseArgs } from './effect-base.ts';
import { EffectContext, GameActionOverrides } from '../../types.ts';

export type InvokeGameActionGeneratorArgs = {
  gameAction: string;
  context: EffectContext;
  overrides?: GameActionOverrides;
}

export class InvokeGameActionGeneratorEffect extends EffectBase {
  type = 'invokeGameActionGenerator' as const;
  gameAction: string;
  context: EffectContext;
  overrides?: GameActionOverrides;
  
  constructor({ gameAction, overrides, context, ...arg }: InvokeGameActionGeneratorArgs & EffectBaseArgs) {
    super(arg);
    
    this.gameAction = gameAction;
    this.context = context;
    this.overrides = overrides;
  }
}
