import type { AppSocket } from '@server-types/index.ts';
import type {
  Card,
  CardId,
  ExpansionListElement,
  Match,
  MatchConfiguration,
  PlayerId,
  ServerEmitEvents,
  ServerListenEvents,
} from 'shared/types/index.ts';
import { Server } from 'socket.io';
import { MatchScopeFactory } from './match-scope-factory.ts';
import { GameConfigurationStore } from './game-configuration-store.ts';
import { ExpansionSearchService } from './expansion-search-service.ts';
import { MatchStartOrchestrator } from './match-start-orchestrator.ts';
import { DisconnectedPlayerVoteService } from './disconnected-player-vote-service.ts';
import { LoggerService } from './logger-service.ts';
import type { GameRuntimeState } from './game-runtime-state.ts';

export interface StartMatchArgs {
  defaultMatchConfiguration: MatchConfiguration;
  onGameOver: () => void;
  registerRemovalVoteHandler: (socket: AppSocket, playerId: PlayerId) => void;
}

// Coordinates match lifecycle and startup transitions for the game.
export class GameMatchLifecycleCoordinatorService {
  constructor(
    private readonly io: Server<ServerListenEvents, ServerEmitEvents>,
    private readonly matchScopeFactory: MatchScopeFactory,
    private readonly configStore: GameConfigurationStore,
    private readonly expansionSearchService: ExpansionSearchService,
    private readonly matchStartOrchestrator: MatchStartOrchestrator,
    private readonly disconnectedPlayerVoteService: DisconnectedPlayerVoteService,
    private readonly loggerService: LoggerService,
  ) {
  }

  // Loads persisted config, rebuilds search indexes, and creates the first match runtime.
  public initialize(state: GameRuntimeState, defaultMatchConfiguration: MatchConfiguration): void {
    this.loggerService.info('[game] loading persisted lobby configuration');
    this.createNewMatch(state, defaultMatchConfiguration);
    this.configStore.load(defaultMatchConfiguration);
    state.matchConfiguration = { ...structuredClone(defaultMatchConfiguration) };
    this.expansionSearchService.rebuildIndexes();
  }

  // Creates a fresh match scope/controller and resets working lobby configuration.
  public createNewMatch(state: GameRuntimeState, defaultMatchConfiguration: MatchConfiguration): void {
    state.matchScope?.dispose();
    state.matchScope = this.matchScopeFactory.create({
      socketMap: state.socketMap,
      gameId: state.gameId,
    });
    state.matchScopeId = state.matchScope.matchScopeId;
    this.configStore.setMatchScopeId(state.matchScopeId);
    this.loggerService.info(
      `[game] created match scope ${state.matchScopeId} for game '${state.gameId}'`,
    );
    state.matchController = state.matchScope.matchController;
    state.matchConfiguration = { ...structuredClone(defaultMatchConfiguration) };
  }

  // Applies expansion-loaded side effects to runtime availability and search indexes.
  public expansionLoaded(state: GameRuntimeState, expansion: ExpansionListElement): void {
    const alreadyAvailable = state.availableExpansion.some(
      (availableExpansion) => availableExpansion.name === expansion.name,
    );
    if (alreadyAvailable) {
      this.loggerService.debug(
        `[game] expansion '${expansion.name}' already available for game '${state.gameId}', skipping duplicate`,
      );
      return;
    }

    this.loggerService.log(`[game] expansion '${expansion.name}' loaded`);
    state.availableExpansion.push(expansion);
    this.io.in(state.roomName).emit(
      'expansionList',
      state.availableExpansion.sort((a, b) => b.order - a.order),
    );
    this.expansionSearchService.rebuildIndexes();
  }

  // Exports the current match state snapshot used by local debug tooling.
  public exportMatchState(state: GameRuntimeState): { match: Match; cardLibrary: Record<CardId, Card> } | null {
    if (!state.matchController) {
      return null;
    }
    return state.matchController.exportMatchState();
  }

  // Applies a partial match patch onto the live runtime match state.
  public mergeMatchState(
    state: GameRuntimeState,
    partial: Partial<Match>,
  ): { ok: boolean; errors?: string[] } {
    if (!state.matchController) {
      return { ok: false, errors: ['match not initialized'] };
    }
    return state.matchController.applyPartialMatchUpdate(partial);
  }

  // Disposes only match-lifetime resources without touching lobby players/sockets.
  public dispose(state: GameRuntimeState): void {
    state.matchScope?.dispose();
    state.matchScope = undefined;
    state.matchScopeId = undefined;
  }

  // Clears all lobby+match runtime state and returns to a fresh lobby.
  public clearMatch(state: GameRuntimeState, defaultMatchConfiguration: MatchConfiguration): void {
    this.loggerService.log('[game] clearing match');

    state.socketMap.forEach((socket) => {
      socket.offAnyIncoming();
      socket.leave(state.roomName);
    });

    state.socketMap.clear();
    state.players = [];
    state.owner = undefined;
    state.matchStarted = false;
    this.disconnectedPlayerVoteService.reset();
    this.createNewMatch(state, defaultMatchConfiguration);
  }

  // Starts gameplay once lobby players are ready and initializes the match controller.
  public startMatch(state: GameRuntimeState, args: StartMatchArgs): void {
    this.loggerService.log('[game] all connected players ready, proceeding to start match');

    state.matchStarted = true;
    if (!state.matchController) {
      this.loggerService.warn('[game] cannot start match without match controller');
      return;
    }

    state.players = this.matchStartOrchestrator.startMatch({
      gameRoomName: state.roomName,
      players: state.players,
      socketMap: state.socketMap,
      matchController: state.matchController,
      defaultMatchConfiguration: args.defaultMatchConfiguration,
      matchConfiguration: state.matchConfiguration,
      onGameOver: args.onGameOver,
      registerRemovalVoteHandler: args.registerRemovalVoteHandler,
    });
  }
}
