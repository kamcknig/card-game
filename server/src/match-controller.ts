import {
  Card,
  Match,
  MatchConfiguration,
  MatchSummary,
  MatchUpdate,
  Player,
  TurnPhaseOrderValues,
} from 'shared/shared-types.ts';
import { EffectHandlerMap, MatchBaseConfiguration } from './types.ts';
import { CardEffectController } from './card-effects-controller.ts';
import { cardLibrary, loadExpansion } from './utils/load-expansion.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { createCard } from './utils/create-card.ts';
import { createEffectHandlerMap } from './effect-handler-map.ts';
import { EffectsPipeline } from './effects-pipeline.ts';
import { fisherYatesShuffle } from './utils/fisher-yates-shuffler.ts';
import { getPlayerById } from './utils/get-player-by-id.ts';
import { ReactionManager } from './reaction-manager.ts';
import { scoringFunctionMap } from './scoring-function-map.ts';
import { sendToSockets } from './utils/send-to-sockets.ts';
import { Socket } from 'socket.io';
import { getGameState } from './utils/get-game-state.ts';
import { map } from 'nanostores';
import { getTurnPhase } from './utils/get-turn-phase.ts';
import { getCurrentPlayerId } from './utils/get-current-player-id.ts';

export class MatchController {
  private $matchState = map<Match>();
  private effectHandlerMap: EffectHandlerMap | undefined;
  private _effectsController: CardEffectController | undefined;
  private _effectsPipeline: EffectsPipeline | undefined;
  private _reactionManager: ReactionManager | undefined;
  private _interactivityController: CardInteractivityController | undefined;
  private _cleanup: (() => void)[] = [];

  constructor(
    private readonly sockets: Socket[],
  ) {
    (globalThis as any).matchState = this.$matchState;
  }

  public async initialize(matchConfig: MatchConfiguration) {
    for (const expansionName of matchConfig.expansions) {
      await loadExpansion(expansionName);
    }

    const supplyCards = this.createBaseSupply();

    const kingdomCards = this.createKingdom(getGameState().players);

    const cardsById: Record<number, Card> = {};
    supplyCards.forEach((card) => {
      cardsById[card.id] = card;
    });
    kingdomCards.forEach((card) => {
      cardsById[card.id] = card;
    });

    const playerCards = this.createPlayerHands(cardsById);

    matchConfig = {
      ...matchConfig,
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

    this.$matchState.set({
      scores: [],
      trash: [],
      players: fisherYatesShuffle(
        getGameState().players.filter((p) => p.connected),
      ).map((p: Player) => p.id),
      supply: supplyCards.map((c) => c.id),
      kingdom: kingdomCards.map((c) => c.id),
      ...playerCards,
      config: matchConfig,
      turnNumber: 0,
      currentPlayerTurnIndex: 0,
      activePlayerId: 0,
      playerBuys: 0,
      playerTreasure: 0,
      playerActions: 0,
      turnPhaseIndex: 0,
      selectableCards: [],
      playArea: [],
      cardsById,
    });

    sendToSockets(this.sockets.values(), 'matchReady', this.$matchState.get());

    for (const socket of this.sockets) {
      socket.on('clientReady', this.onClientReady);
    }
  }

  private createBaseSupply() {
    const supplyCards: Card[] = [];
    Object.entries(
      MatchBaseConfiguration.cards.supply
        .baseCards[getGameState().players.length - 1],
    )
      .forEach(([key, count]) => {
        // copper come from the supply. we subtract those counts when
        // initially creating the supplies, and they get manually created later, estates
        // do not come from the supply, so they don't get subtracted here
        if (key === 'copper') {
          count -= getGameState().players.length *
            MatchBaseConfiguration.playerStartingHand.copper;
          console.debug(
            'Setting copper count to',
            count,
            'due to number of players',
          );
        }

        for (let i = 0; i < count; i++) {
          const c = createCard(key);
          console.debug(`created card ${c}`);
          supplyCards.push(c);
        }

        console.log(`created ${count} of card ${key}`);
      });
    return supplyCards;
  }

  private createKingdom(players: Player[]) {
    const kingdomCards: Card[] = [];
    // todo: remove testing code
    const keepers: string[] = ['militia'];
    const chosenKingdom = Object.keys(cardLibrary['kingdom'])
      .sort((a, b) =>
        keepers.includes(a)
          ? 1
          : keepers.includes(b)
          ? -1
          : Math.random() > .5
          ? 1
          : -1
      )
      .slice(-MatchBaseConfiguration.numberOfKingdomPiles)
      .reduce((prev, key) => {
        prev[key] = cardLibrary['kingdom'][key].type.includes('VICTORY')
          ? (players.length < 3 ? 8 : 12)
          : 10;
        return prev;
      }, {} as Record<string, number>);

    console.log('configured kingdom', chosenKingdom);

    Object.entries(chosenKingdom)
      .forEach(([key, count]) => {
        console.log('creating', count, key);
        for (let i = 0; i < count; i++) {
          const c = createCard(key);
          console.debug(`created kingdom card ${c}`);
          kingdomCards.push(c);
        }
      });

    return kingdomCards;
  }

  private createPlayerHands(cardsById: Record<number, Card>) {
    return Object.values(getGameState().players).reduce((prev, player, idx) => {
      console.log('initializing player', player.id, 'cards...');
      // let blah = {};
      // // todo remove testing code
      // if (idx === 0) {
      //   blah = {
      //     silver: 10,
      //   };
      // }
      //
      // if (idx === 1) {
      //   blah = {
      //     estate: 5,
      //     copper: 5,
      //   };
      // }
      // Object.entries(blah).forEach(([key, count]) => {
        Object.entries(MatchBaseConfiguration.playerStartingHand).forEach(([key, count]) => {
        console.log('adding', count, key, 'to deck');
        prev['playerDecks'][player.id] ??= [];
        let deck = prev['playerDecks'][player.id];
        deck = deck.concat(
          new Array(count).fill(0).map((_) => {
            const c = createCard(key);
            console.debug(`adding card ${c} to ${player}`);
            cardsById[c.id] = c;
            return c.id;
          }),
        );
        prev['playerDecks'][player.id] = fisherYatesShuffle(deck);
      });

      prev['playerHands'][player.id] = [];
      prev['playerDiscards'][player.id] = [];
      return prev;
    }, {
      playerHands: {},
      playerDecks: {},
      playerDiscards: {},
    } as Pick<Match, 'playerHands' | 'playerDiscards' | 'playerDecks'>);
  }

  private onClientReady = async (playerId: number) => {
    const player = getPlayerById(playerId);
    if (player) {
      player.ready = true;
    }

    console.log(`${player} has been marked ready`);

    if (getGameState().players.some((p) => !p.ready)) {
      return;
    }

    console.log('all players ready');
    
    for (const socket of this.sockets) {
      socket.off('clientReady', this.onClientReady);
    }
    
    this._cleanup.push(this.$matchState.listen(this.onMatchUpdated));
    
    this._effectsController = new CardEffectController(this.$matchState);
    this._reactionManager = new ReactionManager(this.$matchState);
    
    this.effectHandlerMap = createEffectHandlerMap(
      this.sockets,
      this._reactionManager,
      this._effectsController,
      this.$matchState,
    );

    this._effectsPipeline = new EffectsPipeline(
      this.effectHandlerMap,
      this.$matchState,
      this.sockets
    );
    this._effectsController.setEffectPipeline(this._effectsPipeline);

    this._interactivityController = new CardInteractivityController(
      this._effectsController,
      this.$matchState,
      this.sockets,
    );

    for (const socket of this.sockets) {
      socket.on('nextPhase', this.onNextPhase);
    }

    const match = {
      ...this.$matchState.get() ?? {},
      turnNumber: 1,
      currentPlayerTurnIndex: 0,
      playerActions: 1,
      playerBuys: 1,
      turnPhaseIndex: 0,
      playerTreasure: 0,
    };

    sendToSockets(this.sockets.values(), 'matchStarted', match as Match);

    await this._effectsController?.suspendedCallbackRunner(async () => {
      for (const playerId of match.players!) {
        for (let i = 0; i < 5; i++) {
          await this._effectsController?.runGameActionEffects(
            'drawCard',
            match as Match,
            playerId,
          );
        }
      }
    });

    this.$matchState.set({ ...match });

    void this.onCheckForPlayerActions();
  }

  private onMatchUpdated = (match: MatchUpdate) => {
    this.calculateScores(match);
    this.checkGameEnd();
    void this.onCheckForPlayerActions();
  }

  private calculateScores(match: MatchUpdate) {
    const scores: Record<number, number> = {};

    for (const playerId of match.players ?? []) {
      const cards = (match.playerHands?.[playerId] ?? [])
        .concat(match.playerDecks?.[playerId] ?? [])
        .concat(match.playerDiscards?.[playerId] ?? [])
        .concat(match.playArea ?? []);
      let score = 0;
      for (const cardId of cards) {
        const card = match.cardsById?.[cardId];
        score += card?.victoryPoints ?? 0;

        const customScoringFn = scoringFunctionMap[card?.cardKey ?? ''];
        if (customScoringFn) {
          console.log(`processing scoring function for ${card}`);
          score += customScoringFn(match as Match, playerId);
        }
      }
      scores[playerId] = score;
    }
    
    match.scores = scores;

    // todo only send update if scores differ
    sendToSockets(this.sockets.values(), 'scoresUpdated', scores);
  }

  private checkGameEnd() {
    console.log(`checking if the game has ended`);
    
    const match = this.$matchState.get();
    const cardsById = match.cardsById;
    if (
      match.supply.map((c) => cardsById[c]).filter((c) =>
        c.cardKey === 'province'
      ).length === 0
    ) {
      console.log(`supply has no more provinces, game over`);
      this.endGame();
      return;
    }
    const allSupplyCardKeys = match.config.supplyCardKeys.concat(
      match.config.kingdomCardKeys,
    );

    console.debug(`original supply card piles ${allSupplyCardKeys}`);

    const remainingSupplyCardKeys = match.supply.concat(
      match.kingdom,
    ).map((id) => cardsById[id].cardKey).reduce((prev, cardKey) => {
      if (prev.includes(cardKey)) {
        return prev;
      }
      return prev.concat(cardKey);
    }, [] as string[]);

    console.debug(`remaining supply card piles ${remainingSupplyCardKeys}`);

    const emptyPileCount = allSupplyCardKeys.length -
      remainingSupplyCardKeys.length;

    console.debug(`empty pile count ${emptyPileCount}`);

    if (emptyPileCount === 3) {
      console.log(`three supply piles are empty, game over`);
      this.endGame();
    }
  }

  private endGame() {
    console.log(`ending game`);
    
    this._effectsController?.endGame();
    this._reactionManager?.endGame();
    this._interactivityController?.endGame();
    
    console.debug(`removing socket listeners for 'nextPhase'`);
    for (const socket of this.sockets) {
      socket.off('nextPhase', this.onNextPhase);
    }
    
    console.debug(`removing listener for match state updates`);
    this._cleanup.forEach(cb => cb());
    
    const match = this.$matchState.get();
    const currentTurn = match.turnNumber;
    const currentPlayerTurnIndex = match.currentPlayerTurnIndex;
    
    const summary: MatchSummary = {
      scores: match.players.reduce((prev, playerId) => {
        const turnsTaken = match.players.findIndex(p => p === playerId) <= currentPlayerTurnIndex ? currentTurn : currentTurn - 1;
        prev.push({
          playerId,
          turnsTaken,
          score: match.scores[playerId],
          deck: match.playerDecks[playerId].concat(match.playerHands[playerId], match.playerDiscards[playerId])
        });
        return prev;
      }, [] as MatchSummary['scores'])
        .sort((a, b) => {
          if (a.score < b.score) return -1;
          if (b.score < a.score) return 1;
          if (a.turnsTaken < b.turnsTaken) return -1;
          if (b.turnsTaken < a.turnsTaken) return 1;
          const aIdx = match.players.findIndex(id => id === a.playerId);
          const bIdx = match.players.findIndex(id => id === b.playerId);
          if (aIdx < bIdx) return -1;
          if (bIdx < aIdx) return 1;
          return 0;
        })
    };
    
    console.log(summary);

    sendToSockets(this.sockets.values(), 'gameOver', { ...summary });
  }

  private async onCheckForPlayerActions() {
    console.log('checking for remaining player actions');

    const match = this.$matchState.get();
    const turnPhase = getTurnPhase(match);
    const playerId = getCurrentPlayerId(match);

    switch (turnPhase) {
      case 'action': {
        const numActionCards =
          match.playerHands[playerId].filter((c) =>
            match.cardsById[c].type.includes('ACTION')
          ).length;

        console.debug(
          `player ${
            getPlayerById(playerId)
          } has ${match.playerActions} actions and ${numActionCards} action cards`,
        );

        if (numActionCards <= 0 || match.playerActions <= 0) {
          console.log(`skipping to next phase`);
          await this.onNextPhase(match);
          return;
        }
        break;
      }
      case 'buy': {
        const treasureCardCount =
          match.playerHands[playerId].filter((c) =>
            match.cardsById[c].type.includes('TREASURE')
          ).length;

        console.debug(
          `player ${
            getPlayerById(playerId)
          } has ${treasureCardCount} treasure cards in hand, ${match.playerTreasure} treasure, and ${match.playerBuys} buys`,
        );

        if (
          (treasureCardCount <= 0 && match.playerTreasure <= 0) ||
          match.playerBuys <= 0
        ) {
          console.log('skipping to next phase');
          await this.onNextPhase(match);
          return;
        }
        break;
      }
    }
  }

  private onNextPhase = async (update?: MatchUpdate) => {
    const currentMatch = this.$matchState.get() as Match;

    try {
      const match: MatchUpdate = {
        ...update,
      };

      match.turnPhaseIndex = currentMatch.turnPhaseIndex + 1;

      if (match.turnPhaseIndex === TurnPhaseOrderValues.length) {
        console.debug('no more phases in turn, resetting turn phase to 0');
        match.turnPhaseIndex = 0;
      }

      console.debug(`new turn phase index ${match.turnPhaseIndex}`);

      const newPhase = getTurnPhase(match as unknown as any);

      console.log(`new turn phase ${newPhase}`);

      let playerId = getCurrentPlayerId(currentMatch);

      switch (newPhase) {
        case 'action':
          match.playerActions = 1;
          match.playerBuys = 1;
          match.playerTreasure = 0;
          match.currentPlayerTurnIndex = currentMatch.currentPlayerTurnIndex +
            1;

          if (match.currentPlayerTurnIndex === currentMatch.players.length) {
            match.currentPlayerTurnIndex = 0;
          }

          if (match.currentPlayerTurnIndex === 0) {
            match.turnNumber = currentMatch.turnNumber + 1;
            console.log(`starting new round ${match.turnNumber}`);
          }

          playerId = getCurrentPlayerId(
            { ...currentMatch, ...match } as unknown as any,
          );
          break;
        case 'buy':
          break;
        case 'cleanup': {
          const cardsToDiscard = currentMatch.playArea.concat(
            currentMatch.playerHands[playerId],
          );

          await this._effectsController?.suspendedCallbackRunner(
            async () => {
              for (const cardId of cardsToDiscard) {
                await this._effectsController!.runGameActionEffects(
                  'discardCard',
                  this.$matchState.get(),
                  playerId,
                  cardId,
                );
              }

              for (let i = 0; i < 5; i++) {
                await this._effectsController!.runGameActionEffects(
                  'drawCard',
                  this.$matchState.get(),
                  playerId,
                );
              }

              this.$matchState.set({ ...this.$matchState.get(), ...match });
              await this.onNextPhase(match);
            },
          );

          return;
        }
      }

      sendToSockets(this.sockets.values(), 'matchUpdated', match);
      this.$matchState.set({ ...this.$matchState.get(), ...match });
    } catch (e) {
      console.error('Could not move to next phase', e);
      console.error(e);
    }
  }
}
