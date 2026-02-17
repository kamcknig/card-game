import { AppSocket } from '@server-types/index.ts';
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
import { RuntimeActionGateway } from './runtime-action-gateway.ts';

// Owns reconnect-time socket hydration and gameplay socket binding behavior.
export class PlayerReconnectOrchestrator {
  constructor(
    private readonly socketMap: Map<PlayerId, AppSocket>,
    private readonly match: Match,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly logManager: LogManager,
    private readonly interactivityController: CardInteractivityController,
    private readonly expansionSearchService: ExpansionSearchService,
    private readonly matchSocketBindings: MatchSocketBindings,
    private readonly runtimeActionGateway: RuntimeActionGateway,
  ) {}

  // Binds gameplay-phase socket handlers for a connected socket.
  public bindGameplaySocketListeners(socket: AppSocket) {
    this.matchSocketBindings.bindGameplaySocketHandlers(socket, {
      onNextPhase: async () => await this.onNextPhase(),
      onSearchCards: (playerId, searchStr) => this.onSearchCards(playerId, searchStr),
      onExchangeCoffer: async (playerId, count) => {
        await this.runtimeActionGateway.run('exchangeCoffer', { playerId, count });
      },
      onSpendVillager: async (playerId, count) => {
        await this.runtimeActionGateway.run('spendVillager', { playerId, count });
      },
      onPayDebt: async (playerId, count) => {
        await this.runtimeActionGateway.run('payDebt', { playerId, count });
      },
    });
  }

  // Rehydrates a reconnecting client and resumes turn flow when appropriate.
  public playerReconnected(playerId: PlayerId, socket: AppSocket) {
    console.info(`[match] player ${playerId} reconnecting`);
    this.socketMap.set(playerId, socket);

    // Send current match/card state only to the reconnecting player.
    const matchPatch = jsonPatch.compare({} as Match, this.match);
    const cardLibraryPatch = jsonPatch.compare({}, this.cardLibrary.getAllCards());
    socket.emit('patchUpdate', matchPatch, cardLibraryPatch);

    socket.emit('setCardLibrary', this.cardLibrary.getAllCards());
    socket.emit('setTokenDefinitions', tokenDefinitionMap);
    socket.emit('matchReady');

    // Rehydrate log history after reconnect so the client can rebuild the UI log.
    const logHistory = this.logManager.getHistory();
    if (logHistory.length > 0) {
      socket.emit('addLogEntry', logHistory);
    }

    socket.on('clientReady', async (_playerId: number, _ready: boolean) => {
      console.info(`[match] ${getPlayerById(this.match, playerId)} marked ready`);
      socket.emit('matchStarted');
      socket.off('clientReady');

      this.bindGameplaySocketListeners(socket);
      this.interactivityController.playerAdded(socket);

      if (getCurrentPlayer(this.match).id === playerId) {
        await this.runtimeActionGateway.run('checkForRemainingPlayerActions');
      }
    });
  }

  private async onNextPhase() {
    await this.runtimeActionGateway.run('nextPhase');
    this.socketMap.forEach((socket) => socket.emit('nextPhaseComplete'));
  }

  private onSearchCards(playerId: PlayerId, searchStr: string) {
    console.debug(`[match] ${getPlayerById(this.match, playerId)} searching for cards using term '${searchStr}'`);
    this.socketMap.get(playerId)?.emit(
      'searchCardResponse',
      this.expansionSearchService.searchKingdomCards(searchStr),
    );
  }
}
