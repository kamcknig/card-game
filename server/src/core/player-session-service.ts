import { Player, PlayerId } from 'shared/types/index.ts';

// Encapsulates player-session and owner-selection decisions.
export class PlayerSessionService {
  // Selects owner when a player joins and current owner is missing or computer-controlled.
  public selectOwnerOnJoin(currentOwner: Player | undefined, joinedPlayer: Player): Player {
    if (!currentOwner || currentOwner.isComputer) {
      return joinedPlayer;
    }
    return currentOwner;
  }

  // Returns true when there is at least one connected human player.
  public hasConnectedHumanPlayers(players: Player[]): boolean {
    return players.some(player => player.connected && !player.isComputer);
  }

  // Returns true when there is at least one disconnected human player.
  public hasDisconnectedHumanPlayers(players: Player[]): boolean {
    return players.some(player => !player.connected && !player.isComputer);
  }

  // Finds a connected human replacement owner.
  public findReplacementOwner(players: Player[], excludedPlayerId?: PlayerId): Player | undefined {
    return players.find(player => player.connected && !player.isComputer && player.id !== excludedPlayerId);
  }
}
