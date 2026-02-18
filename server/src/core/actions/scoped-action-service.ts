import {
  ActionService,
  GameActionDefinitionMap,
  GameActionReturnTypeMap,
  GameActions,
  GameActionRunner,
} from '@server-types/index.ts';

/**
 * Mutable match-scoped reference to the active `GameActionRunner`.
 *
 * Consumers:
 * - `AwilixMatchScopeComposer` binds the runner once the scope has resolved `MatchController`.
 * - `ScopedActionService` delegates all action calls through this ref.
 *
 * Why this exists:
 * It removes per-call container lookups from `actionService.run(...)` while still letting
 * effects/reactions use a stable action-service dependency before concrete controller wiring.
 */
export class MatchActionRunnerRef {
  private runner: GameActionRunner | undefined;

  /**
   * Binds the concrete action runner for the current match scope.
   * Call this exactly once during scope composition.
   */
  public bind(runner: GameActionRunner): void {
    this.runner = runner;
  }

  /**
   * Executes a game action against the bound runner.
   *
   * Throws when called before `bind(...)` to prevent silently dropping actions.
   */
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

/**
 * Match-scoped implementation of the `ActionService` contract.
 *
 * Consumers:
 * - Card effects
 * - Reaction handlers
 * - Token handlers
 *
 * Usage:
 * Inject `ActionService` where needed; do not call `MatchController` directly from effect code.
 * This preserves a single action execution path and consistent trigger/lifecycle behavior.
 */
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
