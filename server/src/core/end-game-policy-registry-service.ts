import { EndGamePolicyFn } from '@server-types/index.ts';

// Stores expansion-registered endgame policies for the active match scope.
export class EndGamePolicyRegistryService {
  private _policies: EndGamePolicyFn[] = [];

  public register(policy: EndGamePolicyFn): void {
    this._policies.push(policy);
  }

  public getPolicies(): EndGamePolicyFn[] {
    return this._policies;
  }
}
