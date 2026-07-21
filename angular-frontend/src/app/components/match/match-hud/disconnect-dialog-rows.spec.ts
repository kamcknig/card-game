import { PlayerRemovedFromMatchPayload, RemovalVoteStateEntry } from 'shared/types';

import { buildDisconnectDialogRows, DisconnectDialogRowArgs } from './disconnect-dialog-rows';

/** Builds a full args object with sensible empty defaults, overridable per test. */
function makeArgs(overrides: Partial<DisconnectDialogRowArgs> = {}): DisconnectDialogRowArgs {
  return {
    disconnected: [],
    removed: [],
    voteState: [],
    selfPlayerId: 1,
    ...overrides,
  };
}

describe('buildDisconnectDialogRows', () => {
  it('returns one active row per disconnected player when nothing is removed or voted', () => {
    const rows = buildDisconnectDialogRows(makeArgs({
      disconnected: [
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
      ],
    }));

    expect(rows).toEqual([
      { playerId: 2, name: 'B', removed: false, votedBySelf: false },
      { playerId: 3, name: 'C', removed: false, votedBySelf: false },
    ]);
  });

  it('marks votedBySelf true only for the target the self id voted for', () => {
    const voteState: RemovalVoteStateEntry[] = [
      { targetPlayerId: 2, voterIds: [1] },
      { targetPlayerId: 3, voterIds: [4] },
    ];
    const rows = buildDisconnectDialogRows(makeArgs({
      disconnected: [
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
      ],
      voteState,
      selfPlayerId: 1,
    }));

    expect(rows.find(row => row.playerId === 2)?.votedBySelf).toBe(true);
    expect(rows.find(row => row.playerId === 3)?.votedBySelf).toBe(false);
  });

  it('appends removed rows with removed: true and no vote state', () => {
    const removed: PlayerRemovedFromMatchPayload[] = [
      { playerId: 5, playerName: 'D', reason: 'resigned' },
    ];
    const rows = buildDisconnectDialogRows(makeArgs({
      disconnected: [{ id: 2, name: 'B' }],
      removed,
    }));

    expect(rows).toEqual([
      { playerId: 2, name: 'B', removed: false, votedBySelf: false },
      { playerId: 5, name: 'D', removed: true, votedBySelf: false },
    ]);
  });

  it('dedupes a player present in both disconnected and removed lists, rendering only the removed row', () => {
    const removed: PlayerRemovedFromMatchPayload[] = [
      { playerId: 2, playerName: 'B', reason: 'voted' },
    ];
    const rows = buildDisconnectDialogRows(makeArgs({
      disconnected: [{ id: 2, name: 'B' }],
      removed,
    }));

    expect(rows).toEqual([
      { playerId: 2, name: 'B', removed: true, votedBySelf: false },
    ]);
  });

  it('yields votedBySelf: false for every row when selfPlayerId is undefined', () => {
    const voteState: RemovalVoteStateEntry[] = [
      { targetPlayerId: 2, voterIds: [1, 3] },
    ];
    const rows = buildDisconnectDialogRows(makeArgs({
      disconnected: [{ id: 2, name: 'B' }],
      voteState,
      selfPlayerId: undefined,
    }));

    expect(rows.every(row => !row.votedBySelf)).toBe(true);
  });
});
