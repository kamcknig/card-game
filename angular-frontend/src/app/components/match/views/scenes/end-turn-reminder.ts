import { Card, CardId } from 'shared/types';

/**
 * Supply piles ignored by the "player still has plays" test: buying
 * Copper/Curse is always legal (both cost $0) so buy-phase selectables are
 * never empty — a player whose only options are these is considered done.
 */
const REMINDER_IGNORABLE_PILE_KEYS: ReadonlySet<string> = new Set(['copper', 'curse']);

export interface EndTurnReminderArgs {
  /** True when the local player is the current turn player. */
  isSelfTurn: boolean;
  /** Current turn phase name. */
  turnPhase: string;
  /** True while a prompt dialog holds the UI. */
  promptLocked: boolean;
  /** True while a turn action is awaiting server completion. */
  awaitingServerLock: boolean;
  /** Server-computed selectable ids for the local player (cards AND card-likes). */
  selectableIds: readonly CardId[];
  /** Card ids currently in the local player's hand. */
  selfHandCardIds: ReadonlySet<CardId>;
  /** Client card library (CardId → Card). Card-like ids (events/projects) do not resolve here. */
  cardsById: Readonly<Record<CardId, Card | undefined>>;
}

/**
 * Decides whether the end-turn reminder should be armed.
 *
 * Armed only in the buy phase — the night side needs no client logic: the
 * server auto-skips night when the hand has no Night cards, and a hand WITH
 * Night cards means the player still has plays.
 *
 * "No plays" = every selectable id is an ignorable junk pile: not a card in
 * the player's hand (that would be a playable treasure), and resolving in
 * the card library to a Copper/Curse pile card. Ids that do not resolve are
 * events/projects (card-likes) — real choices — and disarm. An empty
 * selectable list passes trivially (e.g. debt with no coin): genuinely
 * nothing to do but end the turn.
 */
export function shouldRemindEndTurn(args: EndTurnReminderArgs): boolean {
  if (!args.isSelfTurn || args.turnPhase !== 'buy') {
    return false;
  }
  if (args.promptLocked || args.awaitingServerLock) {
    return false;
  }
  return args.selectableIds.every((id) => {
    // A selectable card in hand is a playable treasure — the player has a play.
    if (args.selfHandCardIds.has(id)) {
      return false;
    }
    const card = args.cardsById[id];
    // Unresolvable id = event/project card-like — an affordable choice.
    if (!card) {
      return false;
    }
    return REMINDER_IGNORABLE_PILE_KEYS.has(card.cardKey);
  });
}
