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
  // Allows tokens to attach to card-like entities such as Projects.
  | { type: 'cardLike'; cardLikeId: CardLikeId; }
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
  // Projects are card-likes that grant permanent abilities.
  projects: ProjectNoId[];
  // Ways are landscape card-likes that provide alternate Action play effects.
  ways: WayNoId[];
  // Boons available for Fate cards in this match.
  boons: BoonNoId[];
  // Hexes available for Doom cards in this match.
  hexes: HexNoId[];
  // States available for cards that grant them (e.g., Lost in the Woods).
  states: StateNoId[];
  // Artifacts available for cards that grant them (e.g., Treasurer).
  artifacts: ArtifactNoId[];
}

export type ComputedMatchConfiguration = MatchConfiguration & {
  nonSupply?: Supply[];
  startingHand: Record<CardKey, number>;
  mats: PlayerMatMap;
}

export type CardStats = {
  // the turn number on which the card was played.
  turnNumber: number;
  // Index in match.stats.turns for the turn where this stat was recorded.
  turnHistoryIndex?: number;

  turnPhase: TurnPhase;

  // the player that played the card
  playerId: PlayerId;
};

export type MatchStats = {
  // Chronological turn history, including extra turns. The last turn in the list is the current turn.
  turns: MatchTurnStats[];

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

export type MatchTurnStats = ExtraTurn & {
  // Engine turn number at turn start (can repeat for same-player extra turns).
  turnNumber: number;
};

export type FleetRoundState = {
  // Indicates that Fleet endgame turns are currently being played.
  active: boolean;
  // Indicates Fleet processing already completed and game should finalize immediately.
  completed: boolean;
  // Snapshot of players eligible for Fleet turns in deterministic play order.
  eligiblePlayerIdsInOrder: PlayerId[];
  // Index of the next Fleet player in eligiblePlayerIdsInOrder.
  nextFleetPlayerIndex: number;
  // Player whose turn caused game-end conditions to be met.
  endingPlayerId?: PlayerId;
  // Turn number when Fleet processing was activated.
  startedAtTurnNumber?: number;
};

export interface Match {
  cardOverrides: CardOverrides;
  cardSources: Record<CardLocation, CardId[]>;
  cardSourceTagMap: Record<string, CardLocation[]>;
  coffers: Record<PlayerId, number>;
  // Tracks per-player Villagers tokens from Renaissance.
  villagers: Record<PlayerId, number>;
  // Tracks per-player debt tokens for Empires-style costs.
  debt: Record<PlayerId, number>;
  config: ComputedMatchConfiguration,
  currentPlayerTurnIndex: number;
  events: Event[];
  // Active landmarks in the match (not part of the supply).
  landmarks: Landmark[];
  // Active projects in the match (not part of the supply).
  projects: Project[];
  // Active ways in the match (not part of the supply).
  ways: Way[];
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
  // State instances in the match and who currently has them.
  states: {
    cards: State[];
    byPlayer: Record<PlayerId, CardLikeId[]>;
  };
  // Artifact instances in the match and who currently has them.
  artifacts: {
    cards: Artifact[];
    byPlayer: Record<PlayerId, CardLikeId[]>;
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
  // when a player gains an extra turn
  extraTurnQueue: ExtraTurn[];
  // Fleet endgame round state.
  fleetRound: FleetRoundState;
}

export type ExtraTurn = {
  // the owner/controller of the turn. typically this is the same as `playerId`. but in some cases might be another
  // player e.g., with Possession from the Alchemy expansion
  controllerId?: PlayerId;
  // the player whose turn it is. This is not necessarily the one actually controlling the turn
  playerId: PlayerId;
  // the source of the effect that provided the extra turn
  sourceId?: CardId | CardLikeId;
}

export type CardOverrides = Record<PlayerId, Record<CardId, Partial<Card>>>;

/**************

 LOG types

 ******************/

export type LogEntrySource = CardId;

export type LogEntry =
  | { type: 'draw'; playerId: PlayerId; cardId: CardId; depth?: number; source?: LogEntrySource }
  // Hand draw log entry (no count; modifiers log separately).
  | { type: 'drawHand'; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  // Discard log entry; count > 1 indicates only the final cardId is revealed in log text.
  | { type: 'discard'; playerId: PlayerId; cardId: CardId; count?: number; depth?: number; source?: LogEntrySource }
  | { type: 'gainAction'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'gainBuy'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'gainTreasure'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'payDebt'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'gainVictoryToken'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  // Logs a card-like effect (boon/hex/state/artifact/event/landmark).
  | { type: 'cardLikeEffect'; playerId: PlayerId; cardLikeId: CardLikeId; effectText: string; depth?: number; source?: LogEntrySource }
  | { type: 'tokenEffect'; playerId: PlayerId; cardId: CardId; tokenId: TokenId; effectText: string; depth?: number; source?: LogEntrySource }
  // Token placement and consumption logs.
  | { type: 'tokenPlaced'; playerId: PlayerId; tokenId: TokenId; depth?: number; source?: LogEntrySource }
  | { type: 'tokenConsumed'; playerId: PlayerId; tokenId: TokenId; depth?: number; source?: LogEntrySource }
  // Logs when a player buys a Project.
  | { type: 'buyProject'; playerId: PlayerId; cardLikeId: CardLikeId; depth?: number; source?: LogEntrySource }
  | { type: 'gainCard'; cardId: CardId; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'cardPlayed'; cardId: CardId; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'revealCard'; cardId: CardId; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'trashCard'; cardId: CardId; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'shuffleDeck'; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  // Logs when a player leaves the active match (e.g., resigns).
  | { type: 'playerLeft'; playerId: PlayerId; reason: 'resigned'; depth?: number; source?: LogEntrySource }
  | { type: 'newTurn'; turn: number; depth?: number; source?: LogEntrySource }
  | { type: 'newPlayerTurn'; turn: number; playerId: PlayerId; depth?: number; source?: LogEntrySource };


/***************

 GAME ACTION types

 *********************/

export interface SelectActionCardArgs {
  count?: CountSpec | number;
  playerId: PlayerId;
  restrict: FindCardsFnInput | CardId[];
  optional?: boolean;
  prompt: string;
  validPrompt?: string;
  cancelPrompt?: string;
}

// Single-card selection only allows one-card count shapes.
export type SingleSelectCountSpec =
  | 1
  | { kind: 'upTo'; count: 1; }
  | { kind: 'exact'; count: 1; };

// Arguments accepted by selectSingleCard.
export interface SelectSingleActionCardArgs extends Omit<SelectActionCardArgs, 'count'> {
  count?: SingleSelectCountSpec;
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
  // Display prompt can optionally include card-likes shown below cards.
  | { type: 'display-cards'; cardIds?: CardId[]; cardLikeIds?: CardLikeId[]; }
  | {
    type: 'select';
    cardIds: CardId[];
    selectCount: CountSpec;
    selectableCardIds?: CardId[];
    // Optional card-like entries to include in the selection prompt.
    cardLikeIds?: CardLikeId[];
    selectableCardLikeIds?: CardLikeId[];
  }
  | { type: 'select-pile'; pileNames: CardKey[]; selectCount: CountSpec; optional?: boolean; };

export type UserPromptActionArgs = {
  playerId: PlayerId;
  prompt?: string;
  content?: UserPromptKinds;
  actionButtons?: ActionButtons;
  validationAction?: number;
  // When false, the prompt is display-only and the server will not wait for user input.
  waitForInput?: boolean;
}

export const TurnPhaseOrderValues = ['action', 'buy', 'night', 'cleanup'] as const;
export type TurnPhase = typeof TurnPhaseOrderValues[number];

export type ExpansionListElement = {
  title: string;
  name: string;
  order: number;
};

// Lobby game status for pre-match discovery and lifecycle updates.
export type LobbyGameStatus = 'configuring' | 'inMatch' | 'closed';

// Summary payload displayed in the lobby game list.
export type LobbyGameSummary = {
  // Stable game identifier for joins, routing, and log partitioning.
  gameId: string;
  // Human-readable generated game name.
  gameName: string;
  // Owner player ID, when currently assigned.
  ownerId?: PlayerId;
  // Current connected+configured players in this game lobby.
  playerCount: number;
  // Maximum allowed players for this game.
  maxPlayers: number;
  // True when a new player can join from the global lobby list.
  isJoinable: boolean;
  // Current lifecycle status used by the lobby UI.
  status: LobbyGameStatus;
};

// Canonical reasons a lobby join can be rejected.
export type LobbyJoinRejectedReason =
  | 'gameNotFound'
  | 'gameNotJoinable'
  | 'gameFull'
  | 'banned'
  | 'alreadyInGame'
  | 'invalidRequest';

// Structured join rejection payload for deterministic client UX.
export type LobbyJoinRejectedPayload = {
  // Requested game identifier when known.
  gameId?: string;
  // Machine-readable reason code.
  reason: LobbyJoinRejectedReason;
  // User-facing message rendered by the lobby UI.
  message: string;
};

// Runtime debug identity for one game + active match scope.
export type DebugRuntimeContext = {
  // Stable game identifier used across lobby/match lifecycle.
  gameId: string;
  // Human-readable lobby game name.
  gameName: string;
  // Active match scope sequence identifier for this game.
  matchScopeId?: number;
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
  // Full game-lobby snapshot sent on connect and on explicit request.
  lobbySnapshot: (games: LobbyGameSummary[]) => void;
  // Incremental game-lobby update for one game summary.
  lobbyGameUpdated: (game: LobbyGameSummary) => void;
  // Removes one game from the lobby list.
  lobbyGameRemoved: (gameId: string) => void;
  // Confirms that this client session is now attached to one specific lobby game.
  joinedLobbyGame: (gameId: string) => void;
  // Join request failed; client remains in lobby view.
  joinLobbyRejected: (payload: LobbyJoinRejectedPayload) => void;
  // Client was removed from a lobby game by owner kick.
  kickedFromGame: (payload: { gameId: string; message: string }) => void;
  // Client was removed and banned from a lobby game by owner action.
  bannedFromGame: (payload: { gameId: string; message: string }) => void;
  // Runtime debug identity used by client-side diagnostic overlays.
  debugRuntimeContext: (payload: DebugRuntimeContext) => void;
  searchCardResponse: (cardData: CardNoId[]) => void;
  // Sends event search results to the client.
  searchEventResponse: (eventData: EventNoId[]) => void;
  // Sends landmark search results to the client.
  searchLandmarkResponse: (landmarkData: LandmarkNoId[]) => void;
  // Sends artifact search results to the client.
  searchArtifactResponse: (artifactData: ArtifactNoId[]) => void;
  // Sends project search results to the client.
  searchProjectResponse: (projectData: ProjectNoId[]) => void;
  // Sends way search results to the client.
  searchWayResponse: (wayData: WayNoId[]) => void;
  selectCard: (signalId: string, selectCardArgs: SelectActionCardArgs & { selectableCardIds: CardId[] }) => void;
  setPlayerList: (players: Player[]) => void;
  setCardLibrary: (library: Record<CardKey, Card>) => void;
  setTokenDefinitions: (definitions: Record<TokenId, TokenDefinition>) => void;
  setPlayer: (player: Player) => void;
  userPrompt: (signalId: string, userPromptArgs: UserPromptActionArgs) => void;
  waitingForPlayer: (playerId: PlayerId) => void;
};

export interface ServerListenEvents {
  // Requests the current global lobby game list.
  requestLobbySnapshot: () => void;
  // Creates a new lobby game with a server-generated name.
  createLobbyGame: () => void;
  // Requests to join an existing lobby game.
  joinLobbyGame: (gameId: string) => void;
  // Leaves a lobby game and returns to the global lobby view.
  leaveLobbyGame: (gameId: string) => void;
  // Owner-only request to kick a player from a lobby game.
  kickLobbyPlayer: (gameId: string, targetPlayerId: PlayerId) => void;
  // Owner-only request to ban a player's session from a lobby game.
  banLobbyPlayer: (gameId: string, targetPlayerId: PlayerId) => void;
  // Owner-only request to unban a previously banned session from a lobby game.
  unbanLobbyPlayer: (gameId: string, targetSessionId: string) => void;
  cardsSelected: (selected: CardId[]) => void
  cardLikeTapped: (playerId: PlayerId, cardId: CardId) => void;
  cardTapped: (playerId: PlayerId, cardId: CardId) => void;
  addComputerPlayer: (count?: number) => void;
  clientReady: (playerId: PlayerId, ready: boolean) => void;
  exchangeCoffer: (playerId: PlayerId, count: number) => void;
  // Spends Villagers to gain actions during the Action phase.
  spendVillager: (playerId: PlayerId, count: number) => void;
  // Pays down debt tokens using available treasure.
  payDebt: (playerId: PlayerId, count: number) => void;
  expansionSelected: (val: string[]) => void;
  matchConfigurationUpdated: (val: MatchConfiguration) => void;
  nextPhase: () => void;
  playerReady: (playerId: PlayerId, ready: boolean) => void;
  playAllTreasure: (playerId: PlayerId) => void;
  // Voluntarily leaves an active match; remaining players continue.
  resignMatch: () => void;
  // Vote to remove a disconnected human player and resume the match.
  removeDisconnectedPlayer: (playerId: PlayerId) => void;
  searchCards: (playerId: PlayerId, searchStr: string) => void;
  // Requests event search results from the server.
  searchEvents: (playerId: PlayerId, searchStr: string) => void;
  // Requests landmark search results from the server.
  searchLandmarks: (playerId: PlayerId, searchStr: string) => void;
  // Requests artifact search results from the server.
  searchArtifacts: (playerId: PlayerId, searchStr: string) => void;
  // Requests project search results from the server.
  searchProjects: (playerId: PlayerId, searchStr: string) => void;
  // Requests way search results from the server.
  searchWays: (playerId: PlayerId, searchStr: string) => void;
  updatePlayerName: (playerId: PlayerId, name: string) => void;
  userInputReceived: (signalId: string, input: unknown) => void;
}

// Player mats can include card-like ids (e.g., boons set aside).
export type PlayerMatMap = Record<PlayerId, Record<Mats, CardLikeId[]>>;

const MatValues = [
  'island',
  'native-village',
  'exile',
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

// Filters for card-search requests (used by selectCard restrictions).
export type CostFindCardsFilter = CostSpec;

export interface CardDataFindCardsFilter {
  tags?: string | string[];
  cardKeys?: CardKey | CardKey[];
  cardType?: CardType | CardType[];
  owner?: PlayerId;
  kingdom?: string;
}

export interface SourceFindCardsFilter {
  location: CardLocation | CardLocation[];
  playerId?: PlayerId;
}

export type NonLocationFilters = CostFindCardsFilter | CardDataFindCardsFilter;

export type FindCardsFnInput =
  | NonLocationFilters[]
  | SourceFindCardsFilter
  | NonLocationFilters
  | [SourceFindCardsFilter, ...NonLocationFilters[]];

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
  // Optional rules text for card-like display.
  abilityText?: string;
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
    this.abilityText = args.abilityText ?? '';
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

type ProjectArgs = {
  [p in keyof CardLike]: CardLike[p];
} & {
  randomizer?: string | null;
};

// Projects are landscape card-likes that grant permanent abilities.
export class Project extends CardLike {
  // Randomizer key used to group projects during selection.
  randomizer: string | null;

  constructor(args: ProjectArgs) {
    super(args);

    this.id = args.id;
    this.cardName = args.cardName;
    this.fullImagePath = args.fullImagePath;
    this.detailImagePath = args.detailImagePath;
    this.randomizer = args.randomizer ?? null;
  }

  override toString() {
    return `[PROJECT ${this.id} - ${this.cardKey}]`;
  }
}

export type ProjectNoId = Omit<Project, 'id'>;

type WayArgs = {
  [p in keyof CardLike]: CardLike[p];
} & {
  randomizer?: string | null;
};

// Ways are landscape card-likes that provide alternate Action card play behavior.
export class Way extends CardLike {
  // Randomizer key used to group ways during selection.
  randomizer: string | null;

  constructor(args: WayArgs) {
    super(args);

    this.id = args.id;
    this.cardName = args.cardName;
    this.fullImagePath = args.fullImagePath;
    this.detailImagePath = args.detailImagePath;
    this.randomizer = args.randomizer ?? null;
  }

  override toString() {
    return `[WAY ${this.id} - ${this.cardKey}]`;
  }
}

export type WayNoId = Omit<Way, 'id'>;

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

// State constructor args mirror base CardLike fields.
type StateArgs = {
  [p in keyof CardLike]: CardLike[p];
};

// States are landscape card-likes that apply persistent player effects.
export class State extends CardLike {
  constructor(args: StateArgs) {
    super(args);

    this.id = args.id;
    this.cardName = args.cardName;
    this.fullImagePath = args.fullImagePath;
    this.detailImagePath = args.detailImagePath;
  }

  override toString() {
    return `[STATE ${this.id} - ${this.cardKey}]`;
  }
}

export type StateNoId = Omit<State, 'id'>;

// Artifact constructor args mirror base CardLike fields.
type ArtifactArgs = {
  [p in keyof CardLike]: CardLike[p];
};

// Artifacts are landscape card-likes that apply persistent player effects.
export class Artifact extends CardLike {
  constructor(args: ArtifactArgs) {
    super(args);

    this.id = args.id;
    this.cardName = args.cardName;
    this.fullImagePath = args.fullImagePath;
    this.detailImagePath = args.detailImagePath;
  }

  override toString() {
    return `[ARTIFACT ${this.id} - ${this.cardKey}]`;
  }
}

export type ArtifactNoId = Omit<Artifact, 'id'>;

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
  override abilityText: string;
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
