import { Injectable } from '@angular/core';
import { CardLike } from 'shared/types';
import { cardStore } from '../state/card-state';
import { matchStore } from '../state/match-state';

/**
 * Preloads card and card-like images at match start so subsequent renders
 * get cache hits instead of network fetches.
 *
 * Call preloadMatchImages() once from MatchComponent's constructor. Both
 * matchStore and cardStore are guaranteed populated before the router
 * navigates to /match (SocketEventMapService emits matchReady only after
 * both stores are hydrated).
 */
@Injectable({ providedIn: 'root' })
export class CardImagePreloadService {

  /**
   * Collects all image paths for the current match and dispatches them in
   * batches via new Image(). Non-blocking — returns immediately after
   * scheduling the first microtask.
   */
  preloadMatchImages(): void {
    const match = matchStore.get();
    const cardsById = cardStore.get();
    if (!match || !cardsById) return;

    const seen = new Set<string>();
    const paths: string[] = [];

    /** Deduplicates and appends defined paths to the flat priority list. */
    const collect = (...values: (string | undefined | null)[]): void => {
      for (const p of values) {
        if (p && !seen.has(p)) {
          seen.add(p);
          paths.push(p);
        }
      }
    };

    // Priority 1: art images for supply piles — immediately visible on load.
    const supplyIds = [
      ...(match.cardSources['basicSupply'] ?? []),
      ...(match.cardSources['kingdomSupply'] ?? []),
    ];
    for (const id of supplyIds) {
      const card = cardsById[id];
      if (card) collect(card.artImagePath);
    }

    // Priority 2: detail + full images for card-likes shown in landscape panels.
    const cardLikes: CardLike[] = [
      ...match.events,
      ...match.landmarks,
      ...match.projects,
      ...match.ways,
      ...match.traits,
      ...match.allies,
      ...match.prophecies,
      ...(match.boons?.cards ?? []),
      ...(match.hexes?.cards ?? []),
      ...(match.states?.cards ?? []),
      ...(match.artifacts?.cards ?? []),
    ];
    for (const cl of cardLikes) {
      collect(cl.detailImagePath, cl.artImagePath);
    }

    // Priority 3: art + detail images for all cards in the library
    // (hand, play area, detail views). Supply images already deduplicated above.
    for (const card of Object.values(cardsById)) {
      collect(card.artImagePath, card.detailImagePath);
    }

    void this._dispatchBatches(paths);
  }

  /**
   * Fires image paths in small batches, yielding via queueMicrotask between
   * each batch so Angular rendering and browser layout are not starved.
   *
   * @param paths - Deduplicated image URLs ordered by display priority.
   * @param batchSize - Number of images dispatched per microtask tick.
   */
  private _dispatchBatches(paths: string[], batchSize = 6): Promise<void> {
    return new Promise<void>((resolve) => {
      let index = 0;
      const next = (): void => {
        if (index >= paths.length) { resolve(); return; }
        const end = Math.min(index + batchSize, paths.length);
        for (; index < end; index++) {
          const img = new Image();
          img.src = paths[index];
        }
        queueMicrotask(next);
      };
      queueMicrotask(next);
    });
  }
}
