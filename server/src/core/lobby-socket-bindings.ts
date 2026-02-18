import { AppSocket } from '@server-types/index.ts';
import { MatchConfiguration, PlayerId } from 'shared/types/index.ts';

// Owner-only lobby handlers used by the game owner before match start.
export interface OwnerLobbyHandlers {
  onMatchConfigurationUpdated: (newConfig: MatchConfiguration) => void | Promise<void>;
  onAddComputerPlayer: (count?: number) => void;
  onSearchCards: (playerId: PlayerId, searchTerm: string) => void;
  onSearchEvents: (playerId: PlayerId, searchTerm: string) => void;
  onSearchLandmarks: (playerId: PlayerId, searchTerm: string) => void;
  onSearchArtifacts: (playerId: PlayerId, searchTerm: string) => void;
  onSearchProjects: (playerId: PlayerId, searchTerm: string) => void;
}

// Lobby handlers shared by all connected lobby players before match start.
export interface PlayerLobbyHandlers {
  onUpdatePlayerName: (playerId: PlayerId, name: string) => void;
  onPlayerReady: (playerId: PlayerId) => void;
}

// Encapsulates lobby socket event binding and unbinding behavior.
export class LobbySocketBindings {
  // Binds owner-only handlers that are allowed in the lobby.
  public bindOwnerLobbyHandlers(socket: AppSocket, handlers: OwnerLobbyHandlers) {
    socket.on('matchConfigurationUpdated', handlers.onMatchConfigurationUpdated);
    socket.on('addComputerPlayer', handlers.onAddComputerPlayer);
    socket.on('searchCards', handlers.onSearchCards);
    socket.on('searchEvents', handlers.onSearchEvents);
    socket.on('searchLandmarks', handlers.onSearchLandmarks);
    socket.on('searchArtifacts', handlers.onSearchArtifacts);
    socket.on('searchProjects', handlers.onSearchProjects);
  }

  // Unbinds owner-only lobby handlers when ownership changes or match starts.
  public unbindOwnerLobbyHandlers(socket?: AppSocket) {
    if (!socket) {
      return;
    }

    socket.off('matchConfigurationUpdated');
    socket.off('addComputerPlayer');
    socket.off('searchCards');
    socket.off('searchEvents');
    socket.off('searchLandmarks');
    socket.off('searchArtifacts');
    socket.off('searchProjects');
  }

  // Binds standard lobby handlers shared by all players before match start.
  public bindPlayerLobbyHandlers(socket: AppSocket, handlers: PlayerLobbyHandlers) {
    socket.on('updatePlayerName', handlers.onUpdatePlayerName);
    socket.on('playerReady', handlers.onPlayerReady);
  }

  // Unbinds standard lobby handlers when leaving lobby mode.
  public unbindPlayerLobbyHandlers(socket?: AppSocket) {
    if (!socket) {
      return;
    }

    socket.off('updatePlayerName');
    socket.off('playerReady');
  }
}
