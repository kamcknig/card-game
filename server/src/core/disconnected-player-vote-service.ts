import { Player, PlayerId, RemovalVoteStateEntry } from 'shared/types/index.ts';

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
    this._pendingRemovalQueue = this._pendingRemovalQueue.filter(id => id !== playerId);
    this._removalVotes.delete(playerId);
    this.sortPendingRemovalQueue(players);
  }

  // Records a removal vote and returns whether vote was accepted and complete.
  public registerRemovalVote(players: Player[], voterId: PlayerId, targetPlayerId: PlayerId): RemovalVoteResult {
    const target = players.find(player => player.id === targetPlayerId);
    const voter = players.find(player => player.id === voterId);

    if (!target || !voter) {
      return { accepted: false, allVoted: false };
    }

    if (target.isComputer || target.connected) {
      return { accepted: false, allVoted: false };
    }

    if (voter.isComputer || !voter.connected) {
      return { accepted: false, allVoted: false };
    }

    const connectedHumans = players.filter(
      player => player.connected && !player.isComputer && player.id !== targetPlayerId,
    );

    if (!connectedHumans.length) {
      return { accepted: false, allVoted: false };
    }

    const votes = this._removalVotes.get(targetPlayerId) ?? new Set<PlayerId>();
    votes.add(voterId);
    this._removalVotes.set(targetPlayerId, votes);

    const allVoted = connectedHumans.every(player => votes.has(player.id));
    return { accepted: true, allVoted };
  }

  // True when the player is currently queued for removal voting.
  public isPendingRemoval(playerId: PlayerId): boolean {
    return this._pendingRemovalQueue.includes(playerId);
  }

  // Removes one voter's vote for one target. Returns whether a vote was
  // actually removed (false when no such vote existed).
  public retractRemovalVote(voterId: PlayerId, targetPlayerId: PlayerId): boolean {
    const votes = this._removalVotes.get(targetPlayerId);
    if (!votes?.has(voterId)) {
      return false;
    }
    votes.delete(voterId);
    return true;
  }

  // Clears every vote cast BY the given player across all targets. Used
  // when a voter permanently leaves the match (resign/vote-out) so stale
  // voter ids do not linger in broadcast snapshots.
  public clearVotesByVoter(voterId: PlayerId): void {
    for (const votes of this._removalVotes.values()) {
      votes.delete(voterId);
    }
  }

  // Serializable snapshot of all pending targets and their current voters,
  // in queue (player) order. Broadcast to clients after every change.
  public getVoteSnapshot(): RemovalVoteStateEntry[] {
    return this._pendingRemovalQueue.map(targetPlayerId => ({
      targetPlayerId,
      voterIds: [...(this._removalVotes.get(targetPlayerId) ?? [])],
    }));
  }

  // Pending targets whose tally is currently complete: every connected
  // human other than the target has an active vote. Re-checked whenever
  // the connected set shrinks (voter disconnect/resign) because that can
  // complete a tally without a new vote arriving.
  public getCompletedTargetIds(players: Player[]): PlayerId[] {
    return this._pendingRemovalQueue.filter(targetPlayerId => {
      const votes = this._removalVotes.get(targetPlayerId);
      if (!votes) return false;
      const connectedHumans = players.filter(
        player => player.connected && !player.isComputer && player.id !== targetPlayerId,
      );
      if (!connectedHumans.length) return false;
      return connectedHumans.every(player => votes.has(player.id));
    });
  }

  // Keeps pending queue sorted by player order and removes invalid targets.
  private sortPendingRemovalQueue(players: Player[]) {
    const disconnectedHumans = new Set(
      players.filter(player => !player.connected && !player.isComputer).map(player => player.id),
    );

    // Prune vote entries alongside queue entries so reconnected targets do
    // not leak stale vote sets into later snapshots.
    for (const id of this._pendingRemovalQueue) {
      if (!disconnectedHumans.has(id)) {
        this._removalVotes.delete(id);
      }
    }
    this._pendingRemovalQueue = this._pendingRemovalQueue.filter(id => disconnectedHumans.has(id));

    const orderById = new Map(players.map((player, index) => [player.id, index]));
    this._pendingRemovalQueue.sort((a, b) => (orderById.get(a) ?? 0) - (orderById.get(b) ?? 0));
  }
}
