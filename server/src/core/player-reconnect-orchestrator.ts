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
import { PromptAbortRegistry } from './undo/prompt-abort-registry.ts';

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
    private readonly promptAbortRegistry: PromptAbortRegistry,
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

      // The scene has just bound its userPrompt/selectCard listeners
      // (MatchScene binds before emitting clientReady) — replay any prompt
      // the server is still awaiting from this player so the suspended
      // action resumes instead of dangling on the dead socket's listener.
      const replayedPrompt = this.promptAbortRegistry.reattachForPlayer(playerId, socket);
      if (replayedPrompt) {
        this.loggerService.info(`[match] replayed pending prompt(s) to reconnected player ${playerId}`);
      }

      // Restore the waiting overlay when the server is waiting on someone
      // else. Mirrors promptViaSocket's fan-out rule: the overlay is only
      // shown for prompts targeting a non-current player, and never to the
      // prompted player themselves.
      const currentPlayerId = getCurrentPlayer(this.match).id;
      for (const pending of this.promptAbortRegistry.getPendingEntries()) {
        if (pending.playerId !== playerId && pending.playerId !== currentPlayerId) {
          socket.emit('waitingForPlayer', pending.playerId);
        }
      }

      // With a prompt replayed, the suspended action owns the turn flow —
      // running the auto-advance check would be re-entrant on top of it.
      if (!replayedPrompt && currentPlayerId === playerId) {
        await this.actionService.run('checkForRemainingPlayerActions');
      }
    };
    // Register readiness listener before matchReady to avoid races.
    socket.on('clientReady', onClientReady);

    // Ensure gameplay socket handlers are active immediately on reconnect,
    // using the known playerId so per-player undo events are attributed correctly.
    // Same-socket re-entry (back-button return): the match-start gameplay
    // handlers may still be bound on this socket, and bindGameplaySocketHandlers
    // stacks rather than replaces — unbind first so nextPhase and friends
    // cannot double-fire. No-op for a genuinely new socket.
    this.unbindGameplaySocketListeners(socket);
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
