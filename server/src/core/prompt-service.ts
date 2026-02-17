import { ActionService, PromptService as PromptServiceContract } from '@server-types/index.ts';
import { UserPromptActionArgs } from 'shared/types/index.ts';

// Provides typed prompt helpers so effect code can avoid repetitive cast/parsing logic.
export class PromptService implements PromptServiceContract {
  constructor(
    private readonly actionService: ActionService,
  ) {}

  public async request<TResult = unknown>(args: UserPromptActionArgs): Promise<TResult | null> {
    return await this.actionService.run<TResult>('userPrompt', args);
  }

  public async requestAction(args: UserPromptActionArgs): Promise<number | null> {
    const result = await this.request<{ action?: number }>(args);
    return typeof result?.action === 'number' ? result.action : null;
  }

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

  public async requestResult<TResult = unknown>(args: UserPromptActionArgs): Promise<TResult | null> {
    const result = await this.request<{ result?: TResult }>(args);
    return result?.result ?? null;
  }
}
