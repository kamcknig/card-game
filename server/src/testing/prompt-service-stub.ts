import { CardId, SelectSingleActionCardArgs, SelectSingleCardPromptArgs, UserPromptActionArgs } from 'shared/types/index.ts';
import { PromptService } from '../types.ts';

// Test-double for PromptService that replays queued actions and records prompt requests.
export class PromptServiceStub implements PromptService {
  public readonly requestedActions: UserPromptActionArgs[] = [];
  private readonly queuedActions: Array<number | null> = [];

  // Queues action responses returned by subsequent requestAction/chooseOne calls.
  public enqueueActions(...actions: Array<number | null>): void {
    this.queuedActions.push(...actions);
  }

  public async request<TResult = unknown>(_args: UserPromptActionArgs): Promise<TResult | null> {
    return null;
  }

  public async requestAction(args: UserPromptActionArgs): Promise<number | null> {
    this.requestedActions.push(args);
    if (this.queuedActions.length < 1) {
      return null;
    }
    return this.queuedActions.shift() ?? null;
  }

  public async chooseOne(args: UserPromptActionArgs): Promise<number | null> {
    return await this.requestAction(args);
  }

  public async confirm(args: UserPromptActionArgs, confirmAction = 1): Promise<boolean> {
    const action = await this.requestAction(args);
    return action === confirmAction;
  }

  public async requestNumberInput(args: UserPromptActionArgs, confirmAction = 1): Promise<number | null> {
    const action = await this.requestAction(args);
    if (action === null) {
      return null;
    }
    if (action === confirmAction) {
      return confirmAction;
    }
    return action;
  }

  public async selectCardsFromPrompt(_args: UserPromptActionArgs): Promise<CardId[]> {
    return [];
  }

  public async selectSingleCardFromPrompt(_args: SelectSingleCardPromptArgs): Promise<CardId | null> {
    return null;
  }

  public async selectSingleCardFromAction(_args: SelectSingleActionCardArgs): Promise<CardId | null> {
    return null;
  }

  public async requestActionResult<TResult = unknown>(
    args: UserPromptActionArgs,
  ): Promise<{ action: number; result: TResult | undefined } | null> {
    const action = await this.requestAction(args);
    if (action === null) {
      return null;
    }
    return {
      action,
      result: undefined,
    };
  }

  public async requestResult<TResult = unknown>(_args: UserPromptActionArgs): Promise<TResult | null> {
    return null;
  }
}
