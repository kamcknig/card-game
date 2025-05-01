import type { Operation } from 'fast-json-patch';

export type CardKey = string;
export type PlayerId = number;
export type CardId = number;

/****************
 
    MATCH types

***************/
export type MatchConfiguration = {
  players: Player[];
  
  // info about the expansions selected for the match. determines what cards can randomly be selected for the kingdom
  expansions: ExpansionListElement[];
  
  // cards banned from the match
  bannedKingdoms: CardNoId[];
  
  // basic cards selected for the game, these are what are available at the beginning of a match
  basicCards: CardNoId[];
  
  // kingdom cards selected for the game, these are what are available at the beginning of a match
  kingdomCards: CardNoId[];
}

export type ComputedMatchConfiguration = MatchConfiguration & {
  basicCardCount: Record<CardKey, number>;
  kingdomCardCount: Record<CardKey, number>;
  startingHand: Record<CardKey, number>;
  mats: PlayerMatMap;
}

type CardStats = {
  // the turn number on which the card was played.
  turnNumber: number;
  
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
  trashedCards: Record<PlayerId, CardStats>;
  cardsBought: Record<PlayerId, CardStats>;
};

export interface Match {
  activeDurationCards: CardId[];
  config: MatchConfiguration,
  currentPlayerTurnIndex: number;
  kingdomSupply: CardId[];
  playArea: CardId[];
  playerActions: number;
  playerBuys: number;
  playerDecks: Record<PlayerId, CardId[]>;
  playerDiscards: Record<PlayerId, CardId[]>;
  playerHands: Record<PlayerId, CardId[]>;
  playerTreasure: number;
  playerPotions: number;
  players: Player[];
  roundNumber: number;
  scores: Record<PlayerId, number>,
  selectableCards: Record<PlayerId, CardId[]>;
  basicSupply: CardId[];
  trash: CardId[];
  turnNumber: number;
  turnPhaseIndex: number;
  mats: PlayerMatMap;
  stats: MatchStats;
  cardOverrides: CardOverrides;
}

export type CardOverrides = Record<PlayerId, Record<CardId, Partial<Card>>>;

/**************
 
 LOG types
 
******************/

export type LogEntrySource = CardId;

export type LogEntry =
  | { type: 'draw'; playerId: PlayerId; cardId: CardId; depth?: number; source?: LogEntrySource}
  | { type: 'discard'; playerId: PlayerId; cardId: CardId; depth?: number; source?: LogEntrySource}
  | { type: 'gainAction'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource}
  | { type: 'gainBuy'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'gainTreasure'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource}
  | { type: 'gainVictoryToken'; count: number; playerId: PlayerId; depth?: number; source?: LogEntrySource}
  | { type: 'gainCard'; cardId: CardId; playerId: PlayerId; depth?: number; source?: LogEntrySource}
  | { type: 'cardPlayed'; cardId: CardId; playerId: PlayerId; depth?: number; source?: LogEntrySource}
  | { type: 'revealCard'; cardId: CardId; playerId: PlayerId; depth?: number; source?: LogEntrySource}
  | { type: 'trashCard'; cardId: CardId; playerId: PlayerId; depth?: number; source?: LogEntrySource}
  | { type: 'shuffleDeck'; playerId: PlayerId; depth?: number; source?: LogEntrySource }
  | { type: 'newTurn'; turn: number; depth?: number; source?: LogEntrySource}
  | { type: 'newPlayerTurn'; turn: number; playerId: PlayerId; depth?: number; source?: LogEntrySource};




/***************
 
 GAME ACTION types
 
*********************/

export type SelectActionCardArgs = {
  restrict: EffectRestrictionSpec | number[];
  count?: CountSpec | number;
  autoSelect?: boolean;
  playerId: PlayerId;
  optional?: boolean;
  prompt: string;
  validPrompt?: string;
  cancelPrompt?: string;
}

export type UserPromptKinds =
  | { type: 'blind-rearrange'; cardIds: CardId[]; }
  | { type: 'rearrange'; cardIds: CardId[]; }
  | { type: 'name-card' }
  | { type: 'select'; cardIds: CardId[]; selectCount: CountSpec };

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
  matchReady: (match: Match) => void;
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
  setCardLibrary: (cardLibrary: Record<CardId, Card>) => void;
  setPlayerList: (players: Player[]) => void;
  setPlayer: (player: Player) => void;
  userPrompt: (signalId: string, userPromptArgs: UserPromptActionArgs) => void;
  waitingForPlayer: (playerId: PlayerId) => void;
};

export type ServerListenEvents = {
  cardsSelected: (selected: CardId[]) => void
  cardTapped: (playerId: PlayerId, cardId: CardId) => void;
  clientReady: (playerId: PlayerId, ready: boolean) => void;
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

const CardLocationValues = ['activeDuration', 'playerDiscards', 'playerHands', 'trash', 'playArea', 'playerDecks', 'supply', 'kingdom'] as const;
export type CardLocations = typeof CardLocationValues[number];

export type CardLocation =
  | CardLocations
  | Mats

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
const CardTypeValues = [
  'ACTION',
  'ALLY',
  'ARTIFACT',
  'ATTACK',
  'AUGUR',
  'BOON',
  'CASTLE',
  'CLASH',
  'COMMAND',
  'CURSE',
  'DOOM',
  'DURATION',
  'EVENT',
  'FATE',
  'FORT',
  'HEIRLOOM',
  'HEX',
  'KNIGHT',
  'LANDMARK',
  'LIAISON',
  'LOOT',
  'LOOTER',
  'NIGHT',
  'ODYSSEY',
  'OMEN',
  'PRIZE',
  'PROJECT',
  'PROPHECY',
  'REACTION',
  'RESERVE',
  'REWARD',
  'RUINS',
  'SHADOW',
  'SHELTER',
  'SPIRIT',
  'STATE',
  'TOWNSFOLK',
  'TRAIT',
  'TRAVELLER',
  'TREASURE',
  'VICTORY',
  'WAY',
  'WIZARD',
  'ZOMBIE',
] as const;
export type CardType = typeof CardTypeValues[number];

export type CardArgs = {
  id: CardId;
  type: CardType[];
  isBasic: boolean;
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
  id: CardId;
  isBasic: boolean = false;
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
    this.isBasic = args.isBasic;
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
  from?: CardLocationSpec;
  card?: {
    cardKeys?: CardKey | CardKey[];
    type?: CardType | CardType[];
  } | CardId[];
  cost?: CostSpec;
};

export type ActionButtons = {
  label: string;
  action: number;
}[];
export type CardNoId = Omit<Card, 'id'>;
