import { GameActions, GameActionDefinitionMap, GameActionReturnTypeMap, RunGameActionDelegate } from '@server-types/index.ts';

// Central gateway for runtime actions so per-match services depend on one injected action entrypoint.
export class RuntimeActionGateway {
  private _delegate: RunGameActionDelegate | undefined;

  // Binds the match controller action executor after the match scope is fully composed.
  public bind(delegate: RunGameActionDelegate): void {
    this._delegate = delegate;
  }

  // Runs a game action through the bound delegate.
  public async run<K extends GameActions>(
    action: K,
    ...args: Parameters<GameActionDefinitionMap[K]>
  ): Promise<GameActionReturnTypeMap[K]> {
    if (!this._delegate) {
      throw new Error('[runtime action gateway] action delegate not bound');
    }
    return await this._delegate(action, ...args);
  }
}
