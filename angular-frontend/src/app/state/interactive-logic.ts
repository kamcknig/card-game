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
import { CardId } from 'shared/types';

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

// Card ids that are currently the visible top card of a basic- or
// kingdom-supply pile. The top of a pile is the LAST matching card in the
// source array's own order (matching the server's authoritative
// findTopSupplyCardForPileKey, find-cards-service.ts:132-145) — not the
// highest card id. Ordinarily array order and id order coincide, but
// rotateSplitPile (game-action-controller.ts:1713-1753) reorders array
// positions in place without renumbering ids, so after a split-pile
// rotation the true top can have a lower id than cards now buried beneath
// it. Used by MatchScene to decide whether a select-card request can run
// directly on the board instead of in a dialog.
export const supplyPileTopCardIdsStore = computed(
  [cardSourceStore, cardStore],
  (sourceMap, cardsById) => {
    const topIds = new Set<CardId>();
    for (const sourceKey of ['basicSupply', 'kingdomSupply'] as const) {
      const topByPile = new Map<string, CardId>();
      for (const cardId of sourceMap[sourceKey] ?? []) {
        const card = cardsById[cardId];
        if (!card) {
          continue;
        }
        const pileKey = card.kingdom ?? card.cardKey;
        // Later entries in array order overwrite earlier ones, so the last
        // write per pile key is the true current top.
        topByPile.set(pileKey, cardId);
      }
      for (const topId of topByPile.values()) {
        topIds.add(topId);
      }
    }
    return topIds;
  }
);

(globalThis as any).selectableCardStore = selectableCardStore;
(globalThis as any).serverSelectableCardsStore = serverSelectableCardsStore;
(globalThis as any).waySelectableCardStore = waySelectableCardStore;
(globalThis as any).supplyPileTopCardIdsStore = supplyPileTopCardIdsStore;
