import { MatchConfigurator } from './match-configurator.ts';
import { getCurrentPlayer } from '../utils/get-current-player.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { fisherYatesShuffle } from '../utils/fisher-yates-shuffler.ts';
import { ReactionManager } from './reactions/reaction-manager.ts';
import { scoringFunctionMap } from '@expansions/scoring-function-map.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { compare } from 'fast-json-patch';
import { getPlayerById } from '../utils/get-player-by-id.ts';
import { cardEffectFunctionMapFactory } from './effects/card-effect-function-map-factory.ts';
import { EventEmitter } from '@denosaurs/event';
import { LogManager } from './log-manager.ts';
import { MatchBaseConfiguration } from '../types.ts';
import { createCard, createEvent } from '../utils/create-card.ts';
import { getRemainingSupplyCount, getStartingSupplyCount } from '../utils/get-starting-supply-count.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { findCardsFactory } from '../utils/find-cards.ts';
import { GameActionController } from './actions/game-action-controller.ts';
import { CardSourceController } from './card-source-controller.ts';
import { eventEffectFactoryMap } from './events/event-effect-factory-map.ts';
export class MatchController extends EventEmitter {
  _socketMap;
  cardSearchFn;
  _cardLibSnapshot;
  _matchSnapshot;
  _reactionManager;
  _interactivityController;
  _cardLibrary;
  _logManager;
  gameActionsController;
  _match;
  _matchConfiguration;
  _expansionEndGameConditionFns;
  _cardPriceController;
  _matchConfigurator;
  _expansionScoringFns;
  _registeredEvents;
  _findCards;
  _cardSourceController;
  _playerHands;
  constructor(_socketMap, cardSearchFn){
    super(), this._socketMap = _socketMap, this.cardSearchFn = cardSearchFn, this._cardLibSnapshot = {}, this._cardLibrary = new MatchCardLibrary(), this._match = {}, this._expansionEndGameConditionFns = [], this._expansionScoringFns = [], this._registeredEvents = [], this._findCards = (...args)=>[], this._playerHands = [], this.onClientReady = (playerId)=>{
      const player = this._match.config?.players.find((player)=>player.id === playerId);
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
      if (this._match.config.players.some((p)=>!p.ready)) {
        console.log(`[match] not all players marked ready, waiting for everyone`);
        return;
      }
      console.log('[match] all players ready');
      for (const socket of this._socketMap.values()){
        socket.off('clientReady', this.onClientReady);
      }
      void this.startMatch();
    };
    this._match = {
      cardOverrides: {},
      cardSources: {},
      cardSourceTagMap: {},
      coffers: {},
      config: {},
      currentPlayerTurnIndex: 0,
      events: [],
      mats: {},
      playerActions: 0,
      playerBuys: 0,
      players: [],
      playerPotions: 0,
      playerTokens: {},
      playerTreasure: 0,
      playerVictoryTokens: {},
      roundNumber: 0,
      scores: {},
      selectableCards: {},
      stats: {
        playedCardsByTurn: {},
        cardsGainedByTurn: {},
        playedCards: {},
        cardsGained: {},
        trashedCards: {},
        trashedCardsByTurn: {},
        cardsBought: {},
        cardsBoughtByTurn: {},
        cardLikesBought: {},
        cardLikesBoughtByTurn: {}
      },
      turnNumber: 0,
      turnPhaseIndex: 0
    };
    this._cardSourceController = new CardSourceController(this._match);
  }
  async initialize(config) {
    this.broadcastPatch({});
    const snapshot = this.getMatchSnapshot();
    this._logManager = new LogManager({
      socketMap: this._socketMap
    });
    this._cardPriceController = new CardPriceRulesController(this._cardLibrary, this._match);
    this._findCards = findCardsFactory(this._cardSourceController, this._cardPriceController, this._cardLibrary);
    this._reactionManager = new ReactionManager(this._cardSourceController, this._findCards, this._cardPriceController, this._logManager, this._match, this._cardLibrary, (action, ...args)=>this.runGameAction(action, ...args));
    const cardEffectFunctionMap = Object.keys(cardEffectFunctionMapFactory).reduce((acc, nextKey)=>{
      acc[nextKey] = cardEffectFunctionMapFactory[nextKey]();
      return acc;
    }, {});
    const eventEffectFunctionMap = Object.keys(eventEffectFactoryMap).reduce((acc, nextKey)=>{
      acc[nextKey] = eventEffectFactoryMap[nextKey]();
      return acc;
    }, {});
    this._interactivityController = new CardInteractivityController(this._cardSourceController, this._cardPriceController, this._match, this._socketMap, this._cardLibrary, (action, ...args)=>this.runGameAction(action, ...args), this._findCards);
    this.gameActionsController = new GameActionController(this._cardSourceController, this._findCards, this._cardPriceController, cardEffectFunctionMap, eventEffectFunctionMap, this._match, this._cardLibrary, this._logManager, this._socketMap, this._reactionManager, (action, ...args)=>this.runGameAction(action, ...args), this._interactivityController);
    this._matchConfigurator = new MatchConfigurator(config);
    const { config: newConfig } = await this._matchConfigurator.createConfiguration({
      match: this._match,
      cardSourceController: this._cardSourceController,
      gameEventRegistrar: (event, handler)=>this._reactionManager?.registerGameEvent(event, handler),
      clientEventRegistrar: (event, handler)=>this.clientEventRegistrar(event, handler),
      endGameConditionRegistrar: (val)=>this._expansionEndGameConditionFns.push(val),
      cardEffectRegistrar: (...args)=>this.gameActionsController?.registerCardEffect(...args),
      playerScoreDecoratorRegistrar: (val)=>this._expansionScoringFns.push(val)
    });
    this._matchConfiguration = newConfig;
    this._match.players = this._matchConfiguration.players;
    this.createBaseSupply(this._matchConfiguration);
    this.createKingdom(this._matchConfiguration);
    this.createEvents(this._matchConfiguration);
    this.createNonSupplyCards(this._matchConfiguration);
    this.createPlayerDecks(this._matchConfiguration);
    this._match.config = this._matchConfiguration;
    console.log(`[match] ready, sending to clients and listening for when clients are ready`);
    this.broadcastPatch(snapshot);
    this._socketMap.forEach((s)=>{
      s.emit('setCardLibrary', this._cardLibrary.getAllCards());
      s.emit('matchReady');
      s.on('clientReady', this.onClientReady);
    });
  }
  clientEventRegistrar(event, handler) {
    this._registeredEvents.push(event);
    this._socketMap.forEach((s)=>{
      s.on(event, handler);
    });
  }
  playerReconnected(playerId, socket) {
    console.log(`[match] player ${playerId} reconnecting`);
    this._socketMap.set(playerId, socket);
    this.broadcastPatch({}, playerId);
    socket.emit('matchReady');
    socket.on('clientReady', async (_playerId, _ready)=>{
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
  playerDisconnected(playerId) {
    // Use whichever array is populated depending on phase
    const roster = this._match.players?.length ? this._match.players : this._match.config.players;
    // There should always be at least one entry after a single disconnect
    const leaving = roster.find((p)=>p.id === playerId);
    console.log(`[match] ${leaving ?? `{id:${playerId}}`} has disconnected`);
    this._socketMap.get(playerId)?.offAnyIncoming();
    this._interactivityController?.playerRemoved(this._socketMap.get(playerId));
    this._socketMap.delete(playerId);
  }
  createBaseSupply(config) {
    console.log(`[match] creating base supply cards`);
    const cardSource = this._cardSourceController.getSource('basicSupply');
    if (!cardSource) {
      throw new Error(`[match] no basic supply card source found`);
    }
    for (const supply of Object.values(config.basicSupply)){
      for (const card of supply.cards){
        if (!card) {
          throw new Error(`[match] no card data found for ${supply}`);
        }
        const c = createCard(card.cardKey, {
          ...card,
          kingdom: supply.name
        });
        this._cardLibrary.addCard(c);
        cardSource.push(c.id);
      }
    }
  }
  createKingdom(config) {
    console.log(`[match] creating kingdom cards`);
    const cardSource = this._cardSourceController.getSource('kingdomSupply');
    if (!cardSource) {
      throw new Error(`[match] no basic supply card source found`);
    }
    for (const kingdom of Object.values(config.kingdomSupply)){
      for (const card of kingdom.cards){
        if (!card) {
          throw new Error(`[match] no card data found for ${kingdom}`);
        }
        const c = createCard(card.cardKey, {
          ...card,
          kingdom: kingdom.name
        });
        this._cardLibrary.addCard(c);
        cardSource.push(c.id);
      }
    }
  }
  createNonSupplyCards(config) {
    console.log(`[match] creating non-supply cards`);
    const cardSource = this._cardSourceController.getSource('nonSupplyCards');
    if (!cardSource) {
      throw new Error(`[match] no basic supply card source found`);
    }
    for (const supply of Object.values(config.nonSupply ?? {})){
      for (const card of supply.cards){
        if (!card) {
          throw new Error(`[match] no card data found for ${supply}`);
        }
        const c = createCard(card.cardKey, {
          ...card,
          kingdom: supply.name
        });
        this._cardLibrary.addCard(c);
        cardSource.push(c.id);
      }
    }
  }
  createPlayerDecks(config) {
    console.log(`[match] creating player decks`);
    return Object.values(config.players).forEach((player, idx)=>{
      console.log('initializing player', player.id, 'cards...');
      let playerStartHand = this._playerHands.length > 0 ? this._playerHands[idx] : config.playerStartingHand;
      playerStartHand ??= MatchBaseConfiguration.playerStartingHand;
      console.log(`[match] using player starting hand`);
      console.log(Object.keys(playerStartHand).map((key)=>`${key}: ${playerStartHand[key]}`).join(', '));
      const deck = this._cardSourceController.getSource('playerDeck', player.id);
      Object.entries(playerStartHand).forEach(([key, count])=>{
        deck.push(...new Array(count).fill(0).map((_)=>{
          const c = createCard(key, {
            owner: player.id
          });
          this._cardLibrary.addCard(c);
          return c.id;
        }));
        fisherYatesShuffle(deck, true);
      });
    });
  }
  getMatchSnapshot() {
    this._cardLibSnapshot = structuredClone(this._cardLibrary.getAllCards());
    return structuredClone(this._match);
  }
  async runGameAction(action, ...args) {
    this._matchSnapshot ??= this.getMatchSnapshot();
    let asyncTimeout = undefined;
    if (action === 'selectCard' || action === 'userPrompt') {
      this.broadcastPatch(this._matchSnapshot);
      this._logManager?.flushQueue();
      this._matchSnapshot = this.getMatchSnapshot();
      let pingCount = 0;
      let pingTime = 30000;
      const pingUser = ()=>{
        this._socketMap.get(args[0].playerId)?.emit('ping', ++pingCount);
        pingTime -= 10000;
        pingTime = Math.max(pingTime, 10000);
        asyncTimeout = setTimeout(pingUser, pingTime);
      };
      asyncTimeout = setTimeout(pingUser, pingTime);
    }
    const result = await this.gameActionsController.invokeAction(action, ...args);
    clearTimeout(asyncTimeout);
    asyncTimeout = undefined;
    this.calculateScores();
    this._interactivityController?.checkCardInteractivity();
    this._match.cardOverrides = this._cardPriceController?.calculateOverrides() ?? {};
    this.broadcastPatch({
      ...this._matchSnapshot
    });
    this._logManager?.flushQueue();
    this._matchSnapshot = null;
    if (await this.checkGameEnd()) {
      console.log(`[match] game ended`);
    }
    return result;
  }
  broadcastPatch(prev, playerId) {
    const patch = compare(prev, this._match);
    const cardLibraryPatch = compare(this._cardLibSnapshot, this._cardLibrary.getAllCards());
    if (patch.length || cardLibraryPatch.length) {
      console.log(`[match] sending match update to clients`);
      if (playerId) {
        this._socketMap.get(playerId)?.emit('patchUpdate', patch, cardLibraryPatch);
      } else {
        this._socketMap.forEach((s)=>s.emit('patchUpdate', patch, cardLibraryPatch));
      }
    }
  }
  onClientReady;
  async startMatch() {
    console.log(`[match] starting match`);
    await this._reactionManager?.runGameLifecycleEvent('onGameStart', {
      match: this._match
    });
    for (const socket of this._socketMap.values()){
      this.initializeSocketListeners(socket);
    }
    this._matchSnapshot = this.getMatchSnapshot();
    this._match.playerBuys = 1;
    this._match.playerActions = 1;
    this._socketMap.forEach((s)=>s.emit('matchStarted'));
    for (const player of this._match.players){
      await this.runGameAction('drawCard', {
        playerId: player.id,
        count: 5
      });
    }
    this._logManager?.addLogEntry({
      root: true,
      type: 'newTurn',
      turn: Math.floor(this._match.turnNumber / this._match.players.length) + 1
    });
    this._logManager?.addLogEntry({
      root: true,
      type: 'newPlayerTurn',
      turn: Math.floor(this._match.turnNumber / this._match.players.length) + 1,
      playerId: getCurrentPlayer(this._match).id
    });
    await this.runGameAction('checkForRemainingPlayerActions');
  }
  calculateScores() {
    console.log(`[match] calculating scores`);
    const match = this._match;
    for (const player of match.players ?? []){
      const playerId = player.id;
      const cards = this._cardLibrary.getCardsByOwner(playerId);
      let score = 0;
      for (const card of cards){
        score += card.victoryPoints ?? 0;
        const customScoringFn = scoringFunctionMap[card?.cardKey ?? ''];
        if (customScoringFn) {
          console.log(`[match] processing scoring function for ${card}`);
          score += customScoringFn({
            cardSourceController: this._cardSourceController,
            cardPriceController: this._cardPriceController,
            findCards: this._findCards,
            reactionManager: this._reactionManager,
            match: this._match,
            cardLibrary: this._cardLibrary,
            ownerId: playerId
          });
        }
      }
      match.scores[playerId] = score;
      for (const expansionScoringFn of this._expansionScoringFns){
        expansionScoringFn(playerId, match);
      }
    }
  }
  async checkGameEnd() {
    console.log(`[match] checking if the game has ended`);
    const match = this._match;
    if (this._findCards([
      {
        location: 'basicSupply'
      },
      {
        cardKeys: 'province'
      }
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
    for (const conditionFn of this._expansionEndGameConditionFns){
      conditionFn({
        cardSourceController: this._cardSourceController,
        match: this._match,
        cardLibrary: this._cardLibrary,
        cardPriceController: this._cardPriceController,
        reactionManager: this._reactionManager,
        findCards: this._findCards
      });
    }
    return false;
  }
  async endGame() {
    console.log(`[match] ending the game`);
    this._reactionManager?.endGame();
    this._interactivityController?.endGame();
    console.log(`[match] removing socket listeners for 'nextPhase'`);
    this._socketMap.forEach((s)=>s.off('nextPhase'));
    console.log(`[match] removing listener for match state updates`);
    const match = this._match;
    for (const player of this._match.players){
      const setAsideCardIds = this._cardSourceController.getSource('set-aside', player.id);
      for (const cardId of setAsideCardIds){
        await this.runGameAction('moveCard', {
          toPlayerId: player.id,
          cardId,
          to: {
            location: 'playerDeck'
          }
        });
      }
    }
    for (const event of this._registeredEvents){
      this._socketMap.forEach((s)=>s.off(event));
    }
    const currentTurn = match.turnNumber;
    const currentPlayerTurnIndex = match.currentPlayerTurnIndex;
    const summary = {
      playerSummary: match.players.reduce((prev, player)=>{
        const playerId = player.id;
        const turnsTaken = match.players.findIndex((p)=>p.id === playerId) <= currentPlayerTurnIndex ? Math.floor(currentTurn / match.players.length) + 1 : Math.floor(currentTurn / match.players.length);
        prev.push({
          playerId,
          turnsTaken,
          score: match.scores[playerId],
          deck: this._findCards([
            {
              owner: playerId
            }
          ]).map((card)=>card.id)
        });
        return prev;
      }, []).sort((a, b)=>{
        if (a.score < b.score) return 1;
        if (b.score < a.score) return -1;
        if (a.turnsTaken < b.turnsTaken) return -1;
        if (b.turnsTaken < a.turnsTaken) return 1;
        const aIdx = match.players.findIndex((player)=>player.id === a.playerId);
        const bIdx = match.players.findIndex((player)=>player.id === b.playerId);
        if (aIdx < bIdx) return -1;
        if (bIdx < aIdx) return 1;
        return 0;
      })
    };
    console.log(`[match] match summary created`);
    console.log(summary);
    this._socketMap.forEach((s)=>s.emit('gameOver', summary));
    this.emit('gameOver');
  }
  async onNextPhase() {
    await this.runGameAction('nextPhase');
    this._socketMap.forEach((s)=>s.emit('nextPhaseComplete'));
  }
  initializeSocketListeners(socket) {
    socket.on('nextPhase', ()=>this.onNextPhase());
    socket.on('searchCards', (playerId, searchStr)=>this.onSearchCards(playerId, searchStr));
    socket.on('exchangeCoffer', async (playerId, count)=>{
      await this.runGameAction('exchangeCoffer', {
        playerId,
        count
      });
    });
  }
  onSearchCards(playerId, searchStr) {
    console.log(`[match] ${getPlayerById(this._match, playerId)} searching for cards using term '${searchStr}'`);
    this._socketMap.get(playerId)?.emit('searchCardResponse', this.cardSearchFn(searchStr));
  }
  createEvents(config) {
    for (const event of config.events){
      this._match.events.push(createEvent(event));
    }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvY29yZS9tYXRjaC1jb250cm9sbGVyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIENhcmRLZXksXG4gIENhcmROb0lkLFxuICBDb21wdXRlZE1hdGNoQ29uZmlndXJhdGlvbixcbiAgTWF0Y2gsXG4gIE1hdGNoQ29uZmlndXJhdGlvbixcbiAgTWF0Y2hTdW1tYXJ5LFxuICBQbGF5ZXJJZCxcbiAgU2VydmVyTGlzdGVuRXZlbnRzLFxufSBmcm9tICdzaGFyZWQvc2hhcmVkLXR5cGVzLnRzJztcbmltcG9ydCB7IE1hdGNoQ29uZmlndXJhdG9yIH0gZnJvbSAnLi9tYXRjaC1jb25maWd1cmF0b3IudHMnO1xuaW1wb3J0IHsgZ2V0Q3VycmVudFBsYXllciB9IGZyb20gJy4uL3V0aWxzL2dldC1jdXJyZW50LXBsYXllci50cyc7XG5pbXBvcnQgeyBDYXJkSW50ZXJhY3Rpdml0eUNvbnRyb2xsZXIgfSBmcm9tICcuL2NhcmQtaW50ZXJhY3Rpdml0eS1jb250cm9sbGVyLnRzJztcbmltcG9ydCB7IGZpc2hlcllhdGVzU2h1ZmZsZSB9IGZyb20gJy4uL3V0aWxzL2Zpc2hlci15YXRlcy1zaHVmZmxlci50cyc7XG5pbXBvcnQgeyBSZWFjdGlvbk1hbmFnZXIgfSBmcm9tICcuL3JlYWN0aW9ucy9yZWFjdGlvbi1tYW5hZ2VyLnRzJztcbmltcG9ydCB7IHNjb3JpbmdGdW5jdGlvbk1hcCB9IGZyb20gJ0BleHBhbnNpb25zL3Njb3JpbmctZnVuY3Rpb24tbWFwLnRzJztcbmltcG9ydCB7IE1hdGNoQ2FyZExpYnJhcnkgfSBmcm9tICcuL21hdGNoLWNhcmQtbGlicmFyeS50cyc7XG5pbXBvcnQgeyBjb21wYXJlLCBPcGVyYXRpb24gfSBmcm9tICdmYXN0LWpzb24tcGF0Y2gnO1xuaW1wb3J0IHsgZ2V0UGxheWVyQnlJZCB9IGZyb20gJy4uL3V0aWxzL2dldC1wbGF5ZXItYnktaWQudHMnO1xuaW1wb3J0IHsgY2FyZEVmZmVjdEZ1bmN0aW9uTWFwRmFjdG9yeSB9IGZyb20gJy4vZWZmZWN0cy9jYXJkLWVmZmVjdC1mdW5jdGlvbi1tYXAtZmFjdG9yeS50cyc7XG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdAZGVub3NhdXJzL2V2ZW50JztcbmltcG9ydCB7IExvZ01hbmFnZXIgfSBmcm9tICcuL2xvZy1tYW5hZ2VyLnRzJztcbmltcG9ydCB7XG4gIEFwcFNvY2tldCxcbiAgQ2FyZEVmZmVjdEZ1bmN0aW9uTWFwLFxuICBFbmRHYW1lQ29uZGl0aW9uRm4sXG4gIEZpbmRDYXJkc0ZuLFxuICBHYW1lQWN0aW9uRGVmaW5pdGlvbk1hcCxcbiAgR2FtZUFjdGlvblJldHVyblR5cGVNYXAsXG4gIEdhbWVBY3Rpb25zLFxuICBHYW1lTGlmZWN5Y2xlQ2FsbGJhY2ssXG4gIEdhbWVMaWZlY3ljbGVFdmVudCxcbiAgTWF0Y2hCYXNlQ29uZmlndXJhdGlvbixcbiAgUGxheWVyU2NvcmVEZWNvcmF0b3IsXG59IGZyb20gJy4uL3R5cGVzLnRzJztcbmltcG9ydCB7IGNyZWF0ZUNhcmQsIGNyZWF0ZUV2ZW50IH0gZnJvbSAnLi4vdXRpbHMvY3JlYXRlLWNhcmQudHMnO1xuaW1wb3J0IHsgZ2V0UmVtYWluaW5nU3VwcGx5Q291bnQsIGdldFN0YXJ0aW5nU3VwcGx5Q291bnQgfSBmcm9tICcuLi91dGlscy9nZXQtc3RhcnRpbmctc3VwcGx5LWNvdW50LnRzJztcbmltcG9ydCB7IENhcmRQcmljZVJ1bGVzQ29udHJvbGxlciB9IGZyb20gJy4vY2FyZC1wcmljZS1ydWxlcy1jb250cm9sbGVyLnRzJztcbmltcG9ydCB7IGZpbmRDYXJkc0ZhY3RvcnkgfSBmcm9tICcuLi91dGlscy9maW5kLWNhcmRzLnRzJztcbmltcG9ydCB7IEdhbWVBY3Rpb25Db250cm9sbGVyIH0gZnJvbSAnLi9hY3Rpb25zL2dhbWUtYWN0aW9uLWNvbnRyb2xsZXIudHMnO1xuaW1wb3J0IHsgQ2FyZFNvdXJjZUNvbnRyb2xsZXIgfSBmcm9tICcuL2NhcmQtc291cmNlLWNvbnRyb2xsZXIudHMnO1xuaW1wb3J0IHsgZXZlbnRFZmZlY3RGYWN0b3J5TWFwIH0gZnJvbSAnLi9ldmVudHMvZXZlbnQtZWZmZWN0LWZhY3RvcnktbWFwLnRzJztcblxuZXhwb3J0IGNsYXNzIE1hdGNoQ29udHJvbGxlciBleHRlbmRzIEV2ZW50RW1pdHRlcjx7IGdhbWVPdmVyOiBbdm9pZF0gfT4ge1xuICBwcml2YXRlIF9jYXJkTGliU25hcHNob3QgPSB7fTtcbiAgcHJpdmF0ZSBfbWF0Y2hTbmFwc2hvdDogTWF0Y2ggfCBudWxsIHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIF9yZWFjdGlvbk1hbmFnZXI6IFJlYWN0aW9uTWFuYWdlciB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBfaW50ZXJhY3Rpdml0eUNvbnRyb2xsZXI6IENhcmRJbnRlcmFjdGl2aXR5Q29udHJvbGxlciB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSByZWFkb25seSBfY2FyZExpYnJhcnk6IE1hdGNoQ2FyZExpYnJhcnkgPSBuZXcgTWF0Y2hDYXJkTGlicmFyeSgpO1xuICBwcml2YXRlIF9sb2dNYW5hZ2VyOiBMb2dNYW5hZ2VyIHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIGdhbWVBY3Rpb25zQ29udHJvbGxlcjogR2FtZUFjdGlvbkNvbnRyb2xsZXIgfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgcmVhZG9ubHkgX21hdGNoOiBNYXRjaCA9IHt9IGFzIE1hdGNoO1xuICBwcml2YXRlIF9tYXRjaENvbmZpZ3VyYXRpb246IENvbXB1dGVkTWF0Y2hDb25maWd1cmF0aW9uIHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIF9leHBhbnNpb25FbmRHYW1lQ29uZGl0aW9uRm5zOiBFbmRHYW1lQ29uZGl0aW9uRm5bXSA9IFtdO1xuICBwcml2YXRlIF9jYXJkUHJpY2VDb250cm9sbGVyOiBDYXJkUHJpY2VSdWxlc0NvbnRyb2xsZXIgfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX21hdGNoQ29uZmlndXJhdG9yOiBNYXRjaENvbmZpZ3VyYXRvciB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBfZXhwYW5zaW9uU2NvcmluZ0ZuczogUGxheWVyU2NvcmVEZWNvcmF0b3JbXSA9IFtdO1xuICBwcml2YXRlIF9yZWdpc3RlcmVkRXZlbnRzOiAoa2V5b2YgU2VydmVyTGlzdGVuRXZlbnRzKVtdID0gW107XG4gIHByaXZhdGUgX2ZpbmRDYXJkczogRmluZENhcmRzRm4gPSAoLi4uYXJncykgPT4gKFtdKTtcbiAgcHJpdmF0ZSByZWFkb25seSBfY2FyZFNvdXJjZUNvbnRyb2xsZXI6IENhcmRTb3VyY2VDb250cm9sbGVyO1xuICBcbiAgcHJpdmF0ZSBfcGxheWVySGFuZHM6IFJlY29yZDxDYXJkS2V5LCBudW1iZXI+W10gPSBbXG4gICAgLyp7XG4gICAgICBnb2xkOiA0LFxuICAgICAgc2lsdmVyOiAzLFxuICAgICAgZXN0YXRlOiAzLFxuICAgIH0sXG4gICAge1xuICAgICAgZ29sZDogNCxcbiAgICAgIHNpbHZlcjogMyxcbiAgICAgIGVzdGF0ZTogMyxcbiAgICB9LCovXG4gIF07XG4gIFxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9zb2NrZXRNYXA6IE1hcDxQbGF5ZXJJZCwgQXBwU29ja2V0PixcbiAgICBwcml2YXRlIHJlYWRvbmx5IGNhcmRTZWFyY2hGbjogKHNlYXJjaFRlcm06IHN0cmluZykgPT4gQ2FyZE5vSWRbXSxcbiAgKSB7XG4gICAgc3VwZXIoKTtcbiAgICBcbiAgICB0aGlzLl9tYXRjaCA9IHtcbiAgICAgIGNhcmRPdmVycmlkZXM6IHt9LFxuICAgICAgY2FyZFNvdXJjZXM6IHt9LFxuICAgICAgY2FyZFNvdXJjZVRhZ01hcDoge30sXG4gICAgICBjb2ZmZXJzOiB7fSxcbiAgICAgIGNvbmZpZzoge30gYXMgQ29tcHV0ZWRNYXRjaENvbmZpZ3VyYXRpb24sXG4gICAgICBjdXJyZW50UGxheWVyVHVybkluZGV4OiAwLFxuICAgICAgZXZlbnRzOiBbXSxcbiAgICAgIG1hdHM6IHt9LFxuICAgICAgcGxheWVyQWN0aW9uczogMCxcbiAgICAgIHBsYXllckJ1eXM6IDAsXG4gICAgICBwbGF5ZXJzOiBbXSxcbiAgICAgIHBsYXllclBvdGlvbnM6IDAsXG4gICAgICBwbGF5ZXJUb2tlbnM6IHt9LFxuICAgICAgcGxheWVyVHJlYXN1cmU6IDAsXG4gICAgICBwbGF5ZXJWaWN0b3J5VG9rZW5zOiB7fSxcbiAgICAgIHJvdW5kTnVtYmVyOiAwLFxuICAgICAgc2NvcmVzOiB7fSxcbiAgICAgIHNlbGVjdGFibGVDYXJkczoge30sXG4gICAgICBzdGF0czoge1xuICAgICAgICBwbGF5ZWRDYXJkc0J5VHVybjoge30sXG4gICAgICAgIGNhcmRzR2FpbmVkQnlUdXJuOiB7fSxcbiAgICAgICAgcGxheWVkQ2FyZHM6IHt9LFxuICAgICAgICBjYXJkc0dhaW5lZDoge30sXG4gICAgICAgIHRyYXNoZWRDYXJkczoge30sXG4gICAgICAgIHRyYXNoZWRDYXJkc0J5VHVybjoge30sXG4gICAgICAgIGNhcmRzQm91Z2h0OiB7fSxcbiAgICAgICAgY2FyZHNCb3VnaHRCeVR1cm46IHt9LFxuICAgICAgICBjYXJkTGlrZXNCb3VnaHQ6IHt9LFxuICAgICAgICBjYXJkTGlrZXNCb3VnaHRCeVR1cm46IHt9LFxuICAgICAgfSxcbiAgICAgIHR1cm5OdW1iZXI6IDAsXG4gICAgICB0dXJuUGhhc2VJbmRleDogMFxuICAgIH1cbiAgICB0aGlzLl9jYXJkU291cmNlQ29udHJvbGxlciA9IG5ldyBDYXJkU291cmNlQ29udHJvbGxlcih0aGlzLl9tYXRjaCk7XG4gIH1cbiAgXG4gIHB1YmxpYyBhc3luYyBpbml0aWFsaXplKGNvbmZpZzogTWF0Y2hDb25maWd1cmF0aW9uKSB7XG4gICAgdGhpcy5icm9hZGNhc3RQYXRjaCh7fSBhcyBNYXRjaCk7XG4gICAgXG4gICAgY29uc3Qgc25hcHNob3QgPSB0aGlzLmdldE1hdGNoU25hcHNob3QoKTtcbiAgICBcbiAgICB0aGlzLl9sb2dNYW5hZ2VyID0gbmV3IExvZ01hbmFnZXIoe1xuICAgICAgc29ja2V0TWFwOiB0aGlzLl9zb2NrZXRNYXAsXG4gICAgfSk7XG4gICAgXG4gICAgdGhpcy5fY2FyZFByaWNlQ29udHJvbGxlciA9IG5ldyBDYXJkUHJpY2VSdWxlc0NvbnRyb2xsZXIoXG4gICAgICB0aGlzLl9jYXJkTGlicmFyeSxcbiAgICAgIHRoaXMuX21hdGNoXG4gICAgKTtcbiAgICBcbiAgICB0aGlzLl9maW5kQ2FyZHMgPSBmaW5kQ2FyZHNGYWN0b3J5KHRoaXMuX2NhcmRTb3VyY2VDb250cm9sbGVyLCB0aGlzLl9jYXJkUHJpY2VDb250cm9sbGVyLCB0aGlzLl9jYXJkTGlicmFyeSk7XG4gICAgXG4gICAgdGhpcy5fcmVhY3Rpb25NYW5hZ2VyID0gbmV3IFJlYWN0aW9uTWFuYWdlcihcbiAgICAgIHRoaXMuX2NhcmRTb3VyY2VDb250cm9sbGVyLFxuICAgICAgdGhpcy5fZmluZENhcmRzLFxuICAgICAgdGhpcy5fY2FyZFByaWNlQ29udHJvbGxlcixcbiAgICAgIHRoaXMuX2xvZ01hbmFnZXIsXG4gICAgICB0aGlzLl9tYXRjaCxcbiAgICAgIHRoaXMuX2NhcmRMaWJyYXJ5LFxuICAgICAgKGFjdGlvbiwgLi4uYXJncykgPT4gdGhpcy5ydW5HYW1lQWN0aW9uKGFjdGlvbiwgLi4uYXJncylcbiAgICApO1xuICAgIFxuICAgIGNvbnN0IGNhcmRFZmZlY3RGdW5jdGlvbk1hcCA9IE9iamVjdC5rZXlzKGNhcmRFZmZlY3RGdW5jdGlvbk1hcEZhY3RvcnkpLnJlZHVjZSgoYWNjLCBuZXh0S2V5KSA9PiB7XG4gICAgICBhY2NbbmV4dEtleV0gPSBjYXJkRWZmZWN0RnVuY3Rpb25NYXBGYWN0b3J5W25leHRLZXldKCk7XG4gICAgICByZXR1cm4gYWNjO1xuICAgIH0sIHt9IGFzIENhcmRFZmZlY3RGdW5jdGlvbk1hcCk7XG4gICAgXG4gICAgY29uc3QgZXZlbnRFZmZlY3RGdW5jdGlvbk1hcCA9IE9iamVjdC5rZXlzKGV2ZW50RWZmZWN0RmFjdG9yeU1hcCkucmVkdWNlKChhY2MsIG5leHRLZXkpID0+IHtcbiAgICAgIGFjY1tuZXh0S2V5XSA9IGV2ZW50RWZmZWN0RmFjdG9yeU1hcFtuZXh0S2V5XSgpO1xuICAgICAgcmV0dXJuIGFjYztcbiAgICB9LCB7fSBhcyBDYXJkRWZmZWN0RnVuY3Rpb25NYXApO1xuICAgIFxuICAgIHRoaXMuX2ludGVyYWN0aXZpdHlDb250cm9sbGVyID0gbmV3IENhcmRJbnRlcmFjdGl2aXR5Q29udHJvbGxlcihcbiAgICAgIHRoaXMuX2NhcmRTb3VyY2VDb250cm9sbGVyLFxuICAgICAgdGhpcy5fY2FyZFByaWNlQ29udHJvbGxlcixcbiAgICAgIHRoaXMuX21hdGNoLFxuICAgICAgdGhpcy5fc29ja2V0TWFwLFxuICAgICAgdGhpcy5fY2FyZExpYnJhcnksXG4gICAgICAoYWN0aW9uLCAuLi5hcmdzKSA9PiB0aGlzLnJ1bkdhbWVBY3Rpb24oYWN0aW9uLCAuLi5hcmdzKSxcbiAgICAgIHRoaXMuX2ZpbmRDYXJkc1xuICAgICk7XG4gICAgXG4gICAgdGhpcy5nYW1lQWN0aW9uc0NvbnRyb2xsZXIgPSBuZXcgR2FtZUFjdGlvbkNvbnRyb2xsZXIoXG4gICAgICB0aGlzLl9jYXJkU291cmNlQ29udHJvbGxlcixcbiAgICAgIHRoaXMuX2ZpbmRDYXJkcyxcbiAgICAgIHRoaXMuX2NhcmRQcmljZUNvbnRyb2xsZXIsXG4gICAgICBjYXJkRWZmZWN0RnVuY3Rpb25NYXAsXG4gICAgICBldmVudEVmZmVjdEZ1bmN0aW9uTWFwLFxuICAgICAgdGhpcy5fbWF0Y2gsXG4gICAgICB0aGlzLl9jYXJkTGlicmFyeSxcbiAgICAgIHRoaXMuX2xvZ01hbmFnZXIsXG4gICAgICB0aGlzLl9zb2NrZXRNYXAsXG4gICAgICB0aGlzLl9yZWFjdGlvbk1hbmFnZXIsXG4gICAgICAoYWN0aW9uLCAuLi5hcmdzKSA9PiB0aGlzLnJ1bkdhbWVBY3Rpb24oYWN0aW9uLCAuLi5hcmdzKSxcbiAgICAgIHRoaXMuX2ludGVyYWN0aXZpdHlDb250cm9sbGVyLFxuICAgICk7XG4gICAgXG4gICAgdGhpcy5fbWF0Y2hDb25maWd1cmF0b3IgPSBuZXcgTWF0Y2hDb25maWd1cmF0b3IoY29uZmlnKTtcbiAgICBcbiAgICBjb25zdCB7IGNvbmZpZzogbmV3Q29uZmlnIH0gPSBhd2FpdCB0aGlzLl9tYXRjaENvbmZpZ3VyYXRvci5jcmVhdGVDb25maWd1cmF0aW9uKHtcbiAgICAgIG1hdGNoOiB0aGlzLl9tYXRjaCxcbiAgICAgIGNhcmRTb3VyY2VDb250cm9sbGVyOiB0aGlzLl9jYXJkU291cmNlQ29udHJvbGxlcixcbiAgICAgIGdhbWVFdmVudFJlZ2lzdHJhcjogKGV2ZW50OiBHYW1lTGlmZWN5Y2xlRXZlbnQsIGhhbmRsZXI6IEdhbWVMaWZlY3ljbGVDYWxsYmFjaykgPT4gdGhpcy5fcmVhY3Rpb25NYW5hZ2VyPy5yZWdpc3RlckdhbWVFdmVudChldmVudCwgaGFuZGxlciksXG4gICAgICBjbGllbnRFdmVudFJlZ2lzdHJhcjogKGV2ZW50LCBoYW5kbGVyKSA9PiB0aGlzLmNsaWVudEV2ZW50UmVnaXN0cmFyKGV2ZW50LCBoYW5kbGVyKSxcbiAgICAgIGVuZEdhbWVDb25kaXRpb25SZWdpc3RyYXI6ICh2YWwpID0+IHRoaXMuX2V4cGFuc2lvbkVuZEdhbWVDb25kaXRpb25GbnMucHVzaCh2YWwpLFxuICAgICAgY2FyZEVmZmVjdFJlZ2lzdHJhcjogKC4uLmFyZ3MpID0+IHRoaXMuZ2FtZUFjdGlvbnNDb250cm9sbGVyPy5yZWdpc3RlckNhcmRFZmZlY3QoLi4uYXJncyksXG4gICAgICBwbGF5ZXJTY29yZURlY29yYXRvclJlZ2lzdHJhcjogKHZhbDogUGxheWVyU2NvcmVEZWNvcmF0b3IpID0+IHRoaXMuX2V4cGFuc2lvblNjb3JpbmdGbnMucHVzaCh2YWwpLFxuICAgIH0pO1xuICAgIFxuICAgIHRoaXMuX21hdGNoQ29uZmlndXJhdGlvbiA9IG5ld0NvbmZpZztcbiAgICBcbiAgICB0aGlzLl9tYXRjaC5wbGF5ZXJzID0gdGhpcy5fbWF0Y2hDb25maWd1cmF0aW9uLnBsYXllcnM7XG4gICAgdGhpcy5jcmVhdGVCYXNlU3VwcGx5KHRoaXMuX21hdGNoQ29uZmlndXJhdGlvbik7XG4gICAgdGhpcy5jcmVhdGVLaW5nZG9tKHRoaXMuX21hdGNoQ29uZmlndXJhdGlvbik7XG4gICAgdGhpcy5jcmVhdGVFdmVudHModGhpcy5fbWF0Y2hDb25maWd1cmF0aW9uKTtcbiAgICB0aGlzLmNyZWF0ZU5vblN1cHBseUNhcmRzKHRoaXMuX21hdGNoQ29uZmlndXJhdGlvbik7XG4gICAgdGhpcy5jcmVhdGVQbGF5ZXJEZWNrcyh0aGlzLl9tYXRjaENvbmZpZ3VyYXRpb24pO1xuICAgIHRoaXMuX21hdGNoLmNvbmZpZyA9IHRoaXMuX21hdGNoQ29uZmlndXJhdGlvbjtcbiAgICBcbiAgICBjb25zb2xlLmxvZyhgW21hdGNoXSByZWFkeSwgc2VuZGluZyB0byBjbGllbnRzIGFuZCBsaXN0ZW5pbmcgZm9yIHdoZW4gY2xpZW50cyBhcmUgcmVhZHlgKTtcbiAgICBcbiAgICB0aGlzLmJyb2FkY2FzdFBhdGNoKHNuYXBzaG90KTtcbiAgICBcbiAgICB0aGlzLl9zb2NrZXRNYXAuZm9yRWFjaCgocykgPT4ge1xuICAgICAgcy5lbWl0KCdzZXRDYXJkTGlicmFyeScsIHRoaXMuX2NhcmRMaWJyYXJ5LmdldEFsbENhcmRzKCkpO1xuICAgICAgcy5lbWl0KCdtYXRjaFJlYWR5Jyk7XG4gICAgICBzLm9uKCdjbGllbnRSZWFkeScsIHRoaXMub25DbGllbnRSZWFkeSk7XG4gICAgfSk7XG4gIH1cbiAgXG4gIHByaXZhdGUgY2xpZW50RXZlbnRSZWdpc3RyYXI8VCBleHRlbmRzIGtleW9mIFNlcnZlckxpc3RlbkV2ZW50cz4oZXZlbnQ6IFQsIGhhbmRsZXI6IFNlcnZlckxpc3RlbkV2ZW50c1tUXSkge1xuICAgIHRoaXMuX3JlZ2lzdGVyZWRFdmVudHMucHVzaChldmVudCk7XG4gICAgdGhpcy5fc29ja2V0TWFwLmZvckVhY2gocyA9PiB7XG4gICAgICBzLm9uKGV2ZW50LCBoYW5kbGVyIGFzIGFueSk7XG4gICAgfSlcbiAgfVxuICBcbiAgcHVibGljIHBsYXllclJlY29ubmVjdGVkKHBsYXllcklkOiBQbGF5ZXJJZCwgc29ja2V0OiBBcHBTb2NrZXQpIHtcbiAgICBjb25zb2xlLmxvZyhgW21hdGNoXSBwbGF5ZXIgJHtwbGF5ZXJJZH0gcmVjb25uZWN0aW5nYCk7XG4gICAgdGhpcy5fc29ja2V0TWFwLnNldChwbGF5ZXJJZCwgc29ja2V0KTtcbiAgICBcbiAgICB0aGlzLmJyb2FkY2FzdFBhdGNoKHt9IGFzIE1hdGNoLCBwbGF5ZXJJZCk7XG4gICAgXG4gICAgc29ja2V0LmVtaXQoJ21hdGNoUmVhZHknKTtcbiAgICBcbiAgICBzb2NrZXQub24oJ2NsaWVudFJlYWR5JywgYXN5bmMgKF9wbGF5ZXJJZDogbnVtYmVyLCBfcmVhZHk6IGJvb2xlYW4pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbbWF0Y2hdICR7Z2V0UGxheWVyQnlJZCh0aGlzLl9tYXRjaCwgcGxheWVySWQpfSBtYXJrZWQgcmVhZHlgKTtcbiAgICAgIHNvY2tldC5lbWl0KCdtYXRjaFN0YXJ0ZWQnKTtcbiAgICAgIHNvY2tldC5vZmYoJ2NsaWVudFJlYWR5Jyk7XG4gICAgICBcbiAgICAgIHRoaXMuaW5pdGlhbGl6ZVNvY2tldExpc3RlbmVycyhzb2NrZXQpO1xuICAgICAgXG4gICAgICB0aGlzLl9pbnRlcmFjdGl2aXR5Q29udHJvbGxlcj8ucGxheWVyQWRkZWQoc29ja2V0KTtcbiAgICAgIFxuICAgICAgaWYgKGdldEN1cnJlbnRQbGF5ZXIodGhpcy5fbWF0Y2gpLmlkID09PSBwbGF5ZXJJZCkge1xuICAgICAgICBhd2FpdCB0aGlzLnJ1bkdhbWVBY3Rpb24oJ2NoZWNrRm9yUmVtYWluaW5nUGxheWVyQWN0aW9ucycpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIFxuICBwdWJsaWMgcGxheWVyRGlzY29ubmVjdGVkKHBsYXllcklkOiBudW1iZXIpIHtcbiAgICAvLyBVc2Ugd2hpY2hldmVyIGFycmF5IGlzIHBvcHVsYXRlZCBkZXBlbmRpbmcgb24gcGhhc2VcbiAgICBjb25zdCByb3N0ZXIgPSB0aGlzLl9tYXRjaC5wbGF5ZXJzPy5sZW5ndGhcbiAgICAgID8gdGhpcy5fbWF0Y2gucGxheWVyc1xuICAgICAgOiB0aGlzLl9tYXRjaC5jb25maWcucGxheWVycztcbiAgICBcbiAgICAvLyBUaGVyZSBzaG91bGQgYWx3YXlzIGJlIGF0IGxlYXN0IG9uZSBlbnRyeSBhZnRlciBhIHNpbmdsZSBkaXNjb25uZWN0XG4gICAgY29uc3QgbGVhdmluZyA9IHJvc3Rlci5maW5kKChwKSA9PiBwLmlkID09PSBwbGF5ZXJJZCk7XG4gICAgY29uc29sZS5sb2coYFttYXRjaF0gJHtsZWF2aW5nID8/IGB7aWQ6JHtwbGF5ZXJJZH19YH0gaGFzIGRpc2Nvbm5lY3RlZGApO1xuICAgIFxuICAgIHRoaXMuX3NvY2tldE1hcC5nZXQocGxheWVySWQpPy5vZmZBbnlJbmNvbWluZygpO1xuICAgIHRoaXMuX2ludGVyYWN0aXZpdHlDb250cm9sbGVyPy5wbGF5ZXJSZW1vdmVkKHRoaXMuX3NvY2tldE1hcC5nZXQocGxheWVySWQpKTtcbiAgICB0aGlzLl9zb2NrZXRNYXAuZGVsZXRlKHBsYXllcklkKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBjcmVhdGVCYXNlU3VwcGx5KGNvbmZpZzogQ29tcHV0ZWRNYXRjaENvbmZpZ3VyYXRpb24pIHtcbiAgICBjb25zb2xlLmxvZyhgW21hdGNoXSBjcmVhdGluZyBiYXNlIHN1cHBseSBjYXJkc2ApO1xuICAgIGNvbnN0IGNhcmRTb3VyY2UgPSB0aGlzLl9jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ2Jhc2ljU3VwcGx5Jyk7XG4gICAgXG4gICAgaWYgKCFjYXJkU291cmNlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFttYXRjaF0gbm8gYmFzaWMgc3VwcGx5IGNhcmQgc291cmNlIGZvdW5kYCk7XG4gICAgfVxuICAgIFxuICAgIGZvciAoY29uc3Qgc3VwcGx5IG9mIE9iamVjdC52YWx1ZXMoY29uZmlnLmJhc2ljU3VwcGx5KSkge1xuICAgICAgZm9yIChjb25zdCBjYXJkIG9mIHN1cHBseS5jYXJkcykge1xuICAgICAgICBpZiAoIWNhcmQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFttYXRjaF0gbm8gY2FyZCBkYXRhIGZvdW5kIGZvciAke3N1cHBseX1gKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgYyA9IGNyZWF0ZUNhcmQoY2FyZC5jYXJkS2V5LCB7IC4uLmNhcmQsIGtpbmdkb206IHN1cHBseS5uYW1lIH0pO1xuICAgICAgICB0aGlzLl9jYXJkTGlicmFyeS5hZGRDYXJkKGMpO1xuICAgICAgICBjYXJkU291cmNlLnB1c2goYy5pZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGNyZWF0ZUtpbmdkb20oY29uZmlnOiBDb21wdXRlZE1hdGNoQ29uZmlndXJhdGlvbikge1xuICAgIGNvbnNvbGUubG9nKGBbbWF0Y2hdIGNyZWF0aW5nIGtpbmdkb20gY2FyZHNgKTtcbiAgICBcbiAgICBjb25zdCBjYXJkU291cmNlID0gdGhpcy5fY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdraW5nZG9tU3VwcGx5Jyk7XG4gICAgXG4gICAgaWYgKCFjYXJkU291cmNlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFttYXRjaF0gbm8gYmFzaWMgc3VwcGx5IGNhcmQgc291cmNlIGZvdW5kYCk7XG4gICAgfVxuICAgIFxuICAgIGZvciAoY29uc3Qga2luZ2RvbSBvZiBPYmplY3QudmFsdWVzKGNvbmZpZy5raW5nZG9tU3VwcGx5KSkge1xuICAgICAgZm9yIChjb25zdCBjYXJkIG9mIGtpbmdkb20uY2FyZHMpIHtcbiAgICAgICAgaWYgKCFjYXJkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBbbWF0Y2hdIG5vIGNhcmQgZGF0YSBmb3VuZCBmb3IgJHtraW5nZG9tfWApO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjID0gY3JlYXRlQ2FyZChjYXJkLmNhcmRLZXksIHsgLi4uY2FyZCwga2luZ2RvbToga2luZ2RvbS5uYW1lIH0pO1xuICAgICAgICB0aGlzLl9jYXJkTGlicmFyeS5hZGRDYXJkKGMpO1xuICAgICAgICBjYXJkU291cmNlLnB1c2goYy5pZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGNyZWF0ZU5vblN1cHBseUNhcmRzKGNvbmZpZzogQ29tcHV0ZWRNYXRjaENvbmZpZ3VyYXRpb24pIHtcbiAgICBjb25zb2xlLmxvZyhgW21hdGNoXSBjcmVhdGluZyBub24tc3VwcGx5IGNhcmRzYCk7XG4gICAgXG4gICAgY29uc3QgY2FyZFNvdXJjZSA9IHRoaXMuX2NhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgnbm9uU3VwcGx5Q2FyZHMnKTtcbiAgICBcbiAgICBpZiAoIWNhcmRTb3VyY2UpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgW21hdGNoXSBubyBiYXNpYyBzdXBwbHkgY2FyZCBzb3VyY2UgZm91bmRgKTtcbiAgICB9XG4gICAgXG4gICAgZm9yIChjb25zdCBzdXBwbHkgb2YgT2JqZWN0LnZhbHVlcyhjb25maWcubm9uU3VwcGx5ID8/IHt9KSkge1xuICAgICAgZm9yIChjb25zdCBjYXJkIG9mIHN1cHBseS5jYXJkcykge1xuICAgICAgICBpZiAoIWNhcmQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFttYXRjaF0gbm8gY2FyZCBkYXRhIGZvdW5kIGZvciAke3N1cHBseX1gKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgYyA9IGNyZWF0ZUNhcmQoY2FyZC5jYXJkS2V5LCB7IC4uLmNhcmQsIGtpbmdkb206IHN1cHBseS5uYW1lIH0pO1xuICAgICAgICB0aGlzLl9jYXJkTGlicmFyeS5hZGRDYXJkKGMpO1xuICAgICAgICBjYXJkU291cmNlLnB1c2goYy5pZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGNyZWF0ZVBsYXllckRlY2tzKGNvbmZpZzogTWF0Y2hDb25maWd1cmF0aW9uKSB7XG4gICAgY29uc29sZS5sb2coYFttYXRjaF0gY3JlYXRpbmcgcGxheWVyIGRlY2tzYCk7XG4gICAgXG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoY29uZmlnLnBsYXllcnMpLmZvckVhY2goKHBsYXllciwgaWR4KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZygnaW5pdGlhbGl6aW5nIHBsYXllcicsIHBsYXllci5pZCwgJ2NhcmRzLi4uJyk7XG4gICAgICBcbiAgICAgIGxldCBwbGF5ZXJTdGFydEhhbmQgPSB0aGlzLl9wbGF5ZXJIYW5kcy5sZW5ndGggPiAwID8gdGhpcy5fcGxheWVySGFuZHNbaWR4XSA6IGNvbmZpZy5wbGF5ZXJTdGFydGluZ0hhbmQgYXMgUmVjb3JkPHN0cmluZywgbnVtYmVyPjtcbiAgICAgIHBsYXllclN0YXJ0SGFuZCA/Pz0gTWF0Y2hCYXNlQ29uZmlndXJhdGlvbi5wbGF5ZXJTdGFydGluZ0hhbmQ7XG4gICAgICBjb25zb2xlLmxvZyhgW21hdGNoXSB1c2luZyBwbGF5ZXIgc3RhcnRpbmcgaGFuZGApO1xuICAgICAgY29uc29sZS5sb2coT2JqZWN0LmtleXMocGxheWVyU3RhcnRIYW5kKS5tYXAoKGtleSkgPT4gYCR7a2V5fTogJHtwbGF5ZXJTdGFydEhhbmRba2V5XX1gKS5qb2luKCcsICcpKVxuICAgICAgXG4gICAgICBjb25zdCBkZWNrID0gdGhpcy5fY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgcGxheWVyLmlkKTtcbiAgICAgIFxuICAgICAgT2JqZWN0LmVudHJpZXMocGxheWVyU3RhcnRIYW5kKS5mb3JFYWNoKFxuICAgICAgICAoW2tleSwgY291bnRdKSA9PiB7XG4gICAgICAgICAgZGVjay5wdXNoKFxuICAgICAgICAgICAgLi4ubmV3IEFycmF5KGNvdW50KS5maWxsKDApLm1hcCgoXykgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBjID0gY3JlYXRlQ2FyZChrZXksIHsgb3duZXI6IHBsYXllci5pZCB9KTtcbiAgICAgICAgICAgICAgdGhpcy5fY2FyZExpYnJhcnkuYWRkQ2FyZChjKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGMuaWQ7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICApO1xuICAgICAgICAgIGZpc2hlcllhdGVzU2h1ZmZsZShkZWNrLCB0cnVlKTtcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cbiAgXG4gIHB1YmxpYyBnZXRNYXRjaFNuYXBzaG90KCk6IE1hdGNoIHtcbiAgICB0aGlzLl9jYXJkTGliU25hcHNob3QgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5fY2FyZExpYnJhcnkuZ2V0QWxsQ2FyZHMoKSk7XG4gICAgcmV0dXJuIHN0cnVjdHVyZWRDbG9uZSh0aGlzLl9tYXRjaCk7XG4gIH1cbiAgXG4gIGFzeW5jIHJ1bkdhbWVBY3Rpb248SyBleHRlbmRzIEdhbWVBY3Rpb25zPihcbiAgICBhY3Rpb246IEssXG4gICAgLi4uYXJnczogUGFyYW1ldGVyczxHYW1lQWN0aW9uRGVmaW5pdGlvbk1hcFtLXT5cbiAgKTogUHJvbWlzZTxHYW1lQWN0aW9uUmV0dXJuVHlwZU1hcFtLXT4ge1xuICAgIHRoaXMuX21hdGNoU25hcHNob3QgPz89IHRoaXMuZ2V0TWF0Y2hTbmFwc2hvdCgpO1xuICAgIFxuICAgIGxldCBhc3luY1RpbWVvdXQ6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBpZiAoYWN0aW9uID09PSAnc2VsZWN0Q2FyZCcgfHwgYWN0aW9uID09PSAndXNlclByb21wdCcpIHtcbiAgICAgIHRoaXMuYnJvYWRjYXN0UGF0Y2godGhpcy5fbWF0Y2hTbmFwc2hvdCk7XG4gICAgICB0aGlzLl9sb2dNYW5hZ2VyPy5mbHVzaFF1ZXVlKCk7XG4gICAgICB0aGlzLl9tYXRjaFNuYXBzaG90ID0gdGhpcy5nZXRNYXRjaFNuYXBzaG90KCk7XG4gICAgICBsZXQgcGluZ0NvdW50ID0gMDtcbiAgICAgIGxldCBwaW5nVGltZSA9IDMwMDAwO1xuICAgICAgXG4gICAgICBjb25zdCBwaW5nVXNlciA9ICgpID0+IHtcbiAgICAgICAgdGhpcy5fc29ja2V0TWFwLmdldChhcmdzWzBdLnBsYXllcklkKT8uZW1pdCgncGluZycsICsrcGluZ0NvdW50KTtcbiAgICAgICAgcGluZ1RpbWUgLT0gMTAwMDA7XG4gICAgICAgIHBpbmdUaW1lID0gTWF0aC5tYXgocGluZ1RpbWUsIDEwMDAwKTtcbiAgICAgICAgYXN5bmNUaW1lb3V0ID0gc2V0VGltZW91dChwaW5nVXNlciwgcGluZ1RpbWUpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBhc3luY1RpbWVvdXQgPSBzZXRUaW1lb3V0KHBpbmdVc2VyLCBwaW5nVGltZSk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2FtZUFjdGlvbnNDb250cm9sbGVyIS5pbnZva2VBY3Rpb24oYWN0aW9uLCAuLi5hcmdzKTtcbiAgICBcbiAgICBjbGVhclRpbWVvdXQoYXN5bmNUaW1lb3V0KTtcbiAgICBhc3luY1RpbWVvdXQgPSB1bmRlZmluZWQ7XG4gICAgXG4gICAgdGhpcy5jYWxjdWxhdGVTY29yZXMoKTtcbiAgICB0aGlzLl9pbnRlcmFjdGl2aXR5Q29udHJvbGxlcj8uY2hlY2tDYXJkSW50ZXJhY3Rpdml0eSgpO1xuICAgIHRoaXMuX21hdGNoLmNhcmRPdmVycmlkZXMgPSB0aGlzLl9jYXJkUHJpY2VDb250cm9sbGVyPy5jYWxjdWxhdGVPdmVycmlkZXMoKSA/PyB7fTtcbiAgICBcbiAgICB0aGlzLmJyb2FkY2FzdFBhdGNoKHsgLi4udGhpcy5fbWF0Y2hTbmFwc2hvdCB9KTtcbiAgICB0aGlzLl9sb2dNYW5hZ2VyPy5mbHVzaFF1ZXVlKCk7XG4gICAgXG4gICAgdGhpcy5fbWF0Y2hTbmFwc2hvdCA9IG51bGw7XG4gICAgXG4gICAgaWYgKGF3YWl0IHRoaXMuY2hlY2tHYW1lRW5kKCkpIHtcbiAgICAgIGNvbnNvbGUubG9nKGBbbWF0Y2hdIGdhbWUgZW5kZWRgKVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzdWx0IGFzIFByb21pc2U8R2FtZUFjdGlvblJldHVyblR5cGVNYXBbS10+O1xuICB9XG4gIFxuICBwdWJsaWMgYnJvYWRjYXN0UGF0Y2gocHJldjogTWF0Y2gsIHBsYXllcklkPzogUGxheWVySWQpIHtcbiAgICBjb25zdCBwYXRjaDogT3BlcmF0aW9uW10gPSBjb21wYXJlKHByZXYsIHRoaXMuX21hdGNoKTtcbiAgICBjb25zdCBjYXJkTGlicmFyeVBhdGNoID0gY29tcGFyZSh0aGlzLl9jYXJkTGliU25hcHNob3QsIHRoaXMuX2NhcmRMaWJyYXJ5LmdldEFsbENhcmRzKCkpO1xuICAgIFxuICAgIGlmIChwYXRjaC5sZW5ndGggfHwgY2FyZExpYnJhcnlQYXRjaC5sZW5ndGgpIHtcbiAgICAgIGNvbnNvbGUubG9nKGBbbWF0Y2hdIHNlbmRpbmcgbWF0Y2ggdXBkYXRlIHRvIGNsaWVudHNgKTtcbiAgICAgIFxuICAgICAgaWYgKHBsYXllcklkKSB7XG4gICAgICAgIHRoaXMuX3NvY2tldE1hcC5nZXQocGxheWVySWQpPy5lbWl0KCdwYXRjaFVwZGF0ZScsIHBhdGNoLCBjYXJkTGlicmFyeVBhdGNoKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLl9zb2NrZXRNYXAuZm9yRWFjaCgocykgPT4gcy5lbWl0KCdwYXRjaFVwZGF0ZScsIHBhdGNoLCBjYXJkTGlicmFyeVBhdGNoKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIG9uQ2xpZW50UmVhZHkgPSAocGxheWVySWQ6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHBsYXllciA9IHRoaXMuX21hdGNoLmNvbmZpZz8ucGxheWVycy5maW5kKChwbGF5ZXIpID0+XG4gICAgICBwbGF5ZXIuaWQgPT09IHBsYXllcklkXG4gICAgKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZyhgW21hdGNoXSByZWNlaXZlZCBjbGllbnRSZWFkeSBldmVudCBmcm9tICR7cGxheWVyfWApO1xuICAgIFxuICAgIGlmICghcGxheWVyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBbbWF0Y2hdIHBsYXllciBub3QgZm91bmRgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgaWYgKCF0aGlzLl9tYXRjaC5jb25maWcpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYFttYXRjaF0gbm8gbWF0Y2ggY29uZmlnYCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIHBsYXllci5yZWFkeSA9IHRydWU7XG4gICAgXG4gICAgaWYgKHRoaXMuX21hdGNoLmNvbmZpZy5wbGF5ZXJzLnNvbWUoKHApID0+ICFwLnJlYWR5KSkge1xuICAgICAgY29uc29sZS5sb2coYFttYXRjaF0gbm90IGFsbCBwbGF5ZXJzIG1hcmtlZCByZWFkeSwgd2FpdGluZyBmb3IgZXZlcnlvbmVgLCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbbWF0Y2hdIGFsbCBwbGF5ZXJzIHJlYWR5Jyk7XG4gICAgXG4gICAgZm9yIChjb25zdCBzb2NrZXQgb2YgdGhpcy5fc29ja2V0TWFwLnZhbHVlcygpKSB7XG4gICAgICBzb2NrZXQub2ZmKCdjbGllbnRSZWFkeScsIHRoaXMub25DbGllbnRSZWFkeSk7XG4gICAgfVxuICAgIFxuICAgIHZvaWQgdGhpcy5zdGFydE1hdGNoKCk7XG4gIH07XG4gIFxuICBwcml2YXRlIGFzeW5jIHN0YXJ0TWF0Y2goKSB7XG4gICAgY29uc29sZS5sb2coYFttYXRjaF0gc3RhcnRpbmcgbWF0Y2hgKTtcbiAgICBcbiAgICBhd2FpdCB0aGlzLl9yZWFjdGlvbk1hbmFnZXI/LnJ1bkdhbWVMaWZlY3ljbGVFdmVudCgnb25HYW1lU3RhcnQnLCB7IG1hdGNoOiB0aGlzLl9tYXRjaCB9KTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHNvY2tldCBvZiB0aGlzLl9zb2NrZXRNYXAudmFsdWVzKCkpIHtcbiAgICAgIHRoaXMuaW5pdGlhbGl6ZVNvY2tldExpc3RlbmVycyhzb2NrZXQpO1xuICAgIH1cbiAgICBcbiAgICB0aGlzLl9tYXRjaFNuYXBzaG90ID0gdGhpcy5nZXRNYXRjaFNuYXBzaG90KCk7XG4gICAgdGhpcy5fbWF0Y2gucGxheWVyQnV5cyA9IDE7XG4gICAgdGhpcy5fbWF0Y2gucGxheWVyQWN0aW9ucyA9IDE7XG4gICAgXG4gICAgdGhpcy5fc29ja2V0TWFwLmZvckVhY2goKHMpID0+IHMuZW1pdCgnbWF0Y2hTdGFydGVkJykpO1xuICAgIFxuICAgIGZvciAoY29uc3QgcGxheWVyIG9mIHRoaXMuX21hdGNoLnBsYXllcnMhKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bkdhbWVBY3Rpb24oJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogcGxheWVyLmlkLCBjb3VudDogNSB9KTtcbiAgICB9XG4gICAgXG4gICAgdGhpcy5fbG9nTWFuYWdlcj8uYWRkTG9nRW50cnkoe1xuICAgICAgcm9vdDogdHJ1ZSxcbiAgICAgIHR5cGU6ICduZXdUdXJuJyxcbiAgICAgIHR1cm46IE1hdGguZmxvb3IodGhpcy5fbWF0Y2gudHVybk51bWJlciAvIHRoaXMuX21hdGNoLnBsYXllcnMubGVuZ3RoKSArIDEsXG4gICAgfSk7XG4gICAgXG4gICAgdGhpcy5fbG9nTWFuYWdlcj8uYWRkTG9nRW50cnkoe1xuICAgICAgcm9vdDogdHJ1ZSxcbiAgICAgIHR5cGU6ICduZXdQbGF5ZXJUdXJuJyxcbiAgICAgIHR1cm46IE1hdGguZmxvb3IodGhpcy5fbWF0Y2gudHVybk51bWJlciAvIHRoaXMuX21hdGNoLnBsYXllcnMubGVuZ3RoKSArIDEsXG4gICAgICBwbGF5ZXJJZDogZ2V0Q3VycmVudFBsYXllcih0aGlzLl9tYXRjaCkuaWRcbiAgICB9KTtcbiAgICBcbiAgICBhd2FpdCB0aGlzLnJ1bkdhbWVBY3Rpb24oJ2NoZWNrRm9yUmVtYWluaW5nUGxheWVyQWN0aW9ucycpO1xuICB9XG4gIFxuICBwcml2YXRlIGNhbGN1bGF0ZVNjb3JlcygpIHtcbiAgICBjb25zb2xlLmxvZyhgW21hdGNoXSBjYWxjdWxhdGluZyBzY29yZXNgKTtcbiAgICBcbiAgICBjb25zdCBtYXRjaCA9IHRoaXMuX21hdGNoO1xuICAgIFxuICAgIGZvciAoY29uc3QgcGxheWVyIG9mIG1hdGNoLnBsYXllcnMgPz8gW10pIHtcbiAgICAgIGNvbnN0IHBsYXllcklkID0gcGxheWVyLmlkO1xuICAgICAgY29uc3QgY2FyZHMgPSB0aGlzLl9jYXJkTGlicmFyeS5nZXRDYXJkc0J5T3duZXIocGxheWVySWQpO1xuICAgICAgXG4gICAgICBsZXQgc2NvcmUgPSAwO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGNhcmQgb2YgY2FyZHMpIHtcbiAgICAgICAgc2NvcmUgKz0gY2FyZC52aWN0b3J5UG9pbnRzID8/IDA7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjdXN0b21TY29yaW5nRm4gPSBzY29yaW5nRnVuY3Rpb25NYXBbY2FyZD8uY2FyZEtleSA/PyAnJ107XG4gICAgICAgIGlmIChjdXN0b21TY29yaW5nRm4pIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW21hdGNoXSBwcm9jZXNzaW5nIHNjb3JpbmcgZnVuY3Rpb24gZm9yICR7Y2FyZH1gKTtcbiAgICAgICAgICBzY29yZSArPSBjdXN0b21TY29yaW5nRm4oe1xuICAgICAgICAgICAgY2FyZFNvdXJjZUNvbnRyb2xsZXI6IHRoaXMuX2NhcmRTb3VyY2VDb250cm9sbGVyLFxuICAgICAgICAgICAgY2FyZFByaWNlQ29udHJvbGxlcjogdGhpcy5fY2FyZFByaWNlQ29udHJvbGxlciEsXG4gICAgICAgICAgICBmaW5kQ2FyZHM6IHRoaXMuX2ZpbmRDYXJkcyxcbiAgICAgICAgICAgIHJlYWN0aW9uTWFuYWdlcjogdGhpcy5fcmVhY3Rpb25NYW5hZ2VyISxcbiAgICAgICAgICAgIG1hdGNoOiB0aGlzLl9tYXRjaCxcbiAgICAgICAgICAgIGNhcmRMaWJyYXJ5OiB0aGlzLl9jYXJkTGlicmFyeSxcbiAgICAgICAgICAgIG93bmVySWQ6IHBsYXllcklkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBtYXRjaC5zY29yZXNbcGxheWVySWRdID0gc2NvcmU7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgZXhwYW5zaW9uU2NvcmluZ0ZuIG9mIHRoaXMuX2V4cGFuc2lvblNjb3JpbmdGbnMpIHtcbiAgICAgICAgZXhwYW5zaW9uU2NvcmluZ0ZuKHBsYXllcklkLCBtYXRjaCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGNoZWNrR2FtZUVuZCgpIHtcbiAgICBjb25zb2xlLmxvZyhgW21hdGNoXSBjaGVja2luZyBpZiB0aGUgZ2FtZSBoYXMgZW5kZWRgKTtcbiAgICBcbiAgICBjb25zdCBtYXRjaCA9IHRoaXMuX21hdGNoO1xuICAgIFxuICAgIGlmICh0aGlzLl9maW5kQ2FyZHMoW1xuICAgICAgeyBsb2NhdGlvbjogJ2Jhc2ljU3VwcGx5JyB9LFxuICAgICAgeyBjYXJkS2V5czogJ3Byb3ZpbmNlJyB9XG4gICAgXSkubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zb2xlLmxvZyhgW21hdGNoXSBzdXBwbHkgaGFzIG5vIG1vcmUgcHJvdmluY2VzLCBnYW1lIG92ZXJgKTtcbiAgICAgIGF3YWl0IHRoaXMuZW5kR2FtZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHN0YXJ0aW5nU3VwcGx5Q291bnQgPSBnZXRTdGFydGluZ1N1cHBseUNvdW50KG1hdGNoKTtcbiAgICBcbiAgICBjb25zdCByZW1haW5pbmdTdXBwbHlDb3VudCA9IGdldFJlbWFpbmluZ1N1cHBseUNvdW50KHRoaXMuX2ZpbmRDYXJkcyk7XG4gICAgXG4gICAgY29uc3QgZW1wdHlQaWxlQ291bnQgPSBzdGFydGluZ1N1cHBseUNvdW50IC0gcmVtYWluaW5nU3VwcGx5Q291bnQ7XG4gICAgXG4gICAgY29uc29sZS5sb2coYFttYXRjaF0gZW1wdHkgcGlsZSBjb3VudCAke2VtcHR5UGlsZUNvdW50fWApO1xuICAgIFxuICAgIGlmIChlbXB0eVBpbGVDb3VudCA9PT0gMykge1xuICAgICAgY29uc29sZS5sb2coYFttYXRjaF0gdGhyZWUgc3VwcGx5IHBpbGVzIGFyZSBlbXB0eSwgZ2FtZSBvdmVyYCk7XG4gICAgICBhd2FpdCB0aGlzLmVuZEdhbWUoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBcbiAgICBmb3IgKGNvbnN0IGNvbmRpdGlvbkZuIG9mIHRoaXMuX2V4cGFuc2lvbkVuZEdhbWVDb25kaXRpb25GbnMpIHtcbiAgICAgIGNvbmRpdGlvbkZuKHtcbiAgICAgICAgY2FyZFNvdXJjZUNvbnRyb2xsZXI6IHRoaXMuX2NhcmRTb3VyY2VDb250cm9sbGVyLFxuICAgICAgICBtYXRjaDogdGhpcy5fbWF0Y2gsIGNhcmRMaWJyYXJ5OiB0aGlzLl9jYXJkTGlicmFyeSxcbiAgICAgICAgY2FyZFByaWNlQ29udHJvbGxlcjogdGhpcy5fY2FyZFByaWNlQ29udHJvbGxlciEsXG4gICAgICAgIHJlYWN0aW9uTWFuYWdlcjogdGhpcy5fcmVhY3Rpb25NYW5hZ2VyISxcbiAgICAgICAgZmluZENhcmRzOiB0aGlzLl9maW5kQ2FyZHNcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgZW5kR2FtZSgpIHtcbiAgICBjb25zb2xlLmxvZyhgW21hdGNoXSBlbmRpbmcgdGhlIGdhbWVgKTtcbiAgICBcbiAgICB0aGlzLl9yZWFjdGlvbk1hbmFnZXI/LmVuZEdhbWUoKTtcbiAgICB0aGlzLl9pbnRlcmFjdGl2aXR5Q29udHJvbGxlcj8uZW5kR2FtZSgpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbbWF0Y2hdIHJlbW92aW5nIHNvY2tldCBsaXN0ZW5lcnMgZm9yICduZXh0UGhhc2UnYCk7XG4gICAgdGhpcy5fc29ja2V0TWFwLmZvckVhY2goKHMpID0+IHMub2ZmKCduZXh0UGhhc2UnKSk7XG4gICAgXG4gICAgY29uc29sZS5sb2coYFttYXRjaF0gcmVtb3ZpbmcgbGlzdGVuZXIgZm9yIG1hdGNoIHN0YXRlIHVwZGF0ZXNgKTtcbiAgICBcbiAgICBjb25zdCBtYXRjaCA9IHRoaXMuX21hdGNoO1xuICAgIFxuICAgIGZvciAoY29uc3QgcGxheWVyIG9mIHRoaXMuX21hdGNoLnBsYXllcnMpIHtcbiAgICAgIGNvbnN0IHNldEFzaWRlQ2FyZElkcyA9IHRoaXMuX2NhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgnc2V0LWFzaWRlJywgcGxheWVyLmlkKVxuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiBzZXRBc2lkZUNhcmRJZHMpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5ydW5HYW1lQWN0aW9uKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICB0b1BsYXllcklkOiBwbGF5ZXIuaWQsXG4gICAgICAgICAgY2FyZElkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGVjaycgfSxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgZm9yIChjb25zdCBldmVudCBvZiB0aGlzLl9yZWdpc3RlcmVkRXZlbnRzKSB7XG4gICAgICB0aGlzLl9zb2NrZXRNYXAuZm9yRWFjaChzID0+IHMub2ZmKGV2ZW50KSk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGN1cnJlbnRUdXJuID0gbWF0Y2gudHVybk51bWJlcjtcbiAgICBjb25zdCBjdXJyZW50UGxheWVyVHVybkluZGV4ID0gbWF0Y2guY3VycmVudFBsYXllclR1cm5JbmRleDtcbiAgICBcbiAgICBjb25zdCBzdW1tYXJ5OiBNYXRjaFN1bW1hcnkgPSB7XG4gICAgICBwbGF5ZXJTdW1tYXJ5OiBtYXRjaC5wbGF5ZXJzLnJlZHVjZSgocHJldiwgcGxheWVyKSA9PiB7XG4gICAgICAgIGNvbnN0IHBsYXllcklkID0gcGxheWVyLmlkO1xuICAgICAgICBjb25zdCB0dXJuc1Rha2VuID0gbWF0Y2gucGxheWVycy5maW5kSW5kZXgoKHApID0+XG4gICAgICAgICAgcC5pZCA9PT0gcGxheWVySWRcbiAgICAgICAgKSA8PSBjdXJyZW50UGxheWVyVHVybkluZGV4XG4gICAgICAgICAgPyAoTWF0aC5mbG9vcihjdXJyZW50VHVybiAvIG1hdGNoLnBsYXllcnMubGVuZ3RoKSArIDEpXG4gICAgICAgICAgOiBNYXRoLmZsb29yKGN1cnJlbnRUdXJuIC8gbWF0Y2gucGxheWVycy5sZW5ndGgpO1xuICAgICAgICBcbiAgICAgICAgcHJldi5wdXNoKHtcbiAgICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgICB0dXJuc1Rha2VuLFxuICAgICAgICAgIHNjb3JlOiBtYXRjaC5zY29yZXNbcGxheWVySWRdLFxuICAgICAgICAgIGRlY2s6IHRoaXMuX2ZpbmRDYXJkcyhbeyBvd25lcjogcGxheWVySWQgfV0pLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHByZXY7XG4gICAgICB9LCBbXSBhcyBNYXRjaFN1bW1hcnlbJ3BsYXllclN1bW1hcnknXSlcbiAgICAgICAgLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICBpZiAoYS5zY29yZSA8IGIuc2NvcmUpIHJldHVybiAxO1xuICAgICAgICAgIGlmIChiLnNjb3JlIDwgYS5zY29yZSkgcmV0dXJuIC0xO1xuICAgICAgICAgIGlmIChhLnR1cm5zVGFrZW4gPCBiLnR1cm5zVGFrZW4pIHJldHVybiAtMTtcbiAgICAgICAgICBpZiAoYi50dXJuc1Rha2VuIDwgYS50dXJuc1Rha2VuKSByZXR1cm4gMTtcbiAgICAgICAgICBjb25zdCBhSWR4ID0gbWF0Y2gucGxheWVycy5maW5kSW5kZXgoKHBsYXllcikgPT5cbiAgICAgICAgICAgIHBsYXllci5pZCA9PT0gYS5wbGF5ZXJJZFxuICAgICAgICAgICk7XG4gICAgICAgICAgY29uc3QgYklkeCA9IG1hdGNoLnBsYXllcnMuZmluZEluZGV4KChwbGF5ZXIpID0+XG4gICAgICAgICAgICBwbGF5ZXIuaWQgPT09IGIucGxheWVySWRcbiAgICAgICAgICApO1xuICAgICAgICAgIGlmIChhSWR4IDwgYklkeCkgcmV0dXJuIC0xO1xuICAgICAgICAgIGlmIChiSWR4IDwgYUlkeCkgcmV0dXJuIDE7XG4gICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH0pLFxuICAgIH07XG4gICAgXG4gICAgY29uc29sZS5sb2coYFttYXRjaF0gbWF0Y2ggc3VtbWFyeSBjcmVhdGVkYCk7XG4gICAgY29uc29sZS5sb2coc3VtbWFyeSk7XG4gICAgXG4gICAgdGhpcy5fc29ja2V0TWFwLmZvckVhY2goKHMpID0+IHMuZW1pdCgnZ2FtZU92ZXInLCBzdW1tYXJ5KSk7XG4gICAgdGhpcy5lbWl0KCdnYW1lT3ZlcicpO1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIG9uTmV4dFBoYXNlKCkge1xuICAgIGF3YWl0IHRoaXMucnVuR2FtZUFjdGlvbignbmV4dFBoYXNlJyk7XG4gICAgdGhpcy5fc29ja2V0TWFwLmZvckVhY2gocyA9PiBzLmVtaXQoJ25leHRQaGFzZUNvbXBsZXRlJykpO1xuICB9XG4gIFxuICBwcml2YXRlIGluaXRpYWxpemVTb2NrZXRMaXN0ZW5lcnMoc29ja2V0OiBBcHBTb2NrZXQpIHtcbiAgICBzb2NrZXQub24oJ25leHRQaGFzZScsICgpID0+IHRoaXMub25OZXh0UGhhc2UoKSk7XG4gICAgc29ja2V0Lm9uKCdzZWFyY2hDYXJkcycsIChwbGF5ZXJJZCwgc2VhcmNoU3RyKSA9PiB0aGlzLm9uU2VhcmNoQ2FyZHMocGxheWVySWQsIHNlYXJjaFN0cikpO1xuICAgIHNvY2tldC5vbignZXhjaGFuZ2VDb2ZmZXInLCBhc3luYyAocGxheWVySWQsIGNvdW50KSA9PiB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bkdhbWVBY3Rpb24oJ2V4Y2hhbmdlQ29mZmVyJywgeyBwbGF5ZXJJZCwgY291bnQgfSk7XG4gICAgfSk7XG4gIH1cbiAgXG4gIHByaXZhdGUgb25TZWFyY2hDYXJkcyhwbGF5ZXJJZDogUGxheWVySWQsIHNlYXJjaFN0cjogc3RyaW5nKSB7XG4gICAgY29uc29sZS5sb2coYFttYXRjaF0gJHtnZXRQbGF5ZXJCeUlkKHRoaXMuX21hdGNoLCBwbGF5ZXJJZCl9IHNlYXJjaGluZyBmb3IgY2FyZHMgdXNpbmcgdGVybSAnJHtzZWFyY2hTdHJ9J2ApO1xuICAgIFxuICAgIHRoaXMuX3NvY2tldE1hcC5nZXQocGxheWVySWQpPy5lbWl0KFxuICAgICAgJ3NlYXJjaENhcmRSZXNwb25zZScsXG4gICAgICB0aGlzLmNhcmRTZWFyY2hGbihzZWFyY2hTdHIpLFxuICAgICk7XG4gIH1cbiAgXG4gIHByaXZhdGUgY3JlYXRlRXZlbnRzKGNvbmZpZzogQ29tcHV0ZWRNYXRjaENvbmZpZ3VyYXRpb24pIHtcbiAgICBmb3IgKGNvbnN0IGV2ZW50IG9mIGNvbmZpZy5ldmVudHMpIHtcbiAgICAgIHRoaXMuX21hdGNoLmV2ZW50cy5wdXNoKGNyZWF0ZUV2ZW50KGV2ZW50KSk7XG4gICAgfVxuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBVUEsU0FBUyxpQkFBaUIsUUFBUSwwQkFBMEI7QUFDNUQsU0FBUyxnQkFBZ0IsUUFBUSxpQ0FBaUM7QUFDbEUsU0FBUywyQkFBMkIsUUFBUSxxQ0FBcUM7QUFDakYsU0FBUyxrQkFBa0IsUUFBUSxvQ0FBb0M7QUFDdkUsU0FBUyxlQUFlLFFBQVEsa0NBQWtDO0FBQ2xFLFNBQVMsa0JBQWtCLFFBQVEsc0NBQXNDO0FBQ3pFLFNBQVMsZ0JBQWdCLFFBQVEsMEJBQTBCO0FBQzNELFNBQVMsT0FBTyxRQUFtQixrQkFBa0I7QUFDckQsU0FBUyxhQUFhLFFBQVEsK0JBQStCO0FBQzdELFNBQVMsNEJBQTRCLFFBQVEsZ0RBQWdEO0FBQzdGLFNBQVMsWUFBWSxRQUFRLG1CQUFtQjtBQUNoRCxTQUFTLFVBQVUsUUFBUSxtQkFBbUI7QUFDOUMsU0FVRSxzQkFBc0IsUUFFakIsY0FBYztBQUNyQixTQUFTLFVBQVUsRUFBRSxXQUFXLFFBQVEsMEJBQTBCO0FBQ2xFLFNBQVMsdUJBQXVCLEVBQUUsc0JBQXNC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
// denoCacheMetadata=6967367832266315013,18184928981589564794