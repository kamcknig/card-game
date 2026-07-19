import { PlayerId, PlayerRemovedFromMatchPayload, RemovalVoteStateEntry } from 'shared/types';

// One row of the disconnect dialog: an active (votable) disconnected
// player or a permanently removed one.
export interface DisconnectDialogRow {
  playerId: PlayerId;
  name: string;
  // True for voted-out/resigned players: rendered "<name> (removed)",
  // disabled, no button.
  removed: boolean;
  // True when the viewing player has an active kick vote for this row.
  votedBySelf: boolean;
}

export interface DisconnectDialogRowArgs {
  // Readonly: nanostores wraps object/array atom values as readonly when
  // read via NanostoresService#useStore, so callers pass signal reads directly.
  disconnected: readonly { id: PlayerId; name: string }[];
  removed: readonly PlayerRemovedFromMatchPayload[];
  voteState: readonly RemovalVoteStateEntry[];
  selfPlayerId: PlayerId | undefined;
}

/**
 * Builds the disconnect dialog's row list: active disconnected players
 * first (with the viewer's current vote state), then permanently removed
 * players. A player present in both inputs (possible briefly between the
 * playerRemovedFromMatch and setPlayerList broadcasts) renders once, as
 * removed.
 */
export function buildDisconnectDialogRows(args: DisconnectDialogRowArgs): DisconnectDialogRow[] {
  const removedIds = new Set(args.removed.map(entry => entry.playerId));

  const activeRows: DisconnectDialogRow[] = args.disconnected
    .filter(player => !removedIds.has(player.id))
    .map(player => ({
      playerId: player.id,
      name: player.name,
      removed: false,
      votedBySelf: args.selfPlayerId !== undefined &&
        (args.voteState.find(entry => entry.targetPlayerId === player.id)?.voterIds.includes(args.selfPlayerId) ?? false),
    }));

  const removedRows: DisconnectDialogRow[] = args.removed.map(entry => ({
    playerId: entry.playerId,
    name: entry.playerName,
    removed: true,
    votedBySelf: false,
  }));

  return [...activeRows, ...removedRows];
}
