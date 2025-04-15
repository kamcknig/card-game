import { EffectBase } from './effect-base.ts';
import { CountSpec, EffectRestrictionSpec, } from 'shared/shared-types.ts';

type SelectCardArgs = {
  count?: CountSpec | number;
  autoSelect?: boolean;
  restrict: EffectRestrictionSpec | number[];
  playerId: number;
  prompt: string;
  validPrompt?: string;
};

export class SelectCardEffect extends EffectBase {
  type = 'selectCard' as const;
  count?: CountSpec | number;
  autoSelect?: boolean;
  restrict: EffectRestrictionSpec | number[];
  playerId: number;
  prompt: string;
  validPrompt?: string;
  
  constructor(args: SelectCardArgs) {
    super();
    this.restrict = args.restrict;
    this.count = args.count;
    this.autoSelect = args.autoSelect;
    this.playerId =args. playerId;
    this.prompt = args.prompt;
    this.validPrompt = args.validPrompt;
  }
}
