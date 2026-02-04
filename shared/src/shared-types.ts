import type { Operation } from 'fast-json-patch';

export type CardKey = string;
export type PlayerId = number;
export type CardId = number;
export type CardLikeId = number;
// Token identifiers are unique across the match for deterministic state updates.
export type TokenId = string;
// Token instance identifiers are unique per placed token to support multiple copies.
export type TokenInstanceId = string;

// Token duration controls how long a placed token remains in effect.
export type TokenDuration = 'oneShot' | 'turn' | 'permanent' | 'eventBound';

// Token facing is used for tokens like Journey that can be face up or face down.
export type TokenFacing = 'faceUp' | 'faceDown';

// Token locations describe where a token is placed and how it is targeted.
export type TokenLocation =
  | { type: 'supplyPile'; cardKey: CardKey; }
  | { type: 'player'; playerId: PlayerId; }
  | { type: 'playerAvailable'; playerId: PlayerId; }
  | { type: 'playerDeck'; playerId: PlayerId; }
  | { type: 'playerDiscard'; playerId: PlayerId; }
  | { type: 'playerMat'; playerId: PlayerId; matKey: string; }
  | { type: 'card'; cardId: CardId; }
  | { type: 'global'; };

// Token definitions are static rules metadata used by both server logic and UI.
export type TokenDefinition = {
  id: TokenId;
  name: string;
  rulesText: string;
  duration: TokenDuration;
  expansion?: string;
};

// Token instances represent placed tokens and their current targets.
export type TokenInstance = {
  id: TokenInstanceId;
  tokenId: TokenId;
  location: TokenLocation;
  ownerId?: PlayerId;
  // When null/undefined/0, the token has infinite counters.
  counters?: number | null;
  // Optional facing for tokens that can be flipped.
  facing?: TokenFacing;
  sourceCardId?: CardId;
};

export interface Supply {
  name: string;
  cards: CardNoId[];
}

/****************

 MATCH types

 ***************/
export interface MatchConfiguration {
  players: Player[];

  // info about the expansions selected for the match. determines what cards can randomly be selected for the kingdom
  expansions: ExpansionListElement[];

  // cards banned from the match
  bannedKingdoms: CardNoId[];

  preselectedKingdoms: CardNoId[];

  // basic cards selected for the game, these are what are available at the beginning of a match
  basicSupply: Supply[];

  // kingdom cards selected for the game, these are what are available at the beginning of a match
  kingdomSupply: Supply[];

  playerStartingHand: Record<CardKey, number>;
  // events are card-likes that can be bought for their effects
  events: EventNoId[];
  // Landmarks are card-likes that affect scoring or gameplay.
  landmarks: LandmarkNoId[];
  // Boons available for Fate cards in this match.
  boons: BoonNoId[];
  // Hexes available for Doom cards in this match.
  hexes: HexNoId[];
}

export type ComputedMatchConfiguration = MatchConfiguration & {
  nonSupply?: Supply[];
  startingHand: Record<CardKey, number>;
  mats: PlayerMatMap;
}

export type CardStats = {
  // the turn number on which the card was played.
  turnNumber: number;

  turnPhase: TurnPhase;

  // the player that played the card
  playerId: PlayerId;
};

export type MatchStats = {
  cardLikesBoughtByTurn: Record<number, CardId[] | undefined>;
  cardLikesBought: Record<CardId, CardStats>;

  cardsGainedByTurn: Record<number, CardId[] | undefined>;
  cardsGained: Record<CardId, CardStats>;

  /**
   * Keys are the card's ID that was played, and values are CardStats objects.
   */
  playedCards: Record<CardId, CardStats>;
  playedCardsByTurn: Record<number, CardId[] | undefined>;

  trashedCards: Record<CardId, CardStats>;
  trashedCardsByTurn: Record<number, CardId[] | undefined>;

  cardsBoughtByTurn: Record<number, CardId[] | undefined>;
  cardsBought: Record<CardId, CardStats & {

    // the cost when it was bought
    cost: number;

    // the amount used to buy it
    paid: number;
  }>;
};

export interface Match {
  cardOverrides: CardOverrides;
  cardSources: Record<CardLocation, CardId[]>;
  cardSourceTagMap: Record<string, CardLocation[]>;
  coffers: Record<PlayerId, number>;
  // Tracks per-player debt tokens for Empires-style costs.
  debt: Record<PlayerId, number>;
  config: ComputedMatchConfiguration,
  currentPlayerTurnIndex: number;
  events: Event[];
  // Active landmarks in the match (not part of the supply).
  landmarks: Landmark[];
  // Boon deck state for Fate cards in this match.
  boons: {
    cards: Boon[];
    deck: CardLikeId[];
    discard: CardLikeId[];
    // Boons set aside for Druid (face up).
    setAside: CardLikeId[];
  };
  // Hex deck state for Doom cards in this match.
  hexes: {
    cards: Hex[];
    deck: CardLikeId[];
    discard: CardLikeId[];
  };
  mats: PlayerMatMap;
  playerActions: number;
  playerBuys: number;
  playerPotions: number;
  playerTreasure: number;
  players: Player[];
  roundNumber: number;
  scores: Record<PlayerId, number>,
  selectableCards: Record<PlayerId, CardId[]>;
  stats: MatchStats;
  // Token instances placed in the match.
  tokens: Record<TokenInstanceId, TokenInstance>;
  // Monotonic counter for deterministic token instance IDs.
  tokenInstanceCounter: number;
  turnNumber: number;
  turnPhaseIndex: number;
}

export type CardOverrides = Record<PlayerId, Record<CardId, Partial<Card>>>;

/**************

 LOG types

 ******************/

export type LogEntrySource = CardId;

export type LogEntry =
  | { type: 'draw'; playerId: PlayerId; cardId: CardId; depth?: number; source?: LogEntrySource }
  | { type: 'discard'; playerId: PlayerId; cardId: CardId; depth?: number; source?: LogEntrySource }
  | { type: 'gainAction'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'gainBuy'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'gainTreasure'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'payDebt'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'gainVictoryToken'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'tokenEffect'; playerId: PlayerId; cardId: CardId; tokenId: TokenId; effectText: string; depth?: number; source?: LogEntrySource }
  // Token placement and consumption logs.
  | { type: 'tokenPlaced'; playerId: PlayerId; tokenId: TokenId; depth?: number; source?: LogEntrySource }
  | { type: 'tokenConsumed'; playerId: PlayerId; tokenId: TokenId; depth?: number; source?: LogEntrySource }
  | { type: 'gainCard'; cardId: CardId; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'cardPlayed'; cardId: CardId; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'revealCard'; cardId: CardId; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'trashCard'; cardId: CardId; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'shuffleDeck'; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'newTurn'; turn: number; depth?: number; source?: LogEntrySource }
  | { type: 'newPlayerTurn'; turn: number; playerId: PlayerId; depth?: number; source?: LogEntrySource };


/***************

 GAME ACTION types

 *********************/

export interface SelectActionCardArgs {
  count?: CountSpec | number;
  playerId: PlayerId;
  optional?: boolean;
  prompt: string;
  validPrompt?: string;
  cancelPrompt?: string;
}

export type UserPromptKinds =
  | { type: 'blind-rearrange'; cardIds: CardId[]; }
  | { type: 'rearrange'; cardIds: CardId[]; }
  | { type: 'name-card'; }
  | { type: 'overpay'; cost: number; }
  // Prompt for a numeric input within a min/max range.
  | {
    type: 'number-input';
    // Optional minimum bound for numeric input.
    min?: number;
    // Optional maximum bound for numeric input.
    max?: number;
    value?: number;
    // Optional prompt controls whether a cancel action is available.
    optional?: boolean;
    submitText?: string;
    cancelText?: string;
    placeholder?: string;
  }
  | { type: 'display-cards'; cardIds: CardId[]; }
  | { type: 'select'; cardIds: CardId[]; selectCount: CountSpec; selectableCardIds?: CardId[]; }
  | { type: 'select-pile'; pileNames: CardKey[]; selectCount: CountSpec; optional?: boolean; };

export type UserPromptActionArgs = {
  playerId: PlayerId;
  prompt?: string;
  content?: UserPromptKinds;
  actionButtons?: ActionButtons;
  validationAction?: number;
}

export const TurnPhaseOrderValues = ['action', 'buy', 'night', 'cleanup'] as const;
export type TurnPhase = typeof TurnPhaseOrderValues[number];

export type ExpansionListElement = {
  title: string;
  name: string;
  order: number;
};

export type ServerEmitEvents = {
  addLogEntry: (logEntry: LogEntry[]) => void;
  cardEffectsComplete: (playerId: PlayerId, cardId?: CardId) => void;
  cardTappedComplete: (playerId: PlayerId, cardId: CardId) => void;
  doneWaitingForPlayer: (playerId?: PlayerId) => void;
  expansionList: (val: ExpansionListElement[]) => void;
  gameOver: (summary: MatchSummary) => void;
  gameOwnerUpdated: (playerId: PlayerId) => void;
  matchConfigurationUpdated: (val: MatchConfiguration) => void;
  matchReady: () => void;
  matchStarted: () => void;
  nextPhaseComplete: () => void;
  patchUpdate: (patchMatch: Operation[], patchCardLibrary: Operation[]) => void;
  patchCardLibrary: (patch: Operation[]) => void;
  patchMatch: (patch: Operation[]) => void;
  patchMatchStats: (patch: Operation[]) => void;
  ping: (pingCount: number) => void;
  playAllTreasureComplete: () => void;
  playerConnected: (player: Player) => void;
  playerDisconnected: (player: Player) => void;
  playerNameUpdated: (playerId: PlayerId, name: string) => void;
  playerReady: (playerId: PlayerId, ready: boolean) => void;
  searchCardResponse: (cardData: CardNoId[]) => void;
  // Sends event search results to the client.
  searchEventResponse: (eventData: EventNoId[]) => void;
  // Sends landmark search results to the client.
  searchLandmarkResponse: (landmarkData: LandmarkNoId[]) => void;
  selectCard: (signalId: string, selectCardArgs: SelectActionCardArgs & { selectableCardIds: CardId[] }) => void;
  setPlayerList: (players: Player[]) => void;
  setCardLibrary: (library: Record<CardKey, Card>) => void;
  setTokenDefinitions: (definitions: Record<TokenId, TokenDefinition>) => void;
  setPlayer: (player: Player) => void;
  userPrompt: (signalId: string, userPromptArgs: UserPromptActionArgs) => void;
  waitingForPlayer: (playerId: PlayerId) => void;
};

export interface ServerListenEvents {
  cardsSelected: (selected: CardId[]) => void
  cardLikeTapped: (playerId: PlayerId, cardId: CardId) => void;
  cardTapped: (playerId: PlayerId, cardId: CardId) => void;
  addComputerPlayer: (count?: number) => void;
  clientReady: (playerId: PlayerId, ready: boolean) => void;
  exchangeCoffer: (playerId: PlayerId, count: number) => void;
  // Pays down debt tokens using available treasure.
  payDebt: (playerId: PlayerId, count: number) => void;
  expansionSelected: (val: string[]) => void;
  matchConfigurationUpdated: (val: MatchConfiguration) => void;
  nextPhase: () => void;
  playerReady: (playerId: PlayerId, ready: boolean) => void;
  playAllTreasure: (playerId: PlayerId) => void;
  // Vote to remove a disconnected human player and resume the match.
  removeDisconnectedPlayer: (playerId: PlayerId) => void;
  searchCards: (playerId: PlayerId, searchStr: string) => void;
  // Requests event search results from the server.
  searchEvents: (playerId: PlayerId, searchStr: string) => void;
  // Requests landmark search results from the server.
  searchLandmarks: (playerId: PlayerId, searchStr: string) => void;
  updatePlayerName: (playerId: PlayerId, name: string) => void;
  userInputReceived: (signalId: string, input: unknown) => void;
}

// Player mats can include card-like ids (e.g., boons set aside).
export type PlayerMatMap = Record<PlayerId, Record<Mats, CardLikeId[]>>;

const MatValues = [
  'island',
  'native-village',
  'set-aside',
  'tavern',
] as const;
export type Mats = typeof MatValues[number];
export const isLocationMat = (location: any): location is Mats => {
  return !!location && (MatValues as unknown as string[]).indexOf(location) !== -1;
}

const CardLocationValues = ['nonSupplyCards', 'activeDuration', 'playerDiscard', 'playerHand', 'trash', 'playArea', 'playerDeck', 'basicSupply', 'kingdomSupply'] as const;
export type CardLocations = typeof CardLocationValues[number];

export type CardLocation =
  | CardLocations
  | Mats
  | string;

export type CardLocationSpec = {
  location: CardLocation | CardLocation[],
  index?: number
};

export type ComparisonType =
  | 'exact'
  | 'upTo';

export type CountSpec =
  | { kind: 'upTo'; count: number; }
  | { kind: 'exact'; count: number; }
  // Range selection allows a minimum and maximum count.
  | { kind: 'range'; min: number; max: number; }
  | number;

// Cost specs can optionally include a minimum ("from") threshold per cost axis.
export type CostSpec =
  | { kind: 'exact'; amount: CardCost, playerId: PlayerId, from?: CardCost }
  | { kind: 'upTo'; amount: CardCost, playerId: PlayerId, from?: CardCost };

export type PlayerArgs = {
  id: PlayerId;
  name: string;
  sessionId: string;
  socketId: string;
  connected: boolean;
  ready: boolean;
  color: string;
  isComputer?: boolean;
}

export class Player {
  id: PlayerId;
  name: string;
  sessionId: string;
  socketId: string;
  connected: boolean;
  ready: boolean;
  color: string;
  isComputer: boolean;

  constructor({ color, id, name, sessionId, socketId, connected, ready, isComputer }: PlayerArgs) {
    this.id = id;
    this.name = name;
    this.sessionId = sessionId;
    this.socketId = socketId;
    this.connected = connected;
    this.ready = ready;
    this.color = color;
    this.isComputer = isComputer ?? false;
  }

  toString() {
    return `[PLAYER ${this.id} - ${this.name}]`;
  }

  // @ts-ignore
  [Symbol.for('Deno.customInspect')]() {
    return this.toString();
  }
}

export type MatchSummary = {
  playerSummary: {
    playerId: PlayerId;
    turnsTaken: number;
    score: number;
    deck: number[];
  }[]
}

export class CardLike<M = unknown> {
  id: CardId;
  cardKey: CardKey;
  cardName: string;
  cost: CardCost;
  fullImagePath: string;
  detailImagePath: string;
  // Optional randomizer overrides for pile-level cost/type metadata.
  randomizerData?: RandomizerData;
  // Indicates whether the card is eligible for kingdom selection.
  kingdomSelectable?: boolean;
  metadata: M;

  constructor(args: CardLike) {
    this.id = args.id;
    this.cardKey = args.cardKey ?? '';
    this.cardName = args.cardName ?? '';
    this.fullImagePath = args.fullImagePath ?? '';
    this.detailImagePath = args.detailImagePath ?? '';
    this.randomizerData = args.randomizerData;
    this.kingdomSelectable = args.kingdomSelectable ?? true;
    this.cost = args.cost ?? { treasure: 0 };
    const metadata = args.metadata ?? {};
    this.metadata = metadata as M;
  }
}

export type CardLikeNoId = Omit<CardLike, 'id'>;

type EventArgs = {
  [p in keyof CardLike]: CardLike[p];
} & {
  randomizer?: string | null;
};

export class Event extends CardLike {
  // Randomizer key used to group events during selection.
  randomizer: string | null;

  constructor(args: EventArgs) {
    super(args);

    this.id = args.id;
    this.cardName = args.cardName;
    this.fullImagePath = args.fullImagePath;
    this.detailImagePath = args.detailImagePath;
    this.randomizer = args.randomizer ?? null;
  }

  override toString() {
    return `[EVENT ${this.id} - ${this.cardKey}]`;
  }
}

export type EventNoId = Omit<Event, 'id'>;

type LandmarkArgs = {
  [p in keyof CardLike]: CardLike[p];
} & {
  randomizer?: string | null;
};

// Landmarks are landscape card-likes that are always in effect once in play.
export class Landmark extends CardLike {
  // Randomizer key used to group landmarks during selection.
  randomizer: string | null;

  constructor(args: LandmarkArgs) {
    super(args);

    this.id = args.id;
    this.cardName = args.cardName;
    this.fullImagePath = args.fullImagePath;
    this.detailImagePath = args.detailImagePath;
    this.randomizer = args.randomizer ?? null;
  }

  override toString() {
    return `[LANDMARK ${this.id} - ${this.cardKey}]`;
  }
}

export type LandmarkNoId = Omit<Landmark, 'id'>;

// Boon constructor args mirror base CardLike fields.
type BoonArgs = {
  [p in keyof CardLike]: CardLike[p];
};

// Boons are landscape card-likes that provide a one-shot or temporary effect.
export class Boon extends CardLike {
  constructor(args: BoonArgs) {
    super(args);

    this.id = args.id;
    this.cardName = args.cardName;
    this.fullImagePath = args.fullImagePath;
    this.detailImagePath = args.detailImagePath;
  }

  override toString() {
    return `[BOON ${this.id} - ${this.cardKey}]`;
  }
}

export type BoonNoId = Omit<Boon, 'id'>;

// Hex constructor args mirror base CardLike fields.
type HexArgs = {
  [p in keyof CardLike]: CardLike[p];
};

// Hexes are landscape card-likes that provide harmful effects.
export class Hex extends CardLike {
  constructor(args: HexArgs) {
    super(args);

    this.id = args.id;
    this.cardName = args.cardName;
    this.fullImagePath = args.fullImagePath;
    this.detailImagePath = args.detailImagePath;
  }

  override toString() {
    return `[HEX ${this.id} - ${this.cardKey}]`;
  }
}

export type HexNoId = Omit<Hex, 'id'>;

/**
 * CARD TYPES
 */
export type CardType =
  | 'ACTION'
  | 'ALLY'
  | 'ARTIFACT'
  | 'ATTACK'
  | 'AUGUR'
  | 'BOON'
  | 'CASTLE'
  | 'CLASH'
  | 'COMMAND'
  | 'CURSE'
  | 'DOOM'
  | 'DURATION'
  | 'EVENT'
  | 'FATE'
  | 'FORT'
  | 'GATHERING'
  | 'HEIRLOOM'
  | 'HEX'
  | 'KNIGHT'
  | 'LANDMARK'
  | 'LIAISON'
  | 'LOOT'
  | 'LOOTER'
  | 'NIGHT'
  | 'ODYSSEY'
  | 'OMEN'
  | 'PRIZE'
  | 'PROJECT'
  | 'PROPHECY'
  | 'REACTION'
  | 'RESERVE'
  | 'REWARD'
  | 'RUINS'
  | 'SHADOW'
  | 'SHELTER'
  | 'SPIRIT'
  | 'STATE'
  | 'TOWNSFOLK'
  | 'TRAIT'
  | 'TRAVELLER'
  | 'TREASURE'
  | 'VICTORY'
  | 'WAY'
  | 'WIZARD'
  | 'ZOMBIE';

export type CardArgs = {
  [p in keyof CardLike]: CardLike[p];
} & {
  abilityText: string;
  expansionName: string;
  facing?: CardFacing;
  halfImagePath: string;
  isBasic?: boolean;
  kingdom: string;
  mat: Mats | undefined;
  owner?: PlayerId | null;
  partOfSupply: boolean;
  tags?: string[];
  targetScheme?: EffectTarget;
  type: CardType[];
  victoryPoints?: number;
}

// Defines pile-level overrides for cards that share a randomizer.
export type RandomizerData = {
  randomizer: string;
  cost?: CardCost;
  type?: CardType[];
};

export type CardCost = {
  treasure: number;
  potion?: number | undefined;
  // Optional debt cost for Empires-style cards/events.
  debt?: number | undefined;
}

export class Card<M = unknown> extends CardLike<M> {
  /**
   * This indicates if the card is part of the supply or not. shelters, rewards, etc. are not part of the supply.
   *
   * @default true
   */
  partOfSupply: boolean;
  tags?: string[] = [];
  kingdom: string;
  facing?: CardFacing;
  isBasic?: boolean = false;
  type: CardType[];
  mat: Mats | undefined;
  victoryPoints: number;
  abilityText: string;
  targetScheme?: EffectTarget;
  expansionName: string;
  halfImagePath: string;
  owner: PlayerId | null;

  constructor(args: CardArgs) {
    super(args);
    this.tags = args.tags ?? [];
    this.facing = args.facing ?? 'front';
    this.isBasic = args.isBasic ?? false;
    this.id = args.id;
    this.type = args.type;
    this.cost = args.cost;
    this.abilityText = args.abilityText;
    this.cardKey = args.cardKey;
    this.cardName = args.cardName;
    this.victoryPoints = args.victoryPoints ?? 0;
    this.targetScheme = args.targetScheme;
    this.expansionName = args.expansionName;
    this.fullImagePath = args.fullImagePath;
    this.halfImagePath = args.halfImagePath;
    this.detailImagePath = args.detailImagePath;
    this.owner = args.owner ?? null;
    this.mat = args.mat;
    this.kingdom = args.kingdom;
    this.partOfSupply = args.partOfSupply ?? true;
    this.randomizerData = args.randomizerData;
    this.kingdomSelectable = args.kingdomSelectable ?? true;
  }

  override toString() {
    return `[CARD ${this.id} - ${this.cardKey}]`;
  }

  // @ts-ignore
  [Symbol.for('Deno.customInspect')]() {
    return this.toString();
  }
}

const EffectTargetValues = ['ANY', 'ALL_OTHER', 'ALL'] as const;
export type EffectTarget = typeof EffectTargetValues[number] | string;
export type ActionButtons = {
  label: string;
  action: string | number;
}[];
export type CardNoId = Omit<Card, 'id'>;
export type CardFacing = 'front' | 'back';
