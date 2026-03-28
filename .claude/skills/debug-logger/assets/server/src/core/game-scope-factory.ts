import { asClass, asValue, AwilixContainer } from 'awilix';
import { DisconnectedPlayerVoteService } from './disconnected-player-vote-service.ts';
import { Game } from './game.ts';
import { GameLobbySessionCoordinatorService } from './game-lobby-session-coordinator-service.ts';
import { GameMatchLifecycleCoordinatorService } from './game-match-lifecycle-coordinator-service.ts';
import { LoggerService } from './logger-service.ts';
import { FileGameConfigurationStore } from './game-configuration-store.ts';

export interface GameScopeFactoryArgs {
  gameId: string;
  gameName: string;
  // Optional callback emitted when lobby-relevant game state changes.
  onGameStateChanged?: () => void;
}

export interface GameScopeHandle {
  game: Game;
  dispose: () => void;
}

// Builds a child Awilix scope per lobby game to isolate game-level stateful services.
export class GameScopeFactory {
  constructor(
    private readonly rootContainer: AwilixContainer,
  ) {
  }

  // Creates and initializes one scoped Game instance with isolated room identity.
  public create(args: GameScopeFactoryArgs): GameScopeHandle {
    const scope = this.rootContainer.createScope();
    const { gameId, gameName, onGameStateChanged } = args;

    scope.register({
      gameId: asValue(gameId),
      gameName: asValue(gameName),
      gameRoomName: asValue(`game:${gameId}`),
      onGameStateChanged: asValue(onGameStateChanged),
      // Build scoped logger instances so contextual values can include game identity.
      loggerContext: asValue({ scope: 'game', gameId }),
      loggerService: asClass(LoggerService).scoped(),
      // Persist lobby configuration per game/match scope instead of process-global files.
      configStore: asClass(FileGameConfigurationStore).scoped(),
      // These services maintain mutable state and must not be shared across games.
      disconnectedPlayerVoteService: asClass(DisconnectedPlayerVoteService).scoped(),
      gameMatchLifecycleCoordinatorService: asClass(GameMatchLifecycleCoordinatorService).scoped(),
      gameLobbySessionCoordinatorService: asClass(GameLobbySessionCoordinatorService).scoped(),
      game: asClass(Game).scoped(),
    });

    const game = scope.resolve<Game>('game');
    return {
      game,
      dispose: () => {
        void scope.dispose();
      },
    };
  }
}
