import { assertEquals } from '@std/assert';
import {
  Ally,
  Artifact,
  Boon,
  Card,
  CardLike,
  Event,
  Hex,
  isLocationMat,
  Landmark,
  Player,
  Project,
  Prophecy,
  State,
  Trait,
  Way,
} from 'shared/types/index.ts';

// Builds minimal CardLike args for constructing entity instances in tests.
const createCardLikeArgs = (overrides: Partial<CardLike> = {}): CardLike => ({
  id: 1,
  cardKey: 'test-card',
  cardName: 'Test Card',
  cost: { treasure: 3 },
  artImagePath: '/full/test-card.jpg',
  detailImagePath: '/detail/test-card.jpg',
  metadata: {},
  ...overrides,
} as CardLike);

// --- isLocationMat ---

Deno.test('isLocationMat returns true for valid mat values', () => {
  assertEquals(isLocationMat('island'), true);
  assertEquals(isLocationMat('native-village'), true);
  assertEquals(isLocationMat('exile'), true);
  assertEquals(isLocationMat('set-aside'), true);
  assertEquals(isLocationMat('tavern'), true);
});

Deno.test('isLocationMat returns false for non-mat location strings', () => {
  assertEquals(isLocationMat('playerHand'), false);
  assertEquals(isLocationMat('trash'), false);
  assertEquals(isLocationMat('playArea'), false);
});

Deno.test('isLocationMat returns false for null and undefined', () => {
  assertEquals(isLocationMat(null), false);
  assertEquals(isLocationMat(undefined), false);
});

Deno.test('isLocationMat returns false for empty string', () => {
  assertEquals(isLocationMat(''), false);
});

// --- Player ---

Deno.test('Player constructor assigns all fields from args', () => {
  const player = new Player({
    id: 5,
    name: 'Alice',
    sessionId: 'sess-1',
    socketId: 'sock-1',
    connected: true,
    ready: false,
    color: 'red',
    isComputer: true,
  });

  assertEquals(player.id, 5);
  assertEquals(player.name, 'Alice');
  assertEquals(player.sessionId, 'sess-1');
  assertEquals(player.socketId, 'sock-1');
  assertEquals(player.connected, true);
  assertEquals(player.ready, false);
  assertEquals(player.color, 'red');
  assertEquals(player.isComputer, true);
});

Deno.test('Player constructor defaults isComputer to false', () => {
  const player = new Player({
    id: 1,
    name: 'Bob',
    sessionId: 'sess-2',
    socketId: 'sock-2',
    connected: true,
    ready: true,
    color: 'blue',
  });

  assertEquals(player.isComputer, false);
});

Deno.test('Player.toString returns formatted player string', () => {
  const player = new Player({
    id: 3,
    name: 'Charlie',
    sessionId: 's',
    socketId: 's',
    connected: true,
    ready: true,
    color: 'green',
  });

  assertEquals(player.toString(), '[PLAYER 3 - Charlie]');
});

// --- CardLike ---

Deno.test('CardLike constructor assigns all fields with defaults', () => {
  const cardLike = new CardLike(createCardLikeArgs({ id: 10 }));

  assertEquals(cardLike.id, 10);
  assertEquals(cardLike.cardKey, 'test-card');
  assertEquals(cardLike.cardName, 'Test Card');
  assertEquals(cardLike.cost, { treasure: 3 });
  assertEquals(cardLike.kingdomSelectable, true);
});

Deno.test('CardLike constructor defaults optional fields when not provided', () => {
  const cardLike = new CardLike({
    id: 11,
  } as CardLike);

  assertEquals(cardLike.cardKey, '');
  assertEquals(cardLike.cardName, '');
  assertEquals(cardLike.abilityText, '');
  assertEquals(cardLike.artImagePath, '');
  assertEquals(cardLike.detailImagePath, '');
  assertEquals(cardLike.kingdomSelectable, true);
  assertEquals(cardLike.cost, { treasure: 0 });
});

Deno.test('CardLike.toString returns formatted string', () => {
  const cardLike = new CardLike(createCardLikeArgs({ id: 20, cardKey: 'village' }));

  assertEquals(cardLike.toString(), '[CARD-LIKE 20 - village]');
});

Deno.test('CardLike Deno.customInspect returns toString value', () => {
  const cardLike = new CardLike(createCardLikeArgs({ id: 21, cardKey: 'smithy' }));
  const inspectFn = cardLike[Symbol.for('Deno.customInspect') as unknown as keyof CardLike] as () => string;

  assertEquals(inspectFn.call(cardLike), '[CARD-LIKE 21 - smithy]');
});

// --- Card ---

Deno.test('Card constructor assigns all card-specific fields', () => {
  const card = new Card({
    ...createCardLikeArgs({ id: 100 }),
    abilityText: '+2 Cards',
    expansionName: 'base-v2',
    artImagePath: '/half/village.jpg',
    kingdom: 'village',
    type: ['ACTION'],
    partOfSupply: true,
    mat: undefined,
  });

  assertEquals(card.id, 100);
  assertEquals(card.abilityText, '+2 Cards');
  assertEquals(card.expansionName, 'base-v2');
  // CardLike base constructor derives art/detail URLs from expansionName + cardKey,
  // so the path passed in args is overridden with the canonical flat-layout URL.
  assertEquals(card.artImagePath, './assets/card-images/base-v2/test-card-art.jpg');
  assertEquals(card.kingdom, 'village');
  assertEquals(card.type, ['ACTION']);
  assertEquals(card.partOfSupply, true);
  assertEquals(card.facing, 'front');
  assertEquals(card.isBasic, false);
  assertEquals(card.victoryPoints, 0);
  assertEquals(card.owner, null);
  assertEquals(card.tags, []);
});

Deno.test('Card constructor uses provided optional values', () => {
  const card = new Card({
    ...createCardLikeArgs({ id: 101 }),
    abilityText: '1VP per 10 cards',
    expansionName: 'base-v2',
    artImagePath: '/half/gardens.jpg',
    kingdom: 'gardens',
    type: ['VICTORY', 'ACTION'],
    partOfSupply: true,
    mat: 'island',
    facing: 'back',
    isBasic: true,
    victoryPoints: 4,
    owner: 2,
    tags: ['garden'],
  });

  assertEquals(card.facing, 'back');
  assertEquals(card.isBasic, true);
  assertEquals(card.victoryPoints, 4);
  assertEquals(card.owner, 2);
  assertEquals(card.mat, 'island');
  assertEquals(card.tags, ['garden']);
});

Deno.test('Card.toString returns formatted card string', () => {
  const card = new Card({
    ...createCardLikeArgs({ id: 102, cardKey: 'market' }),
    abilityText: '+1 Card, +1 Action, +1 Buy, +$1',
    expansionName: 'base-v2',
    artImagePath: '/half/market.jpg',
    kingdom: 'market',
    type: ['ACTION'],
    partOfSupply: true,
    mat: undefined,
  });

  assertEquals(card.toString(), '[CARD 102 - market]');
});

// --- Event ---

Deno.test('Event constructor assigns randomizer and calls super', () => {
  const event = new Event({
    ...createCardLikeArgs({ id: 200, cardKey: 'donate' }),
    randomizer: 'empires-events',
  });

  assertEquals(event.id, 200);
  assertEquals(event.cardKey, 'donate');
  assertEquals(event.randomizer, 'empires-events');
});

Deno.test('Event constructor defaults randomizer to null', () => {
  const event = new Event({
    ...createCardLikeArgs({ id: 201 }),
  });

  assertEquals(event.randomizer, null);
});

Deno.test('Event.toString returns formatted event string', () => {
  const event = new Event({
    ...createCardLikeArgs({ id: 202, cardKey: 'pilgrimage' }),
  });

  assertEquals(event.toString(), '[EVENT 202 - pilgrimage]');
});

// --- Ally ---

Deno.test('Ally constructor assigns fields and defaults randomizer', () => {
  const ally = new Ally({
    ...createCardLikeArgs({ id: 300, cardKey: 'bahar' }),
  });

  assertEquals(ally.id, 300);
  assertEquals(ally.randomizer, null);
});

Deno.test('Ally.toString returns formatted ally string', () => {
  const ally = new Ally({
    ...createCardLikeArgs({ id: 301, cardKey: 'architect' }),
  });

  assertEquals(ally.toString(), '[ALLY 301 - architect]');
});

// --- Prophecy ---

Deno.test('Prophecy constructor assigns fields and defaults randomizer', () => {
  const prophecy = new Prophecy({
    ...createCardLikeArgs({ id: 400, cardKey: 'test-prophecy' }),
    randomizer: 'rising-sun',
  });

  assertEquals(prophecy.id, 400);
  assertEquals(prophecy.randomizer, 'rising-sun');
});

Deno.test('Prophecy.toString returns formatted prophecy string', () => {
  const prophecy = new Prophecy({
    ...createCardLikeArgs({ id: 401, cardKey: 'great-leader' }),
  });

  assertEquals(prophecy.toString(), '[PROPHECY 401 - great-leader]');
});

// --- Landmark ---

Deno.test('Landmark constructor assigns fields and defaults randomizer', () => {
  const landmark = new Landmark({
    ...createCardLikeArgs({ id: 500, cardKey: 'aqueduct' }),
  });

  assertEquals(landmark.id, 500);
  assertEquals(landmark.randomizer, null);
});

Deno.test('Landmark.toString returns formatted landmark string', () => {
  const landmark = new Landmark({
    ...createCardLikeArgs({ id: 501, cardKey: 'arena' }),
  });

  assertEquals(landmark.toString(), '[LANDMARK 501 - arena]');
});

// --- Project ---

Deno.test('Project constructor assigns fields and defaults randomizer', () => {
  const project = new Project({
    ...createCardLikeArgs({ id: 600, cardKey: 'academy' }),
  });

  assertEquals(project.id, 600);
  assertEquals(project.randomizer, null);
});

Deno.test('Project.toString returns formatted project string', () => {
  const project = new Project({
    ...createCardLikeArgs({ id: 601, cardKey: 'barracks' }),
  });

  assertEquals(project.toString(), '[PROJECT 601 - barracks]');
});

// --- Way ---

Deno.test('Way constructor assigns fields and defaults randomizer', () => {
  const way = new Way({
    ...createCardLikeArgs({ id: 700, cardKey: 'way-of-the-mouse' }),
  });

  assertEquals(way.id, 700);
  assertEquals(way.randomizer, null);
});

Deno.test('Way.toString returns formatted way string', () => {
  const way = new Way({
    ...createCardLikeArgs({ id: 701, cardKey: 'way-of-the-mole' }),
  });

  assertEquals(way.toString(), '[WAY 701 - way-of-the-mole]');
});

// --- Trait ---

Deno.test('Trait constructor assigns fields including pileKey', () => {
  const trait = new Trait({
    ...createCardLikeArgs({ id: 800, cardKey: 'cheap' }),
    pileKey: 'village',
  });

  assertEquals(trait.id, 800);
  assertEquals(trait.pileKey, 'village');
  assertEquals(trait.randomizer, null);
});

Deno.test('Trait constructor defaults pileKey and randomizer to null', () => {
  const trait = new Trait({
    ...createCardLikeArgs({ id: 801 }),
  });

  assertEquals(trait.pileKey, null);
  assertEquals(trait.randomizer, null);
});

Deno.test('Trait.toString returns formatted trait string', () => {
  const trait = new Trait({
    ...createCardLikeArgs({ id: 802, cardKey: 'rich' }),
  });

  assertEquals(trait.toString(), '[TRAIT 802 - rich]');
});

// --- Boon ---

Deno.test('Boon constructor assigns fields', () => {
  const boon = new Boon(createCardLikeArgs({ id: 900, cardKey: 'the-fields-gift' }));

  assertEquals(boon.id, 900);
  assertEquals(boon.cardKey, 'the-fields-gift');
});

Deno.test('Boon.toString returns formatted boon string', () => {
  const boon = new Boon(createCardLikeArgs({ id: 901, cardKey: 'the-seas-gift' }));

  assertEquals(boon.toString(), '[BOON 901 - the-seas-gift]');
});

// --- Hex ---

Deno.test('Hex constructor assigns fields', () => {
  const hex = new Hex(createCardLikeArgs({ id: 1000, cardKey: 'bad-omens' }));

  assertEquals(hex.id, 1000);
  assertEquals(hex.cardKey, 'bad-omens');
});

Deno.test('Hex.toString returns formatted hex string', () => {
  const hex = new Hex(createCardLikeArgs({ id: 1001, cardKey: 'delusion' }));

  assertEquals(hex.toString(), '[HEX 1001 - delusion]');
});

// --- State ---

Deno.test('State constructor assigns fields', () => {
  const state = new State(createCardLikeArgs({ id: 1100, cardKey: 'lost-in-the-woods' }));

  assertEquals(state.id, 1100);
  assertEquals(state.cardKey, 'lost-in-the-woods');
});

Deno.test('State.toString returns formatted state string', () => {
  const state = new State(createCardLikeArgs({ id: 1101, cardKey: 'envious' }));

  assertEquals(state.toString(), '[STATE 1101 - envious]');
});

// --- Artifact ---

Deno.test('Artifact constructor assigns fields', () => {
  const artifact = new Artifact(createCardLikeArgs({ id: 1200, cardKey: 'horn' }));

  assertEquals(artifact.id, 1200);
  assertEquals(artifact.cardKey, 'horn');
});

Deno.test('Artifact.toString returns formatted artifact string', () => {
  const artifact = new Artifact(createCardLikeArgs({ id: 1201, cardKey: 'lantern' }));

  assertEquals(artifact.toString(), '[ARTIFACT 1201 - lantern]');
});

// --- Player Deno.customInspect ---

Deno.test('Player Deno.customInspect returns toString value', () => {
  const player = new Player({
    id: 7,
    name: 'Diana',
    sessionId: 's',
    socketId: 's',
    connected: true,
    ready: true,
    color: 'purple',
  });

  const inspectFn = player[Symbol.for('Deno.customInspect') as unknown as keyof Player] as () => string;
  assertEquals(inspectFn.call(player), '[PLAYER 7 - Diana]');
});

// --- Card partOfSupply default and Deno.customInspect ---

Deno.test('Card constructor defaults partOfSupply to true when not provided', () => {
  const card = new Card({
    ...createCardLikeArgs({ id: 103, cardKey: 'mine' }),
    abilityText: 'Trash a Treasure...',
    expansionName: 'base-v2',
    artImagePath: '/half/mine.jpg',
    kingdom: 'mine',
    type: ['ACTION'],
    mat: undefined,
    // partOfSupply NOT provided; should default to true.
  } as Card);

  assertEquals(card.partOfSupply, true);
});

Deno.test('Card Deno.customInspect returns toString value', () => {
  const card = new Card({
    ...createCardLikeArgs({ id: 104, cardKey: 'chapel' }),
    abilityText: 'Trash up to 4 cards...',
    expansionName: 'base-v2',
    artImagePath: '/half/chapel.jpg',
    kingdom: 'chapel',
    type: ['ACTION'],
    partOfSupply: true,
    mat: undefined,
  });

  const inspectFn = card[Symbol.for('Deno.customInspect') as unknown as keyof Card] as () => string;
  assertEquals(inspectFn.call(card), '[CARD 104 - chapel]');
});
