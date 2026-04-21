import type { AppSocket } from '@server-types/index.ts';
import type { MatchConfiguration, PlayerId, ServerEmitEvents, ServerListenEvents } from 'shared/types/index.ts';
import { Server } from 'socket.io';
import { LobbySocketBindings } from './lobby-socket-bindings.ts';
import { ExpansionSearchService } from './expansion-search-service.ts';
import { DisconnectedPlayerVoteService } from './disconnected-player-vote-service.ts';
import { PlayerSessionService } from './player-session-service.ts';
import { PlayerRegistryService } from './player-registry-service.ts';
import { PlayerFactoryService } from './player-factory-service.ts';
import type { GameRuntimeState } from './game-runtime-state.ts';
import { LoggerService } from './logger-service.ts';
import { ServerConfigService } from './server-config-service.ts';

export interface GameLobbyCallbacks {
  onStartMatch: () => void;
  onClearMatch: () => void;
  onMatchConfigurationUpdated: (newConfig: MatchConfiguration) => void | Promise<void>;
  onCheckMatchConfigurationSaveName: (playerId: PlayerId, name: string) => void;
  onSaveMatchConfiguration: (playerId: PlayerId, name: string) => void;
  onRequestSavedMatchConfigurationList: (playerId: PlayerId) => void;
  onLoadSavedMatchConfiguration: (playerId: PlayerId, key: string) => void | Promise<void>;
  onDeleteSavedMatchConfiguration: (playerId: PlayerId, key: string) => void;
  // Notifies outer orchestrators that game state changed (players/owner/match status).
  onGameStateChanged?: () => void;
  // Called by the coordinator when the owner requests restart from post-game phase.
  onRestartMatch?: () => void;
  // Called by the coordinator when the owner requests edit from post-game phase.
  onEditMatch?: () => void;
}

export type AddPlayerResult =
  | { status: 'accepted'; playerId: PlayerId }
  | { status: 'rejected_capacity' }
  | { status: 'rejected_started' };

export type RemoveLobbyPlayerResult =
  | { status: 'removed'; playerId: PlayerId; sessionId: string; socketId: string }
  | { status: 'not_found' }
  | { status: 'match_started' };

// Coordinates lobby/session events such as join/disconnect/readiness/owner actions.
export class GameLobbySessionCoordinatorService {
  // Shared lobby room name for returning resigned players to lobby updates.
  private static readonly LOBBY_ROOM_NAME = 'lobby';
  // Tracks per-socket runtime handlers so re-joins replace handlers instead of stacking duplicates.
  private readonly runtimeSocketHandlersBySocketId = new Map<
    string,
    {
      disconnect: (disconnectReason: unknown) => void;
      resignMatch: () => void;
    }
  >();

  constructor(
    private readonly io: Server<ServerListenEvents, ServerEmitEvents>,
    private readonly maxPlayers: number,
    private readonly lobbySocketBindings: LobbySocketBindings,
    private readonly expansionSearchService: ExpansionSearchService,
    private readonly disconnectedPlayerVoteService: DisconnectedPlayerVoteService,
    private readonly playerSessionService: PlayerSessionService,
    private readonly playerRegistryService: PlayerRegistryService,
    private readonly playerFactoryService: PlayerFactoryService,
    private readonly loggerService: LoggerService,
    private readonly serverConfigService: ServerConfigService,
  ) {}

  // Handles a player socket joining/rejoining the lobby or active match.
  // The username is forwarded to player creation so new players get their auth display name.
  public addPlayer(
    state: GameRuntimeState,
    args: {
      sessionId: string;
      socket: AppSocket;
      username: string;
      callbacks: GameLobbyCallbacks;
      registerRemovalVoteHandler: (socket: AppSocket, playerId: PlayerId) => void;
    },
  ): AddPlayerResult {
    const { sessionId, socket, username, callbacks, registerRemovalVoteHandler } = args;

    const joinResult = this.playerRegistryService.registerPlayerJoin({
      players: state.players,
      sessionId,
      socket,
      matchStarted: state.matchStarted,
      username,
    });

    if (joinResult.status === 'rejected_capacity') {
      this.loggerService.info(`[game] game has ${this.maxPlayers} players, rejecting`);
      return { status: 'rejected_capacity' };
    }

    if (joinResult.status === 'rejected_started') {
      this.loggerService.info('[game] match has already started, and player not found in game, rejecting');
      return { status: 'rejected_started' };
    }

    const player = joinResult.player;
    if (!joinResult.created) {
      this.loggerService.info(`[game] ${player} already in match - assigning socket ID`);
    }

    socket.join(state.roomName);
    player.connected = true;
    state.socketMap.set(player.id, socket);
    // Re-joins can occur for the same socket/session while UI retries requests.
    // Clear previously bound lobby handlers before rebinding to prevent duplicates.
    this.lobbySocketBindings.unbindPlayerLobbyHandlers(socket);
    this.lobbySocketBindings.unbindOwnerLobbyHandlers(socket);

    socket.emit('setPlayerList', state.players);
    this.io.in(state.roomName).emit('playerConnected', player);
    socket.emit('setPlayer', player);

    const nextOwner = this.playerSessionService.selectOwnerOnJoin(state.owner, player);
    if (nextOwner.id !== state.owner?.id) {
      this.loggerService.info(`[game] game owner does not exist, setting to ${nextOwner}`);
    }
    state.owner = nextOwner;

    if (state.owner?.id === player.id) {
      this.bindOwnerLobbyHandlers(state, player.id, socket, callbacks);
    }

    this.io.in(state.roomName).emit('gameOwnerUpdated', state.owner.id);
    this.loggerService.log(`[game] ${player} added to game`);

    if (state.matchStarted) {
      this.loggerService.info('[game] game already started');
      socket.emit('setPlayerList', state.players);
      this.disconnectedPlayerVoteService.removePendingRemovalPlayer(state.players, player.id);
      state.matchController?.playerReconnected(player.id, socket);
      registerRemovalVoteHandler(socket, player.id);
      const hasDisconnectedHuman = this.playerSessionService.hasDisconnectedHumanPlayers(state.players);
      if (!hasDisconnectedHuman) {
        void state.matchController?.runGameAction('checkForRemainingPlayerActions');
      }
    } else {
      this.loggerService.info('[game] not yet started, sending player to match configuration');
      socket.emit(
        'expansionList',
        state.availableExpansion.sort((a, b) => a.order - b.order),
      );
      socket.emit('matchConfigurationUpdated', state.matchConfiguration!);
      this.lobbySocketBindings.bindPlayerLobbyHandlers(socket, {
        onUpdatePlayerName: (playerId, name) => this.onUpdatePlayerName(state, playerId, name),
        onPlayerReady: (playerId, ready) =>
          this.onPlayerReady(state, playerId, ready, callbacks.onStartMatch, socket.id),
      });
    }

    this.bindRuntimeSocketHandlers(state, player.id, socket, callbacks);

    callbacks.onGameStateChanged?.();
    return { status: 'accepted', playerId: player.id };
  }

  // Binds per-socket runtime handlers, replacing previous bindings for this socket.
  private bindRuntimeSocketHandlers(
    state: GameRuntimeState,
    playerId: PlayerId,
    socket: AppSocket,
    callbacks: GameLobbyCallbacks,
  ): void {
    const existingHandlers = this.runtimeSocketHandlersBySocketId.get(socket.id);
    if (existingHandlers) {
      socket.off('disconnect', existingHandlers.disconnect);
      socket.off('resignMatch', existingHandlers.resignMatch);
    }

    const disconnectHandler = (disconnectReason: unknown) => {
      this.onPlayerDisconnected(state, {
        playerId,
        socketId: socket.id,
        reason: String(disconnectReason),
        callbacks,
      });
      this.runtimeSocketHandlersBySocketId.delete(socket.id);
    };

    const resignMatchHandler = () => {
      this.onPlayerResigned(state, {
        playerId,
        socketId: socket.id,
        callbacks,
      });
    };

    socket.on('disconnect', disconnectHandler);
    socket.on('resignMatch', resignMatchHandler);
    this.runtimeSocketHandlersBySocketId.set(socket.id, {
      disconnect: disconnectHandler,
      resignMatch: resignMatchHandler,
    });
  }

  // Removes runtime handlers for one socket when the player leaves this game context.
  private unbindRuntimeSocketHandlers(socket: AppSocket): void {
    const existingHandlers = this.runtimeSocketHandlersBySocketId.get(socket.id);
    if (!existingHandlers) {
      return;
    }

    socket.off('disconnect', existingHandlers.disconnect);
    socket.off('resignMatch', existingHandlers.resignMatch);
    this.runtimeSocketHandlersBySocketId.delete(socket.id);
  }

  // Handles socket disconnect behavior for lobby and active-match contexts.
  public onPlayerDisconnected(
    state: GameRuntimeState,
    args: {
      playerId: PlayerId;
      socketId: string;
      reason: string;
      callbacks: GameLobbyCallbacks;
    },
  ): void {
    const { playerId, socketId, reason, callbacks } = args;
    this.loggerService.info(`[game] ${playerId} disconnected - ${reason}`);

    const activePlayer = state.players.find(candidate => candidate.id === playerId);
    if (activePlayer && activePlayer.socketId !== socketId) {
      this.loggerService.debug(
        `[game] ignoring disconnect from stale socket ${socketId} for ${activePlayer}; active socket is ${activePlayer.socketId}`,
      );
      return;
    }

    const player = this.playerRegistryService.markPlayerDisconnected(state.players, playerId);
    if (!player) {
      state.socketMap.delete(playerId);
      this.loggerService.warn('[game] player disconnected, but cannot find player object');
      return;
    }

    const hasConnectedHuman = this.playerSessionService.hasConnectedHumanPlayers(state.players);
    if (!hasConnectedHuman && this.serverConfigService.shouldEndMatchOnNoHumans()) {
      this.loggerService.log('[game] no human players left in game, clearing game state completely');
      callbacks.onClearMatch();
      return;
    }

    if (player.id === state.owner?.id) {
      this.lobbySocketBindings.unbindOwnerLobbyHandlers(state.socketMap.get(player.id));
      const replacement = this.playerSessionService.findReplacementOwner(state.players, player.id);
      if (replacement) {
        state.owner = replacement;
        this.io.in(state.roomName).emit('gameOwnerUpdated', replacement.id);
        const replacementSocket = state.socketMap.get(replacement.id);
        if (replacementSocket) {
          this.bindOwnerLobbyHandlers(state, replacement.id, replacementSocket, callbacks);
        }
      }
    }

    if (state.matchStarted) {
      state.matchController?.playerDisconnected(player.id);
      if (!player.isComputer) {
        this.disconnectedPlayerVoteService.addPendingRemovalPlayer(state.players, player.id);
      }
    }

    this.io.in(state.roomName).emit('playerDisconnected', player);
    callbacks.onGameStateChanged?.();
  }

  // Handles voluntary resignations from active human players and keeps the match running.
  public onPlayerResigned(
    state: GameRuntimeState,
    args: {
      playerId: PlayerId;
      socketId: string;
      callbacks: GameLobbyCallbacks;
    },
  ): void {
    const { playerId, socketId, callbacks } = args;
    if (!state.matchStarted) {
      this.loggerService.warn(`[game] ignoring resign from ${playerId}; match not started`);
      return;
    }

    const activePlayer = state.players.find(candidate => candidate.id === playerId);
    if (activePlayer && activePlayer.socketId !== socketId) {
      this.loggerService.debug(
        `[game] ignoring resign from stale socket ${socketId} for ${activePlayer}; active socket is ${activePlayer.socketId}`,
      );
      return;
    }

    const player = state.players.find(candidate => candidate.id === playerId);
    if (!player) {
      this.loggerService.warn(`[game] resign requested by unknown player ${playerId}`);
      return;
    }

    if (player.isComputer) {
      this.loggerService.warn(`[game] ignoring resign from computer player ${playerId}`);
      return;
    }

    this.loggerService.log(`[game] ${player} resigned from active match`);

    state.matchController?.logPlayerLeft(player.id);

    const socket = state.socketMap.get(player.id);
    if (socket) {
      // Remove gameplay listeners first so any in-flight client events from the old match are ignored.
      state.matchController?.detachPlayerGameplaySocketListeners(player.id);
      this.unbindRuntimeSocketHandlers(socket);
      this.lobbySocketBindings.unbindPlayerLobbyHandlers(socket);
      this.lobbySocketBindings.unbindOwnerLobbyHandlers(socket);
      socket.leave(state.roomName);
      socket.join(GameLobbySessionCoordinatorService.LOBBY_ROOM_NAME);
      socket.emit('kickedFromGame', {
        gameId: state.gameId,
        message: 'You resigned and left the game.',
      });
    }

    state.socketMap.delete(player.id);
    player.connected = false;
    player.ready = false;

    state.players = state.players.filter(nextPlayer => nextPlayer.id !== player.id);
    state.matchController?.removePlayerFromMatch(player.id);

    this.io.in(state.roomName).emit('setPlayerList', state.players);
    this.io.in(state.roomName).emit('playerDisconnected', player);

    if (state.owner?.id === player.id) {
      const replacement = this.playerSessionService.findReplacementOwner(state.players, player.id);
      state.owner = replacement;
      if (replacement) {
        this.io.in(state.roomName).emit('gameOwnerUpdated', replacement.id);
      }
    }

    this.disconnectedPlayerVoteService.removePendingRemovalPlayer(state.players, player.id);

    const hasConnectedHuman = this.playerSessionService.hasConnectedHumanPlayers(state.players);
    if (!hasConnectedHuman && this.serverConfigService.shouldEndMatchOnNoHumans()) {
      this.loggerService.log('[game] no human players left after resignation, clearing game state completely');
      callbacks.onClearMatch();
      return;
    }

    if (state.players.length > 0) {
      void state.matchController?.runGameAction('checkForRemainingPlayerActions');
    }

    callbacks.onGameStateChanged?.();
  }

  // Handles owner votes to remove disconnected players after consensus.
  public onRemoveDisconnectedPlayerVote(state: GameRuntimeState, voterId: PlayerId, targetPlayerId: PlayerId): void {
    if (!state.matchStarted) return;
    if (this.disconnectedPlayerVoteService.getPendingRemovalPlayerId() !== targetPlayerId) return;

    const voteResult = this.disconnectedPlayerVoteService.registerRemovalVote(state.players, voterId, targetPlayerId);
    if (!voteResult.accepted || !voteResult.allVoted) return;

    state.players = state.players.filter(player => player.id !== targetPlayerId);
    state.socketMap.delete(targetPlayerId);
    state.matchController?.removePlayerFromMatch(targetPlayerId);
    this.io.in(state.roomName).emit('setPlayerList', state.players);

    if (state.owner?.id === targetPlayerId) {
      const replacement = this.playerSessionService.findReplacementOwner(state.players, targetPlayerId);
      if (replacement) {
        state.owner = replacement;
        this.io.in(state.roomName).emit('gameOwnerUpdated', replacement.id);
      }
    }

    this.disconnectedPlayerVoteService.removePendingRemovalPlayer(state.players, targetPlayerId);
    void state.matchController?.runGameAction('checkForRemainingPlayerActions');
  }

  // Removes a player from a lobby game before match start (leave/kick/ban flow).
  public removePlayerFromLobby(
    state: GameRuntimeState,
    args: { playerId: PlayerId; callbacks: GameLobbyCallbacks },
  ): RemoveLobbyPlayerResult {
    const { playerId, callbacks } = args;
    this.loggerService.info(`[game] removing lobby player ${playerId}`);
    if (state.matchStarted) {
      this.loggerService.warn(`[game] cannot remove player ${playerId} from lobby after match start`);
      return { status: 'match_started' };
    }

    const player = state.players.find(nextPlayer => nextPlayer.id === playerId);
    if (!player) {
      this.loggerService.warn(`[game] cannot remove player ${playerId}; player not found`);
      return { status: 'not_found' };
    }

    const socket = state.socketMap.get(player.id);
    if (socket) {
      this.unbindRuntimeSocketHandlers(socket);
      this.lobbySocketBindings.unbindPlayerLobbyHandlers(socket);
      this.lobbySocketBindings.unbindOwnerLobbyHandlers(socket);
      socket.leave(state.roomName);
    }

    state.socketMap.delete(player.id);
    state.players = state.players.filter(nextPlayer => nextPlayer.id !== player.id);
    player.connected = false;
    player.ready = false;

    if (state.owner?.id === player.id) {
      const replacement = this.playerSessionService.findReplacementOwner(state.players, player.id);
      if (replacement) {
        state.owner = replacement;
        this.io.in(state.roomName).emit('gameOwnerUpdated', replacement.id);
        const replacementSocket = state.socketMap.get(replacement.id);
        if (replacementSocket) {
          this.bindOwnerLobbyHandlers(state, replacement.id, replacementSocket, callbacks);
        }
      } else {
        state.owner = undefined;
      }
    }

    this.io.in(state.roomName).emit('setPlayerList', state.players);
    this.io.in(state.roomName).emit('playerDisconnected', player);
    this.loggerService.info(`[game] removed ${player} from lobby game`);
    callbacks.onGameStateChanged?.();

    return {
      status: 'removed',
      playerId: player.id,
      sessionId: player.sessionId,
      socketId: player.socketId,
    };
  }

  // Handles lobby display-name edits.
  public onUpdatePlayerName(state: GameRuntimeState, playerId: PlayerId, name: string): void {
    this.loggerService.info(`[game] player ${playerId} request to update name to '${name}'`);

    const player = this.playerRegistryService.setPlayerName(state.players, playerId, name);
    if (player) {
      this.loggerService.info(`[game] ${player} name updated to '${name}'`);
    } else {
      this.loggerService.info(`[game] player ${playerId} not found`);
    }

    this.io.in(state.roomName).emit('playerNameUpdated', playerId, name);
  }

  // Updates readiness and starts match when all connected players are ready.
  public onPlayerReady(
    state: GameRuntimeState,
    playerId: PlayerId,
    ready: boolean,
    onStartMatch: () => void,
    sourceSocketId: string,
  ): void {
    // Ignore late or duplicate ready events once match startup has begun.
    if (state.matchStarted) {
      this.loggerService.debug(`[game] ignoring ready event from ${playerId}; match has already started`);
      return;
    }

    const player = state.players.find(nextPlayer => nextPlayer.id === playerId);
    if (!player) {
      this.loggerService.warn(`[game] received player ready event from ${playerId} but could not find Player object`);
      return;
    }

    if (player.socketId !== sourceSocketId) {
      this.loggerService.debug(
        `[game] ignoring ready event from stale socket ${sourceSocketId} for ${player}; active socket is ${player.socketId}`,
      );
      return;
    }

    if (player.ready === ready) {
      this.loggerService.debug(`[game] ignoring duplicate ready state ${ready} from ${player}`);
      return;
    }

    this.loggerService.info(`[game] received ready event from ${player}`);
    player.ready = ready;
    this.loggerService.info(`[game] marking ${player} as ${player.ready}`);
    this.io.in(state.roomName).except(player.socketId).emit('playerReady', playerId, player.ready);

    if (state.players.some(nextPlayer => !nextPlayer.ready && nextPlayer.connected)) {
      this.loggerService.debug('[game] not all players ready yet');
      return;
    }

    onStartMatch();
  }

  // Adds one or more computer players to the lobby (owner-only).
  public onAddComputerPlayer(
    state: GameRuntimeState,
    ownerId: PlayerId,
    count: number = 1,
    onGameStateChanged?: () => void,
  ): void {
    if (!state.owner || state.owner.id !== ownerId) {
      this.loggerService.warn(`[game] ignoring addComputerPlayer from non-owner ${ownerId}`);
      return;
    }

    if (state.matchStarted) {
      this.loggerService.warn('[game] match already started, cannot add computer players');
      return;
    }

    for (let i = 0; i < count; i++) {
      if (state.players.length >= this.maxPlayers) {
        this.loggerService.warn('[game] player limit reached, cannot add computer player');
        break;
      }

      const bot = this.playerFactoryService.createComputerPlayer();
      state.players.push(bot);
      this.io.in(state.roomName).emit('playerConnected', bot);
    }

    // Computer player changes affect lobby occupancy and joinability.
    if (count > 0) onGameStateChanged?.();
  }

  // Binds owner-only handlers for the current lobby owner.
  public bindOwnerLobbyHandlers(
    state: GameRuntimeState,
    ownerId: PlayerId,
    socket: AppSocket,
    callbacks: GameLobbyCallbacks,
  ): void {
    this.lobbySocketBindings.bindOwnerLobbyHandlers(socket, {
      onMatchConfigurationUpdated: callbacks.onMatchConfigurationUpdated,
      onAddComputerPlayer: (count?: number) =>
        this.onAddComputerPlayer(state, ownerId, count, callbacks.onGameStateChanged),
      onCheckMatchConfigurationSaveName: (name: string) => callbacks.onCheckMatchConfigurationSaveName(ownerId, name),
      onSaveMatchConfiguration: (name: string) => callbacks.onSaveMatchConfiguration(ownerId, name),
      onRequestSavedMatchConfigurationList: () => callbacks.onRequestSavedMatchConfigurationList(ownerId),
      onLoadSavedMatchConfiguration: (key: string) => callbacks.onLoadSavedMatchConfiguration(ownerId, key),
      onDeleteSavedMatchConfiguration: (key: string) => callbacks.onDeleteSavedMatchConfiguration(ownerId, key),
      onSearchCards: (playerId, searchTerm) => {
        const cards = this.expansionSearchService.searchKingdomCards(searchTerm);
        this.loggerService.debug(`[game] kingdom search '${searchTerm}' returned ${cards.length} eligible card(s)`);
        state.socketMap.get(playerId)?.emit('searchCardResponse', cards);
      },
      onSearchEvents: (playerId, searchTerm) => {
        state.socketMap
          .get(playerId)
          ?.emit('searchEventResponse', this.expansionSearchService.searchEvents(searchTerm));
      },
      onSearchLandmarks: (playerId, searchTerm) => {
        state.socketMap
          .get(playerId)
          ?.emit('searchLandmarkResponse', this.expansionSearchService.searchLandmarks(searchTerm));
      },
      onSearchArtifacts: (playerId, searchTerm) => {
        state.socketMap
          .get(playerId)
          ?.emit('searchArtifactResponse', this.expansionSearchService.searchArtifacts(searchTerm));
      },
      onSearchProjects: (playerId, searchTerm) => {
        state.socketMap
          .get(playerId)
          ?.emit('searchProjectResponse', this.expansionSearchService.searchProjects(searchTerm));
      },
      onSearchWays: (playerId, searchTerm) => {
        const ways = this.expansionSearchService.searchWays(searchTerm);
        this.loggerService.debug(
          `[game] way search '${searchTerm}' returned ${ways.length} way card(s) for player ${playerId}`,
        );
        state.socketMap.get(playerId)?.emit('searchWayResponse', ways);
      },
    });
  }
}
