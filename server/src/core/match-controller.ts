import {
  Card,
  CardData,
  CardKey, LogEntry,
  Match,
  MatchConfiguration,
  MatchSummary,
  Player,
  PlayerId,
} from 'shared/shared-types.ts';
import { AppSocket, MatchBaseConfiguration, } from '../types.ts';
import { CardEffectController } from './card-effects-controller.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { createCardFactory } from '../utils/create-card.ts';
import { createEffectHandlerMap } from './effect-handler-map.ts';
import { EffectsPipeline } from './effects-pipeline.ts';
import { fisherYatesShuffle } from '../utils/fisher-yates-shuffler.ts';
import { ReactionManager } from './reaction-manager.ts';
import { scoringFunctionMap } from '../expansions/scoring-function-map.ts';
import { CardLibrary } from './card-library.ts';
import { compare, Operation } from 'fast-json-patch';
import { ExpansionCardData, expansionData } from '../state/expansion-data.ts';
import { getPlayerById } from '../utils/get-player-by-id.ts';
import Fuse, { IFuseOptions } from 'fuse.js';
import { createEffectGeneratorMap, effectGeneratorBlueprintMap } from './effect-generator-map.ts';
import { EventEmitter } from '@denosaurs/event';
import { LogManager } from './log-manager.ts';

export class MatchController extends EventEmitter<{ gameOver: [void] }> {
  private _effectsController: CardEffectController | undefined;
  private _effectsPipeline: EffectsPipeline | undefined;
  private _reactionManager: ReactionManager | undefined;
  private _interactivityController: CardInteractivityController | undefined;
  private _cardLibrary: CardLibrary = new CardLibrary();
  private _cardData: ExpansionCardData | undefined;
  private _config: MatchConfiguration | undefined;
  private _createCardFn: ((key: CardKey, card?: Omit<Partial<Card>, 'id'>) => Card) | undefined;
  private _fuse: Fuse<CardData & { cardKey: CardKey }> | undefined;
  private _logManager: LogManager | undefined;
  
  constructor(
    private _match: Match,
    private readonly _socketMap: Map<PlayerId, AppSocket>,
  ) {
    super();
  }
  
  public initialize(
    config: MatchConfiguration,
    cardData: ExpansionCardData,
  ) {
    const find = (key: CardKey, arr: (CardData & { cardKey: CardKey })[]) =>
      arr.findIndex(e => e.cardKey === key) > -1;
    
    const allExpansionCards = Object.keys(expansionData).reduce(
      (prev, expansionName) => {
        const expansion = expansionData[expansionName];
        const supply = expansion.cardData.supply;
        const kingdom = expansion.cardData.kingdom;
        
        prev = prev
          .concat(Object.keys(supply).filter(k => !find(k, prev)).map((k) => ({ ...supply[k], cardKey: k })))
          .concat(Object.keys(kingdom).filter(k => !find(k, prev)).map((k) => ({ ...kingdom[k], cardKey: k })));
        
        return prev;
      },
      [] as (CardData & { cardKey: CardKey })[],
    );
    
    const fuseOptions: IFuseOptions<CardData> = {
      ignoreDiacritics: true,
      minMatchCharLength: 1,
      distance: 5,
      keys: ['cardName']
    };
    
    this._fuse = new Fuse(allExpansionCards, fuseOptions);
    
    this._createCardFn = createCardFactory(cardData);
    this._cardData = cardData;
    const supplyCards = this.createBaseSupply(config);
    const kingdomCards = this.createKingdom(config);
    const playerCards = this.createPlayerDecks(config);
    
    config = {
      ...config,
      supplyCardKeys: supplyCards.reduce((prev, card) => {
        if (prev.includes(card.cardKey)) {
          return prev;
        }
        return prev.concat(card.cardKey);
      }, [] as string[]),
      kingdomCardKeys: kingdomCards.reduce((prev, card) => {
        if (prev.includes(card.cardKey)) {
          return prev;
        }
        return prev.concat(card.cardKey);
      }, [] as string[]),
    };
    
    this._match = {
      scores: [],
      trash: [],
      players: fisherYatesShuffle(config.players),
      supply: supplyCards.map((c) => c.id),
      kingdom: kingdomCards.map((c) => c.id),
      ...playerCards,
      config: config,
      turnNumber: 0,
      currentPlayerTurnIndex: 0,
      playerBuys: 0,
      playerTreasure: 0,
      playerActions: 0,
      turnPhaseIndex: 0,
      selectableCards: {},
      playArea: [],
      cardsPlayed: {},
    };
    
    this._config = config;
    
    console.log(
      `[MATCH] ready, sending to clients and listening for when clients are ready`,
    );
    
    this._socketMap.forEach((s) => {
      s.emit('setCardLibrary', this._cardLibrary.getAllCards());
      s.emit('matchReady', this._match);
      s.on('clientReady', this.onClientReady);
    });
  }
  
  public getMatchSnapshot(): Match {
    return structuredClone(this._match);
  }
  
  public broadcastPatch(prev: Match) {
    const patch: Operation[] = compare(prev, this._match);
    if (patch.length) {
      console.log(`[MATCH] sending match update to clients`);
      this._socketMap.forEach((s) => s.emit('matchPatch', patch));
    } else {
      console.debug(`[MATCH] no changes, not sending update to client`);
    }
  }
  
  public playerReconnected(playerId: PlayerId, socket: AppSocket) {
    console.log(`[MATCH] player ${playerId} reconnecting`);
    this._socketMap.set(playerId, socket);
    
    socket.emit('setCardLibrary', this._cardLibrary.getAllCards());
    socket.emit('matchReady', this._match);
    socket.on('clientReady', (_playerId: number, _ready: boolean) => {
      console.log(
        `[MATCH] ${
          this._match.players.find((player) => player.id === playerId)
        } marked ready`,
      );
      socket.emit('matchStarted');
      socket.off('clientReady');
      
      this.initializeSocketListeners(playerId, socket);
      
      this._interactivityController?.playerAdded(socket);
      
      if (
        this._match.players[this._match.currentPlayerTurnIndex].id === playerId
      ) {
        this._effectsController?.runGameActionEffects('checkForPlayerActions');
        this._interactivityController?.checkCardInteractivity();
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
    console.log(`[MATCH] ${leaving ?? `{id:${playerId}}`} has disconnected`);
    
    this._socketMap.get(playerId)?.offAnyIncoming();
    this._interactivityController?.playerRemoved(this._socketMap.get(playerId));
    this._socketMap.delete(playerId);
  }
  
  private createBaseSupply(config: MatchConfiguration) {
    console.log(`[MATCH] creating base supply cards`);
    const supplyCards: Card[] = [];
    
    const baseCardsDict =
      MatchBaseConfiguration.cards.supply.baseCards[config.players.length - 1];
    
    console.log(`[MATCH] base card dictionary counts`);
    console.log(baseCardsDict);
    
    Object.entries(baseCardsDict)
      .forEach(([key, count]) => {
        // copper come from the supply. we subtract those counts when
        // initially creating the supplies, and they get manually created later, estates
        // do not come from the supply, so they don't get subtracted here
        if (key === 'copper') {
          count -= config.players.length * MatchBaseConfiguration.playerStartingHand.copper;
          console.log(`[MATCH] setting copper count to ${count} due to number of players ${config.players.length}`,);
        }
        
        for (let i = 0; i < count; i++) {
          const c = this._createCardFn!(key);
          this._cardLibrary.addCard(c);
          supplyCards.push(c);
        }
        
        console.log(`[MATCH] created ${count} of card ${key}`);
      });
    return supplyCards;
  }
  
  private createKingdom({ players }: MatchConfiguration) {
    if (!this._cardData) {
      throw new Error('no card data available to match');
    }
    console.log(`[MATCH] creating kingdom cards`);
    
    const kingdomCards: Card[] = [];
    
    // todo: remove testing code
    const keepers: string[] = [].filter((k) =>
      this._cardData!.kingdom[k]
    );
    
    console.log(`[MATCH] choosing ${MatchBaseConfiguration.numberOfKingdomPiles} kingdom cards`);
    
    const availableKingdom = Object.keys(this._cardData.kingdom);
    
    console.log(`[MATCH] available kingdom cards\n${availableKingdom}`);
    
    let chosenKingdom = availableKingdom
      .sort(() => Math.random() > .5 ? 1 : -1)
      .slice(-MatchBaseConfiguration.numberOfKingdomPiles);
    
    console.log(`[MATCH] sorted and selected kingdom cards ${chosenKingdom}`);
    
    if (keepers.length) {
      console.log(`[MATCH] adding keeper cards ${keepers}`);
      
      const filteredKingdom = chosenKingdom.filter((k) => !keepers.includes(k));
      chosenKingdom = filteredKingdom.concat(keepers).slice(
        -MatchBaseConfiguration.numberOfKingdomPiles,
      );
    }
    
    console.log(`[MATCH] final chosen kingdom cards ${chosenKingdom}`);
    
    const finalKingdom = chosenKingdom.reduce((prev, key) => {
      prev[key] = this._cardData!.kingdom[key].type.includes('VICTORY')
        ? (players.length < 3 ? 8 : 12)
        : 10;
      
      console.log(
        `[MATCH] setting card count to ${prev[key]} for chosen card ${key}`,
      );
      return prev;
    }, {} as Record<string, number>);
    
    Object.entries(finalKingdom)
      .forEach(([key, count]) => {
        for (let i = 0; i < count; i++) {
          const c = this._createCardFn!(key);
          this._cardLibrary.addCard(c);
          kingdomCards.push(c);
        }
      });
    
    return kingdomCards;
  }
  
  private createPlayerDecks(config: MatchConfiguration) {
    console.log(`[MATCH] creating player decks`);
    
    const playerStartHand = MatchBaseConfiguration.playerStartingHand;
    console.log(`[MATCH] using player starting hand ${playerStartHand}`);
    
    return Object.values(config.players).reduce((prev, player, _idx) => {
      console.log('initializing player', player.id, 'cards...');
      /*let blah = {};
      // todo remove testing code
      if (_idx === 0) {
        blah = {
          moat: 3,
          militia: 3,
          gold: 5
        };
      } else {
        blah = {
          moat: 3,
          militia: 3,
          gold: 5
        };
      }
      Object.entries(blah).forEach(([key, count]) => {*/
          Object.entries(playerStartHand).forEach(
           ([key, count]) => {
          prev['playerDecks'][player.id] ??= [];
          let deck = prev['playerDecks'][player.id];
          deck = deck.concat(
            new Array(count).fill(0).map((_) => {
              const c = this._createCardFn!(key, { owner: player.id });
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
  
  private onClientReady = (playerId: number) => {
    const player = this._config?.players.find((player) =>
      player.id === playerId
    );
    
    console.log(`[MATCH] received clientReady event from ${player}`);
    
    if (!player) {
      console.error(`[MATCH] player not found`);
      return;
    }
    
    if (!this._config) {
      console.error(`[MATCH] no match config`);
      return;
    }
    
    player.ready = true;
    
    if (this._config.players.some((p) => !p.ready)) {
      console.log(
        `[MATCH] not all players marked ready, waiting for everyone`,
      );
      return;
    }
    
    console.log('[MATCH] all players ready');
    
    for (const socket of this._socketMap.values()) {
      socket.off('clientReady', this.onClientReady);
    }
    
    void this.startMatch();
  };
  
  private startMatch() {
    console.log(`[MATCH] starting match`);
    
    this._reactionManager = new ReactionManager(
      this._match,
      this._cardLibrary,
    );
    
    this._logManager = new LogManager({
      socketMap: this._socketMap,
    });
    
    const effectGeneratorMap = createEffectGeneratorMap({
      reactionManager: this._reactionManager,
      logManager: this._logManager
    });
    for (const [key, blueprint] of Object.entries(effectGeneratorBlueprintMap)) {
      effectGeneratorMap[key] = blueprint({
        reactionManager: this._reactionManager
      });
    }
    
    this._effectsController = new CardEffectController(
      effectGeneratorMap,
      this._cardLibrary,
      this._match,
    );
    
    this._interactivityController = new CardInteractivityController(
      this._effectsController,
      this._match,
      this._socketMap,
      this._cardLibrary,
      this.onCardTapHandlerComplete,
      this,
      effectGeneratorMap
    );
    
    const effectHandlerMap = createEffectHandlerMap(
      this._socketMap,
      this._reactionManager,
      effectGeneratorMap,
      this._cardLibrary,
      this._logManager
    );
    
    this._effectsPipeline = new EffectsPipeline(
      effectHandlerMap,
      this._socketMap,
      this.onEffectCompleted,
      this,
      this._match,
    );
    this._effectsController.setEffectPipeline(this._effectsPipeline);
    
    for (const [playerId, socket] of this._socketMap.entries()) {
      this.initializeSocketListeners(playerId, socket);
    }
    
    const prev = this.getMatchSnapshot();
    const match = this._match;
    match.playerBuys = 1;
    match.playerActions = 1;
    match.turnNumber = 1;
    this.broadcastPatch(prev);
    
    this._socketMap.forEach((s) => s.emit('matchStarted'));
    
    for (const player of match.players!) {
      for (let i = 0; i < 5; i++) {
        this._effectsController?.runGameActionEffects(
          'drawCard',
          player.id,
        );
      }
    }
    
    this._logManager.rootLog({
      type: 'newTurn',
      turn: match.turnNumber,
    });
    
    this._logManager.rootLog({
      type: 'newPlayerTurn',
      turn: match.turnNumber,
      playerId: match.players[match.currentPlayerTurnIndex].id
    });
    
    this._effectsController?.runGameActionEffects('checkForPlayerActions');
  }
  
  private onUserInputReceived = (signalId: string, input: unknown) => {
    console.log(`[MATCH] user input received for signal ${signalId}`);
    console.log(`[MATCH] input ${input}`);
    this._effectsPipeline?.resumeGenerator(signalId, input);
  }
  
  private onSearchCards = (playerId: PlayerId, searchStr: string) => {
    console.log(
      `[MATCH] searching cards for string '${searchStr}' for ${
        getPlayerById(this._match, playerId)
      }`,
    );
    
    const results = this._fuse?.search(searchStr);
    this._socketMap.get(playerId)?.emit(
      'searchCardResponse',
      results?.map((r) => r.item) ?? [],
    );
  };
  
  private onCardTapHandlerComplete = (_card: Card, _player: Player) => {
    console.log(`[MATCH] card tap complete handler invoked`);
    this._effectsController?.runGameActionEffects('checkForPlayerActions');
  };
  
  private onEffectCompleted = () => {
    console.log(`[MATCH] effect has completed, updating clients`);
    
    this.calculateScores();
    if (this.checkGameEnd()) return;
    this._interactivityController?.checkCardInteractivity();
  };
  
  private calculateScores() {
    console.log(`[MATCH] calculating scores`);
    
    const prev = this.getMatchSnapshot();
    const match = this._match;
    const scores: Record<number, number> = {};
    
    for (const player of match.players ?? []) {
      const playerId = player.id;
      const cards = this._cardLibrary.getCardsByOwner(playerId);
      /*const cards = (match.playerHands?.[playerId] ?? [])
        .concat(match.playerDecks?.[playerId] ?? [])
        .concat(match.playerDiscards?.[playerId] ?? [])
        .concat(match.playArea ?? []);*/
      
      let score = 0;
      for (const { id: cardId } of cards) {
        const card = this._cardLibrary.getCard(cardId);
        score += card.victoryPoints ?? 0;
        
        const customScoringFn = scoringFunctionMap[card?.cardKey ?? ''];
        if (customScoringFn) {
          console.log(`[MATCH] processing scoring function for ${card}`);
          score += customScoringFn({
            match: this._match,
            cardLibrary: this._cardLibrary,
            ownerId: playerId,
          });
        }
      }
      scores[playerId] = score;
    }
    
    match.scores = scores;
    
    this.broadcastPatch(prev);
  }
  
  private checkGameEnd() {
    console.log(`[MATCH] checking if the game has ended`);
    
    const match = this._match;
    
    if (
      match.supply.map((c) => this._cardLibrary.getCard(c)).filter((c) =>
        c.cardKey === 'province'
      ).length === 0
    ) {
      console.log(`[MATCH] supply has no more provinces, game over`);
      this.endGame();
      return true;
    }
    
    const allSupplyCardKeys = match.config.supplyCardKeys.concat(
      match.config.kingdomCardKeys,
    );
    
    console.log(`[MATCH] original supply card piles ${allSupplyCardKeys}`);
    
    const remainingSupplyCardKeys = match.supply.concat(match.kingdom).map((
      id,
    ) => this._cardLibrary.getCard(id).cardKey).reduce((prev, cardKey) => {
      if (prev.includes(cardKey)) {
        return prev;
      }
      return prev.concat(cardKey);
    }, [] as string[]);
    
    console.log(
      `[MATCH] remaining supply card piles ${remainingSupplyCardKeys}`,
    );
    
    const emptyPileCount = allSupplyCardKeys.length -
      remainingSupplyCardKeys.length;
    
    console.log(`[MATCH] empty pile count ${emptyPileCount}`);
    
    if (emptyPileCount === 3) {
      console.log(`[MATCH] three supply piles are empty, game over`);
      this.endGame();
      return true;
    }
    
    return false;
  }
  
  private endGame() {
    console.log(`[MATCH] ending the game`);
    
    this._effectsController?.endGame();
    this._reactionManager?.endGame();
    this._interactivityController?.endGame();
    
    console.log(`[MATCH] removing socket listeners for 'nextPhase'`);
    this._socketMap.forEach((s) => s.off('nextPhase'));
    
    console.log(`[MATCH] removing listener for match state updates`);
    
    const match = this._match;
    const currentTurn = match.turnNumber;
    const currentPlayerTurnIndex = match.currentPlayerTurnIndex;
    
    const summary: MatchSummary = {
      playerSummary: match.players.reduce((prev, player) => {
        const playerId = player.id;
        const turnsTaken = match.players.findIndex((p) =>
          p.id === playerId
        ) <= currentPlayerTurnIndex
          ? currentTurn
          : currentTurn - 1;
        
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
    
    console.log(`[MATCH] match summary created`);
    console.log(summary);
    
    this._socketMap.forEach((s) => s.emit('gameOver', summary));
    this.emit('gameOver');
  }
  
  private onNextPhase = () => {
    this._effectsController?.runGameActionEffects('nextPhase');
    this._socketMap.forEach(s => s.emit('nextPhaseComplete'));
  }
  
  private initializeSocketListeners(_playerId: PlayerId, socket: AppSocket) {
    socket.on('nextPhase', this.onNextPhase);
    socket.on('searchCards', this.onSearchCards);
    socket.on('userInputReceived', this.onUserInputReceived);
  }
}
