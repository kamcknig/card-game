import type { Operation } from 'fast-json-patch';

export type CardKey = string;
export type PlayerId = number;
export type CardId = number;

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
  
  playerStartingHand: Record<CardKey, number>
}

export type ComputedMatchConfiguration = MatchConfiguration & {
  nonSupply?: Supply[];
  startingHand: Record<CardKey, number>;
  mats: PlayerMatMap;
}

type CardStats = {
  // the turn number on which the card was played.
  turnNumber: number;
  
  turnPhase: TurnPhase;
  
  // the player that played the card
  playerId: PlayerId;
};

export type MatchStats = {
  cardsGainedByTurn: Record<number, CardId[]>;
  cardsGained: Record<CardId, CardStats>;
  /**
   * Keys are the card's ID that was played, and values are CardStats objects.
   */
  playedCards: Record<CardId, CardStats>;
  playedCardsByTurn: Record<number, CardId[]>;
  trashedCards: Record<CardId, CardStats>;
  trashedCardsByTurn: Record<number, CardId[]>;
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
  config: ComputedMatchConfiguration,
  currentPlayerTurnIndex: number;
  mats: PlayerMatMap;
  playerActions: number;
  playerBuys: number;
  playerPotions: number;
  playerTreasure: number;
  players: Player[];
  playerVictoryTokens: Record<PlayerId, number>;
  roundNumber: number;
  scores: Record<PlayerId, number>,
  selectableCards: Record<PlayerId, CardId[]>;
  stats: MatchStats;
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
  | { type: 'gainVictoryToken'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource }
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
  | { type: 'display-cards'; cardIds: CardId[]; }
  | { type: 'select'; cardIds: CardId[]; selectCount: CountSpec; };

export type UserPromptActionArgs = {
  playerId: PlayerId;
  prompt?: string;
  content?: UserPromptKinds;
  actionButtons?: ActionButtons;
  validationAction?: number;
}

export const TurnPhaseOrderValues = ['action', 'buy', 'cleanup'] as const;
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
  playAllTreasureComplete: () => void;
  playerConnected: (player: Player) => void;
  playerDisconnected: (player: Player) => void;
  playerNameUpdated: (playerId: PlayerId, name: string) => void;
  playerReady: (playerId: PlayerId, ready: boolean) => void;
  searchCardResponse: (cardData: CardNoId[]) => void;
  selectCard: (signalId: string, selectCardArgs: SelectActionCardArgs & { selectableCardIds: CardId[] }) => void;
  setPlayerList: (players: Player[]) => void;
  setCardLibrary: (library: Record<CardKey, Card>) => void;
  setPlayer: (player: Player) => void;
  userPrompt: (signalId: string, userPromptArgs: UserPromptActionArgs) => void;
  waitingForPlayer: (playerId: PlayerId) => void;
};

export interface ServerListenEvents {
  cardsSelected: (selected: CardId[]) => void
  cardTapped: (playerId: PlayerId, cardId: CardId) => void;
  clientReady: (playerId: PlayerId, ready: boolean) => void;
  exchangeCoffer: (playerId: PlayerId, count: number) => void;
  expansionSelected: (val: string[]) => void;
  matchConfigurationUpdated: (val: MatchConfiguration) => void;
  nextPhase: () => void;
  playerReady: (playerId: PlayerId, ready: boolean) => void;
  playAllTreasure: (playerId: PlayerId) => void;
  searchCards: (playerId: PlayerId, searchStr: string) => void;
  updatePlayerName: (playerId: PlayerId, name: string) => void;
  userInputReceived: (signalId: string, input: unknown) => void;
}

export type PlayerMatMap = Record<PlayerId, Record<Mats, CardId[]>>;

const MatValues = [
  'island',
  'native-village',
  'set-aside',
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
  | number;

export type CostSpec =
  | { kind: 'exact'; amount: CardCost, playerId: PlayerId }
  | { kind: 'upTo'; amount: CardCost, playerId: PlayerId };

export type PlayerArgs = {
  id: PlayerId;
  name: string;
  sessionId: string;
  socketId: string;
  connected: boolean;
  ready: boolean;
  color: string;
}

export class Player {
  id: PlayerId;
  name: string;
  sessionId: string;
  socketId: string;
  connected: boolean;
  ready: boolean;
  color: string;
  
  constructor({ color, id, name, sessionId, socketId, connected, ready }: PlayerArgs) {
    this.id = id;
    this.name = name;
    this.sessionId = sessionId;
    this.socketId = socketId;
    this.connected = connected;
    this.ready = ready;
    this.color = color;
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
  randomizer: string | null;
  partOfSupply: boolean;
  kingdom: string;
  tags?: string[];
  facing?: CardFacing;
  id: CardId;
  type: CardType[];
  isBasic?: boolean;
  cardName: string;
  mat: Mats | undefined;
  cost: {
    treasure: number;
  };
  abilityText: string;
  cardKey: CardKey;
  victoryPoints?: number;
  targetScheme?: EffectTarget;
  expansionName: string;
  fullImagePath: string;
  halfImagePath: string;
  detailImagePath: string;
  owner?: PlayerId | null;
}

export type CardCost = {
  treasure: number;
  potion?: number | undefined;
}

export class Card {
  /**
   * If null, this card is not used during kingdom selection as part of the pool. If undefined, the cardKey is used.
   *
   * This is used in cases where a kingdom supply might contain different cards in one supply such as Knights from
   * Dark Ages. We set a randomizer of "knights" on it so that it's only gets one vote but it has 10 different knight
   * cards in the supply
   */
  randomizer: string | null;
  /**
   * This indicates if the card is part of the supply or not. shelters, rewards, etc. are not part of the supply.
   *
   * @default true
   */
  partOfSupply: boolean;
  tags?: string[] = [];
  kingdom: string;
  facing?: CardFacing;
  id: CardId;
  isBasic?: boolean = false;
  cardName: string;
  type: CardType[];
  mat: Mats | undefined;
  cost: CardCost;
  victoryPoints: number;
  abilityText: string;
  cardKey: CardKey;
  targetScheme?: EffectTarget;
  expansionName: string;
  fullImagePath: string;
  detailImagePath: string;
  halfImagePath: string;
  owner: PlayerId | null;
  
  constructor(args: CardArgs) {
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
    this.randomizer = args.randomizer;
  }
  
  toString() {
    return `[CARD ${this.id} - ${this.cardKey}]`;
  }
  
  // @ts-ignore
  [Symbol.for('Deno.customInspect')]() {
    return this.toString();
  }
}

const EffectTargetValues = ['ANY', 'ALL_OTHER', 'ALL'] as const;
export type EffectTarget = typeof EffectTargetValues[number] | string;
export type EffectRestrictionSpec = {
  source: {
    location: CardLocation | CardLocation[];
    playerId?: PlayerId;
  }
  card?: {
    cardKeys?: CardKey | CardKey[];
    type?: CardType | CardType[];
  };
  cost?: CostSpec;
};

export type ActionButtons = {
  label: string;
  action: number;
}[];
export type CardNoId = Omit<Card, 'id'>;
export type CardFacing = 'front' | 'back';