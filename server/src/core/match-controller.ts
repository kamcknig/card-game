import {
  Card,
  CardKey,
  CardNoId,
  ComputedMatchConfiguration,
  Match,
  MatchConfiguration,
  MatchSummary,
  PlayerId,
} from 'shared/shared-types.ts';
import { MatchConfigurator } from './match-configurator.ts';
import { getCurrentPlayer } from '../utils/get-current-player.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { fisherYatesShuffle } from '../utils/fisher-yates-shuffler.ts';
import { ReactionManager } from './reactions/reaction-manager.ts';
import { scoringFunctionMap } from '@expansions/scoring-function-map.ts';
import { CardLibrary } from './card-library.ts';
import { compare, Operation } from 'fast-json-patch';
import { getPlayerById } from '../utils/get-player-by-id.ts';
import { cardEffectFunctionMapFactory } from './effects/card-effect-function-map-factory.ts';
import { EventEmitter } from '@denosaurs/event';
import { LogManager } from './log-manager.ts';
import { GameActionController } from './actions/game-action-controller.ts';
import {
  AppSocket,
  CardEffectFunctionMap,
  EndGameConditionFn,
  GameActionDefinitionMap,
  GameActionReturnTypeMap,
  GameActions,
  MatchBaseConfiguration,
  PlayerScoreDecorator,
} from '../types.ts';
import { createCard } from '../utils/create-card.ts';
import { getRemainingSupplyCount, getStartingSupplyCount } from '../utils/get-starting-supply-count.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { findCards } from '../utils/find-cards.ts';

export class MatchController extends EventEmitter<{ gameOver: [void] }> {
  private _cardLibSnapshot = {};
  private _matchSnapshot: Match | null | undefined;
  private _reactionManager: ReactionManager | undefined;
  private _interactivityController: CardInteractivityController | undefined;
  private _cardLibrary: CardLibrary = new CardLibrary();
  private _logManager: LogManager | undefined;
  private gameActionsController: GameActionController | undefined;
  private _match: Match = {} as Match;
  private _matchConfiguration: ComputedMatchConfiguration | undefined;
  private _expansionEndGameConditionFns: EndGameConditionFn[] = [];
  private _cardPriceController: CardPriceRulesController | undefined;
  private _matchConfigurator: MatchConfigurator | undefined;
  private _expansionScoringFns: PlayerScoreDecorator[] = [];
  
  private _playerHands: Record<CardKey, number>[] = [
    {
      gold: 3,
      silver: 2,
      haven: 8,
      'militia': 3,
    },
    {
      gold: 3,
      silver: 2,
      haven: 8,
      'moat': 3,
    },
    {
      gold: 4,
      silver: 3,
      copper: 3,
    }
  ];
  
  constructor(
    private readonly _socketMap: Map<PlayerId, AppSocket>,
    private readonly cardSearchFn: (searchTerm: string) => CardNoId[],
  ) {
    super();
    
    this._match = {
      cardOverrides: {},
      activeDurationCards: [],
      scores: {},
      trash: [],
      players: [],
      basicSupply: [],
      kingdomSupply: [],
      playerDecks: {},
      config: {} as MatchConfiguration,
      turnNumber: 0,
      roundNumber: 0,
      currentPlayerTurnIndex: 0,
      playerPotions: 0,
      playerBuys: 0,
      playerTreasure: 0,
      playerDiscards: {},
      playerHands: {},
      playerActions: 0,
      turnPhaseIndex: 0,
      selectableCards: {},
      playArea: [],
      mats: {},
      stats: {
        playedCardsByTurn: {},
        cardsGainedByTurn: {},
        playedCards: {},
        cardsGained: {},
        trashedCards: {},
        cardsBought: {}
      }
    }
  }
  
  public async initialize(config: MatchConfiguration) {
    this._matchConfigurator = new MatchConfigurator(config);
    const { config: newConfig } = await this._matchConfigurator.createConfiguration();
    
    this._matchConfiguration = newConfig;
    
    this._logManager = new LogManager({
      socketMap: this._socketMap,
    });
    
    this._cardPriceController = new CardPriceRulesController(
      this._cardLibrary,
      this._match
    );
    
    this._reactionManager = new ReactionManager(
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
      this._cardPriceController,
      this._match,
      this._socketMap,
      this._cardLibrary,
      this,
    );
    
    this.gameActionsController = new GameActionController(
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
    
    await this._matchConfigurator?.initializeExpansions({
      match: this._match,
      endGameConditionRegistrar: (val) => this._expansionEndGameConditionFns.push(val),
      actionRegistrar: (...args) => this.gameActionsController?.registerAction(...args),
      cardEffectRegistrar: (...args) => this.gameActionsController?.registerCardEffect(...args),
      playerScoreDecoratorRegistrar: (val: PlayerScoreDecorator) => this._expansionScoringFns.push(val),
    });
    
    this._match.players = this._matchConfiguration.players;
    this._match.basicSupply = this.createBaseSupply(this._matchConfiguration);
    this._match.kingdomSupply = this.createKingdom(this._matchConfiguration);
    const { playerDecks, playerHands, playerDiscards } = this.createPlayerDecks(this._matchConfiguration);
    this._match.playerDecks = playerDecks;
    this._match.playerHands = playerHands;
    this._match.playerDiscards = playerDiscards;
    this._match.config = this._matchConfiguration;
    this._match.mats = this._matchConfiguration.mats;
    
    console.log(`[match] ready, sending to clients and listening for when clients are ready`);
    
    this._socketMap.forEach((s) => {
      s.emit('setCardLibrary', this._cardLibrary.getAllCards());
      s.emit('matchReady', this._match);
      s.on('clientReady', this.onClientReady);
    });
  }
  
  public playerReconnected(playerId: PlayerId, socket: AppSocket) {
    console.log(`[match] player ${playerId} reconnecting`);
    this._socketMap.set(playerId, socket);
    
    socket.emit('setCardLibrary', this._cardLibrary.getAllCards());
    socket.emit('matchReady', this._match);
    socket.on('clientReady', async (_playerId: number, _ready: boolean) => {
      console.log(
        `[match] ${
          this._match.players.find((player) => player.id === playerId)
        } marked ready`,
      );
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
    const supplyCards: Card[] = [];
    
    for (const [key, count] of Object.entries(config.basicCardCount)) {
      const cardData = config.basicCards.find((card) => card.cardKey === key);
      for (let i = 0; i < count; i++) {
        const c = createCard(key, cardData);
        this._cardLibrary.addCard(c);
        supplyCards.push(c);
      }
    }
    
    return supplyCards.map(card => card.id);
  }
  
  private createKingdom(config: ComputedMatchConfiguration) {
    console.log(`[match] creating kingdom cards`);
    
    const kingdomCards: Card[] = [];
    
    for (const [key, count] of Object.entries(config.kingdomCardCount)) {
      const cardData = config.kingdomCards.find((card) => card.cardKey === key);
      for (let i = 0; i < count; i++) {
        const c = createCard(key, cardData);
        this._cardLibrary.addCard(c);
        kingdomCards.push(c);
      }
    }
    
    return kingdomCards.map(card => card.id);
  }
  
  private createPlayerDecks(config: MatchConfiguration) {
    console.log(`[match] creating player decks`);
    
    return Object.values(config.players).reduce((prev, player, _idx) => {
      console.log('initializing player', player.id, 'cards...');
      
      let playerStartHand = this._playerHands.length > 0 ? this._playerHands[_idx] : MatchBaseConfiguration.playerStartingHand;
      playerStartHand ??= MatchBaseConfiguration.playerStartingHand;
      console.log(`[match] using player starting hand ${playerStartHand}`);
      
      Object.entries(playerStartHand).forEach(
        ([key, count]) => {
          prev['playerDecks'][player.id] ??= [];
          let deck = prev['playerDecks'][player.id];
          deck = deck.concat(
            new Array(count).fill(0).map((_) => {
              const c = createCard(key, { owner: player.id });
              this._cardLibrary.addCard(c);
              return c.id;
            }),
          );
          prev['playerDecks'][player.id] = fisherYatesShuffle(deck);
        },
      );
      
      prev['playerHands'][player.id] = [];
      prev['playerDiscards'][player.id] = [];
      return prev;
    }, {
      playerHands: {},
      playerDecks: {},
      playerDiscards: {},
    } as Pick<Match, 'playerHands' | 'playerDiscards' | 'playerDecks'>);
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
    
    if (action === 'selectCard' || action === 'userPrompt') {
      this.broadcastPatch(this._matchSnapshot);
      this._logManager?.flushQueue();
      this._matchSnapshot = this.getMatchSnapshot();
    }
    
    const result = await this.gameActionsController!.invokeAction(action, ...args);
    
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
  
  public broadcastPatch(prev: Match) {
    const patch: Operation[] = compare(prev, this._match);
    const cardLibraryPatch = compare(this._cardLibSnapshot, this._cardLibrary.getAllCards());
    
    if (patch.length || cardLibraryPatch.length) {
      console.log(`[match] sending match update to clients`);
      
      if (cardLibraryPatch.length) {
        console.log(`[ match ] card library patch`);
        console.log(cardLibraryPatch);
      }
      
      if (patch.length) {
        console.log(`[ match ] match patch`);
        console.log(patch);
      }
      
      this._socketMap.forEach((s) => s.emit('patchUpdate', patch, cardLibraryPatch));
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
    
    await this._reactionManager?.triggerGameLifecycleEvent('onGameStart')
    
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
    
    if (
      match.basicSupply.map((c) => this._cardLibrary.getCard(c)).filter((c) =>
        c.cardKey === 'province'
      ).length === 0
    ) {
      console.log(`[match] supply has no more provinces, game over`);
      await this.endGame();
      return true;
    }
    
    const startingSupplyCount = getStartingSupplyCount(match);
    
    const remainingSupplyCount = getRemainingSupplyCount(match, this._cardLibrary);
    
    const emptyPileCount = startingSupplyCount - remainingSupplyCount;
    
    console.log(`[match] empty pile count ${emptyPileCount}`);
    
    if (emptyPileCount === 3) {
      console.log(`[match] three supply piles are empty, game over`);
      await this.endGame();
      return true;
    }
    
    for (const conditionFn of this._expansionEndGameConditionFns) {
      conditionFn({ match: this._match, cardLibrary: this._cardLibrary });
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
    
    const setAsideCardIds = findCards(
      match,
      { location: 'set-aside' },
      this._cardLibrary
    );
    
    for (const cardId of setAsideCardIds) {
      const owner = this._cardLibrary.getCard(cardId).owner;
      if (owner === null) continue;
      await this.runGameAction('moveCard', {
        toPlayerId: owner,
        cardId,
        to: { location: 'playerDecks' },
      })
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
          deck: match.playerDecks[playerId].concat(
            match.playerHands[playerId],
            match.playerDiscards[playerId],
          ),
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
  }
  
  private onSearchCards(playerId: PlayerId, searchStr: string) {
    console.log(`[match] ${getPlayerById(this._match, playerId)} searching for cards using term '${searchStr}'`);
    
    this._socketMap.get(playerId)?.emit(
      'searchCardResponse',
      this.cardSearchFn(searchStr),
    );
  }
}
