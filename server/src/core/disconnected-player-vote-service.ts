import { Player, PlayerId } from 'shared/types/index.ts';

export type RemovalVoteResult = {
  accepted: boolean;
  allVoted: boolean;
};

// Tracks disconnected-player removal votes with deterministic queue ordering.
export class DisconnectedPlayerVoteService {
  private _pendingRemovalQueue: PlayerId[] = [];
  private _removalVotes: Map<PlayerId, Set<PlayerId>> = new Map();

  // Clears all queued removal state, typically when a match resets.
  public reset() {
    this._pendingRemovalQueue = [];
    this._removalVotes.clear();
  }

  // Returns the current pending disconnected player target, if any.
  public getPendingRemovalPlayerId(): PlayerId | undefined {
    return this._pendingRemovalQueue[0];
  }

  // Adds a disconnected human player to the pending removal queue.
  public addPendingRemovalPlayer(players: Player[], playerId: PlayerId) {
    if (this._pendingRemovalQueue.includes(playerId)) {
      return;
    }

    this._pendingRemovalQueue.push(playerId);
    this._removalVotes.set(playerId, this._removalVotes.get(playerId) ?? new Set());
    this.sortPendingRemovalQueue(players);
  }

  // Removes a disconnected player from pending queue and clears their votes.
  public removePendingRemovalPlayer(players: Player[], playerId: PlayerId) {
    this._pendingRemovalQueue = this._pendingRemovalQueue.filter((id) => id !== playerId);
    this._removalVotes.delete(playerId);
    this.sortPendingRemovalQueue(players);
  }

  // Records a removal vote and returns whether vote was accepted and complete.
  public registerRemovalVote(
    players: Player[],
    voterId: PlayerId,
    targetPlayerId: PlayerId,
  ): RemovalVoteResult {
    const target = players.find((player) => player.id === targetPlayerId);
    const voter = players.find((player) => player.id === voterId);

    if (!target || !voter) {
      return { accepted: false, allVoted: false };
    }

    if (target.isComputer || target.connected) {
      return { accepted: false, allVoted: false };
    }

    if (voter.isComputer || !voter.connected) {
      return { accepted: false, allVoted: false };
    }

    const connectedHumans = players.filter((player) =>
      player.connected && !player.isComputer && player.id !== targetPlayerId
    );

    if (!connectedHumans.length) {
      return { accepted: false, allVoted: false };
    }

    const votes = this._removalVotes.get(targetPlayerId) ?? new Set<PlayerId>();
    votes.add(voterId);
    this._removalVotes.set(targetPlayerId, votes);

    const allVoted = connectedHumans.every((player) => votes.has(player.id));
    return { accepted: true, allVoted };
  }

  // Keeps pending queue sorted by player order and removes invalid targets.
  private sortPendingRemovalQueue(players: Player[]) {
    const disconnectedHumans = new Set(
      players
        .filter((player) => !player.connected && !player.isComputer)
        .map((player) => player.id),
    );

    this._pendingRemovalQueue = this._pendingRemovalQueue.filter((id) => disconnectedHumans.has(id));

    const orderById = new Map(players.map((player, index) => [player.id, index]));
    this._pendingRemovalQueue.sort((a, b) => (orderById.get(a) ?? 0) - (orderById.get(b) ?? 0));
  }
}
