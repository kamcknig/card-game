import { EffectBase, EffectBaseArgs } from './effect-base.ts';
import { EffectContext } from '../../../types.ts';
import { CardKey } from "shared/shared-types.ts";

export type InvokeGeneratorEffectArgs = {
  cardKey: CardKey;
  context: EffectContext;
}

export class InvokeCardGeneratorEffect extends EffectBase {
  type = 'invokeCardEffects' as const;
  cardKey: CardKey;
  context: EffectContext;
  
  constructor({ cardKey, context, ...arg }: InvokeGeneratorEffectArgs & EffectBaseArgs) {
    super(arg);
    
    this.cardKey = cardKey;
    this.context = context;
  }
}