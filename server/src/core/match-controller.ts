import {
  CardKey,
  CardNoId,
  ComputedMatchConfiguration,
  Match,
  MatchConfiguration,
  MatchSummary,
  PlayerId,
  ServerListenEvents,
} from 'shared/shared-types.ts';
import { MatchConfigurator } from './match-configurator.ts';
import { getCurrentPlayer } from '../utils/get-current-player.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { fisherYatesShuffle } from '../utils/fisher-yates-shuffler.ts';
import { ReactionManager } from './reactions/reaction-manager.ts';
import { scoringFunctionMap } from '@expansions/scoring-function-map.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { compare, Operation } from 'fast-json-patch';
import { getPlayerById } from '../utils/get-player-by-id.ts';
import { cardEffectFunctionMapFactory } from './effects/card-effect-function-map-factory.ts';
import { EventEmitter } from '@denosaurs/event';
import { LogManager } from './log-manager.ts';
import {
  AppSocket,
  CardEffectFunctionMap,
  EndGameConditionFn,
  FindCardsFn,
  GameActionDefinitionMap,
  GameActionReturnTypeMap,
  GameActions,
  GameLifecycleCallback,
  GameLifecycleEvent,
  MatchBaseConfiguration,
  PlayerScoreDecorator,
} from '../types.ts';
import { createCard } from '../utils/create-card.ts';
import { getRemainingSupplyCount, getStartingSupplyCount } from '../utils/get-starting-supply-count.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { findCardsFactory } from '../utils/find-cards.ts';
import { GameActionController } from './actions/game-action-controller.ts';
import { CardSourceController } from './card-source-controller.ts';

export class MatchController extends EventEmitter<{ gameOver: [void] }> {
  private _cardLibSnapshot = {};
  private _matchSnapshot: Match | null | undefined;
  private _reactionManager: ReactionManager | undefined;
  private _interactivityController: CardInteractivityController | undefined;
  private readonly _cardLibrary: MatchCardLibrary = new MatchCardLibrary();
  private _logManager: LogManager | undefined;
  private gameActionsController: GameActionController | undefined;
  private readonly _match: Match = {} as Match;
  private _matchConfiguration: ComputedMatchConfiguration | undefined;
  private _expansionEndGameConditionFns: EndGameConditionFn[] = [];
  private _cardPriceController: CardPriceRulesController | undefined;
  private _matchConfigurator: MatchConfigurator | undefined;
  private _expansionScoringFns: PlayerScoreDecorator[] = [];
  private _registeredEvents: (keyof ServerListenEvents)[] = [];
  private _findCards: FindCardsFn = (...args) => ([]);
  private readonly _cardSourceController: CardSourceController;
  
  private _playerHands: Record<CardKey, number>[] = [
    {
      gold: 3,
      silver: 2,
      estate: 2,
      'urchin': 2,
      vagrant: 3,
    },
    {
      gold: 3,
      silver: 2,
      estate: 2,
      'urchin': 2,
      vagrant: 3,
    },
  ];
  
  constructor(
    private readonly _socketMap: Map<PlayerId, AppSocket>,
    private readonly cardSearchFn: (searchTerm: string) => CardNoId[],
  ) {
    super();
    
    this._match = {
      cardSources: {},
      cardSourceTagMap: {},
      playerVictoryTokens: {},
      coffers: {},
      cardOverrides: {},
      scores: {},
      players: [],
      config: {} as ComputedMatchConfiguration,
      turnNumber: 0,
      roundNumber: 0,
      currentPlayerTurnIndex: 0,
      playerPotions: 0,
      playerBuys: 0,
      playerTreasure: 0,
      playerActions: 0,
      turnPhaseIndex: 0,
      selectableCards: {},
      mats: {},
      stats: {
        playedCardsByTurn: {},
        cardsGainedByTurn: {},
        playedCards: {},
        cardsGained: {},
        trashedCards: {},
        trashedCardsByTurn: {},
        cardsBought: {}
      }
    }
    this._cardSourceController = new CardSourceController(this._match);
  }
  
  public async initialize(config: MatchConfiguration) {
    this.broadcastPatch({} as Match);
    
    const snapshot = this.getMatchSnapshot();
    
    this._logManager = new LogManager({
      socketMap: this._socketMap,
    });
    
    this._cardPriceController = new CardPriceRulesController(
      this._cardLibrary,
      this._match
    );
    
    this._findCards = findCardsFactory(this._cardSourceController, this._cardPriceController, this._cardLibrary);
    
    this._reactionManager = new ReactionManager(
      this._cardSourceController,
      this._findCards,
      this._cardPriceController,
      this._logManager,
      this._match,
      this._cardLibrary,
      (action, ...args) => this.runGameAction(action, ...args)
    );
    
    const cardEffectFunctionMap = Object.keys(cardEffectFunctionMapFactory).reduce((acc, nextKey) => {
      acc[nextKey] = cardEffectFunctionMapFactory[nextKey]();
      return acc;
    }, {} as CardEffectFunctionMap);
    
    this._interactivityController = new CardInteractivityController(
      this._cardSourceController,
      this._cardPriceController,
      this._match,
      this._socketMap,
      this._cardLibrary,
      (action, ...args) => this.runGameAction(action, ...args),
      this._findCards
    );
    
    this.gameActionsController = new GameActionController(
      this._cardSourceController,
      this._findCards,
      this._cardPriceController,
      cardEffectFunctionMap,
      this._match,
      this._cardLibrary,
      this._logManager,
      this._socketMap,
      this._reactionManager,
      (action, ...args) => this.runGameAction(action, ...args),
      this._interactivityController,
    );
    
    this._matchConfigurator = new MatchConfigurator(config);
    
    const { config: newConfig } = await this._matchConfigurator.createConfiguration({
      match: this._match,
      cardSourceController: this._cardSourceController,
      gameEventRegistrar: (event: GameLifecycleEvent, handler: GameLifecycleCallback) => this._reactionManager?.registerGameEvent(event, handler),
      clientEventRegistrar: (event, handler) => this.clientEventRegistrar(event, handler),
      endGameConditionRegistrar: (val) => this._expansionEndGameConditionFns.push(val),
      cardEffectRegistrar: (...args) => this.gameActionsController?.registerCardEffect(...args),
      playerScoreDecoratorRegistrar: (val: PlayerScoreDecorator) => this._expansionScoringFns.push(val),
    });
    
    this._matchConfiguration = newConfig;
    
    this._match.players = this._matchConfiguration.players;
    this.createBaseSupply(this._matchConfiguration);
    this.createKingdom(this._matchConfiguration);
    this.createNonSupplyCards(this._matchConfiguration);
    this.createPlayerDecks(this._matchConfiguration);
    this._match.config = this._matchConfiguration;
    
    console.log(`[match] ready, sending to clients and listening for when clients are ready`);
    
    this.broadcastPatch(snapshot);
    
    this._socketMap.forEach((s) => {
      s.emit('setCardLibrary', this._cardLibrary.getAllCards());
      s.emit('matchReady');
      s.on('clientReady', this.onClientReady);
    });
  }
  
  private clientEventRegistrar<T extends keyof ServerListenEvents>(event: T, handler: ServerListenEvents[T]) {
    this._registeredEvents.push(event);
    this._socketMap.forEach(s => {
      s.on(event, handler as any);
    })
  }
  
  public playerReconnected(playerId: PlayerId, socket: AppSocket) {
    console.log(`[match] player ${playerId} reconnecting`);
    this._socketMap.set(playerId, socket);
    
    this.broadcastPatch({} as Match, playerId);
    
    socket.emit('matchReady');
    
    socket.on('clientReady', async (_playerId: number, _ready: boolean) => {
      console.log(`[match] ${getPlayerById(this._match, playerId)} marked ready`);
      socket.emit('matchStarted');
      socket.off('clientReady');
      
      this.initializeSocketListeners(socket);
      
      this._interactivityController?.playerAdded(socket);
      
      if (getCurrentPlayer(this._match).id === playerId) {
        await this.runGameAction('checkForRemainingPlayerActions');
      }
    });
  }
  
  public playerDisconnected(playerId: number) {
    // Use whichever array is populated depending on phase
    const roster = this._match.players?.length
      ? this._match.players
      : this._match.config.players;
    
    // There should always be at least one entry after a single disconnect
    const leaving = roster.find((p) => p.id === playerId);
    console.log(`[match] ${leaving ?? `{id:${playerId}}`} has disconnected`);
    
    this._socketMap.get(playerId)?.offAnyIncoming();
    this._interactivityController?.playerRemoved(this._socketMap.get(playerId));
    this._socketMap.delete(playerId);
  }
  
  private createBaseSupply(config: ComputedMatchConfiguration) {
    console.log(`[match] creating base supply cards`);
    const cardSource = this._cardSourceController.getSource('basicSupply');
    
    if (!cardSource) {
      throw new Error(`[match] no basic supply card source found`);
    }
    
    for (const supply of Object.values(config.basicSupply)) {
      for (const card of supply.cards) {
        if (!card) {
          throw new Error(`[match] no card data found for ${supply}`);
        }
        
        const c = createCard(card.cardKey, { ...card, kingdom: supply.name });
        this._cardLibrary.addCard(c);
        cardSource.push(c.id);
      }
    }
  }
  
  private createKingdom(config: ComputedMatchConfiguration) {
    console.log(`[match] creating kingdom cards`);
    
    const cardSource = this._cardSourceController.getSource('kingdomSupply');
    
    if (!cardSource) {
      throw new Error(`[match] no basic supply card source found`);
    }
    
    for (const kingdom of Object.values(config.kingdomSupply)) {
      for (const card of kingdom.cards) {
        if (!card) {
          throw new Error(`[match] no card data found for ${kingdom}`);
        }
        
        const c = createCard(card.cardKey, { ...card, kingdom: kingdom.name });
        this._cardLibrary.addCard(c);
        cardSource.push(c.id);
      }
    }
  }
  
  private createNonSupplyCards(config: ComputedMatchConfiguration) {
    console.log(`[match] creating non-supply cards`);
    
    const cardSource = this._cardSourceController.getSource('nonSupplyCards');
    
    if (!cardSource) {
      throw new Error(`[match] no basic supply card source found`);
    }
    
    for (const supply of Object.values(config.nonSupply ?? {})) {
      for (const card of supply.cards) {
        if (!card) {
          throw new Error(`[match] no card data found for ${supply}`);
        }
        
        const c = createCard(card.cardKey, { ...card, kingdom: supply.name });
        this._cardLibrary.addCard(c);
        cardSource.push(c.id);
      }
    }
  }
  
  private createPlayerDecks(config: MatchConfiguration) {
    console.log(`[match] creating player decks`);
    
    return Object.values(config.players).forEach((player, idx) => {
      console.log('initializing player', player.id, 'cards...');
      
      let playerStartHand = this._playerHands.length > 0 ? this._playerHands[idx] : MatchBaseConfiguration.playerStartingHand as Record<string, number>;
      playerStartHand ??= MatchBaseConfiguration.playerStartingHand;
      console.log(`[match] using player starting hand`);
      console.log(Object.keys(playerStartHand).map((key) => `${key}: ${playerStartHand[key]}`).join(', '))
      
      const deck = this._cardSourceController.getSource('playerDeck', player.id);
      
      Object.entries(playerStartHand).forEach(
        ([key, count]) => {
          deck.push(
            ...new Array(count).fill(0).map((_) => {
              const c = createCard(key, { owner: player.id });
              this._cardLibrary.addCard(c);
              return c.id;
            }),
          );
          fisherYatesShuffle(deck, true);
        },
      );
    });
  }
  
  public getMatchSnapshot(): Match {
    this._cardLibSnapshot = structuredClone(this._cardLibrary.getAllCards());
    return structuredClone(this._match);
  }
  
  async runGameAction<K extends GameActions>(
    action: K,
    ...args: Parameters<GameActionDefinitionMap[K]>
  ): Promise<GameActionReturnTypeMap[K]> {
    this._matchSnapshot ??= this.getMatchSnapshot();
    
    let asyncTimeout: number | undefined = undefined;
    if (action === 'selectCard' || action === 'userPrompt') {
      this.broadcastPatch(this._matchSnapshot);
      this._logManager?.flushQueue();
      this._matchSnapshot = this.getMatchSnapshot();
      let pingCount = 0;
      let pingTime = 30000;
      
      const pingUser = () => {
        this._socketMap.get(args[0].playerId)?.emit('ping', ++pingCount);
        pingTime -= 10000;
        pingTime = Math.max(pingTime, 10000);
        asyncTimeout = setTimeout(pingUser, pingTime);
      }
      
      asyncTimeout = setTimeout(pingUser, pingTime);
    }
    
    const result = await this.gameActionsController!.invokeAction(action, ...args);
    
    clearTimeout(asyncTimeout);
    asyncTimeout = undefined;
    
    this.calculateScores();
    this._interactivityController?.checkCardInteractivity();
    this._match.cardOverrides = this._cardPriceController?.calculateOverrides() ?? {};
    
    this.broadcastPatch({ ...this._matchSnapshot });
    this._logManager?.flushQueue();
    
    this._matchSnapshot = null;
    
    if (await this.checkGameEnd()) {
      console.log(`[match] game ended`)
    }
    
    return result as Promise<GameActionReturnTypeMap[K]>;
  }
  
  public broadcastPatch(prev: Match, playerId?: PlayerId) {
    const patch: Operation[] = compare(prev, this._match);
    const cardLibraryPatch = compare(this._cardLibSnapshot, this._cardLibrary.getAllCards());
    
    if (patch.length || cardLibraryPatch.length) {
      console.log(`[match] sending match update to clients`);
      
      if (playerId) {
        this._socketMap.get(playerId)?.emit('patchUpdate', patch, cardLibraryPatch);
      }
      else {
        this._socketMap.forEach((s) => s.emit('patchUpdate', patch, cardLibraryPatch));
      }
    }
  }
  
  private onClientReady = (playerId: number) => {
    const player = this._match.config?.players.find((player) =>
      player.id === playerId
    );
    
    console.log(`[match] received clientReady event from ${player}`);
    
    if (!player) {
      console.error(`[match] player not found`);
      return;
    }
    
    if (!this._match.config) {
      console.error(`[match] no match config`);
      return;
    }
    
    player.ready = true;
    
    if (this._match.config.players.some((p) => !p.ready)) {
      console.log(`[match] not all players marked ready, waiting for everyone`,);
      return;
    }
    
    console.log('[match] all players ready');
    
    for (const socket of this._socketMap.values()) {
      socket.off('clientReady', this.onClientReady);
    }
    
    void this.startMatch();
  };
  
  private async startMatch() {
    console.log(`[match] starting match`);
    
    await this._reactionManager?.runGameLifecycleEvent('onGameStart', { match: this._match });
    
    for (const socket of this._socketMap.values()) {
      this.initializeSocketListeners(socket);
    }
    
    this._matchSnapshot = this.getMatchSnapshot();
    this._match.playerBuys = 1;
    this._match.playerActions = 1;
    
    this._socketMap.forEach((s) => s.emit('matchStarted'));
    
    for (const player of this._match.players!) {
      await this.runGameAction('drawCard', { playerId: player.id, count: 5 });
    }
    
    this._logManager?.addLogEntry({
      root: true,
      type: 'newTurn',
      turn: Math.floor(this._match.turnNumber / this._match.players.length) + 1,
    });
    
    this._logManager?.addLogEntry({
      root: true,
      type: 'newPlayerTurn',
      turn: Math.floor(this._match.turnNumber / this._match.players.length) + 1,
      playerId: getCurrentPlayer(this._match).id
    });
    
    await this.runGameAction('checkForRemainingPlayerActions');
  }
  
  private calculateScores() {
    console.log(`[match] calculating scores`);
    
    const match = this._match;
    
    for (const player of match.players ?? []) {
      const playerId = player.id;
      const cards = this._cardLibrary.getCardsByOwner(playerId);
      
      let score = 0;
      for (const { id: cardId } of cards) {
        const card = this._cardLibrary.getCard(cardId);
        score += card.victoryPoints ?? 0;
        
        const customScoringFn = scoringFunctionMap[card?.cardKey ?? ''];
        if (customScoringFn) {
          console.log(`[match] processing scoring function for ${card}`);
          score += customScoringFn({
            cardSourceController: this._cardSourceController,
            cardPriceController: this._cardPriceController!,
            findCards: this._findCards,
            reactionManager: this._reactionManager!,
            match: this._match,
            cardLibrary: this._cardLibrary,
            ownerId: playerId,
          });
        }
      }
      match.scores[playerId] = score;
      
      for (const expansionScoringFn of this._expansionScoringFns) {
        expansionScoringFn(playerId, match);
      }
    }
  }
  
  private async checkGameEnd() {
    console.log(`[match] checking if the game has ended`);
    
    const match = this._match;
    
    if (this._findCards([
      { location: 'basicSupply' },
      { cardKeys: 'province' }
    ]).length === 0) {
      console.log(`[match] supply has no more provinces, game over`);
      await this.endGame();
      return true;
    }
    
    const startingSupplyCount = getStartingSupplyCount(match);
    
    const remainingSupplyCount = getRemainingSupplyCount(this._findCards);
    
    const emptyPileCount = startingSupplyCount - remainingSupplyCount;
    
    console.log(`[match] empty pile count ${emptyPileCount}`);
    
    if (emptyPileCount === 3) {
      console.log(`[match] three supply piles are empty, game over`);
      await this.endGame();
      return true;
    }
    
    for (const conditionFn of this._expansionEndGameConditionFns) {
      conditionFn({
        cardSourceController: this._cardSourceController,
        match: this._match, cardLibrary: this._cardLibrary,
        cardPriceController: this._cardPriceController!,
        reactionManager: this._reactionManager!,
        findCards: this._findCards
      });
    }
    
    return false;
  }
  
  private async endGame() {
    console.log(`[match] ending the game`);
    
    this._reactionManager?.endGame();
    this._interactivityController?.endGame();
    
    console.log(`[match] removing socket listeners for 'nextPhase'`);
    this._socketMap.forEach((s) => s.off('nextPhase'));
    
    console.log(`[match] removing listener for match state updates`);
    
    const match = this._match;
    
    for (const player of this._match.players) {
      const setAsideCardIds = this._cardSourceController.getSource('set-aside', player.id)
      
      for (const cardId of setAsideCardIds) {
        await this.runGameAction('moveCard', {
          toPlayerId: player.id,
          cardId,
          to: { location: 'playerDeck' },
        })
      }
    }
    
    for (const event of this._registeredEvents) {
      this._socketMap.forEach(s => s.off(event));
    }
    
    const currentTurn = match.turnNumber;
    const currentPlayerTurnIndex = match.currentPlayerTurnIndex;
    
    const summary: MatchSummary = {
      playerSummary: match.players.reduce((prev, player) => {
        const playerId = player.id;
        const turnsTaken = match.players.findIndex((p) =>
          p.id === playerId
        ) <= currentPlayerTurnIndex
          ? (Math.floor(currentTurn / match.players.length) + 1)
          : Math.floor(currentTurn / match.players.length);
        
        prev.push({
          playerId,
          turnsTaken,
          score: match.scores[playerId],
          deck: this._findCards([{ owner: playerId }]).map(card => card.id),
        });
        return prev;
      }, [] as MatchSummary['playerSummary'])
        .sort((a, b) => {
          if (a.score < b.score) return 1;
          if (b.score < a.score) return -1;
          if (a.turnsTaken < b.turnsTaken) return -1;
          if (b.turnsTaken < a.turnsTaken) return 1;
          const aIdx = match.players.findIndex((player) =>
            player.id === a.playerId
          );
          const bIdx = match.players.findIndex((player) =>
            player.id === b.playerId
          );
          if (aIdx < bIdx) return -1;
          if (bIdx < aIdx) return 1;
          return 0;
        }),
    };
    
    console.log(`[match] match summary created`);
    console.log(summary);
    
    this._socketMap.forEach((s) => s.emit('gameOver', summary));
    this.emit('gameOver');
  }
  
  private async onNextPhase() {
    await this.runGameAction('nextPhase');
    this._socketMap.forEach(s => s.emit('nextPhaseComplete'));
  }
  
  private initializeSocketListeners(socket: AppSocket) {
    socket.on('nextPhase', () => this.onNextPhase());
    socket.on('searchCards', (playerId, searchStr) => this.onSearchCards(playerId, searchStr));
    socket.on('exchangeCoffer', async (playerId, count) => {
      await this.runGameAction('exchangeCoffer', { playerId, count });
    });
  }
  
  private onSearchCards(playerId: PlayerId, searchStr: string) {
    console.log(`[match] ${getPlayerById(this._match, playerId)} searching for cards using term '${searchStr}'`);
    
    this._socketMap.get(playerId)?.emit(
      'searchCardResponse',
      this.cardSearchFn(searchStr),
    );
  }
}
