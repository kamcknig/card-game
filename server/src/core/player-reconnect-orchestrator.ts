import { AppSocket, RunGameActionDelegate } from '@server-types/index.ts';
import { Match, PlayerId } from 'shared/types/index.ts';
import jsonPatch from 'fast-json-patch';
import { getCurrentPlayer } from '../utils/get-current-player.ts';
import { getPlayerById } from '../utils/get-player-by-id.ts';
import { ExpansionSearchService } from './expansion-search-service.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { LogManager } from './log-manager.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { MatchSocketBindings } from './match-socket-bindings.ts';
import { tokenDefinitionMap } from './tokens/token-definition-map.ts';

// Owns reconnect-time socket hydration and gameplay socket binding behavior.
export class PlayerReconnectOrchestrator {
  constructor(
    private readonly _socketMap: Map<PlayerId, AppSocket>,
    private readonly _match: Match,
    private readonly _cardLibrary: MatchCardLibrary,
    private readonly _logManager: LogManager,
    private readonly _interactivityController: CardInteractivityController,
    private readonly _expansionSearchService: ExpansionSearchService,
    private readonly _matchSocketBindings: MatchSocketBindings,
    private readonly _runGameActionDelegate: RunGameActionDelegate,
  ) {}

  // Binds gameplay-phase socket handlers for a connected socket.
  public bindGameplaySocketListeners(socket: AppSocket) {
    this._matchSocketBindings.bindGameplaySocketHandlers(socket, {
      onNextPhase: async () => await this.onNextPhase(),
      onSearchCards: (playerId, searchStr) => this.onSearchCards(playerId, searchStr),
      onExchangeCoffer: async (playerId, count) => {
        await this._runGameActionDelegate('exchangeCoffer', { playerId, count });
      },
      onSpendVillager: async (playerId, count) => {
        await this._runGameActionDelegate('spendVillager', { playerId, count });
      },
      onPayDebt: async (playerId, count) => {
        await this._runGameActionDelegate('payDebt', { playerId, count });
      },
    });
  }

  // Rehydrates a reconnecting client and resumes turn flow when appropriate.
  public playerReconnected(playerId: PlayerId, socket: AppSocket) {
    console.info(`[match] player ${playerId} reconnecting`);
    this._socketMap.set(playerId, socket);

    // Send current match/card state only to the reconnecting player.
    const matchPatch = jsonPatch.compare({} as Match, this._match);
    const cardLibraryPatch = jsonPatch.compare({}, this._cardLibrary.getAllCards());
    socket.emit('patchUpdate', matchPatch, cardLibraryPatch);

    socket.emit('setCardLibrary', this._cardLibrary.getAllCards());
    socket.emit('setTokenDefinitions', tokenDefinitionMap);
    socket.emit('matchReady');

    // Rehydrate log history after reconnect so the client can rebuild the UI log.
    const logHistory = this._logManager.getHistory();
    if (logHistory.length > 0) {
      socket.emit('addLogEntry', logHistory);
    }

    socket.on('clientReady', async (_playerId: number, _ready: boolean) => {
      console.info(`[match] ${getPlayerById(this._match, playerId)} marked ready`);
      socket.emit('matchStarted');
      socket.off('clientReady');

      this.bindGameplaySocketListeners(socket);
      this._interactivityController.playerAdded(socket);

      if (getCurrentPlayer(this._match).id === playerId) {
        await this._runGameActionDelegate('checkForRemainingPlayerActions');
      }
    });
  }

  private async onNextPhase() {
    await this._runGameActionDelegate('nextPhase');
    this._socketMap.forEach((socket) => socket.emit('nextPhaseComplete'));
  }

  private onSearchCards(playerId: PlayerId, searchStr: string) {
    console.debug(`[match] ${getPlayerById(this._match, playerId)} searching for cards using term '${searchStr}'`);
    this._socketMap.get(playerId)?.emit(
      'searchCardResponse',
      this._expansionSearchService.searchKingdomCards(searchStr),
    );
  }
}
