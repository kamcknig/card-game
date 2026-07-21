import { AppSocket } from '@server-types/index.ts';
import { MatchConfiguration, PlayerId } from 'shared/types/index.ts';

// Owner-only lobby handlers used by the game owner before match start.
export interface OwnerLobbyHandlers {
  onMatchConfigurationUpdated: (newConfig: MatchConfiguration) => void | Promise<void>;
  onAddComputerPlayer: (count?: number) => void;
  onCheckMatchConfigurationSaveName: (name: string) => void;
  onSaveMatchConfiguration: (name: string) => void;
  onRequestSavedMatchConfigurationList: () => void;
  onLoadSavedMatchConfiguration: (key: string) => void;
  onDeleteSavedMatchConfiguration: (key: string) => void;
  onSearchCards: (playerId: PlayerId, searchTerm: string) => void;
  onSearchEvents: (playerId: PlayerId, searchTerm: string) => void;
  onSearchLandmarks: (playerId: PlayerId, searchTerm: string) => void;
  onSearchArtifacts: (playerId: PlayerId, searchTerm: string) => void;
  onSearchProjects: (playerId: PlayerId, searchTerm: string) => void;
  onSearchWays: (playerId: PlayerId, searchTerm: string) => void;
  onSearchTraits: (playerId: PlayerId, searchTerm: string) => void;
  onSearchAllies: (playerId: PlayerId, searchTerm: string) => void;
  onSearchProphecies: (playerId: PlayerId, searchTerm: string) => void;
}

// Lobby handlers shared by all connected lobby players before match start.
export interface PlayerLobbyHandlers {
  onUpdatePlayerName: (playerId: PlayerId, name: string) => void;
  onPlayerReady: (playerId: PlayerId, ready: boolean) => void;
}

// Encapsulates lobby socket event binding and unbinding behavior.
export class LobbySocketBindings {
  // Binds owner-only handlers that are allowed in the lobby.
  public bindOwnerLobbyHandlers(socket: AppSocket, handlers: OwnerLobbyHandlers) {
    socket.on('matchConfigurationUpdated', handlers.onMatchConfigurationUpdated);
    socket.on('addComputerPlayer', handlers.onAddComputerPlayer);
    socket.on('checkMatchConfigurationSaveName', handlers.onCheckMatchConfigurationSaveName);
    socket.on('saveMatchConfiguration', handlers.onSaveMatchConfiguration);
    socket.on('requestSavedMatchConfigurationList', handlers.onRequestSavedMatchConfigurationList);
    socket.on('loadSavedMatchConfiguration', handlers.onLoadSavedMatchConfiguration);
    socket.on('deleteSavedMatchConfiguration', handlers.onDeleteSavedMatchConfiguration);
    socket.on('searchCards', handlers.onSearchCards);
    socket.on('searchEvents', handlers.onSearchEvents);
    socket.on('searchLandmarks', handlers.onSearchLandmarks);
    socket.on('searchArtifacts', handlers.onSearchArtifacts);
    socket.on('searchProjects', handlers.onSearchProjects);
    socket.on('searchWays', handlers.onSearchWays);
    socket.on('searchTraits', handlers.onSearchTraits);
    socket.on('searchAllies', handlers.onSearchAllies);
    socket.on('searchProphecies', handlers.onSearchProphecies);
  }

  // Unbinds owner-only lobby handlers when ownership changes or match starts.
  public unbindOwnerLobbyHandlers(socket?: AppSocket) {
    if (!socket) {
      return;
    }

    socket.off('matchConfigurationUpdated');
    socket.off('addComputerPlayer');
    socket.off('checkMatchConfigurationSaveName');
    socket.off('saveMatchConfiguration');
    socket.off('requestSavedMatchConfigurationList');
    socket.off('loadSavedMatchConfiguration');
    socket.off('deleteSavedMatchConfiguration');
    socket.off('searchCards');
    socket.off('searchEvents');
    socket.off('searchLandmarks');
    socket.off('searchArtifacts');
    socket.off('searchProjects');
    socket.off('searchWays');
    socket.off('searchTraits');
    socket.off('searchAllies');
    socket.off('searchProphecies');
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
