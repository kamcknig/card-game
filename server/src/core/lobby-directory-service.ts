import type { AppSocket } from '@server-types/index.ts';
import type {
  ArtifactNoId,
  CardNoId,
  EventNoId,
  ExpansionListElement,
  LandmarkNoId,
  LobbyGameSummary,
  LobbyJoinRejectedPayload,
  Match,
  PlayerId,
  ProjectNoId,
  ServerEmitEvents,
  ServerListenEvents,
  WayNoId,
} from 'shared/types/index.ts';
import { Server } from 'socket.io';
import { Game } from './game.ts';
import { GameScopeFactory } from './game-scope-factory.ts';
import { LoggerService } from './logger-service.ts';
import { ExpansionSearchService } from './expansion-search-service.ts';

type LobbyGameRecord = {
  gameId: string;
  gameName: string;
  game: Game;
  dispose: () => void;
  bannedSessionIds: Set<string>;
  // Tracks whether this game is currently visible in the global lobby list.
  listedInLobby: boolean;
};

type DebugSearchType = 'cards' | 'events' | 'landmarks' | 'artifacts' | 'projects' | 'ways';
type DebugSearchResult =
  | CardNoId[]
  | EventNoId[]
  | LandmarkNoId[]
  | ArtifactNoId[]
  | ProjectNoId[]
  | WayNoId[];

// Debug-level game lifecycle status exposed by REST debug endpoints.
export type DebugGameStatus = 'configuring' | 'inMatch';

// Debug-level match lifecycle status exposed by REST debug endpoints.
export type DebugMatchStatus = 'prepared' | 'active';

// Summary payload for one running game process.
export type DebugGameSummary = {
  gameId: string;
  gameName: string;
  roomName: string;
  status: DebugGameStatus;
  listedInLobby: boolean;
  ownerId?: PlayerId;
  ownerName?: string;
  playerCount: number;
  connectedPlayerCount: number;
  connectedHumanCount: number;
  maxPlayers: number;
  activeMatchScopeId?: number;
  matchControllerInitialized: boolean;
  bannedSessionCount: number;
};

// Summary payload for one running match scope in a game.
export type DebugMatchSummary = {
  gameId: string;
  gameName: string;
  matchScopeId: number;
  status: DebugMatchStatus;
  matchStarted: boolean;
  controllerInitialized: boolean;
};

// Coordinates the global lobby and routes sessions to isolated per-game runtimes.
export class LobbyDirectoryService {
  private static readonly LOBBY_ROOM_NAME = 'lobby';

  // Simple deterministic game id counter for this process lifetime.
  private nextGameSequence = 1;

  // Session -> active game mapping used for reconnect and join validation.
  private readonly sessionToGameId = new Map<string, string>();
  private readonly games = new Map<string, LobbyGameRecord>();
  private readonly loadedExpansions: ExpansionListElement[] = [];

  // 50 adjectives used for generated lobby game names.
  private static readonly ADJECTIVES = [
    'Agile',
    'Ancient',
    'Arcane',
    'Bold',
    'Brisk',
    'Calm',
    'Clever',
    'Cobalt',
    'Crimson',
    'Daring',
    'Dawn',
    'Eager',
    'Emerald',
    'Fierce',
    'Fleet',
    'Golden',
    'Grand',
    'Hidden',
    'Icy',
    'Iron',
    'Jade',
    'Jolly',
    'Keen',
    'Lucky',
    'Lunar',
    'Merry',
    'Mighty',
    'Nimble',
    'Noble',
    'Onyx',
    'Proud',
    'Quick',
    'Quiet',
    'Rapid',
    'Royal',
    'Ruby',
    'Shiny',
    'Silver',
    'Silent',
    'Solar',
    'Starlit',
    'Steady',
    'Storm',
    'Swift',
    'Tidy',
    'Valiant',
    'Velvet',
    'Vivid',
    'Wild',
    'Zealous',
  ] as const;

  // 50 animals used for generated lobby game names.
  private static readonly ANIMALS = [
    'Antelope',
    'Badger',
    'Bear',
    'Beaver',
    'Bison',
    'Buffalo',
    'Camel',
    'Cheetah',
    'Cougar',
    'Crane',
    'Crow',
    'Deer',
    'Dolphin',
    'Eagle',
    'Falcon',
    'Ferret',
    'Fox',
    'Gazelle',
    'Gorilla',
    'Hawk',
    'Heron',
    'Jaguar',
    'Koala',
    'Leopard',
    'Lion',
    'Lynx',
    'Marten',
    'Moose',
    'Otter',
    'Owl',
    'Panther',
    'Puma',
    'Rabbit',
    'Raven',
    'Seal',
    'Shark',
    'Sparrow',
    'Stag',
    'Tiger',
    'Turtle',
    'Viper',
    'Walrus',
    'Whale',
    'Wolf',
    'Wolverine',
    'Yak',
    'Zebra',
    'Pelican',
    'Condor',
    'Albatross',
  ] as const;

  constructor(
    private readonly io: Server<ServerListenEvents, ServerEmitEvents>,
    private readonly maxPlayers: number,
    private readonly gameScopeFactory: GameScopeFactory,
    private readonly expansionSearchService: ExpansionSearchService,
    private readonly loggerService: LoggerService,
  ) {
  }

  // Registers a new client session in the lobby directory and wires lobby-level handlers.
  public registerConnection(sessionId: string, socket: AppSocket): void {
    this.loggerService.info(`[lobby directory] registering session ${sessionId}`);
    socket.join(LobbyDirectoryService.LOBBY_ROOM_NAME);

    this.registerLobbyHandlers(sessionId, socket);
    this.emitLobbySnapshot(socket);
    this.emitSelectableSearchCatalog(socket);

    // Preserve reconnect behavior: if the session already belongs to a game, resume it automatically.
    const gameId = this.findGameIdForSession(sessionId);
    if (gameId) {
      this.loggerService.info(`[lobby directory] session ${sessionId} reconnecting to game ${gameId}`);
      this.joinLobbyGame(sessionId, socket, gameId);
    }
  }

  // Applies expansion-load events to existing games and future game templates.
  public expansionLoaded(expansion: ExpansionListElement): void {
    const alreadyTracked = this.loadedExpansions.some(
      (loadedExpansion) => loadedExpansion.name === expansion.name,
    );
    if (alreadyTracked) {
      this.loggerService.debug(
        `[lobby directory] expansion '${expansion.name}' already tracked globally, skipping duplicate load`,
      );
      return;
    }

    this.loadedExpansions.push(expansion);
    this.loggerService.info(`[lobby directory] expansion '${expansion.name}' loaded globally`);

    for (const record of this.games.values()) {
      record.game.expansionLoaded(expansion);
    }

    // Push refreshed card-like catalog so clients can update local search caches.
    this.io.in(LobbyDirectoryService.LOBBY_ROOM_NAME).emit(
      'setSelectableSearchCatalog',
      this.expansionSearchService.getSelectableSearchCatalog(),
    );
  }

  // Returns debug summaries for all currently running games.
  public getDebugGames(): DebugGameSummary[] {
    const summaries = [...this.games.values()]
      .map((record) => this.toDebugGameSummary(record))
      .sort((a, b) => a.gameName.localeCompare(b.gameName));
    this.loggerService.debug(`[lobby directory] debug games requested; returning ${summaries.length} game(s)`);
    return summaries;
  }

  // Returns a debug summary for one game when it exists.
  public getDebugGame(gameId: string): DebugGameSummary | undefined {
    const record = this.games.get(gameId);
    if (!record) {
      this.loggerService.warn(`[lobby directory] debug game request not found for game '${gameId}'`);
      return undefined;
    }
    this.loggerService.debug(`[lobby directory] debug game requested for game '${gameId}'`);
    return this.toDebugGameSummary(record);
  }

  // Returns debug summaries for match scopes in one game.
  public getDebugMatches(gameId: string): DebugMatchSummary[] | undefined {
    const record = this.games.get(gameId);
    if (!record) {
      this.loggerService.warn(`[lobby directory] debug match-list request not found for game '${gameId}'`);
      return undefined;
    }
    const summaries = this.toDebugMatchSummaries(record);
    this.loggerService.debug(
      `[lobby directory] debug matches requested for game '${gameId}'; returning ${summaries.length} match(es)`,
    );
    return summaries;
  }

  // Returns one debug match summary when game and scope id are valid.
  public getDebugMatch(gameId: string, matchScopeId: number): DebugMatchSummary | undefined {
    const record = this.games.get(gameId);
    if (!record) {
      this.loggerService.warn(
        `[lobby directory] debug match request not found for game '${gameId}' matchScopeId=${matchScopeId}`,
      );
      return undefined;
    }
    const summary = this.toDebugMatchSummaries(record)
      .find((summary) => summary.matchScopeId === matchScopeId);
    if (!summary) {
      this.loggerService.warn(
        `[lobby directory] debug match request not found for game '${gameId}' matchScopeId=${matchScopeId}`,
      );
      return undefined;
    }
    this.loggerService.debug(
      `[lobby directory] debug match requested for game '${gameId}' matchScopeId=${matchScopeId}`,
    );
    return summary;
  }

  // Exports live match state for a specific game and match scope.
  public exportMatchStateForMatch(
    gameId: string,
    matchScopeId: number,
  ): ReturnType<Game['exportMatchState']> | { error: string } {
    const resolved = this.resolveDebugGameAndMatch(gameId, matchScopeId);
    if (!resolved.ok) {
      this.loggerService.warn(
        `[lobby directory] debug match-state export rejected for game '${gameId}' matchScopeId=${matchScopeId}: ${resolved.error}`,
      );
      return { error: resolved.error };
    }
    this.loggerService.debug(
      `[lobby directory] debug match-state export for game '${gameId}' matchScopeId=${matchScopeId}`,
    );
    return resolved.record.game.exportMatchState();
  }

  // Applies partial live match state merge for a specific game and match scope.
  public mergeMatchStateForMatch(
    gameId: string,
    matchScopeId: number,
    partial: Partial<Match>,
  ): { ok: boolean; errors?: string[] } {
    const resolved = this.resolveDebugGameAndMatch(gameId, matchScopeId);
    if (!resolved.ok) {
      this.loggerService.warn(
        `[lobby directory] debug match-state merge rejected for game '${gameId}' matchScopeId=${matchScopeId}: ${resolved.error}`,
      );
      return { ok: false, errors: [resolved.error] };
    }
    this.loggerService.debug(
      `[lobby directory] debug match-state merge for game '${gameId}' matchScopeId=${matchScopeId}`,
    );
    return resolved.record.game.mergeMatchState(partial);
  }

  // Executes one debug expansion search for a specific game and match scope.
  public debugSearchForMatch(
    gameId: string,
    matchScopeId: number,
    type: DebugSearchType,
    searchStr: string,
  ): { ok: true; results: DebugSearchResult; gameId: string; matchScopeId: number; type: DebugSearchType; query: string }
    | { ok: false; error: string } {
    const resolved = this.resolveDebugGameAndMatch(gameId, matchScopeId);
    if (!resolved.ok) {
      return { ok: false, error: resolved.error };
    }

    const query = searchStr ?? '';
    this.loggerService.info(
      `[lobby directory] debug search request game=${resolved.record.gameId} matchScopeId=${matchScopeId} type=${type} query='${query}'`,
    );

    const results = this.performDebugSearch(type, query);
    this.loggerService.debug(
      `[lobby directory] debug search returned ${results.length} result(s) for type=${type}`,
    );

    return {
      ok: true,
      results,
      gameId: resolved.record.gameId,
      matchScopeId,
      type,
      query,
    };
  }

  // Disposes all scoped game runtimes for clean server shutdown.
  public dispose(): void {
    for (const gameId of [...this.games.keys()]) {
      this.removeGame(gameId, 'server shutdown');
    }
  }

  // Registers all global-lobby socket handlers for one session.
  private registerLobbyHandlers(sessionId: string, socket: AppSocket): void {
    socket.on('requestLobbySnapshot', () => this.emitLobbySnapshot(socket));
    socket.on('requestSelectableSearchCatalog', () => this.emitSelectableSearchCatalog(socket));
    socket.on('createLobbyGame', () => {
      const gameId = this.createLobbyGame();
      this.joinLobbyGame(sessionId, socket, gameId);
    });
    socket.on('joinLobbyGame', (gameId: string) => this.joinLobbyGame(sessionId, socket, gameId));
    socket.on('leaveLobbyGame', (gameId: string) => this.onLeaveLobbyGame(sessionId, socket, gameId));
    socket.on('kickLobbyPlayer', (gameId: string, targetPlayerId: PlayerId) => {
      this.onKickLobbyPlayer(sessionId, socket, gameId, targetPlayerId);
    });
    socket.on('banLobbyPlayer', (gameId: string, targetPlayerId: PlayerId) => {
      this.onBanLobbyPlayer(sessionId, socket, gameId, targetPlayerId);
    });
    socket.on('unbanLobbyPlayer', (gameId: string, targetSessionId: string) => {
      this.onUnbanLobbyPlayer(sessionId, socket, gameId, targetSessionId);
    });

    socket.on('disconnect', () => {
      // Let per-game handlers update state first, then recompute lobby summary.
      const gameId = this.findGameIdForSession(sessionId);
      if (!gameId) return;
      queueMicrotask(() => this.handleGameStateChanged(gameId));
    });
  }

  // Creates one new empty game and broadcasts the resulting lobby summary update.
  private createLobbyGame(): string {
    const gameId = `game-${this.nextGameSequence++}`;
    const gameName = this.generateUniqueGameName();

    const scopeHandle = this.gameScopeFactory.create({
      gameId,
      gameName,
      onGameStateChanged: () => this.handleGameStateChanged(gameId),
    });

    const record: LobbyGameRecord = {
      gameId,
      gameName,
      game: scopeHandle.game,
      dispose: scopeHandle.dispose,
      bannedSessionIds: new Set(),
      listedInLobby: true,
    };

    this.games.set(gameId, record);
    for (const expansion of this.loadedExpansions) {
      record.game.expansionLoaded(expansion);
    }

    this.loggerService.log(`[lobby directory] created game ${gameId} (${gameName})`);
    this.io.in(LobbyDirectoryService.LOBBY_ROOM_NAME).emit('lobbyGameUpdated', this.toLobbySummary(record));
    return gameId;
  }

  // Handles a join request from the global lobby into a specific game.
  private joinLobbyGame(sessionId: string, socket: AppSocket, gameId: string): void {
    this.loggerService.info(`[lobby directory] session ${sessionId} attempting to join ${gameId}`);
    const record = this.games.get(gameId);
    if (!record) {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'gameNotFound',
        message: 'That game no longer exists.',
      });
      return;
    }

    if (record.bannedSessionIds.has(sessionId)) {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'banned',
        message: 'You are banned from this game.',
      });
      return;
    }

    const existingGameId = this.findGameIdForSession(sessionId);
    if (existingGameId && existingGameId !== gameId) {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'alreadyInGame',
        message: 'Leave your current game before joining another one.',
      });
      return;
    }

    if (record.game.matchStarted && !record.game.hasSession(sessionId)) {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'gameNotJoinable',
        message: 'That game has already started.',
      });
      return;
    }

    const addResult = record.game.addPlayer(sessionId, socket);
    if (addResult.status === 'rejected_capacity') {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'gameFull',
        message: `That game is full (${this.maxPlayers}/${this.maxPlayers}).`,
      });
      this.handleGameStateChanged(gameId);
      return;
    }

    if (addResult.status === 'rejected_started') {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'gameNotJoinable',
        message: 'That game has already started.',
      });
      this.handleGameStateChanged(gameId);
      return;
    }

    socket.leave(LobbyDirectoryService.LOBBY_ROOM_NAME);
    this.sessionToGameId.set(sessionId, gameId);
    // Notify client-side routing/state which game is now active.
    socket.emit('joinedLobbyGame', gameId);
    socket.emit('debugRuntimeContext', record.game.getDebugRuntimeContext());
    this.loggerService.info(`[lobby directory] session ${sessionId} joined ${gameId}`);
    this.handleGameStateChanged(gameId);
  }

  // Emits the current searchable card-like catalog to one socket.
  private emitSelectableSearchCatalog(socket: AppSocket): void {
    socket.emit('setSelectableSearchCatalog', this.expansionSearchService.getSelectableSearchCatalog());
  }

  // Handles explicit lobby leave requests from configuration-state games.
  private onLeaveLobbyGame(sessionId: string, socket: AppSocket, gameId: string): void {
    const record = this.games.get(gameId);
    if (!record) {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'gameNotFound',
        message: 'That game no longer exists.',
      });
      return;
    }

    const player = record.game.getPlayerBySession(sessionId);
    if (!player) {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'invalidRequest',
        message: 'You are not in that game.',
      });
      return;
    }

    this.loggerService.info(`[lobby directory] session ${sessionId} leaving game ${gameId}`);
    const removal = record.game.removePlayerFromLobby(player.id);
    if (removal.status === 'match_started') {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'gameNotJoinable',
        message: 'You cannot leave from lobby once the match has started.',
      });
      return;
    }
    if (removal.status === 'not_found') {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'invalidRequest',
        message: 'Player not found in game.',
      });
      return;
    }

    this.sessionToGameId.delete(removal.sessionId);
    socket.join(LobbyDirectoryService.LOBBY_ROOM_NAME);
    this.handleGameStateChanged(gameId);
    this.emitLobbySnapshot(socket);
  }

  // Handles owner-initiated kick requests during lobby configuration.
  private onKickLobbyPlayer(sessionId: string, socket: AppSocket, gameId: string, targetPlayerId: PlayerId): void {
    const record = this.games.get(gameId);
    if (!record) {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'gameNotFound',
        message: 'That game no longer exists.',
      });
      return;
    }

    const ownerValidation = this.validateOwnerSession(record, sessionId);
    if (!ownerValidation.valid) {
      this.emitJoinRejected(socket, ownerValidation.rejection);
      return;
    }

    if (ownerValidation.playerId === targetPlayerId) {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'invalidRequest',
        message: 'You cannot kick yourself.',
      });
      return;
    }

    this.loggerService.info(`[lobby directory] owner session ${sessionId} kicking player ${targetPlayerId} from ${gameId}`);
    const removal = record.game.removePlayerFromLobby(targetPlayerId);
    if (removal.status === 'match_started') {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'gameNotJoinable',
        message: 'Kick is only available during lobby configuration.',
      });
      return;
    }
    if (removal.status === 'not_found') {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'invalidRequest',
        message: 'Target player not found.',
      });
      return;
    }

    this.sessionToGameId.delete(removal.sessionId);
    const targetSocket = this.findSocketById(removal.socketId);
    if (targetSocket) {
      targetSocket.join(LobbyDirectoryService.LOBBY_ROOM_NAME);
      targetSocket.emit('kickedFromGame', {
        gameId,
        message: `You were kicked from ${record.gameName}.`,
      });
      this.emitLobbySnapshot(targetSocket);
    }

    this.handleGameStateChanged(gameId);
  }

  // Handles owner-initiated ban requests during lobby configuration.
  private onBanLobbyPlayer(sessionId: string, socket: AppSocket, gameId: string, targetPlayerId: PlayerId): void {
    const record = this.games.get(gameId);
    if (!record) {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'gameNotFound',
        message: 'That game no longer exists.',
      });
      return;
    }

    const ownerValidation = this.validateOwnerSession(record, sessionId);
    if (!ownerValidation.valid) {
      this.emitJoinRejected(socket, ownerValidation.rejection);
      return;
    }

    if (ownerValidation.playerId === targetPlayerId) {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'invalidRequest',
        message: 'You cannot ban yourself.',
      });
      return;
    }

    this.loggerService.info(`[lobby directory] owner session ${sessionId} banning player ${targetPlayerId} from ${gameId}`);
    const targetPlayer = record.game.getPlayerById(targetPlayerId);
    if (!targetPlayer) {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'invalidRequest',
        message: 'Target player not found.',
      });
      return;
    }

    const removal = record.game.removePlayerFromLobby(targetPlayerId);
    if (removal.status === 'match_started') {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'gameNotJoinable',
        message: 'Ban is only available during lobby configuration.',
      });
      return;
    }
    if (removal.status === 'not_found') {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'invalidRequest',
        message: 'Target player not found.',
      });
      return;
    }

    record.bannedSessionIds.add(removal.sessionId);
    this.sessionToGameId.delete(removal.sessionId);
    const targetSocket = this.findSocketById(removal.socketId);
    if (targetSocket) {
      targetSocket.join(LobbyDirectoryService.LOBBY_ROOM_NAME);
      targetSocket.emit('bannedFromGame', {
        gameId,
        message: `You were banned from ${record.gameName}.`,
      });
      this.emitLobbySnapshot(targetSocket);
    }

    this.handleGameStateChanged(gameId);
  }

  // Handles owner-initiated unban requests for one banned session.
  private onUnbanLobbyPlayer(sessionId: string, socket: AppSocket, gameId: string, targetSessionId: string): void {
    const record = this.games.get(gameId);
    if (!record) {
      this.emitJoinRejected(socket, {
        gameId,
        reason: 'gameNotFound',
        message: 'That game no longer exists.',
      });
      return;
    }

    const ownerValidation = this.validateOwnerSession(record, sessionId);
    if (!ownerValidation.valid) {
      this.emitJoinRejected(socket, ownerValidation.rejection);
      return;
    }

    if (record.bannedSessionIds.delete(targetSessionId)) {
      this.loggerService.info(`[lobby directory] unbanned session ${targetSessionId} from game ${gameId}`);
    } else {
      this.loggerService.debug(`[lobby directory] session ${targetSessionId} was not banned in game ${gameId}`);
    }
  }

  // Recomputes lobby visibility and clean-up rules after one game state transition.
  private handleGameStateChanged(gameId: string): void {
    const record = this.games.get(gameId);
    if (!record) return;

    this.syncSessionMappingsForGame(record);

    if (!record.game.matchStarted && record.game.getConnectedHumanCount() < 1) {
      this.removeGame(gameId, 'no connected human players in configuration');
      return;
    }

    if (record.game.matchStarted) {
      if (record.listedInLobby) {
        record.listedInLobby = false;
        this.io.in(LobbyDirectoryService.LOBBY_ROOM_NAME).emit('lobbyGameRemoved', gameId);
      }
      return;
    }

    // Non-started games remain visible in lobby and publish incremental updates.
    record.listedInLobby = true;
    this.io.in(LobbyDirectoryService.LOBBY_ROOM_NAME).emit('lobbyGameUpdated', this.toLobbySummary(record));
  }

  // Disposes and removes one game from the directory.
  private removeGame(gameId: string, reason: string): void {
    const record = this.games.get(gameId);
    if (!record) return;

    this.loggerService.log(`[lobby directory] removing game ${gameId}: ${reason}`);
    if (record.listedInLobby) {
      this.io.in(LobbyDirectoryService.LOBBY_ROOM_NAME).emit('lobbyGameRemoved', gameId);
    }

    this.clearSessionMappingsForGame(gameId);
    record.game.dispose();
    record.dispose();
    this.games.delete(gameId);
  }

  // Emits the current lobby snapshot to one socket.
  private emitLobbySnapshot(socket: AppSocket): void {
    socket.emit('lobbySnapshot', this.buildLobbySnapshot());
  }

  // Builds the visible lobby list (configuring games only).
  private buildLobbySnapshot(): LobbyGameSummary[] {
    return [...this.games.values()]
      .filter((record) => record.listedInLobby && !record.game.matchStarted)
      .map((record) => this.toLobbySummary(record))
      .sort((a, b) => a.gameName.localeCompare(b.gameName));
  }

  // Converts internal game records to shared lobby summary payloads.
  private toLobbySummary(record: LobbyGameRecord): LobbyGameSummary {
    return {
      gameId: record.gameId,
      gameName: record.gameName,
      ownerId: record.game.owner?.id,
      playerCount: record.game.getConnectedPlayerCount(),
      maxPlayers: this.maxPlayers,
      isJoinable: !record.game.matchStarted && record.game.players.length < this.maxPlayers,
      status: record.game.matchStarted ? 'inMatch' : 'configuring',
    };
  }

  // Converts one record into the debug game summary resource shape.
  private toDebugGameSummary(record: LobbyGameRecord): DebugGameSummary {
    return {
      gameId: record.gameId,
      gameName: record.gameName,
      roomName: record.game.roomName,
      status: record.game.matchStarted ? 'inMatch' : 'configuring',
      listedInLobby: record.listedInLobby,
      ownerId: record.game.owner?.id,
      ownerName: record.game.owner?.name,
      playerCount: record.game.players.length,
      connectedPlayerCount: record.game.getConnectedPlayerCount(),
      connectedHumanCount: record.game.getConnectedHumanCount(),
      maxPlayers: this.maxPlayers,
      activeMatchScopeId: record.game.matchScopeId,
      matchControllerInitialized: record.game.isMatchControllerInitialized(),
      bannedSessionCount: record.bannedSessionIds.size,
    };
  }

  // Builds the active match summary list for a game (currently one active scope).
  private toDebugMatchSummaries(record: LobbyGameRecord): DebugMatchSummary[] {
    if (record.game.matchScopeId === undefined) {
      return [];
    }

    return [{
      gameId: record.game.id,
      gameName: record.game.name,
      matchScopeId: record.game.matchScopeId,
      status: record.game.matchStarted ? 'active' : 'prepared',
      matchStarted: record.game.matchStarted,
      controllerInitialized: record.game.isMatchControllerInitialized(),
    }];
  }

  // Emits a structured join rejection payload and keeps socket in lobby context.
  private emitJoinRejected(socket: AppSocket, payload: LobbyJoinRejectedPayload): void {
    this.loggerService.warn(
      `[lobby directory] rejecting lobby action for game ${payload.gameId} (${payload.reason}): ${payload.message}`,
    );
    socket.join(LobbyDirectoryService.LOBBY_ROOM_NAME);
    socket.emit('joinLobbyRejected', payload);
  }

  // Finds the current game id for a session, including fallback scan when map entries are stale.
  private findGameIdForSession(sessionId: string): string | undefined {
    const mappedGameId = this.sessionToGameId.get(sessionId);
    if (mappedGameId && this.games.has(mappedGameId)) {
      return mappedGameId;
    }

    if (mappedGameId && !this.games.has(mappedGameId)) {
      this.sessionToGameId.delete(sessionId);
    }

    for (const record of this.games.values()) {
      if (record.game.hasSession(sessionId)) {
        this.sessionToGameId.set(sessionId, record.game.id);
        return record.game.id;
      }
    }

    return undefined;
  }

  // Syncs session->game mapping entries for one game after membership updates.
  private syncSessionMappingsForGame(record: LobbyGameRecord): void {
    this.clearSessionMappingsForGame(record.gameId);
    for (const player of record.game.players) {
      this.sessionToGameId.set(player.sessionId, record.gameId);
    }
  }

  // Removes all session mappings currently pointing to one game.
  private clearSessionMappingsForGame(gameId: string): void {
    for (const [sessionId, mappedGameId] of this.sessionToGameId.entries()) {
      if (mappedGameId === gameId) {
        this.sessionToGameId.delete(sessionId);
      }
    }
  }

  // Validates game and active match scope identity for debug operations.
  private resolveDebugGameAndMatch(
    gameId: string,
    matchScopeId: number,
  ): { ok: true; record: LobbyGameRecord } | { ok: false; error: string } {
    const record = this.games.get(gameId);
    if (!record) {
      return { ok: false, error: `game '${gameId}' not found` };
    }

    const activeMatchScopeId = record.game.matchScopeId;
    if (activeMatchScopeId === undefined) {
      return { ok: false, error: `game '${gameId}' has no active match scope` };
    }

    if (activeMatchScopeId !== matchScopeId) {
      return {
        ok: false,
        error: `requested matchScopeId ${matchScopeId} does not match active ${activeMatchScopeId}`,
      };
    }

    return { ok: true, record };
  }

  // Runs one expansion search operation for debug HTTP tooling.
  private performDebugSearch(type: DebugSearchType, searchStr: string): DebugSearchResult {
    switch (type) {
      case 'cards':
        return this.expansionSearchService.searchKingdomCards(searchStr);
      case 'events':
        return this.expansionSearchService.searchEvents(searchStr);
      case 'landmarks':
        return this.expansionSearchService.searchLandmarks(searchStr);
      case 'artifacts':
        return this.expansionSearchService.searchArtifacts(searchStr);
      case 'projects':
        return this.expansionSearchService.searchProjects(searchStr);
      case 'ways':
        return this.expansionSearchService.searchWays(searchStr);
    }
  }

  // Generates a unique random adjective-animal game name.
  private generateUniqueGameName(): string {
    const existingNames = new Set([...this.games.values()].map((record) => record.gameName));
    let attempt = 0;

    while (true) {
      const adjective = LobbyDirectoryService.ADJECTIVES[Math.floor(Math.random() * LobbyDirectoryService.ADJECTIVES.length)];
      const animal = LobbyDirectoryService.ANIMALS[Math.floor(Math.random() * LobbyDirectoryService.ANIMALS.length)];
      const baseName = `${adjective} ${animal}`;
      const candidate = attempt < 1 ? baseName : `${baseName} ${attempt + 1}`;

      if (!existingNames.has(candidate)) {
        return candidate;
      }
      attempt++;
    }
  }

  // Finds a connected socket by id when available.
  private findSocketById(socketId: string): AppSocket | undefined {
    if (!socketId) return undefined;
    return this.io.of('/').sockets.get(socketId) as AppSocket | undefined;
  }

  // Validates that the session belongs to the owner of the specified game.
  private validateOwnerSession(
    record: LobbyGameRecord,
    sessionId: string,
  ): { valid: true; playerId: PlayerId } | { valid: false; rejection: LobbyJoinRejectedPayload } {
    const gameId = record.gameId;
    const player = record.game.getPlayerBySession(sessionId);
    if (!player) {
      return {
        valid: false,
        rejection: {
          gameId,
          reason: 'invalidRequest',
          message: 'You are not in that game.',
        },
      };
    }

    if (record.game.owner?.id !== player.id) {
      return {
        valid: false,
        rejection: {
          gameId,
          reason: 'invalidRequest',
          message: 'Only the game owner can perform that action.',
        },
      };
    }

    return { valid: true, playerId: player.id };
  }
}
