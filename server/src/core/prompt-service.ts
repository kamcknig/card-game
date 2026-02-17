import { ActionService, PromptService as PromptServiceContract } from '@server-types/index.ts';
import { CardId, SelectActionCardArgs, UserPromptActionArgs } from 'shared/types/index.ts';

// Provides typed prompt helpers so effect code can avoid repetitive cast/parsing logic.
export class PromptService implements PromptServiceContract {
  constructor(
    private readonly actionService: ActionService,
  ) {}

  // Sends a prompt and returns the raw typed response payload, or null when the prompt cannot produce a result.
  public async request<TResult = unknown>(args: UserPromptActionArgs): Promise<TResult | null> {
    return await this.actionService.run<TResult>('userPrompt', args);
  }

  // Sends a prompt and returns only the numeric action selected by the player, or null if no action is present.
  public async requestAction(args: UserPromptActionArgs): Promise<number | null> {
    const result = await this.request<{ action?: number }>(args);
    return typeof result?.action === 'number' ? result.action : null;
  }

  // Alias for requestAction used by card-effect code paths that model prompts as a single choice.
  public async chooseOne(args: UserPromptActionArgs): Promise<number | null> {
    return await this.requestAction(args);
  }

  // Returns true only when the selected action matches the provided confirmAction (default 1).
  public async confirm(args: UserPromptActionArgs, confirmAction = 1): Promise<boolean> {
    const action = await this.requestAction(args);
    return action === confirmAction;
  }

  // Returns selected card ids from prompt result payloads; returns an empty array when no selection result exists.
  public async selectCards(args: UserPromptActionArgs): Promise<CardId[]> {
    const result = await this.requestActionResult<CardId[]>(args);
    return result?.result ?? [];
  }

  // Requests a single card selection and returns null when no card was selected.
  public async selectSingleCard(args: SelectActionCardArgs): Promise<CardId | null> {
    return await this.actionService.run('selectSingleCard', args);
  }

  // Returns both the selected action and typed result payload when action is present; otherwise returns null.
  public async requestActionResult<TResult = unknown>(
    args: UserPromptActionArgs,
  ): Promise<{ action: number; result: TResult | undefined } | null> {
    const result = await this.request<{ action?: number; result?: TResult }>(args);
    if (!result || typeof result.action !== 'number') {
      return null;
    }
    return {
      action: result.action,
      result: result.result,
    };
  }

  // Returns only the typed result payload from the prompt response, or null when no result field is provided.
  public async requestResult<TResult = unknown>(args: UserPromptActionArgs): Promise<TResult | null> {
    const result = await this.request<{ result?: TResult }>(args);
    return result?.result ?? null;
  }
}
