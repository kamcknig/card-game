import { Reaction } from '../../types.ts';
import { formatCardName } from '../../utils/format-card-name.ts';
import { MatchCardLibrary } from '../match-card-library.ts';

export function buildActionButtons(
  grouped: Map<string, { count: number; reaction: Reaction }>,
  cardLibrary: MatchCardLibrary,
) {
  let actionId = 1;
  const buttons = [{ action: 0, label: 'Cancel' }];
  for (const [_cardKey, { count, reaction }] of grouped) {
    // Try to resolve the reaction source name from the card library.
    const [, cardId] = reaction.id.split(':');
    const parsedId = Number(cardId);
    let cardName: string | undefined;
    if (!Number.isNaN(parsedId)) {
      try {
        cardName = cardLibrary.getCard(parsedId).cardName;
      } catch (error) {
        // Fall back when the reaction source isn't a regular card (events/landmarks/tokens).
        console.debug(
          `[buildActionButtons] unable to resolve card ${parsedId}, falling back to card key`,
        );
      }
    }
    // Use the reaction key formatted as a name for non-card reactions.
    const resolvedName = cardName ?? formatCardName(reaction.getSourceKey());
    buttons.push({ action: actionId++, label: `${resolvedName} (${count})` });
  }
  return buttons;
}
