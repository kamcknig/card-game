import { Reaction } from '@server-types/index.ts';
import { formatCardName } from '../../utils/format-card-name.ts';
import { MatchCardLibrary } from '../match-card-library.ts';

export function buildActionButtons(
  grouped: Map<string, { count: number; reaction: Reaction }>,
  cardLibrary: MatchCardLibrary,
) {
  let actionId = 1;
  const buttons = [{ action: 0, label: 'Cancel' }];
  for (const [_cardKey, { count, reaction }] of grouped) {
    // Prefer explicit reaction source names for labels.
    let resolvedName = reaction.sourceName;
    // Fallback to card library lookup when a source id is provided or embedded.
    const parsedId = reaction.sourceId ?? Number(reaction.id.split(':')[1]);
    if (!resolvedName && !Number.isNaN(parsedId)) {
      try {
        resolvedName = cardLibrary.getCard(parsedId).cardName;
      } catch (error) {
        // Fall back when the reaction source isn't a regular card (events/landmarks/tokens).
        console.debug(
          `[buildActionButtons] unable to resolve card ${parsedId}, falling back to key`,
        );
      }
    }
    // Final fallback to a formatted key for non-card reactions.
    if (!resolvedName) {
      console.debug(
        `[buildActionButtons] unable to resolve reaction name, using source key`,
      );
      resolvedName = formatCardName(reaction.getSourceKey());
    }
    buttons.push({ action: actionId++, label: `${resolvedName} (${count})` });
  }
  return buttons;
}
