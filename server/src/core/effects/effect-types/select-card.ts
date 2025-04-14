import { EffectBase, EffectBaseArgs } from './effect-base.ts';
import { CountSpec, EffectRestrictionSpec, SelectCardEffectArgs, } from 'shared/shared-types.ts';

export class SelectCardEffect extends EffectBase {
  type = 'selectCard' as const;
  count?: CountSpec | number;
  autoSelect?: boolean;
  restrict: EffectRestrictionSpec | number[];
  playerId: number;
  prompt: string;
  validPrompt?: string;
  
  constructor(
    { validPrompt, prompt, playerId, restrict, count, autoSelect, ...arg }:
    & SelectCardEffectArgs
      & EffectBaseArgs,
  ) {
    super(arg);
    this.restrict = restrict;
    this.count = count;
    this.autoSelect = autoSelect;
    this.playerId = playerId;
    this.prompt = prompt;
    this.validPrompt = validPrompt;
  }
}
