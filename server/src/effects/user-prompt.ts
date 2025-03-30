import { CountSpec } from "shared/shared-types.ts";
import { EffectBase, EffectBaseArgs } from "./effect-base.ts";

export type UserPromptArgs = {
  prompt: string;
  confirmLabel: string;
  declineLabel?: string;
  showDeclineOption?: boolean;
  content?: {
    cardSelection?: {
      cardIds: number[];
      selectCount?: CountSpec;
    };
  };
};

export class UserPromptEffect extends EffectBase {
  type = "userPrompt" as const;
  playerId: number;
  prompt: string;
  declineLabel?: string;
  confirmLabel: string;
  showDeclineOption?: boolean;
  content?: UserPromptArgs["content"];

  constructor(
    {
      content,
      showDeclineOption,
      declineLabel,
      confirmLabel,
      playerId,
      prompt,
      ...arg
    }: { playerId: number } & UserPromptArgs & EffectBaseArgs,
  ) {
    super(arg);
    this.playerId = playerId;
    this.prompt = prompt;
    this.declineLabel = declineLabel;
    this.confirmLabel = confirmLabel;
    this.showDeclineOption = showDeclineOption ?? true;
    this.content = content;
  }
}
