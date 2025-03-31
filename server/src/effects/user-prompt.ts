import { ActionButtons, UserPromptEffectArgs } from 'shared/shared-types.ts';
import { EffectBase, EffectBaseArgs } from './effect-base.ts';

export class UserPromptEffect extends EffectBase {
  type = "userPrompt" as const;
  playerId: number;
  prompt: string;
  actionButtons: ActionButtons;
  content?: UserPromptEffectArgs["content"];
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
