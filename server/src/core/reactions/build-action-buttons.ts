import { Reaction } from '../../types.ts';
import { MatchCardLibrary } from '../match-card-library.ts';

export function buildActionButtons(
  grouped: Map<string, { count: number; reaction: Reaction }>,
  cardLibrary: MatchCardLibrary,
) {
  let actionId = 1;
  const buttons = [{ action: 0, label: 'Cancel' }];
  for (const [_cardKey, { count, reaction: { id } }] of grouped) {
    const [, cardId] = id.split(':');
    const cardName = cardLibrary.getCard(+cardId).cardName;
    buttons.push({ action: actionId++, label: `${cardName} (${count})` });
  }
  return buttons;
}