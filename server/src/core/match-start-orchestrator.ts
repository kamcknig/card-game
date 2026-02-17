import {AppSocket} from '@server-types/index.ts';
import {
  MatchConfiguration,
  Player,
  PlayerId,
  ServerEmitEvents,
  ServerListenEvents,
} from 'shared/types/index.ts';
import {Server} from 'socket.io';
import {fisherYatesShuffle} from '../utils/fisher-yates-shuffler.ts';
import {LobbySocketBindings} from './lobby-socket-bindings.ts';
import {MatchController} from './match-controller.ts';

export interface MatchStartOrchestratorArgs {
  players: Player[];
  socketMap: Map<PlayerId, AppSocket>;
  matchController: MatchController;
  defaultMatchConfiguration: MatchConfiguration;
  matchConfiguration: MatchConfiguration | undefined;
  onGameOver: () => void;
  registerRemovalVoteHandler: (socket: AppSocket, playerId: PlayerId) => void;
}

// Encapsulates only the lobby->match startup pipeline.
export class MatchStartOrchestrator {
  constructor(
    private readonly _io: Server<ServerListenEvents, ServerEmitEvents>,
    private readonly _lobbySocketBindings: LobbySocketBindings,
  ) {
  }

  // Stable color assignment order used for active match players.
  private static readonly _MATCH_PLAYER_COLORS = ['#10FF19', '#3c69ff', '#FF0BF2', '#FFF114', '#FF1F11', '#FF9900'];

  // Runs start-of-match orchestration and returns finalized player order.
  public startMatch(args: MatchStartOrchestratorArgs): Player[] {
    const {
      players,
      socketMap,
      matchController,
      defaultMatchConfiguration,
      matchConfiguration,
      onGameOver,
      registerRemovalVoteHandler,
    } = args;

    // Remove lobby-only handlers before gameplay starts.
    socketMap.forEach((socket) => {
      this._lobbySocketBindings.unbindPlayerLobbyHandlers(socket);
      this._lobbySocketBindings.unbindOwnerLobbyHandlers(socket);
    });

    // Set per-match player fields, then randomize turn order.
    const activePlayers = fisherYatesShuffle(
      players
        .filter((player) => player.connected)
        .map((player, index) => {
          // Keep computer players ready so they do not block start.
          player.ready = player.isComputer;
          player.color = MatchStartOrchestrator._MATCH_PLAYER_COLORS[index];
          return player;
        }),
    );

    this._io.in('game').emit('setPlayerList', activePlayers);

    matchController.on('gameOver', onGameOver);

    // Initialize the match with current lobby config overlayed on defaults.
    void matchController.initialize(
      {
        ...structuredClone(defaultMatchConfiguration),
        ...matchConfiguration,
        players: activePlayers,
      } as MatchConfiguration,
    );

    // Register runtime-only socket handlers after match activation.
    for (const [playerId, socket] of socketMap.entries()) {
      registerRemovalVoteHandler(socket, playerId);
    }

    return activePlayers;
  }
}
