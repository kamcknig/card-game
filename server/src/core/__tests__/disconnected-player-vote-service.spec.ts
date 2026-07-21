import { assertEquals, assertFalse } from '@std/assert';
import { createTestPlayer } from '../../testing/create-test-player.ts';
import { DisconnectedPlayerVoteService } from '../disconnected-player-vote-service.ts';

Deno.test('DisconnectedPlayerVoteService register/retract round trip', () => {
  const service = new DisconnectedPlayerVoteService();
  const voter = createTestPlayer({ id: 1, connected: true, isComputer: false });
  const target = createTestPlayer({ id: 2, connected: false, isComputer: false });
  const players = [voter, target];

  service.addPendingRemovalPlayer(players, target.id);

  const voteResult = service.registerRemovalVote(players, voter.id, target.id);
  assertEquals(voteResult, { accepted: true, allVoted: true });
  assertEquals(service.getVoteSnapshot(), [{ targetPlayerId: target.id, voterIds: [voter.id] }]);

  const retracted = service.retractRemovalVote(voter.id, target.id);
  assertEquals(retracted, true);
  assertEquals(service.getVoteSnapshot(), [{ targetPlayerId: target.id, voterIds: [] }]);

  // Retracting again with no active vote is a no-op.
  const secondRetract = service.retractRemovalVote(voter.id, target.id);
  assertFalse(secondRetract);
});

Deno.test('DisconnectedPlayerVoteService supports independent multi-target voting', () => {
  const service = new DisconnectedPlayerVoteService();
  const voter = createTestPlayer({ id: 1, connected: true, isComputer: false });
  const targetB = createTestPlayer({ id: 2, connected: false, isComputer: false });
  const targetC = createTestPlayer({ id: 3, connected: false, isComputer: false });
  const players = [voter, targetB, targetC];

  service.addPendingRemovalPlayer(players, targetB.id);
  service.addPendingRemovalPlayer(players, targetC.id);

  assertEquals(service.registerRemovalVote(players, voter.id, targetB.id).accepted, true);
  assertEquals(service.registerRemovalVote(players, voter.id, targetC.id).accepted, true);

  // Snapshot preserves queue (player) order and keeps each target's tally independent.
  assertEquals(service.getVoteSnapshot(), [
    { targetPlayerId: targetB.id, voterIds: [voter.id] },
    { targetPlayerId: targetC.id, voterIds: [voter.id] },
  ]);
});

Deno.test('DisconnectedPlayerVoteService.getCompletedTargetIds requires every connected non-target human to vote', () => {
  const service = new DisconnectedPlayerVoteService();
  const a = createTestPlayer({ id: 1, connected: true, isComputer: false });
  const b = createTestPlayer({ id: 2, connected: false, isComputer: false });
  const c = createTestPlayer({ id: 3, connected: false, isComputer: false });
  const players = [a, b, c];

  service.addPendingRemovalPlayer(players, b.id);
  service.addPendingRemovalPlayer(players, c.id);

  // A is the only connected non-target human, so A alone voting for C completes the tally.
  assertEquals(service.registerRemovalVote(players, a.id, c.id).accepted, true);
  assertEquals(service.getCompletedTargetIds(players), [c.id]);

  // Adding a second connected human who has not voted reopens the tally for C.
  const d = createTestPlayer({ id: 4, connected: true, isComputer: false });
  const playersWithD = [a, b, c, d];
  assertEquals(service.getCompletedTargetIds(playersWithD), []);
});

Deno.test('DisconnectedPlayerVoteService re-evaluates completion when the connected voter set shrinks', () => {
  const service = new DisconnectedPlayerVoteService();
  const a = createTestPlayer({ id: 1, connected: true, isComputer: false });
  const d = createTestPlayer({ id: 2, connected: true, isComputer: false });
  const target = createTestPlayer({ id: 3, connected: false, isComputer: false });
  const players = [a, d, target];

  service.addPendingRemovalPlayer(players, target.id);
  assertEquals(service.registerRemovalVote(players, a.id, target.id).accepted, true);

  // D is still connected and has not voted, so the tally is not yet complete.
  assertEquals(service.getCompletedTargetIds(players), []);

  // D disconnects — the required voter set shrinks to just A, who already voted.
  d.connected = false;
  assertEquals(service.getCompletedTargetIds(players), [target.id]);
});

Deno.test('DisconnectedPlayerVoteService.clearVotesByVoter removes a voter from every target', () => {
  const service = new DisconnectedPlayerVoteService();
  const a = createTestPlayer({ id: 1, connected: true, isComputer: false });
  const d = createTestPlayer({ id: 2, connected: true, isComputer: false });
  const targetB = createTestPlayer({ id: 3, connected: false, isComputer: false });
  const targetC = createTestPlayer({ id: 4, connected: false, isComputer: false });
  const players = [a, d, targetB, targetC];

  service.addPendingRemovalPlayer(players, targetB.id);
  service.addPendingRemovalPlayer(players, targetC.id);

  service.registerRemovalVote(players, a.id, targetB.id);
  service.registerRemovalVote(players, a.id, targetC.id);

  service.clearVotesByVoter(a.id);

  assertEquals(service.getVoteSnapshot(), [
    { targetPlayerId: targetB.id, voterIds: [] },
    { targetPlayerId: targetC.id, voterIds: [] },
  ]);
});

Deno.test('DisconnectedPlayerVoteService prunes vote entries alongside queue entries on reconnect', () => {
  const service = new DisconnectedPlayerVoteService();
  const a = createTestPlayer({ id: 1, connected: true, isComputer: false });
  const b = createTestPlayer({ id: 2, connected: false, isComputer: false });
  const c = createTestPlayer({ id: 3, connected: false, isComputer: false });
  const players = [a, b, c];

  service.addPendingRemovalPlayer(players, b.id);
  assertEquals(service.registerRemovalVote(players, a.id, b.id).accepted, true);

  // B reconnects; the next queue mutation (adding C) triggers the prune pass.
  b.connected = true;
  service.addPendingRemovalPlayer(players, c.id);

  const snapshotAfterPrune = service.getVoteSnapshot();
  assertFalse(snapshotAfterPrune.some(entry => entry.targetPlayerId === b.id));

  // B disconnects again and re-enters the queue with no leftover votes.
  b.connected = false;
  service.addPendingRemovalPlayer(players, b.id);
  const bEntry = service.getVoteSnapshot().find(entry => entry.targetPlayerId === b.id);
  assertEquals(bEntry?.voterIds, []);
});
