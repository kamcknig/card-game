import {
  ActionService,
  GameActionDefinitionMap,
  GameActionReturnTypeMap,
  GameActions,
  GameActionRunner,
} from '@server-types/index.ts';

// Stores the active match action runner once MatchController has been resolved in the scope.
export class MatchActionRunnerRef {
  private runner: GameActionRunner | undefined;

  // Binds the runner used by all action-service callers in this scope.
  public bind(runner: GameActionRunner): void {
    this.runner = runner;
  }

  // Executes a game action against the bound runner.
  public async run<K extends GameActions>(
    action: K,
    ...args: Parameters<GameActionDefinitionMap[K]>
  ): Promise<GameActionReturnTypeMap[K]> {
    if (!this.runner) {
      throw new Error('[action service] match action runner is not bound');
    }
    return await this.runner(action, ...args);
  }
}

// Scoped action-service implementation used by effects/reactions to run game actions.
export class ScopedActionService implements ActionService {
  constructor(
    private readonly matchActionRunnerRef: MatchActionRunnerRef,
  ) {
  }

  public async run<K extends GameActions>(
    action: K,
    ...args: Parameters<GameActionDefinitionMap[K]>
  ): Promise<GameActionReturnTypeMap[K]> {
    return await this.matchActionRunnerRef.run(action, ...args);
  }
}
