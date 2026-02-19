import { ActionService, PromptService as PromptServiceContract } from '@server-types/index.ts';
import { CardId, SelectSingleActionCardArgs, UserPromptActionArgs } from 'shared/types/index.ts';

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

  // Returns submitted numeric input when the confirm action is selected; otherwise returns null.
  public async requestNumberInput(args: UserPromptActionArgs, confirmAction = 1): Promise<number | null> {
    const result = await this.requestActionResult<number>(args);
    if (!result || result.action !== confirmAction) {
      return null;
    }
    return typeof result.result === 'number' ? result.result : null;
  }

  // Returns selected card ids from a prompt-result payload; returns an empty array when no selection result exists.
  public async selectCardsFromPrompt(args: UserPromptActionArgs): Promise<CardId[]> {
    const result = await this.request<unknown>(args);
    return this.extractSelectedCardIds(result);
  }

  // Returns a single selected card id from a prompt-result payload, or null when no card was selected.
  public async selectSingleCardFromPrompt(args: UserPromptActionArgs): Promise<CardId | null> {
    const selectedCardIds = await this.selectCardsFromPrompt(args);
    return selectedCardIds[0] ?? null;
  }

  // Runs the action-layer single-card selection and returns null when no card was selected.
  public async selectSingleCardFromAction(args: SelectSingleActionCardArgs): Promise<CardId | null> {
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

  // Normalizes prompt responses that may encode selected cards as raw arrays or wrapped result payloads.
  private extractSelectedCardIds(result: unknown): CardId[] {
    if (Array.isArray(result)) {
      return result.filter((value): value is CardId => typeof value === 'number');
    }

    if (!result || typeof result !== 'object') {
      return [];
    }

    const payload = result as {
      selectedCardIds?: unknown;
      result?: unknown;
    };

    if (Array.isArray(payload.selectedCardIds)) {
      return payload.selectedCardIds.filter((value): value is CardId => typeof value === 'number');
    }

    if (payload.result !== undefined) {
      return this.extractSelectedCardIds(payload.result);
    }

    return [];
  }
}
