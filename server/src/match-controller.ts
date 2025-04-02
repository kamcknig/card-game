import {
  Card,
  CardId,
  Match,
  MatchConfiguration,
  MatchSummary,
  MatchUpdate,
  PlayerID,
  TurnPhaseOrderValues,
} from 'shared/shared-types.ts';
import { AppSocket, EffectHandlerMap, MatchBaseConfiguration, } from './types.ts';
import { CardEffectController } from './card-effects-controller.ts';
import { cardLibrary, loadExpansion } from './utils/load-expansion.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { createCard } from './utils/create-card.ts';
import { createEffectHandlerMap } from './effect-handler-map.ts';
import { EffectsPipeline } from './effects-pipeline.ts';
import { fisherYatesShuffle } from './utils/fisher-yates-shuffler.ts';
import { ReactionManager } from './reaction-manager.ts';
import { scoringFunctionMap } from './scoring-function-map.ts';
import { map } from 'nanostores';
import { getCardOverrides, removeOverrideEffects, } from './card-data-overrides.ts';

export class CardLibrary {
  private readonly _library: Map<CardId, Card> = new Map();

  public addCard = (card: Card) => {
    console.log(`[CARD LIBRARY] adding ${card} to library`);
    this._library.set(card.id, card);
  }

  public getCard = (cardId: CardId): Card => {
    const c = this._library.get(cardId);
    if (!c) throw new Error(`[CARD LIBRARY] unable to locate card ${cardId}`);
    return c;
  }

  public getAllCards = (): Record<number, Card> => {
    return Object.fromEntries(this._library) as Record<number, Card>;
  }
}

export class MatchController {
  private $matchState = map<Match>();
  private effectHandlerMap: EffectHandlerMap | undefined;
  private _effectsController: CardEffectController | undefined;
  private _effectsPipeline: EffectsPipeline | undefined;
  private _reactionManager: ReactionManager | undefined;
  private _interactivityController: CardInteractivityController | undefined;
  private _cleanup: (() => void)[] = [];
  private _cardLibrary: CardLibrary = new CardLibrary();
  private _config: MatchConfiguration | undefined;

  constructor(private readonly _socketMap: Map<PlayerID, AppSocket>) {}

  public async initialize(config: MatchConfiguration) {
    for (const expansionName of config.expansions) {
      await loadExpansion(expansionName);
    }

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
    
    this.$matchState.set({
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
      selectableCards: [],
      playArea: [],
      cardsPlayed: {},
    });

    this._config = config;
    
    console.log(
      `[MATCH] ready, sending to clients and listening for when clients are ready`,
    );

    this._socketMap.forEach((s) => {
      s.emit("setCardLibrary", this._cardLibrary.getAllCards());
      s.emit("matchReady", this.$matchState.get());
      s.on("clientReady", this.onClientReady);
    });
  }

  private createBaseSupply(config: MatchConfiguration) {
    console.log(`[MATCH] creating base supply cards`);
    const supplyCards: Card[] = [];

    const baseCardsDict =
      MatchBaseConfiguration.cards.supply.baseCards[config.players.length - 1];

    console.debug(`[MATCH] base card dictionary counts`);
    console.debug(baseCardsDict);

    Object.entries(baseCardsDict)
      .forEach(([key, count]) => {
        // copper come from the supply. we subtract those counts when
        // initially creating the supplies, and they get manually created later, estates
        // do not come from the supply, so they don't get subtracted here
        if (key === "copper") {
          count -= config.players.length *
            MatchBaseConfiguration.playerStartingHand.copper;
          console.debug(
            `[MATCH] setting copper count to ${count} due to number of players ${config.players.length}`,
          );
        }

        for (let i = 0; i < count; i++) {
          const c = createCard(key);
          this._cardLibrary.addCard(c);
          supplyCards.push(c);
        }

        console.debug(`[MATCH] created ${count} of card ${key}`);
      });
    return supplyCards;
  }

  private createKingdom({ players }: MatchConfiguration) {
    console.log(`[MATCH] creating kingdom cards`);

    const kingdomCards: Card[] = [];

    // todo: remove testing code
    const keepers: string[] = ['militia', 'moat', 'harbinger', 'sentry', 'pawn', 'replace'];

    console.debug(
      `[MATCH] choosing ${MatchBaseConfiguration.numberOfKingdomPiles} kingdom cards`,
    );

    const availableKingdom = Object.keys(cardLibrary["kingdom"]);
    console.debug(`[MATCH] available kingdom cards ${availableKingdom}`);

    const chosenKingdom = availableKingdom
      .sort(() => Math.random() > .5 ? 1 : -1)
      .slice(-MatchBaseConfiguration.numberOfKingdomPiles);
    
    console.debug(`[MATCH] sorted and selected kingdom cards ${chosenKingdom}`);
    
    if (keepers.length) {
      console.debug(`[MATCH] adding keeper cards ${keepers}`);
      
      const finalKeepers = keepers.filter(k => availableKingdom.includes(k));
      
      if (finalKeepers.length !== keepers.length) {
        console.debug(`[MATCH] final keepers ${finalKeepers}`);
      }
      
      for (const keeper of finalKeepers) {
        if (chosenKingdom.includes(keeper)) continue;
        chosenKingdom.unshift(keeper);
        chosenKingdom.pop();
      }
    }
    
    console.debug(`[MATCH] final chosen kingdom cards ${chosenKingdom}`);
    
     const finalKingdom = chosenKingdom.reduce((prev, key) => {
        prev[key] = cardLibrary["kingdom"][key].type.includes("VICTORY")
          ? (players.length < 3 ? 8 : 12)
          : 10;

        console.debug(
          `[MATCH] setting card count to ${prev[key]} for chosen card ${key}`,
        );
        return prev;
      }, {} as Record<string, number>);

    Object.entries(finalKingdom)
      .forEach(([key, count]) => {
        for (let i = 0; i < count; i++) {
          const c = createCard(key);
          this._cardLibrary.addCard(c);
          kingdomCards.push(c);
        }
      });

    return kingdomCards;
  }

  private createPlayerDecks(config: MatchConfiguration) {
    console.log(`[MATCH] creating player decks`);

    const playerStartHand = MatchBaseConfiguration.playerStartingHand;
    console.debug(`[MATCH] using player starting hand ${playerStartHand}`);

    return Object.values(config.players).reduce((prev, player, _idx) => {
      console.log("initializing player", player.id, "cards...");
      let blah = {};
      // todo remove testing code
      if (_idx === 0) {
        blah = {
          replace: 3,
          copper: 1,
          province: 1,
          estate: 1,
          duchy: 1,
          militia: 1,
          moat: 2,
          laboratory: 2
        };
      } else {
        blah = {
          militia: 3,
          copper: 3,
          silver: 3,
          moat: 5
        };
      }
      Object.entries(blah).forEach(([key, count]) => {
        /*Object.entries(playerStartHand).forEach(
        ([key, count]) => {*/
        prev["playerDecks"][player.id] ??= [];
        let deck = prev["playerDecks"][player.id];
        deck = deck.concat(
          new Array(count).fill(0).map((_) => {
            const c = createCard(key);
            this._cardLibrary.addCard(c);
            return c.id;
          }),
        );
        prev["playerDecks"][player.id] = fisherYatesShuffle(deck);
      });

      prev["playerHands"][player.id] = [];
      prev["playerDiscards"][player.id] = [];
      return prev;
    }, {
      playerHands: {},
      playerDecks: {},
      playerDiscards: {},
    } as Pick<Match, "playerHands" | "playerDiscards" | "playerDecks">);
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
      console.debug(
        `[MATCH] not all players marked ready, waiting for everyone`,
      );
      return;
    }

    console.debug("[MATCH] all players ready");

    for (const socket of this._socketMap.values()) {
      socket.off("clientReady", this.onClientReady);
    }

    void this.startMatch();
  };

  private async startMatch() {
    console.log(`[MATCH] starting match`);

    this._cleanup.push(this.$matchState.listen(this.onMatchUpdated));

    this._reactionManager = new ReactionManager(
      this.$matchState,
      this._cardLibrary,
    );

    this._effectsController = new CardEffectController(this._cardLibrary);

    this._interactivityController = new CardInteractivityController(
      this._effectsController,
      this.$matchState,
      this._socketMap,
      this._cardLibrary,
    );

    this.effectHandlerMap = createEffectHandlerMap(
      this._socketMap,
      this._reactionManager,
      this._effectsController,
      this._interactivityController,
      this._cardLibrary,
    );

    this._effectsPipeline = new EffectsPipeline(
      this.effectHandlerMap,
      this.$matchState,
      this._socketMap,
    );
    this._effectsController.setEffectPipeline(this._effectsPipeline);

    for (const socket of this._socketMap.values()) {
      socket.on("nextPhase", this.onNextPhase);
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

    this._socketMap.forEach((s) => s.emit("matchStarted", match));

    await this._effectsController?.suspendedCallbackRunner(async () => {
      for (const player of match.players!) {
        for (let i = 0; i < 5; i++) {
          await this._effectsController?.runGameActionEffects(
            "drawCard",
            match as Match,
            player.id,
          );
        }
      }
    });

    this.$matchState.set({ ...match });

    void this.onCheckForPlayerActions();
  }

  private onMatchUpdated = (match: MatchUpdate) => {
    console.log(`[MATCH] match updated handler`);
    this.calculateScores(match);
    this.checkGameEnd();
    void this.onCheckForPlayerActions();
  };

  private calculateScores(match: MatchUpdate) {
    console.log(`[MATCH] calculating scores`);

    const scores: Record<number, number> = {};

    for (const player of match.players ?? []) {
      const playerId = player.id;
      const cards = (match.playerHands?.[playerId] ?? [])
        .concat(match.playerDecks?.[playerId] ?? [])
        .concat(match.playerDiscards?.[playerId] ?? [])
        .concat(match.playArea ?? []);

      let score = 0;
      for (const cardId of cards) {
        const card = this._cardLibrary.getCard(cardId);
        score += card.victoryPoints ?? 0;

        const customScoringFn = scoringFunctionMap[card?.cardKey ?? ""];
        if (customScoringFn) {
          console.log(`[MATCH] processing scoring function for ${card}`);
          score += customScoringFn(match as Match, this._cardLibrary, playerId);
        }
      }
      scores[playerId] = score;
    }

    match.scores = scores;

    this._socketMap.forEach((s) => s.emit("matchUpdated", match));
  }

  private checkGameEnd() {
    console.log(`[MATCH] checking if the game has ended`);

    const match = this.$matchState.get();

    if (
      match.supply.map((c) => this._cardLibrary.getCard(c)).filter((c) =>
        c.cardKey === "province"
      ).length === 0
    ) {
      console.log(`[MATCH] supply has no more provinces, game over`);
      this.endGame();
      return;
    }
    const allSupplyCardKeys = match.config.supplyCardKeys.concat(
      match.config.kingdomCardKeys,
    );

    console.debug(`[MATCH] original supply card piles ${allSupplyCardKeys}`);

    const remainingSupplyCardKeys = match.supply.concat(
      match.kingdom,
    ).map((id) => this._cardLibrary.getCard(id).cardKey).reduce(
      (prev, cardKey) => {
        if (prev.includes(cardKey)) {
          return prev;
        }
        return prev.concat(cardKey);
      },
      [] as string[],
    );

    console.debug(
      `[MATCH] remaining supply card piles ${remainingSupplyCardKeys}`,
    );

    const emptyPileCount = allSupplyCardKeys.length -
      remainingSupplyCardKeys.length;

    console.debug(`[MATCH] empty pile count ${emptyPileCount}`);

    if (emptyPileCount === 3) {
      console.log(`[MATCH] three supply piles are empty, game over`);
      this.endGame();
    }
  }

  private endGame() {
    console.log(`[MATCH] ending the game`);

    this._effectsController?.endGame();
    this._reactionManager?.endGame();
    this._interactivityController?.endGame();

    console.debug(`[MATCH] removing socket listeners for 'nextPhase'`);
    this._socketMap.forEach((s) => s.off("nextPhase"));

    console.debug(`[MATCH] removing listener for match state updates`);
    this._cleanup.forEach((cb) => cb());

    const match = this.$matchState.get();
    const currentTurn = match.turnNumber;
    const currentPlayerTurnIndex = match.currentPlayerTurnIndex;

    const summary: MatchSummary = {
      scores: match.players.reduce((prev, player) => {
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
      }, [] as MatchSummary["scores"])
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

    console.debug(`[MATCH] match summary created`);
    console.debug(summary);

    this._socketMap.forEach((s) => s.emit("gameOver", summary));
  }

  private async onCheckForPlayerActions() {
    console.log("[MATCH] checking for remaining player actions");

    const match = this.$matchState.get();
    const turnPhase = TurnPhaseOrderValues[match.turnPhaseIndex];
    const player = match.players[match.currentPlayerTurnIndex];

    switch (turnPhase) {
      case "action": {
        const numActionCards =
          match.playerHands[player.id].filter((c) =>
            this._cardLibrary.getCard(c).type.includes("ACTION")
          ).length;

        console.debug(
          `[MATCH] player ${player.id} has ${match.playerActions} actions and ${numActionCards} action cards`,
        );

        if (numActionCards <= 0 || match.playerActions <= 0) {
          console.log(`[MATCH] skipping to next phase`);
          await this.onNextPhase(match);
          return;
        }
        break;
      }
      case "buy": {
        const treasureCardCount =
          match.playerHands[player.id].filter((c) =>
            this._cardLibrary.getCard(c).type.includes("TREASURE")
          ).length;

        console.debug(
          `[MATCH] player ${player.id} has ${treasureCardCount} treasure cards in hand, ${match.playerTreasure} treasure, and ${match.playerBuys} buys`,
        );

        if (
          (treasureCardCount <= 0 && match.playerTreasure <= 0) ||
          match.playerBuys <= 0
        ) {
          console.log("[MATCH] skipping to next phase");
          await this.onNextPhase(match);
          return;
        }
        break;
      }
    }
  }

  private onNextPhase = async (update?: MatchUpdate) => {
    console.log(`[MATCH] next phase handler invoked`);

    const currentMatch = this.$matchState.get() as Match;

    try {
      const match: MatchUpdate = {
        ...update,
      };

      match.turnPhaseIndex = currentMatch.turnPhaseIndex + 1;

      if (match.turnPhaseIndex === TurnPhaseOrderValues.length) {
        console.debug(
          "[MATCH] no more phases in turn, resetting turn phase to 0",
        );
        match.turnPhaseIndex = 0;
      }

      console.debug(`[MATCH] new turn phase index ${match.turnPhaseIndex}`);

      const newPhase = TurnPhaseOrderValues[match.turnPhaseIndex];

      console.log(`[MATCH] new turn phase ${newPhase}`);

      const player = currentMatch.players[currentMatch.currentPlayerTurnIndex];

      switch (newPhase) {
        case "action":
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
            console.log(`[MATCH] starting new round ${match.turnNumber}`);
          }

          break;
        case "buy":
          break;
        case "cleanup": {
          const cardsToDiscard = currentMatch.playArea.concat(
            currentMatch.playerHands[player.id],
          );

          await this._effectsController?.suspendedCallbackRunner(
            async () => {
              for (const cardId of cardsToDiscard) {
                await this._effectsController!.runGameActionEffects(
                  "discardCard",
                  this.$matchState.get(),
                  player.id,
                  cardId,
                );
              }

              for (let i = 0; i < 5; i++) {
                await this._effectsController!.runGameActionEffects(
                  "drawCard",
                  this.$matchState.get(),
                  player.id,
                );
              }

              const newMatch = { ...this.$matchState.get(), ...match };
              this.$matchState.set(newMatch);
              this.endTurn(newMatch);
              await this.onNextPhase(match);
            },
          );

          return;
        }
      }

      this._socketMap.forEach((s) => s.emit("matchUpdated", match));
      this.$matchState.set({ ...this.$matchState.get(), ...match });
    } catch (e) {
      console.error("[MATCH] Could not move to next phase", e);
      console.error(e);
    }
  };

  private endTurn = (match: Match) => {
    removeOverrideEffects("TURN_END");

    const overrides = getCardOverrides(match, this._cardLibrary);
    for (const { id } of match.players) {
      const playerOverrides = overrides?.[id];
      const socket = this._socketMap.get(id);
      socket?.emit("setCardDataOverrides", playerOverrides);
    }
  };

  public playerReconnected(playerId: number, socket: AppSocket) {
    console.log(`[MATCH] player ${playerId} reconnecting`);
    this._socketMap.set(playerId, socket);

    const match = this.$matchState.get();

    socket.emit("setCardLibrary", this._cardLibrary.getAllCards());
    socket.emit("matchReady", match);
    socket.on("clientReady", (_playerId: number, _ready: boolean) => {
      console.log(
        `[MATCH] ${
          match.players.find((player) => player.id === playerId)
        } marked ready`,
      );
      socket.emit("matchStarted", match);
      socket.off("clientReady");

      socket.on("nextPhase", this.onNextPhase);

      this._interactivityController?.playerAdded(playerId, socket);

      if (match.players[match.currentPlayerTurnIndex].id === playerId) {
        void this.onCheckForPlayerActions();
      }

      this.$matchState.set({ ...this.$matchState.get() });
    });
  }

  public playerDisconnected(playerId: number, socket: AppSocket | undefined) {
    this._interactivityController?.playerRemoved(playerId, socket);
    this._socketMap.delete(playerId);
  }
}
