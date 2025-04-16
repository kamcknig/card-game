import { EffectBase } from './effect-base.ts';
import { CardKey } from "shared/shared-types.ts";
import { CardEffectGeneratorFnContext } from '../../../types.ts';

export type InvokeGeneratorEffectArgs = {
  cardKey: CardKey;
  context: CardEffectGeneratorFnContext;
}

export class InvokeCardGeneratorEffect extends EffectBase {
  type = 'invokeCardEffects' as const;
  cardKey: CardKey;
  context: CardEffectGeneratorFnContext;
  
  constructor(args: InvokeGeneratorEffectArgs) {
    super();
    
    this.cardKey = args.cardKey;
    this.context = args.context;
  }
}