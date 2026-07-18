import { Card, CardId } from 'shared/types';

import { EndTurnReminderArgs, shouldRemindEndTurn } from './end-turn-reminder';

/**
 * Minimal card factory — only cardKey is inspected by shouldRemindEndTurn.
 */
function makeCard(fields: { id: CardId; cardKey: string }): Card {
  return {
    id: fields.id,
    cardKey: fields.cardKey,
  } as unknown as Card;
}

/** Builds a full args object with sensible "armed" defaults, overridable per test. */
function makeArgs(overrides: Partial<EndTurnReminderArgs> = {}): EndTurnReminderArgs {
  return {
    isSelfTurn: true,
    turnPhase: 'buy',
    promptLocked: false,
    awaitingServerLock: false,
    selectableIds: [],
    selfHandCardIds: new Set<CardId>(),
    cardsById: {},
    ...overrides,
  };
}

describe('shouldRemindEndTurn', () => {
  it('returns false when it is not the local player\'s turn', () => {
    const args = makeArgs({ isSelfTurn: false });
    expect(shouldRemindEndTurn(args)).toBe(false);
  });

  it('returns false when the turn phase is not buy', () => {
    const args = makeArgs({ turnPhase: 'action' });
    expect(shouldRemindEndTurn(args)).toBe(false);
  });

  it('returns false while a prompt dialog holds the UI', () => {
    const args = makeArgs({ promptLocked: true });
    expect(shouldRemindEndTurn(args)).toBe(false);
  });

  it('returns false while awaiting a server lock release', () => {
    const args = makeArgs({ awaitingServerLock: true });
    expect(shouldRemindEndTurn(args)).toBe(false);
  });

  it('returns false when a selectable id is in the player\'s hand (playable treasure)', () => {
    const copper = makeCard({ id: 1, cardKey: 'copper' });
    const args = makeArgs({
      selectableIds: [1],
      selfHandCardIds: new Set([1]),
      cardsById: { 1: copper },
    });
    expect(shouldRemindEndTurn(args)).toBe(false);
  });

  it('returns false when a selectable id does not resolve in the card library (event/project)', () => {
    const args = makeArgs({
      selectableIds: [99],
      cardsById: {},
    });
    expect(shouldRemindEndTurn(args)).toBe(false);
  });

  it('returns false when a selectable pile is not Copper/Curse (e.g. Estate)', () => {
    const estate = makeCard({ id: 2, cardKey: 'estate' });
    const args = makeArgs({
      selectableIds: [2],
      cardsById: { 2: estate },
    });
    expect(shouldRemindEndTurn(args)).toBe(false);
  });

  it('returns true when all selectables are Copper/Curse piles', () => {
    const copper = makeCard({ id: 1, cardKey: 'copper' });
    const curse = makeCard({ id: 2, cardKey: 'curse' });
    const args = makeArgs({
      selectableIds: [1, 2],
      cardsById: { 1: copper, 2: curse },
    });
    expect(shouldRemindEndTurn(args)).toBe(true);
  });

  it('returns true when the selectable list is empty (e.g. debt with no coin)', () => {
    const args = makeArgs({ selectableIds: [] });
    expect(shouldRemindEndTurn(args)).toBe(true);
  });
});
