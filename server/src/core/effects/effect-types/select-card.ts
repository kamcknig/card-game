import { EffectArgs, EffectBase } from './effect-base.ts';
import { CountSpec, EffectRestrictionSpec, SelectCardEffectArgs, } from 'shared/shared-types.ts';



export class SelectCardEffect extends EffectBase {
  type = 'selectCard' as const;
  count?: CountSpec | number;
  optional?: boolean;
  restrict: EffectRestrictionSpec | number[];
  playerId: number;
  prompt: string;
  validPrompt?: string;
  cancelPrompt?: string;
  
  constructor(args: EffectArgs<SelectCardEffectArgs>) {
    super();
    this.restrict = args.restrict;
    this.count = args.count;
    this.optional = args.optional;
    this.playerId =args. playerId;
    this.prompt = args.prompt;
    this.validPrompt = args.validPrompt;
    this.cancelPrompt = args.cancelPrompt;
  }
}
