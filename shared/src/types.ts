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

export type UserPromptArgs = {
    prompt: string;
    confirmLabel: string;
    declineLabel?: string;
    showDeclineOption?: boolean;
    content?: {
        cardSelection?: {
            cardIds: number[],
            selectCount?: CountSpec
        }
    }
}

export type MatchConfiguration = {
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
    scores: Record<number, number>,
    cardsById: Record<number, Card>,
    selectableCards: { playerId: number; cardId: number }[];
    players: number[];
    playArea: number[];
    supply: number[];
    kingdom: number[];
    trash: number[];
    playerHands: Record<number, number[]>;
    playerDecks: Record<number, number[]>;
    playerDiscards: Record<number, number[]>;
    config: MatchConfiguration,
    turnNumber: number;
    // this is the index within the turn order array of whose turn it is. - note this number never resets - modulus is used to determine the actual index
    currentPlayerTurnIndex: number;
    // could be used to differentiate between the original player's turn vs who is
    // currently playing cards like when reacting
    activePlayerId: number;
    playerActions: number;
    playerBuys: number;
    playerTreasure: number;
    // the current phase's index within the TurnPhaseValues array. - note this number never resets - modulus is used to determine the actual index
    turnPhaseIndex: number;
}

export const TurnPhaseOrderValues = ["action", "buy", "cleanup"] as const;
export type TurnPhase = typeof TurnPhaseOrderValues[number] | undefined; // Define Effect as a union of all effect classes.

export type ServerEmitEvents = {
    addLogEntry: (logEntry: LogEntry) => void;
    cardEffectsComplete: () => void;
    doneWaitingForPlayer: (playerId?: number) => void;
    expansionList: (val: any[]) => void;
    matchConfigurationUpdated: (val: Pick<MatchConfiguration, 'expansions'>) => void;
    gameOver: (summary: MatchSummary) => void;
    gameOwnerUpdated: (playerId: number) => void;
    matchReady: (match: Match) => void;
    matchStarted: (match: Match) => void;
    matchUpdated: (match: MatchUpdate) => void;
    playerConnected: (player: Player, players: Player[]) => void;
    playerDisconnected: (player: Player, players: Player[]) => void;
    playerNameUpdated: (playerId: number, name: string) => void;
    playerReady: (playerId: number, ready: boolean) => void;
    playerSet: (player: Player) => void;
    reconnectedToGame: (player: Player, state?: Match) => void;
    scoresUpdated: (scores: Record<number, number>) => void;
    selectableCardsUpdated: (cards: number[]) => void;
    selectCard: (selectCardArgs: { selectableCardIds: number[], count: CountSpec }) => void;
    userPrompt: (userPromptArgs: UserPromptArgs) => void;
    waitingForPlayer: (playerId: number) => void;
}
export type ServerEmitEventNames = keyof ServerEmitEvents;

export type ServerListenEvents = {
    cardTapped: (playerId: number, cardId: number) => void;
    clientReady: (playerId: number, ready: boolean) => void;
    expansionSelected: (val: string[]) => void;
    matchConfigurationUpdated: (val: Pick<MatchConfiguration, 'expansions'>) => void;
    nextPhase: () => void;
    playerReady: (playerId: number, ready: boolean) => void;
    playAllTreasure: (playerId: number) => void;
    selectCardResponse: (selectedCards: number[]) => void;
    updatePlayerName: (playerId: number, name: string) => void;
    userPromptResponse: (result: unknown) => void;
}
export type ClientEmitEvents = Omit<ServerListenEvents, 'startMatch'> & {
    startMatch: (configuration: Pick<MatchConfiguration, 'expansions'>) => void;
};

const CardLocationValues = ['playerDiscards', 'playerHands', 'trash', 'playArea', 'playerDecks', 'supply', 'kingdom'] as const;
export type CardLocation = typeof CardLocationValues[number];

export type LocationSpec = { location: CardLocation | CardLocation[], index?: number };

export type CountSpec =
    | { kind: 'exact'; count: number }
    | { kind: 'upTo'; count: number }
    | { kind: 'all' }
    | { kind: 'variable' }
    | number;

export type CostSpec =
    | { kind: 'exact'; amount: number }
    | { kind: 'upTo'; amount: number }
    | number;

export type EffectExceptionSpec =
    | { kind: 'player'; playerIds: number[] };

export type PlayerArgs = {
    id: number;
    name: string;
    sessionId: string;
    socketId: string;
    connected: boolean;
    ready: boolean;
}

export class Player {
    id: number;
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

    [Symbol.for('Deno.customInspect')]() {
        return this.toString();
    }
}

export type MatchSummary = {
    scores: {
        playerId: number;
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
    id: number;
    type: CardType[];
    cardName: string;
    cost: {
        treasure: number;
    };
    abilityText: string;
    order: number;
    cardKey: string;
    victoryPoints?: number;
    targetScheme?: EffectTarget;
}

export class Card {
    id: number;
    cardName: string;
    type: CardType[];
    cost: {
        treasure: number;
    };
    victoryPoints: number;
    abilityText: string;
    order: number;
    cardKey: string;
    targetScheme?: EffectTarget;

    constructor(args: CardArgs) {
        this.id = args.id;
        this.type = args.type;
        this.cost = args.cost;
        this.abilityText = args.abilityText;
        this.order = args.order;
        this.cardKey = args.cardKey;
        this.cardName = args.cardName;
        this.victoryPoints = args.victoryPoints ?? 0;
        this.targetScheme = args.targetScheme;
    }

    toString() {
        return `[CARD ${this.id} - ${this.cardKey}]`;
    }
    
    [Symbol.for("Deno.customInspect")]() {
        return this.toString();
    }
}

export type ClientListenEvents = ServerEmitEvents;
export type ClientListenEventNames = ServerEmitEventNames;

export interface GameEvents {
    addLogEntry: (logEntry: string) => void;
    cardEffectsComplete: () => void;
    cardsSelected: (cardIds: number[]) => void;
    cardTapped: (playerId: number, cardId: number) => void;
    displayCardDetail: (cardId: number) => void;
    doneWaitingForPlayer: (playerId?: number) => void;
    matchStarted: () => void;
    nextPhase: () => void;
    playCard: (playerId: number, cardId: number) => void;
    selectCard: (count: CountSpec) => void;
    userPrompt: (userPromptArgs: UserPromptArgs) => void;
    userPromptResponse: (confirm: unknown) => void;
    waitingForPlayer: (playerId: number) => void;
}

export type CardKey = string;

const EffectTargetValues = ["ANY", "ALL_OTHER", "ALL"] as const;
export type EffectTarget = typeof EffectTargetValues[number] | string;