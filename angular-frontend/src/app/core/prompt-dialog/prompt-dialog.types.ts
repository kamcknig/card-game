import { PlayerId, UserPromptActionArgs, UserPromptKinds } from 'shared/types';

// Prompt content types currently supported by the Angular prompt host.
export type SupportedPromptContentType =
  | 'select'
  | 'display-cards'
  | 'number-input'
  | 'name-card'
  | 'overpay'
  | 'rearrange'
  | 'blind-rearrange';

// Union of prompt payload shapes supported by the Angular prompt host.
export type SupportedPromptContent = Extract<UserPromptKinds, { type: SupportedPromptContentType }>;

// Prompt args accepted by the Angular prompt host (content is optional for action-only prompts).
export type PromptDialogArgs = Omit<UserPromptActionArgs, 'content'> & {
  content?: SupportedPromptContent;
};

// Active prompt request tracked by the prompt dialog coordinator.
export type ActivePromptRequest = {
  id: number;
  args: PromptDialogArgs;
  selfPlayerId: PlayerId;
};
