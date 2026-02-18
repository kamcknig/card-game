import type { AppSocket } from '@server-types/index.ts';
import type {
  ExpansionListElement,
  LobbyGameSummary,
  LobbyJoinRejectedPayload,
  Match,
  PlayerId,
  ServerEmitEvents,
  ServerListenEvents,
} from 'shared/types/index.ts';
import { Server } from 'socket.io';
import { Game } from './game.ts';
import { GameScopeFactory } from './game-scope-factory.ts';
import { LoggerService } from './logger-service.ts';

type LobbyGameRecord = {
  gameId: string;
  gameName: string;
  game: Game;
  dispose: () => void;
  bannedSessionIds: Set<string>;
  // Tracks whether this game is currently visible in the global lobby list.
  listedInLobby: boolean;
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
    private readonly loggerService: LoggerService,
  ) {
  }

  // Registers a new client session in the lobby directory and wires lobby-level handlers.
  public registerConnection(sessionId: string, socket: AppSocket): void {
    this.loggerService.info(`[lobby directory] registering session ${sessionId}`);
    socket.join(LobbyDirectoryService.LOBBY_ROOM_NAME);

    this.registerLobbyHandlers(sessionId, socket);
    this.emitLobbySnapshot(socket);

    // Preserve reconnect behavior: if the session already belongs to a game, resume it automatically.
    const gameId = this.findGameIdForSession(sessionId);
    if (gameId) {
      this.loggerService.info(`[lobby directory] session ${sessionId} reconnecting to game ${gameId}`);
      this.joinLobbyGame(sessionId, socket, gameId);
    }
  }

  // Applies expansion-load events to existing games and future game templates.
  public expansionLoaded(expansion: ExpansionListElement): void {
    this.loadedExpansions.push(expansion);
    this.loggerService.info(`[lobby directory] expansion '${expansion.name}' loaded globally`);

    for (const record of this.games.values()) {
      record.game.expansionLoaded(expansion);
    }
  }

  // Exports live match state for one game id, or auto-selects if exactly one game exists.
  public exportMatchState(gameId?: string): ReturnType<Game['exportMatchState']> {
    return this.resolveDebugGame(gameId)?.game.exportMatchState() ?? null;
  }

  // Applies partial live match state merge for one selected game.
  public mergeMatchState(gameId: string | undefined, partial: Partial<Match>): { ok: boolean; errors?: string[] } {
    const game = this.resolveDebugGame(gameId)?.game;
    if (!game) {
      return { ok: false, errors: ['game not found for debug merge'] };
    }
    return game.mergeMatchState(partial);
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
    this.handleGameStateChanged(gameId);
  }

  // Placeholder for phase-3 explicit leave flow.
  private onLeaveLobbyGame(sessionId: string, socket: AppSocket, gameId: string): void {
    this.loggerService.warn(`[lobby directory] leaveLobbyGame not implemented yet (${sessionId}, ${gameId})`);
    socket.emit('joinLobbyRejected', {
      gameId,
      reason: 'invalidRequest',
      message: 'Leave game flow is not implemented yet.',
    });
  }

  // Placeholder for phase-3 owner kick flow.
  private onKickLobbyPlayer(sessionId: string, socket: AppSocket, gameId: string, targetPlayerId: PlayerId): void {
    this.loggerService.warn(
      `[lobby directory] kickLobbyPlayer not implemented yet (${sessionId}, ${gameId}, ${targetPlayerId})`,
    );
    socket.emit('joinLobbyRejected', {
      gameId,
      reason: 'invalidRequest',
      message: 'Kick flow is not implemented yet.',
    });
  }

  // Placeholder for phase-3 owner ban flow.
  private onBanLobbyPlayer(sessionId: string, socket: AppSocket, gameId: string, targetPlayerId: PlayerId): void {
    this.loggerService.warn(
      `[lobby directory] banLobbyPlayer not implemented yet (${sessionId}, ${gameId}, ${targetPlayerId})`,
    );
    socket.emit('joinLobbyRejected', {
      gameId,
      reason: 'invalidRequest',
      message: 'Ban flow is not implemented yet.',
    });
  }

  // Placeholder for phase-3 unban flow.
  private onUnbanLobbyPlayer(sessionId: string, socket: AppSocket, gameId: string, targetSessionId: string): void {
    this.loggerService.warn(
      `[lobby directory] unbanLobbyPlayer not implemented yet (${sessionId}, ${gameId}, ${targetSessionId})`,
    );
    socket.emit('joinLobbyRejected', {
      gameId,
      reason: 'invalidRequest',
      message: 'Unban flow is not implemented yet.',
    });
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

  // Emits a structured join rejection payload and keeps socket in lobby context.
  private emitJoinRejected(socket: AppSocket, payload: LobbyJoinRejectedPayload): void {
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

  // Resolves debug target game by explicit id or auto-select when only one game exists.
  private resolveDebugGame(gameId?: string): LobbyGameRecord | undefined {
    if (gameId) return this.games.get(gameId);
    if (this.games.size === 1) return [...this.games.values()][0];
    return undefined;
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
}
