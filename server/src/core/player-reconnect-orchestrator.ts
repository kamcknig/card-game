import { ActionService, AppSocket } from '@server-types/index.ts';
import { Match, PlayerId } from 'shared/types/index.ts';
import jsonPatch from 'fast-json-patch';
import { getCurrentPlayer } from '../utils/get-current-player.ts';
import { getPlayerById } from '../utils/get-player-by-id.ts';
import { ExpansionSearchService } from './expansion-search-service.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { LogManager } from './log-manager.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { MatchSocketBindings } from './match-socket-bindings.ts';
import { TokenRegistryService } from './tokens/token-registry-service.ts';
import { LoggerService } from './logger-service.ts';
import { MatchUndoVoteService } from './undo/match-undo-vote-service.ts';

/**
 * Owns reconnect-time socket hydration and gameplay socket binding behavior.
 * Also injects MatchUndoVoteService to supply per-player undo socket handlers
 * when binding gameplay listeners on match start and reconnect.
 */
export class PlayerReconnectOrchestrator {
  constructor(
    private readonly socketMap: Map<PlayerId, AppSocket>,
    private readonly match: Match,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly logManager: LogManager,
    private readonly interactivityController: CardInteractivityController,
    private readonly expansionSearchService: ExpansionSearchService,
    private readonly matchSocketBindings: MatchSocketBindings,
    private readonly actionService: ActionService,
    private readonly tokenRegistryService: TokenRegistryService,
    private readonly loggerService: LoggerService,
    private readonly undoVoteService: MatchUndoVoteService,
  ) {}

  /**
   * Binds gameplay-phase socket handlers for one connected player socket.
   * The playerId parameter identifies which player owns this socket so that
   * undo and other per-player events can be attributed correctly.
   * Called at match start for every socket and on reconnect for the
   * rejoining player.
   */
  public bindGameplaySocketListeners(socket: AppSocket, playerId: PlayerId) {
    this.matchSocketBindings.bindGameplaySocketHandlers(socket, {
      onNextPhase: async () => await this.onNextPhase(),
      // Attribute to the socket's bound player; never trust the payload id.
      onSearchCards: (_pid, searchStr) => this.onSearchCards(playerId, searchStr),
      onExchangeCoffer: async (_pid, count) => {
        // Attribute to the socket's bound player; never trust the payload id.
        await this.actionService.run('exchangeCoffer', { playerId, count });
      },
      onSpendVillager: async (_pid, count) => {
        await this.actionService.run('spendVillager', { playerId, count });
      },
      onPayDebt: async (_pid, count) => {
        await this.actionService.run('payDebt', { playerId, count });
      },
      onUndoRequested: () => {
        void this.undoVoteService.requestUndo(playerId);
      },
      onUndoVote: (allow: boolean) => {
        void this.undoVoteService.registerVote(playerId, allow);
      },
      onUndoCancelled: () => {
        this.undoVoteService.cancelByOriginator(playerId);
      },
    });
  }

  /**
   * Removes gameplay-phase socket handlers when a player leaves the active
   * match or their socket is being cleaned up.
   */
  public unbindGameplaySocketListeners(socket?: AppSocket) {
    this.matchSocketBindings.unbindGameplaySocketHandlers(socket);
  }

  // Rehydrates a reconnecting client and resumes turn flow when appropriate.
  public playerReconnected(playerId: PlayerId, socket: AppSocket) {
    this.loggerService.info(`[match] player ${playerId} reconnecting`);
    this.socketMap.set(playerId, socket);

    const onClientReady = async (_playerId: number, _ready: boolean) => {
      this.loggerService.info(`[match] ${getPlayerById(this.match, playerId)} marked ready`);
      socket.emit('matchStarted');
      socket.off('clientReady', onClientReady);

      if (getCurrentPlayer(this.match).id === playerId) {
        await this.actionService.run('checkForRemainingPlayerActions');
      }
    };
    // Register readiness listener before matchReady to avoid races.
    socket.on('clientReady', onClientReady);

    // Ensure gameplay socket handlers are active immediately on reconnect,
    // using the known playerId so per-player undo events are attributed correctly.
    this.bindGameplaySocketListeners(socket, playerId);
    this.interactivityController.playerAdded(socket);

    // Send current match/card state only to the reconnecting player.
    const matchPatch = jsonPatch.compare({} as Match, this.match);
    const cardLibraryPatch = jsonPatch.compare({}, this.cardLibrary.getAllCards());
    socket.emit('patchUpdate', matchPatch, cardLibraryPatch);

    socket.emit('setCardLibrary', this.cardLibrary.getAllCards());
    socket.emit('setTokenDefinitions', this.tokenRegistryService.getTokenDefinitions());
    socket.emit('matchReady');

    // Rehydrate log history after reconnect so the client can rebuild the UI log.
    const logHistory = this.logManager.getHistory();
    if (logHistory.length > 0) {
      socket.emit('addLogEntry', logHistory);
    }
  }

  private async onNextPhase() {
    await this.actionService.run('nextPhase');
    this.socketMap.forEach(socket => socket.emit('nextPhaseComplete'));
  }

  private onSearchCards(playerId: PlayerId, searchStr: string) {
    this.loggerService.debug(
      `[match] ${getPlayerById(this.match, playerId)} searching for cards using term '${searchStr}'`,
    );
    this.socketMap.get(playerId)?.emit('searchCardResponse', this.expansionSearchService.searchKingdomCards(searchStr));
  }
}
