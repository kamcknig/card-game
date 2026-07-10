import { assertEquals } from '@std/assert';
import { MatchSetupService } from '../match-setup-service.ts';
import { createTestLogger } from '../../testing/create-test-logger.ts';
import type { Card, CardId, Match } from 'shared/types/index.ts';
import type { MatchCardLibrary } from '../match-card-library.ts';
import type { CardSourceController } from '../card-source-controller.ts';
import type { CardInstanceFactoryService } from '../card-instance-factory-service.ts';
import type { RngService } from '../rng-service.ts';

// Minimal card fixture — loadCardLibraryFromState only reads `id` off of it
// before handing the whole object to rehydrateCard (stubbed as identity below).
const makeCard = (id: CardId): Card => ({ id, cardKey: `card-${id}` }) as unknown as Card;

// Builds a MatchSetupService wired to a fake id allocator so tests can assert
// on the allocator's post-call value without a full CardInstanceFactoryService.
const makeService = (initialCardCount: number) => {
  const { loggerService } = createTestLogger();
  const addedCards: Card[] = [];
  const cardLibrary = {
    addCard: (card: Card) => addedCards.push(card),
  } as unknown as MatchCardLibrary;

  let cardCount = initialCardCount;
  const cardInstanceFactoryService = {
    getCardCount: () => cardCount,
    setCardCount: (value: number) => {
      cardCount = value;
    },
    rehydrateCard: (card: Card) => card,
  } as unknown as CardInstanceFactoryService;

  const service = new MatchSetupService(
    {} as Match,
    cardLibrary,
    {} as CardSourceController,
    cardInstanceFactoryService,
    {} as RngService,
    loggerService,
  );

  return { service, cardInstanceFactoryService, addedCards };
};

Deno.test('MatchSetupService.loadCardLibraryFromState advances the id allocator past the highest loaded id', () => {
  const { service, cardInstanceFactoryService, addedCards } = makeService(0);

  service.loadCardLibraryFromState({
    5: makeCard(5),
    12: makeCard(12),
    3: makeCard(3),
  } as unknown as Record<CardId, Card>);

  // Every loaded card must have been rehydrated and added to the library.
  assertEquals(addedCards.length, 3);
  // The allocator must land past the highest id present in the loaded state,
  // so post-load card creation (e.g. Nocturne heirlooms) cannot collide.
  assertEquals(cardInstanceFactoryService.getCardCount(), 12);
});

Deno.test('MatchSetupService.loadCardLibraryFromState never lowers an already-advanced allocator', () => {
  const { service, cardInstanceFactoryService } = makeService(50);

  service.loadCardLibraryFromState({
    5: makeCard(5),
    12: makeCard(12),
  } as unknown as Record<CardId, Card>);

  // Loaded ids are all below the current allocator value — it must stay put.
  assertEquals(cardInstanceFactoryService.getCardCount(), 50);
});

Deno.test('MatchSetupService.loadCardLibraryFromState is a no-op on the allocator for an empty state', () => {
  const { service, cardInstanceFactoryService, addedCards } = makeService(7);

  service.loadCardLibraryFromState({} as unknown as Record<CardId, Card>);

  assertEquals(addedCards.length, 0);
  assertEquals(cardInstanceFactoryService.getCardCount(), 7);
});
