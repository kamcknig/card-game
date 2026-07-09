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
      leftMatch: () => void;
      enteredMatch: () => void;
    }
  >();
  // Tracks post-game socket handlers per socket for clean unbinding.
  private readonly postGameHandlersBySocketId = new Map<
    string,
    {
      returnToLobby: () => void;
      playerReady: (playerId: PlayerId, ready: boolean) => void;
      restartMatch?: () => void;
      editMatch?: () => void;
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

      if (state.postGamePhase) {
        // Rejoining during the summary screen on a fresh socket: the prior
        // socket's post-game handlers died with it, and this branch never
        // bound them for reconnects — stranding the player on an inert
        // summary screen (returnToLobby/playerReady/restartMatch/editMatch
        // all silently did nothing). Rebind them here. The `setPlayerList`
        // emit above already mirrors enterPostGamePhase's only broadcast
        // payload, so no further state re-emit is needed.
        this.bindPostGamePlayerHandlers(state, player.id, socket, callbacks);
        if (state.owner?.id === player.id) {
          this.bindPostGameOwnerHandlers(state, player.id, socket, callbacks);
        }
      }
    } else {
      this.loggerService.info('[game] not yet started, sending player to match configuration');
      socket.emit(
        // Sort a copy — shared lobby state must never be reordered in place by an emit.
        'expansionList',
        [...state.availableExpansion].sort((a, b) => a.order - b.order),
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
      socket.off('leftMatch', existingHandlers.leftMatch);
      socket.off('enteredMatch', existingHandlers.enteredMatch);
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

    // Treats /match route exit as a logical disconnect while the socket stays alive.
    const leftMatchHandler = () => {
      this.onPlayerDisconnected(state, {
        playerId,
        socketId: socket.id,
        reason: 'left match scene',
        callbacks,
      });
    };

    // Reverses leftMatchHandler when the player returns to /match.
    const enteredMatchHandler = () => {
      this.onPlayerEnteredMatch(state, {
        playerId,
        socketId: socket.id,
        callbacks,
      });
    };

    socket.on('disconnect', disconnectHandler);
    socket.on('resignMatch', resignMatchHandler);
    socket.on('leftMatch', leftMatchHandler);
    socket.on('enteredMatch', enteredMatchHandler);
    this.runtimeSocketHandlersBySocketId.set(socket.id, {
      disconnect: disconnectHandler,
      resignMatch: resignMatchHandler,
      leftMatch: leftMatchHandler,
      enteredMatch: enteredMatchHandler,
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
    socket.off('leftMatch', existingHandlers.leftMatch);
    socket.off('enteredMatch', existingHandlers.enteredMatch);
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

    // During post-game, a DISCONNECT is transient: keep the seat so the
    // session can rejoin the summary screen. Only an explicit returnToLobby
    // removes the player. `matchStarted` stays true through post-game, so
    // treating this as onReturnToLobby (which drops the player from
    // state.players) would make the later `matchStarted && !hasSession`
    // reconnect gate reject the rejoin as "already started" — permanently
    // locking the player out after any network blip on the summary screen.
    if (state.postGamePhase) {
      const player = this.playerRegistryService.markPlayerDisconnected(state.players, playerId);
      const socket = state.socketMap.get(playerId);
      if (socket) {
        this.runtimeSocketHandlersBySocketId.delete(socket.id);
        // The post-game handlers bound to this now-dead socket are inert once
        // disconnected, but leaving the map entry around leaks one closure per
        // reconnect cycle; drop it the same way runtime handlers are dropped above.
        this.unbindPostGameHandlers(socket);
      }
      state.socketMap.delete(playerId);

      if (!player) {
        this.loggerService.warn('[game] post-game disconnect for unknown player');
        return;
      }

      // Owner transfer mirrors onReturnToLobby's post-game handling.
      if (state.owner?.id === playerId) {
        const replacement = this.playerSessionService.findReplacementOwner(state.players, playerId);
        state.owner = replacement;
        if (replacement) {
          this.io.in(state.roomName).emit('gameOwnerUpdated', replacement.id);
          const replacementSocket = state.socketMap.get(replacement.id);
          if (replacementSocket) {
            this.bindPostGameOwnerHandlers(state, replacement.id, replacementSocket, callbacks);
          }
        }
      }

      // If nobody connected remains, clear the match as before.
      if (!this.playerSessionService.hasConnectedHumanPlayers(state.players)) {
        this.loggerService.log('[game] no connected humans left in post-game, clearing match');
        state.postGamePhase = false;
        callbacks.onClearMatch();
        return;
      }

      this.io.in(state.roomName).emit('playerDisconnected', player);
      callbacks.onGameStateChanged?.();
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

    // Guard: during post-game phase, treat a resign as a voluntary return to lobby.
    if (state.postGamePhase) {
      // Treat resign during post-game summary as a voluntary return to lobby.
      this.onReturnToLobby(state, playerId, callbacks);
      return;
    }

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

  // Reverses onPlayerDisconnected when the player navigates back to /match on the same live
  // socket. Lighter than full playerReconnected because the client never lost match state.
  public onPlayerEnteredMatch(
    state: GameRuntimeState,
    args: {
      playerId: PlayerId;
      socketId: string;
      callbacks: GameLobbyCallbacks;
    },
  ): void {
    const { playerId, socketId, callbacks } = args;

    if (!state.matchStarted) {
      this.loggerService.debug(`[game] enteredMatch ignored from ${playerId}; match not started`);
      return;
    }

    const player = state.players.find(candidate => candidate.id === playerId);
    if (!player) {
      this.loggerService.warn(`[game] enteredMatch from unknown player ${playerId}`);
      return;
    }

    if (player.socketId !== socketId) {
      // The event arrived on a stale socket; the active socket already owns this player.
      this.loggerService.debug(
        `[game] ignoring enteredMatch from stale socket ${socketId} for ${player}; active socket is ${player.socketId}`,
      );
      return;
    }

    if (player.connected) {
      // Already marked connected — nothing to do (covers fresh-match-start case).
      this.loggerService.debug(`[game] enteredMatch from already-connected player ${player}; ignoring`);
      return;
    }

    this.loggerService.info(`[game] ${player} returned to match scene`);
    player.connected = true;
    this.disconnectedPlayerVoteService.removePendingRemovalPlayer(state.players, playerId);
    this.io.in(state.roomName).emit('playerConnected', player);

    // Resume the action engine if every human is now connected. Mirrors the
    // resume branch in addPlayer (line 145-148).
    const hasDisconnectedHuman = this.playerSessionService.hasDisconnectedHumanPlayers(state.players);
    if (!hasDisconnectedHuman) {
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

  // Transitions to post-game phase: resets ready states, keeps all players/sockets,
  // and binds summary-screen action handlers.
  public enterPostGamePhase(state: GameRuntimeState, callbacks: GameLobbyCallbacks): void {
    this.loggerService.log('[game] entering post-game phase');
    state.postGamePhase = true;

    // Reset all non-computer players to not-ready for the restart gate.
    for (const player of state.players) {
      if (!player.isComputer) {
        player.ready = false;
      }
    }

    // Owner is automatically ready — they do not press the ready button.
    if (state.owner) {
      state.owner.ready = true;
    }

    // Broadcast the initial ready state (owner already ready, others not) to all clients.
    this.io.in(state.roomName).emit('setPlayerList', state.players);

    for (const [playerId, socket] of state.socketMap.entries()) {
      this.bindPostGamePlayerHandlers(state, playerId, socket, callbacks);
      if (state.owner?.id === playerId) {
        this.bindPostGameOwnerHandlers(state, playerId, socket, callbacks);
      }
    }
  }

  // Binds returnToLobby and playerReady handlers for one socket in post-game phase.
  private bindPostGamePlayerHandlers(
    state: GameRuntimeState,
    playerId: PlayerId,
    socket: AppSocket,
    callbacks: GameLobbyCallbacks,
  ): void {
    const existing = this.postGameHandlersBySocketId.get(socket.id);
    if (existing) {
      socket.off('returnToLobby', existing.returnToLobby);
      socket.off('playerReady', existing.playerReady);
    }

    const returnToLobbyHandler = () => {
      this.onReturnToLobby(state, playerId, callbacks);
    };

    const playerReadyHandler = (targetPlayerId: PlayerId, ready: boolean) => {
      this.onPostGamePlayerReady(state, targetPlayerId, ready);
    };

    const current = this.postGameHandlersBySocketId.get(socket.id) ?? {};
    this.postGameHandlersBySocketId.set(socket.id, {
      ...current,
      returnToLobby: returnToLobbyHandler,
      playerReady: playerReadyHandler,
    });
    socket.on('returnToLobby', returnToLobbyHandler);
    socket.on('playerReady', playerReadyHandler);
  }

  // Updates one player's ready state during post-game and broadcasts it to the room.
  private onPostGamePlayerReady(state: GameRuntimeState, playerId: PlayerId, ready: boolean): void {
    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      this.loggerService.warn(`[game] post-game playerReady for unknown player ${playerId}`);
      return;
    }
    this.loggerService.debug(`[game] post-game player ${playerId} ready=${ready}`);
    player.ready = ready;
    this.io.in(state.roomName).emit('playerReady', playerId, ready);
  }

  // Binds restartMatch and editMatch handlers for the owner socket in post-game phase.
  private bindPostGameOwnerHandlers(
    state: GameRuntimeState,
    ownerId: PlayerId,
    socket: AppSocket,
    callbacks: GameLobbyCallbacks,
  ): void {
    const existing = this.postGameHandlersBySocketId.get(socket.id);
    if (existing) {
      if (existing.restartMatch) socket.off('restartMatch', existing.restartMatch);
      if (existing.editMatch) socket.off('editMatch', existing.editMatch);
    }

    const restartMatchHandler = () => {
      const connectedHumans = state.players.filter(p => p.connected && !p.isComputer);
      const allReady = connectedHumans.length > 0 && connectedHumans.every(p => p.ready);
      if (!allReady) {
        this.loggerService.warn(
          `[game] owner ${ownerId} attempted restart but not all connected players are ready`,
        );
        return;
      }
      this.loggerService.log(`[game] owner ${ownerId} restarting match from post-game phase`);
      this.unbindAllPostGameHandlers(state);
      callbacks.onRestartMatch?.();
    };

    const editMatchHandler = () => {
      this.loggerService.log(`[game] owner ${ownerId} editing match from post-game phase`);
      this.unbindAllPostGameHandlers(state);
      callbacks.onEditMatch?.();
    };

    const current = this.postGameHandlersBySocketId.get(socket.id) ?? {
      returnToLobby: () => {},
      playerReady: () => {},
    };
    this.postGameHandlersBySocketId.set(socket.id, {
      ...current,
      restartMatch: restartMatchHandler,
      editMatch: editMatchHandler,
    });
    socket.on('restartMatch', restartMatchHandler);
    socket.on('editMatch', editMatchHandler);
  }

  // Removes all post-game handlers from one socket.
  private unbindPostGameHandlers(socket: AppSocket): void {
    const handlers = this.postGameHandlersBySocketId.get(socket.id);
    if (!handlers) return;

    socket.off('returnToLobby', handlers.returnToLobby);
    socket.off('playerReady', handlers.playerReady);
    if (handlers.restartMatch) socket.off('restartMatch', handlers.restartMatch);
    if (handlers.editMatch) socket.off('editMatch', handlers.editMatch);
    this.postGameHandlersBySocketId.delete(socket.id);
  }

  // Removes post-game handlers from every socket in the game room.
  public unbindAllPostGameHandlers(state: GameRuntimeState): void {
    for (const socket of state.socketMap.values()) {
      this.unbindPostGameHandlers(socket);
    }
    state.postGamePhase = false;
  }

  // Rebinds standard lobby handlers on all connected player sockets after post-game phase.
  public rebindLobbyHandlersAfterPostGame(state: GameRuntimeState, callbacks: GameLobbyCallbacks): void {
    for (const player of state.players) {
      if (!player.connected || player.isComputer) continue;
      const socket = state.socketMap.get(player.id);
      if (!socket) continue;

      this.lobbySocketBindings.bindPlayerLobbyHandlers(socket, {
        onUpdatePlayerName: (playerId, name) => this.onUpdatePlayerName(state, playerId, name),
        onPlayerReady: (playerId, ready) =>
          this.onPlayerReady(state, playerId, ready, callbacks.onStartMatch, socket.id),
      });

      if (state.owner?.id === player.id) {
        this.bindOwnerLobbyHandlers(state, player.id, socket, callbacks);
      }
    }
  }

  // Removes one player from post-game, sends them to lobby, handles owner transfer.
  private onReturnToLobby(
    state: GameRuntimeState,
    playerId: PlayerId,
    callbacks: GameLobbyCallbacks,
  ): void {
    this.loggerService.log(`[game] player ${playerId} returning to lobby from post-game`);

    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      this.loggerService.warn(`[game] returnToLobby called for unknown player ${playerId}`);
      return;
    }

    const socket = state.socketMap.get(playerId);
    if (socket) {
      this.unbindPostGameHandlers(socket);
      this.unbindRuntimeSocketHandlers(socket);
      socket.leave(state.roomName);
      socket.join(GameLobbySessionCoordinatorService.LOBBY_ROOM_NAME);
      socket.emit('kickedFromGame', { gameId: state.gameId, message: 'You returned to the lobby.' });
    }

    state.socketMap.delete(playerId);
    state.players = state.players.filter(p => p.id !== playerId);

    // Broadcast updated player list to remaining players on the summary screen.
    this.io.in(state.roomName).emit('setPlayerList', state.players);

    // Transfer ownership if this player was the owner.
    if (state.owner?.id === playerId) {
      const replacement = this.playerSessionService.findReplacementOwner(state.players, playerId);
      state.owner = replacement;
      if (replacement) {
        this.io.in(state.roomName).emit('gameOwnerUpdated', replacement.id);
        const replacementSocket = state.socketMap.get(replacement.id);
        if (replacementSocket) {
          this.bindPostGameOwnerHandlers(state, replacement.id, replacementSocket, callbacks);
        }
      }
    }

    // If no human players remain, end the post-game phase and clear match state.
    const hasConnectedHuman = this.playerSessionService.hasConnectedHumanPlayers(state.players);
    if (!hasConnectedHuman) {
      this.loggerService.log('[game] no human players left in post-game phase, clearing match');
      state.postGamePhase = false;
      callbacks.onClearMatch();
      return;
    }

    callbacks.onGameStateChanged?.();
  }
}
