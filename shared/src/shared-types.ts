import type { Operation } from 'fast-json-patch';

export type LogEntry =
    | { type: 'draw'; playerSourceId: number; cardId: number; }
    | { type: 'discard'; playerSourceId: number; cardId: number; }
    | { type: 'gainAction'; count: number; playerSourceId: number; }
    | { type: 'gainBuy'; count: number; playerSourceId: number;}
    | { type: 'gainTreasure'; count: number; playerSourceId: number;}
    | { type: 'gainCard'; cardId: number; playerSourceId: number;}
    | { type: 'playCard'; cardId: number; playerSourceId: number;}
    | { type: 'revealCard'; cardId: number; playerSourceId: number;}
    | { type: 'trashCard'; cardId: number; playerSourceId: number;}

export type SelectCardEffectArgs = {
    restrict: EffectRestrictionSpec | number[],
    count?: CountSpec | number,
    autoSelect?: boolean,
    playerId: number,
    prompt: string,
    validPrompt?: string,
}

export type UserPromptKinds =
    | { type: 'blind-rearrange'; cardIds: CardId[]; }
    | { type: 'rearrange'; cardIds: CardId[]; }
    | { type: 'select'; cardIds: CardId[]; selectCount: CountSpec };

export type UserPromptEffectArgs = {
    prompt?: string;
    content?: UserPromptKinds;
    actionButtons?: ActionButtons;
    validationAction?: number;
}

export type MatchConfiguration = {
    players: Player[];
    expansions: string[];
    supplyCardKeys: string[];
    kingdomCardKeys: string[];
}

export type GameState = {
    match: Match;
    matchConfig: MatchConfiguration;
    owner: number;
    players: Player[];
    started: boolean;
}

export type MatchUpdate = Partial<Match>;

export type Match = {
    config: MatchConfiguration,
    currentPlayerTurnIndex: number;
    kingdom: CardId[];
    playArea: CardId[];
    playerActions: number;
    playerBuys: number;
    playerDecks: Record<PlayerId, CardId[]>;
    playerDiscards: Record<PlayerId, CardId[]>;
    playerHands: Record<PlayerId, CardId[]>;
    playerTreasure: number;
    players: Player[];
    scores: Record<PlayerId, number>,
    selectableCards: Record<PlayerId, CardId[]>;
    supply: CardId[];
    trash: CardId[];
    turnNumber: number;
    turnPhaseIndex: number;
    cardsPlayed: Record<PlayerId, CardId[]>;
}

export const TurnPhaseOrderValues = ["action", "buy", "cleanup"] as const;
export type TurnPhase = typeof TurnPhaseOrderValues[number] | undefined; // Define Effect as a union of all effect classes.

export type CardOverrides = Record<PlayerId, Record<CardId, Card>>;

export type ServerEmitEvents = {
    addLogEntry: (logEntry: LogEntry) => void;
    cardEffectsComplete: () => void;
    doneWaitingForPlayer: (playerId?: PlayerId) => void;
    expansionList: (val: any[]) => void;
    matchConfigurationUpdated: (val: MatchConfiguration) => void;
    gameOver: (summary: MatchSummary) => void;
    gameOwnerUpdated: (playerId: PlayerId) => void;
    matchReady: (match: Match) => void;
    matchStarted: () => void;
    matchPatch: (patch: Operation[]) => void;
    playerConnected: (player: Player) => void;
    playerDisconnected: (player: Player) => void;
    playerNameUpdated: (playerId: PlayerId, name: string) => void;
    playerReady: (playerId: PlayerId, ready: boolean) => void;
    selectCard: (selectCardArgs: SelectCardEffectArgs & { selectableCardIds: CardId[] }) => void;
    setCardDataOverrides: (overrides: Record<CardId, Partial<Card>> | undefined) => void;
    setCardLibrary: (cardLibrary: Record<CardId, Card>) => void;
    setPlayerList: (players: Player[]) => void;
    setPlayer: (player: Player) => void;
    userPrompt: (userPromptArgs: UserPromptEffectArgs) => void;
    waitingForPlayer: (playerId: PlayerId) => void;
}
export type ServerEmitEventNames = keyof ServerEmitEvents;

export type ServerListenEvents = {
    cardsSelected: (selected: CardId[]) =>void
    cardTapped: (playerId: PlayerId, cardId: CardId) => void;
    clientReady: (playerId: PlayerId, ready: boolean) => void;
    expansionSelected: (val: string[]) => void;
    matchConfigurationUpdated: (val: MatchConfiguration) => void;
    nextPhase: () => void;
    playerReady: (playerId: PlayerId, ready: boolean) => void;
    playAllTreasure: (playerId: PlayerId) => void;
    selectCardResponse: (selectedCards: CardId[]) => void;
    updatePlayerName: (playerId: PlayerId, name: string) => void;
    userPromptResponse: (result: unknown) => void;
}

export type ClientEmitEvents = Omit<ServerListenEvents, 'startMatch' | 'matchConfigurationUpdated'> & {
    startMatch: (configuration: Pick<MatchConfiguration, 'expansions'>) => void;
    matchConfigurationUpdated: (config: Pick<MatchConfiguration, 'expansions'>) => void;
};

const CardLocationValues = ['playerDiscards', 'playerHands', 'trash', 'playArea', 'playerDecks', 'supply', 'kingdom'] as const;
export type CardLocation = typeof CardLocationValues[number];

export type LocationSpec = { location: CardLocation | CardLocation[], index?: number };

export type CountSpec =
    | { kind: 'upTo'; count: number }
    | number;

export type CostSpec =
    | { kind: 'exact'; amount: number }
    | { kind: 'upTo'; amount: number }
    | number;

export type EffectExceptionSpec =
    | { kind: 'player'; playerIds: PlayerId[] };

export type PlayerArgs = {
    id: PlayerId;
    name: string;
    sessionId: string;
    socketId: string;
    connected: boolean;
    ready: boolean;
}

export class Player {
    id: PlayerId;
    name: string;
    sessionId: string;
    socketId: string;
    connected: boolean;
    ready: boolean;

    constructor({id, name, sessionId, socketId, connected, ready}: PlayerArgs) {
        this.id = id;
        this.name = name;
        this.sessionId = sessionId;
        this.socketId = socketId;
        this.connected = connected;
        this.ready = ready;
    }

    toString() {
        return `[PLAYER ${this.id} - ${this.name}]`;
    }
    
    // @ts-ignore
    [Symbol.for("Deno.customInspect")]() {
        return this.toString();
    }
}

export type MatchSummary = {
    scores: {
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
export type CardType = typeof CardTypeValues[number] | string;

export type CardArgs = {
    id: CardId;
    type: CardType[];
    cardName: string;
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
}

export class Card {
    id: CardId;
    cardName: string;
    type: CardType[];
    cost: {
        treasure: number;
    };
    victoryPoints: number;
    abilityText: string;
    cardKey: CardKey;
    targetScheme?: EffectTarget;
    expansionName: string;
    fullImagePath: string;
    detailImagePath: string;
    halfImagePath: string;

    constructor(args: CardArgs) {
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
    }
    
    toString() {
        return `[CARD ${this.id} - ${this.cardKey}]`;
    }
    
    // @ts-ignore
    [Symbol.for("Deno.customInspect")]() {
        return this.toString();
    }
}

export type ClientListenEvents = ServerEmitEvents;
export type ClientListenEventNames = ServerEmitEventNames;

export interface GameEvents {
    addLogEntry: (logEntry: string) => void;
    cardEffectsComplete: () => void;
    cardsSelected: (cardIds: CardId[]) => void;
    cardTapped: (playerId: PlayerId, cardId: CardId) => void;
    displayCardDetail: (cardId: CardId) => void;
    doneWaitingForPlayer: (playerId?: PlayerId) => void;
    nextPhase: () => void;
    playCard: (playerId: PlayerId, cardId: CardId) => void;
    selectCard: (selectCardArgs: SelectCardEffectArgs) => void;
    userPrompt: (userPromptArgs: UserPromptEffectArgs) => void;
    userPromptResponse: (confirm: unknown) => void;
    waitingForPlayer: (playerId: PlayerId) => void;
}

export type CardKey = string;

const EffectTargetValues = ["ANY", "ALL_OTHER", "ALL"] as const;
export type EffectTarget = typeof EffectTargetValues[number] | string;
export type EffectRestrictionSpec = "SELF" | {
    from?: LocationSpec;
    card?: {
        cardKeys?: CardKey | CardKey[];
        type?: CardType | CardType[];
    };
    cost?: CostSpec;
};
export type PlayerId = number;
export type CardId = number;
export type ActionButtons = {
    label: string;
    action: number;
}[];
export type CardFacing = 'front' | 'back';
export type CardSize = 'full' | 'half' | 'detail';