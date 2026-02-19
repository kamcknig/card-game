import {
  awaitingServerLockReleaseStore,
  clientSelectableCardsOverrideStore,
  promptInteractionLockStore,
  promptWaySelectableCardsOverrideStore,
} from './interactive-state';
import { computed } from 'nanostores';
import { matchStore } from './match-state';
import { selfPlayerIdStore } from './player-state';
import { cardSourceStore } from './card-source-store';
import { cardStore } from './card-state';

export const serverSelectableCardsStore = computed([matchStore, selfPlayerIdStore], (match, selfPlayerId) => {
  if (!match || selfPlayerId == null) return [];
  return match.selectableCards?.[selfPlayerId] ?? [];
});


// Final store that components should subscribe to
export const selectableCardStore = computed(
  [clientSelectableCardsOverrideStore, serverSelectableCardsStore],
  (clientOverride, serverCards) => clientOverride ?? serverCards
);

// Cards that can currently be played as a Way from the active player's hand.
export const waySelectableCardStore = computed(
  [
    selectableCardStore,
    matchStore,
    selfPlayerIdStore,
    cardSourceStore,
    cardStore,
    promptInteractionLockStore,
    awaitingServerLockReleaseStore,
    promptWaySelectableCardsOverrideStore,
  ],
  (
    selectableCards,
    match,
    selfPlayerId,
    sourceMap,
    cardsById,
    promptInteractionLocked,
    awaitingServerLockRelease,
    promptWaySelectableCardsOverride,
  ) => {
    // Keep normal lock behavior, but allow explicit prompt-driven Way selection to work while awaiting card resolution.
    if (awaitingServerLockRelease && promptWaySelectableCardsOverride === null) {
      return [];
    }

    // Prompt locking normally disables way hover, except explicit play-selection prompts.
    if (promptInteractionLocked && promptWaySelectableCardsOverride === null) {
      return [];
    }

    if (!match || selfPlayerId == null || (match.ways?.length ?? 0) === 0) {
      return [];
    }

    const handCardIds = sourceMap[`playerHand:${selfPlayerId}`] ?? [];
    const handCardIdSet = new Set(handCardIds);
    const candidateCards = promptWaySelectableCardsOverride ?? selectableCards;
    const enforceHandSource = promptWaySelectableCardsOverride === null;

    return candidateCards.filter((cardId) => {
      if (enforceHandSource && !handCardIdSet.has(cardId)) {
        return false;
      }

      const card = cardsById[cardId];
      return !!card && card.type.includes('ACTION');
    });
  }
);

(globalThis as any).selectableCardStore = selectableCardStore;
(globalThis as any).serverSelectableCardsStore = serverSelectableCardsStore;
(globalThis as any).waySelectableCardStore = waySelectableCardStore;
