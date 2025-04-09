import { ActionButtons, UserPromptEffectArgs, UserPromptKinds } from 'shared/shared-types.ts';
import { EffectBase, EffectBaseArgs } from './effect-base.ts';

export class UserPromptEffect extends EffectBase {
  type = 'userPrompt' as const;
  playerId: number;
  prompt?: string;
  actionButtons?: ActionButtons;
  content?: UserPromptKinds;
  validationAction?: number;
  
  constructor(
    {
      content,
      actionButtons,
      playerId,
      prompt,
      validationAction,
      ...arg
    }: { playerId: number } & UserPromptEffectArgs & EffectBaseArgs,
  ) {
    super(arg);
    this.playerId = playerId;
    this.prompt = prompt;
    this.content = content;
    this.actionButtons = actionButtons;
    this.validationAction = validationAction;
  }
}
