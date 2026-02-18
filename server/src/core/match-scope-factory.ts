import { AppSocket } from '@server-types/index.ts';
import { Match, PlayerId } from 'shared/types/index.ts';
import { MatchConfiguratorFactory } from './match-configurator-factory.ts';
import { MatchController } from './match-controller.ts';
import { createInitialMatchState } from './match-state-factory.ts';

/**
 * Runtime handle for one active match scope.
 *
 * - `matchController` drives match lifecycle and action execution.
 * - `dispose` releases scope-owned resources when the match ends/resets.
 */
export interface MatchScope {
  matchController: MatchController;
  dispose: () => void;
}

/**
 * Inputs required to compose one isolated match scope.
 */
export interface MatchScopeComposerArgs {
  socketMap: Map<PlayerId, AppSocket>;
  match: Match;
  matchScopeId: number;
  matchConfiguratorFactory: MatchConfiguratorFactory;
}

/**
 * Abstraction over the concrete DI/container implementation used to build match scopes.
 *
 * Implementations may use Awilix, a test double, or any other composition strategy.
 */
export interface MatchScopeComposer {
  create(args: MatchScopeComposerArgs): MatchScope;
}

/**
 * Creates match scopes without exposing container-specific APIs to game core code.
 *
 * Usage:
 * - Inject into game/session orchestration code.
 * - Call `create(socketMap)` per match start.
 * - Hold and dispose the returned `MatchScope` at match teardown.
 */
export class MatchScopeFactory {
  private nextMatchScopeId = 1;

  constructor(
    private readonly matchScopeComposer: MatchScopeComposer,
    private readonly matchConfiguratorFactory: MatchConfiguratorFactory,
  ) {
  }

  public create(socketMap: Map<PlayerId, AppSocket>): MatchScope {
    return this.matchScopeComposer.create({
      socketMap,
      match: createInitialMatchState(),
      matchScopeId: this.nextMatchScopeId++,
      matchConfiguratorFactory: this.matchConfiguratorFactory,
    });
  }
}
