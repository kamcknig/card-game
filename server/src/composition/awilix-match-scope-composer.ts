import { AwilixContainer } from 'awilix';
import { MatchScope, MatchScopeComposer, MatchScopeComposerArgs } from '../core/match-scope-factory.ts';
import { MatchController } from '../core/match-controller.ts';
import { MatchActionRunnerRef } from '../core/actions/scoped-action-service.ts';
import { ExpansionEffectRegistryService } from '../core/expansion-effect-registry-service.ts';
import { registerMatchScopeServices } from './register-match-scope-services.ts';

/**
 * Awilix-backed implementation of `MatchScopeComposer`.
 *
 * Responsibilities:
 * - Create a child container for each match.
 * - Register all match-scoped services/runtime maps.
 * - Resolve and wire the `MatchController` + `ActionService` runner bridge.
 * - Return a disposable `MatchScope` handle.
 *
 * This class is the only place in the match pipeline that knows about Awilix scope mechanics.
 * Core factories consume the `MatchScopeComposer` abstraction instead.
 */
export class AwilixMatchScopeComposer implements MatchScopeComposer {
  constructor(
    private readonly rootContainer: AwilixContainer,
    private readonly expansionEffectRegistryService: ExpansionEffectRegistryService,
  ) {
  }

  public create(args: MatchScopeComposerArgs): MatchScope {
    // Scope owns match-lifetime dependencies and instances.
    const scope = this.rootContainer.createScope();

    registerMatchScopeServices(scope, {
      ...args,
      expansionEffectRegistryService: this.expansionEffectRegistryService,
    });

    const matchController = scope.resolve<MatchController>('matchController');
    const matchActionRunnerRef = scope.resolve<MatchActionRunnerRef>('matchActionRunnerRef');

    // Bind action-service calls to this match controller once the graph is fully resolved.
    matchActionRunnerRef.bind(matchController.runGameAction.bind(matchController));

    return {
      matchController,
      dispose: () => {
        // Dispose registered resources in this match scope when the match ends/resets.
        void scope.dispose();
      },
    };
  }
}
