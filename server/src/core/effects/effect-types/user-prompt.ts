import { ActionButtons, UserPromptKinds } from 'shared/shared-types.ts';
import { EffectBase } from './effect-base.ts';

type UserPromptArgs = {
  playerId: number;
  prompt?: string;
  actionButtons?: ActionButtons;
  content?: UserPromptKinds;
  validationAction?: number;
}

export class UserPromptEffect extends EffectBase {
  type = 'userPrompt' as const;
  
  playerId: number;
  prompt?: string;
  actionButtons?: ActionButtons;
  content?: UserPromptKinds;
  validationAction?: number;
  
  constructor(args: UserPromptArgs) {
    super();
    this.playerId = args.playerId;
    this.prompt = args.prompt;
    this.content = args.content;
    this.actionButtons = args.actionButtons;
    this.validationAction = args.validationAction;
  }
}
