import { assertEquals } from '@std/assert';
import type { Card, Match } from 'shared/types/index.ts';
import { CardSourceController } from '../card-source-controller.ts';
import type { CardPriceRulesController } from '../card-price-rules-controller.ts';
import type { LoggerService } from '../logger-service.ts';
import type { MatchCardLibrary } from '../match-card-library.ts';
import { createInitialMatchState } from '../match-state-factory.ts';
import { FindCardsService } from '../find-cards-service.ts';

// Captures messages emitted by stubbed loggerService.warn for assertions.
const buildLoggerStub = () => {
  const warnings: string[] = [];
  const stub = {
    debug: () => {},
    info: () => {},
    log: () => {},
    warn: (...parts: unknown[]) => {
      warnings.push(parts.join(' '));
    },
    error: () => {},
  } as unknown as LoggerService;
  return { stub, warnings };
};

// Builds a minimal MatchCardLibrary stub seeded with the provided cards.
const buildCardLibraryStub = (cards: Card[]) => {
  const byId = new Map(cards.map(card => [card.id, card]));
  return {
    getAllCardsAsArray: () => cards,
    getCard: (cardId: number) => {
      const card = byId.get(cardId);
      if (!card) throw new Error(`unable to locate card ${cardId}`);
      return card;
    },
  } as unknown as MatchCardLibrary;
};

// CardPriceRulesController is unused for these source-only tests.
const priceController = {} as CardPriceRulesController;

const buildService = (cards: Card[] = []) => {
  const match: Match = createInitialMatchState();
  const cardSourceController = new CardSourceController(match);
  const library = buildCardLibraryStub(cards);
  const { stub: logger, warnings } = buildLoggerStub();
  const service = new FindCardsService(cardSourceController, priceController, library, logger);
  return { service, cardSourceController, warnings };
};

Deno.test('FindCardsService.findCards returns empty and warns when player-scoped zone is not registered', () => {
  const { service, warnings } = buildService();

  const result = service.findCards({ location: 'tavern', playerId: 11 });

  assertEquals(result, []);
  assertEquals(warnings.length, 1);
  assertEquals(
    warnings[0],
    `[find cards] requested zone 'tavern' for playerId=11 is not registered; treating as empty`,
  );
});

Deno.test('FindCardsService.findCards returns empty and warns when global zone is not registered', () => {
  const { service, warnings } = buildService();

  const result = service.findCards({ location: 'trash' });

  assertEquals(result, []);
  assertEquals(warnings.length, 1);
  assertEquals(warnings[0], `[find cards] requested zone 'trash' is not registered; treating as empty`);
});

Deno.test('FindCardsService.findCards does not warn when a player-scoped zone is registered', () => {
  const { service, cardSourceController, warnings } = buildService();
  cardSourceController.registerZone('tavern', [], 11);

  const result = service.findCards({ location: 'tavern', playerId: 11 });

  assertEquals(result, []);
  assertEquals(warnings, []);
});

Deno.test('FindCardsService.findCards does not warn when only the global zone is registered for a player query', () => {
  const { service, cardSourceController, warnings } = buildService();
  cardSourceController.registerZone('trash', []);

  // No player-scoped zone exists, but the global fallback is registered — should not warn.
  const result = service.findCards({ location: 'trash', playerId: 11 });

  assertEquals(result, []);
  assertEquals(warnings, []);
});
