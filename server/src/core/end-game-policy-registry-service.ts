import { EndGamePolicyFn, EndGamePolicyRegistrationOptions } from '@server-types/index.ts';

// Stores expansion-registered endgame policies for the active match scope.
export class EndGamePolicyRegistryService {
  private _policies: { fn: EndGamePolicyFn; priority: number; order: number }[] = [];
  private _nextOrder: number = 0;

  public register(policy: EndGamePolicyFn, options: EndGamePolicyRegistrationOptions = {}): void {
    this._policies.push({
      fn: policy,
      priority: options.priority ?? 100,
      order: this._nextOrder++,
    });
  }

  public getPolicies(): EndGamePolicyFn[] {
    return this._policies
      .slice()
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.order - b.order;
      })
      .map(entry => entry.fn);
  }
}
