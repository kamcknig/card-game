import { AppSocket } from '@server-types/index.ts';
import { Match, PlayerId } from 'shared/types/index.ts';
import { MatchConfiguratorFactory } from './match-configurator-factory.ts';
import { MatchController } from './match-controller.ts';
import { createInitialMatchState } from './match-state-factory.ts';

export interface MatchScope {
  matchController: MatchController;
  dispose: () => void;
}

export interface MatchScopeComposerArgs {
  socketMap: Map<PlayerId, AppSocket>;
  match: Match;
  matchScopeId: number;
  matchConfiguratorFactory: MatchConfiguratorFactory;
}

export interface MatchScopeComposer {
  create(args: MatchScopeComposerArgs): MatchScope;
}

// Builds the per-match scope and resolves match-lifetime services/controllers.
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
