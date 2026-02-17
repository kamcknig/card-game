import {
  Card,
  CardId,
  CardKey,
  CardNoId,
  ComputedMatchConfiguration,
  Match,
  MatchConfiguration,
  MatchSummary,
  PlayerId,
  SelectActionCardArgs,
  ServerListenEvents,
  UserPromptActionArgs,
} from 'shared/types/index.ts';
import { MatchConfigurator } from './match-configurator.ts';
import { getCurrentPlayer } from '../utils/get-current-player.ts';
import { fisherYatesShuffle } from '../utils/fisher-yates-shuffler.ts';
import { scoringFunctionMap } from '@expansions/scoring-function-map.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import jsonPatch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';
import { getPlayerById } from '../utils/get-player-by-id.ts';
import { EventEmitter } from '@denosaurs/event';
import {
  AppSocket,
  EndGameConditionFn,
  FindCardService,
  SupplyGainService,
  GameActionDefinitionMap,
  GameActionReturnTypeMap,
  GameActions,
  GameLifecycleCallback,
  GameLifecycleEvent,
  MatchBaseConfiguration,
  PlayerScoreDecorator,
} from '@server-types/index.ts';
import {
  createArtifact,
  createBoon,
  createCard,
  createEvent,
  createHex,
  createLandmark,
  createProject,
  createState,
} from '../utils/create-card.ts';
import { CardSourceController } from './card-source-controller.ts';
import { tokenDefinitionMap } from './tokens/token-definition-map.ts';
import { prosperityTokenIds } from '@expansions/prosperity/token-prosperity-ids.ts';
import { renaissanceTokenIds } from '@expansions/renaissance/token-ids-renaissance.ts';
import { MatchRuntimeFactory } from './match-runtime-factory.ts';
import { ReactionManager } from './reactions/reaction-manager.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { LogManager } from './log-manager.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { GameActionController } from './actions/game-action-controller.ts';
import { MatchConfiguratorFactory } from './match-configurator-factory.ts';
import { EndGameEvaluatorService } from './end-game-evaluator-service.ts';
import { PlayerReconnectOrchestrator } from './player-reconnect-orchestrator.ts';

export class MatchController extends EventEmitter<{ gameOver: [void] }> {
  private _cardLibSnapshot = {};
  private _matchSnapshot: Match | null | undefined;
  private _reactionManager: ReactionManager | undefined;
  private _interactivityController: CardInteractivityController | undefined;
  private _logManager: LogManager | undefined;
  private _gameActionsController: GameActionController | undefined;
  private _matchConfiguration: ComputedMatchConfiguration | undefined;
  private _expansionEndGameConditionFns: EndGameConditionFn[] = [];
  private _cardPriceController: CardPriceRulesController | undefined;
  private _matchConfigurator: MatchConfigurator | undefined;
  private _endGameEvaluator: EndGameEvaluatorService | undefined;
  private _playerReconnectOrchestrator: PlayerReconnectOrchestrator | undefined;
  private _expansionScoringFns: PlayerScoreDecorator[] = [];
  private _registeredEvents: (keyof ServerListenEvents)[] = [];
  private _findCardService: FindCardService = {
    findCards: (...args) => [],
    getCardsInPlay: () => [],
    getRemainingSupplyCount: () => 0,
    findTopSupplyCardForPileKey: () => undefined,
  };
  private _supplyGainService: SupplyGainService = {
    gainTopSupplyCardForPileKey: async () => undefined,
  };
  // Tracks nested runGameAction calls to avoid corrupting patch snapshots.
  private _actionDepth: number = 0;
  // Cached match state override loaded from disk, if provided.
  private _loadedMatchState: { match: Match; cardLibrary: Record<CardId, Card> } | null = null;

  private _playerHands: Record<CardKey, number>[] = [
    /*{
      gold: 4,
      silver: 3,
      estate: 3,
    },
    {
      gold: 4,
      silver: 3,
      estate: 3,
    },*/
  ];

  constructor(
    private readonly socketMap: Map<PlayerId, AppSocket>,
    private readonly matchRuntimeFactory: MatchRuntimeFactory,
    private readonly matchConfiguratorFactory: MatchConfiguratorFactory,
    private readonly match: Match,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly cardSourceController: CardSourceController,
  ) {
    super();
  }

  // Returns true for non-null plain object values.
  private static isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  // Validates that a partial match update only includes keys present in the live match structure.
  private static validatePartialMatch(
    partial: unknown,
    base: unknown,
    pathPrefix = '',
    allowExtraKeys = false,
  ): string[] {
    const errors: string[] = [];
    if (!MatchController.isPlainObject(partial)) {
      return errors;
    }
    const baseObj = MatchController.isPlainObject(base) ? base : undefined;
    for (const [key, val] of Object.entries(partial)) {
      // Prevent prototype pollution paths from being accepted.
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        errors.push(`${pathPrefix}${key}`);
        continue;
      }
      if (!allowExtraKeys && (!baseObj || !(key in baseObj))) {
        errors.push(`${pathPrefix}${key}`);
        continue;
      }
      const baseVal = baseObj ? (baseObj as Record<string, unknown>)[key] : undefined;
      if (MatchController.isPlainObject(val) && MatchController.isPlainObject(baseVal)) {
        errors.push(...MatchController.validatePartialMatch(val, baseVal, `${pathPrefix}${key}.`, allowExtraKeys));
      }
    }
    return errors;
  }

  // Deep merges a partial match into the live match state without mutating arrays by reference.
  private static mergePartialMatch(target: Record<string, unknown>, patch: Record<string, unknown>) {
    for (const [key, value] of Object.entries(patch)) {
      // Prevent prototype pollution paths from being merged.
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        target[key] = structuredClone(value);
        continue;
      }
      if (MatchController.isPlainObject(value)) {
        const existing = target[key];
        if (MatchController.isPlainObject(existing)) {
          MatchController.mergePartialMatch(existing, value);
        } else {
          target[key] = structuredClone(value);
        }
        continue;
      }
      target[key] = value;
    }
  }

  public async initialize(config: MatchConfiguration) {
    this.broadcastPatch({} as Match);

    const snapshot = this.getMatchSnapshot();
    // Load an optional match override from disk for local dev/debugging.
    this._loadedMatchState = await this.tryLoadMatchStateOverride();

    const runtime = this.matchRuntimeFactory.create({
      socketMap: this.socketMap,
      match: this.match,
      cardLibrary: this.cardLibrary,
      cardSourceController: this.cardSourceController,
      runGameActionDelegate: (action, ...args) => this.runGameAction(action as any, ...(args as any)),
    });

    this._logManager = runtime.logManager;
    this._cardPriceController = runtime.cardPriceController;
    this._findCardService = runtime.findCardService;
    this._supplyGainService = runtime.supplyGainService;
    this._reactionManager = runtime.reactionManager;
    this._endGameEvaluator = runtime.endGameEvaluator;
    this._interactivityController = runtime.interactivityController;
    this._playerReconnectOrchestrator = runtime.playerReconnectOrchestrator;
    this._gameActionsController = runtime.gameActionsController;

    this._matchConfigurator = this.matchConfiguratorFactory.create(config);

    const { config: newConfig } = await this._matchConfigurator.createConfiguration({
      match: this.match,
      cardSourceController: this.cardSourceController,
      gameEventRegistrar: (event: GameLifecycleEvent, handler: GameLifecycleCallback) =>
        this._reactionManager?.registerGameEvent(event, handler),
      clientEventRegistrar: (event, handler) => this.clientEventRegistrar(event, handler),
      endGameConditionRegistrar: (val) => this._expansionEndGameConditionFns.push(val),
      cardEffectRegistrar: (...args) => this._gameActionsController?.registerCardEffect(...args),
      boonEffectRegistrar: (cardKey, effectFn) => this._gameActionsController?.registerBoonEffect(cardKey, effectFn),
      hexEffectRegistrar: (cardKey, effectFn) => this._gameActionsController?.registerHexEffect(cardKey, effectFn),
      stateEffectRegistrar: (cardKey, effectFn) => this._gameActionsController?.registerStateEffect(cardKey, effectFn),
      artifactEffectRegistrar: (cardKey, effectFn) =>
        this._gameActionsController?.registerArtifactEffect(cardKey, effectFn),
      projectEffectRegistrar: (cardKey, effectFn) =>
        this._gameActionsController?.registerProjectEffect(cardKey, effectFn),
      playerScoreDecoratorRegistrar: (val: PlayerScoreDecorator) => this._expansionScoringFns.push(val),
    });

    // Use the loaded match state if provided; otherwise build a fresh match state.
    if (this._loadedMatchState) {
      this.applyLoadedMatchState(this._loadedMatchState.match);
      this.loadCardLibraryFromState(this._loadedMatchState.cardLibrary);
      this._matchConfiguration = this._loadedMatchState.match.config ?? newConfig;
      // Ensure match config is always populated for downstream logic.
      this.match.config = this.match.config ?? this._matchConfiguration;
    } else {
      this._matchConfiguration = newConfig;

      this.match.players = this._matchConfiguration.players;
      this.createBaseSupply(this._matchConfiguration);
      this.createKingdom(this._matchConfiguration);
      this.createEvents(this._matchConfiguration);
      // Landmarks are landscape card-likes that should be created alongside events.
      this.createLandmarks(this._matchConfiguration);
      // Projects are landscape card-likes that should be created alongside events.
      this.createProjects(this._matchConfiguration);
      // Boons are initialized after events/landmarks if Fate cards are present.
      this.createBoons(this._matchConfiguration);
      // Hexes are initialized after boons if Doom cards are present.
      this.createHexes(this._matchConfiguration);
      // States are initialized after boons/hexes for any state-granting cards.
      this.createStates(this._matchConfiguration);
      // Artifacts are initialized after states for any artifact-granting cards.
      this.createArtifacts(this._matchConfiguration);
      this.createNonSupplyCards(this._matchConfiguration);
      this.createPlayerDecks(this._matchConfiguration);
      this.match.config = this._matchConfiguration;
    }

    console.log(`[match] ready, sending to clients and listening for when clients are ready`);

    this.broadcastPatch(snapshot);

    this.socketMap.forEach((s) => {
      s.emit('setCardLibrary', this.cardLibrary.getAllCards());
      s.emit('setTokenDefinitions', tokenDefinitionMap);
      s.emit('matchReady');
      s.on('clientReady', this.onClientReady);
    });
  }

  // Attempts to load a match state JSON override from disk for development.
  private async tryLoadMatchStateOverride(): Promise<{ match: Match; cardLibrary: Record<CardId, Card> } | null> {
    const matchStatePath = Deno.env.get('MATCH_STATE_PATH');
    if (!matchStatePath) return null;
    try {
      const contents = await Deno.readTextFile(matchStatePath);
      const parsed = JSON.parse(contents) as { match: Match; cardLibrary: Record<CardId, Card> };
      if (!parsed?.match || !parsed?.cardLibrary) {
        throw new Error('match state file must include match and cardLibrary');
      }
      console.info(`[match] loaded match state override from ${matchStatePath}`);
      return parsed;
    } catch (error) {
      console.warn(`[match] failed to load match state override from ${matchStatePath}`);
      console.error(error);
      return null;
    }
  }

  // Applies a loaded match state onto the current match instance.
  private applyLoadedMatchState(loadedMatch: Match): void {
    Object.assign(this.match, loadedMatch);
    // Normalize persisted snapshots once at match load, not during gameplay actions.
    this.match.coffers ??= {};
    this.match.villagers ??= {};
    this.match.debt ??= {};
    this.match.boons ??= {
      cards: [],
      deck: [],
      discard: [],
      setAside: [],
    };
    this.match.boons.cards ??= [];
    this.match.boons.deck ??= [];
    this.match.boons.discard ??= [];
    this.match.boons.setAside ??= [];
    this.match.hexes ??= {
      cards: [],
      deck: [],
      discard: [],
    };
    this.match.hexes.cards ??= [];
    this.match.hexes.deck ??= [];
    this.match.hexes.discard ??= [];
    this.match.states ??= {
      cards: [],
      byPlayer: {},
    };
    this.match.states.cards ??= [];
    this.match.states.byPlayer ??= {};
    this.match.artifacts ??= {
      cards: [],
      byPlayer: {},
    };
    this.match.artifacts.cards ??= [];
    this.match.artifacts.byPlayer ??= {};
    this.match.tokens ??= {};
    this.match.tokenInstanceCounter ??= 0;
    this.match.fleetRound ??= {
      active: false,
      completed: false,
      eligiblePlayerIdsInOrder: [],
      nextFleetPlayerIndex: 0,
    };
    this.match.fleetRound.active ??= false;
    this.match.fleetRound.completed ??= false;
    this.match.fleetRound.eligiblePlayerIdsInOrder ??= [];
    this.match.fleetRound.nextFleetPlayerIndex ??= 0;
  }

  // Loads a card library snapshot for a loaded match state.
  private loadCardLibraryFromState(cardLibrary: Record<CardId, Card>): void {
    for (const card of Object.values(cardLibrary)) {
      // Rehydrate card instances so downstream logic uses Card class methods.
      this.cardLibrary.addCard(new Card({ ...card }));
    }
  }

  private clientEventRegistrar<T extends keyof ServerListenEvents>(event: T, handler: ServerListenEvents[T]) {
    this._registeredEvents.push(event);
    this.socketMap.forEach((s) => {
      s.on(event, handler as any);
    });
  }

  public playerReconnected(playerId: PlayerId, socket: AppSocket) {
    this._playerReconnectOrchestrator?.playerReconnected(playerId, socket);
  }

  public playerDisconnected(playerId: number) {
    // Use whichever array is populated depending on phase
    const roster = this.match.players?.length ? this.match.players : this.match.config.players;

    // There should always be at least one entry after a single disconnect
    const leaving = roster.find((p) => p.id === playerId);
    console.info(`[match] ${leaving ?? `{id:${playerId}}`} has disconnected`);

    this.socketMap.get(playerId)?.offAnyIncoming();
    this._interactivityController?.playerRemoved(this.socketMap.get(playerId));
    this.socketMap.delete(playerId);
  }

  private createBaseSupply(config: ComputedMatchConfiguration) {
    console.info(`[match] creating base supply cards`);
    const cardSource = this.cardSourceController.getSource('basicSupply');

    if (!cardSource) {
      throw new Error(`[match] no basic supply card source found`);
    }

    for (const supply of Object.values(config.basicSupply)) {
      for (const card of supply.cards) {
        if (!card) {
          throw new Error(`[match] no card data found for ${supply}`);
        }

        const c = createCard(card.cardKey, { ...card, kingdom: supply.name });
        this.cardLibrary.addCard(c);
        cardSource.push(c.id);
      }
    }
  }

  private createKingdom(config: ComputedMatchConfiguration) {
    console.info(`[match] creating kingdom cards`);

    const cardSource = this.cardSourceController.getSource('kingdomSupply');

    if (!cardSource) {
      throw new Error(`[match] no basic supply card source found`);
    }

    for (const kingdom of Object.values(config.kingdomSupply)) {
      for (const card of kingdom.cards) {
        if (!card) {
          throw new Error(`[match] no card data found for ${kingdom}`);
        }

        const c = createCard(card.cardKey, { ...card, kingdom: kingdom.name });
        this.cardLibrary.addCard(c);
        cardSource.push(c.id);
      }
    }
  }

  private createNonSupplyCards(config: ComputedMatchConfiguration) {
    console.info(`[match] creating non-supply cards`);

    const cardSource = this.cardSourceController.getSource('nonSupplyCards');

    if (!cardSource) {
      throw new Error(`[match] no basic supply card source found`);
    }

    for (const supply of Object.values(config.nonSupply ?? {})) {
      for (const card of supply.cards) {
        if (!card) {
          throw new Error(`[match] no card data found for ${supply}`);
        }

        const c = createCard(card.cardKey, { ...card, kingdom: supply.name });
        this.cardLibrary.addCard(c);
        cardSource.push(c.id);
      }
    }
  }

  private createPlayerDecks(config: MatchConfiguration) {
    console.info(`[match] creating player decks`);

    return Object.values(config.players).forEach((player, idx) => {
      console.debug('initializing player', player.id, 'cards...');

      let playerStartHand = this._playerHands.length > 0
        ? this._playerHands[idx]
        : config.playerStartingHand as Record<string, number>;
      playerStartHand ??= MatchBaseConfiguration.playerStartingHand;
      console.debug(`[match] using player starting hand`);
      console.debug(Object.keys(playerStartHand).map((key) => `${key}: ${playerStartHand[key]}`).join(', '));

      const deck = this.cardSourceController.getSource('playerDeck', player.id);

      Object.entries(playerStartHand).forEach(
        ([key, count]) => {
          deck.push(
            ...new Array(count).fill(0).map((_) => {
              const c = createCard(key, { owner: player.id });
              // Cards in the deck should start face down; client rendering uses facing.
              c.facing = 'back';
              this.cardLibrary.addCard(c);
              return c.id;
            }),
          );
          fisherYatesShuffle(deck, true);
        },
      );
    });
  }

  public getMatchSnapshot(): Match {
    this._cardLibSnapshot = structuredClone(this.cardLibrary.getAllCards());
    return structuredClone(this.match);
  }

  // Returns a full match state export for debugging and local test setups.
  public exportMatchState(): { match: Match; cardLibrary: Record<CardId, Card> } {
    return {
      match: structuredClone(this.match),
      cardLibrary: structuredClone(this.cardLibrary.getAllCards()),
    };
  }

  // Applies a partial match update, recalculates derived state, and broadcasts to clients.
  public applyPartialMatchUpdate(partial: Partial<Match>): { ok: boolean; errors?: string[] } {
    const prev = this.getMatchSnapshot();

    const recordKeyAllowList = new Set([
      'cardOverrides',
      'cardSources',
      'cardSourceTagMap',
      'coffers',
      'villagers',
      'debt',
      'mats',
      'scores',
      'selectableCards',
      'tokens',
    ]);

    const validationErrors: string[] = [];
    if (MatchController.isPlainObject(partial)) {
      for (const [key, val] of Object.entries(partial)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          validationErrors.push(`${key}`);
          continue;
        }
        if (!(key in this.match)) {
          validationErrors.push(`${key}`);
          continue;
        }
        const baseVal = (this.match as unknown as Record<string, unknown>)[key];
        if (recordKeyAllowList.has(key)) {
          validationErrors.push(...MatchController.validatePartialMatch(val, baseVal, `${key}.`, true));
        } else if (MatchController.isPlainObject(val) && MatchController.isPlainObject(baseVal)) {
          validationErrors.push(...MatchController.validatePartialMatch(val, baseVal, `${key}.`));
        }
      }
    }
    if (validationErrors.length > 0) {
      console.warn('[match] partial match update rejected due to unknown keys', validationErrors);
      return { ok: false, errors: validationErrors };
    }

    MatchController.mergePartialMatch(
      this.match as unknown as Record<string, unknown>,
      partial as Record<string, unknown>,
    );

    this.calculateScores();
    this._interactivityController?.checkCardInteractivity();
    this.match.cardOverrides = this._cardPriceController?.calculateOverrides() ?? {};

    this.broadcastPatch(prev);

    return { ok: true };
  }

  // Removes a player from the live match state and updates turn ordering.
  public removePlayerFromMatch(playerId: PlayerId): void {
    const prev = structuredClone(this.match);
    const playerIdx = this.match.players.findIndex((player) => player.id === playerId);
    if (playerIdx === -1) return;

    this.match.players.splice(playerIdx, 1);
    if (this.match.config?.players) {
      const configIdx = this.match.config.players.findIndex((player) => player.id === playerId);
      if (configIdx !== -1) {
        this.match.config.players.splice(configIdx, 1);
      }
    }

    delete this.match.scores[playerId];

    if (this.match.currentPlayerTurnIndex > playerIdx) {
      this.match.currentPlayerTurnIndex -= 1;
    }
    if (this.match.currentPlayerTurnIndex >= this.match.players.length) {
      this.match.currentPlayerTurnIndex = 0;
    }

    this._interactivityController?.checkCardInteractivity();
    this.broadcastPatch(prev);
  }

  async runGameAction<K extends GameActions>(
    action: K,
    ...args: Parameters<GameActionDefinitionMap[K]>
  ): Promise<GameActionReturnTypeMap[K]> {
    const isTopLevel = this._actionDepth === 0;
    this._actionDepth += 1;
    this._matchSnapshot ??= this.getMatchSnapshot();

    let asyncTimeout: number | undefined = undefined;

    try {
      if (action === 'selectCard' || action === 'userPrompt') {
        // Always sync patches before prompting; advance the snapshot to avoid duplicate diffs.
        this.broadcastPatch(this._matchSnapshot);
        this._logManager?.flushQueue();
        this._matchSnapshot = this.getMatchSnapshot();
        const promptArgs = args[0] as SelectActionCardArgs | UserPromptActionArgs | undefined;
        if (!promptArgs) {
          throw new Error(`[match] missing prompt args for ${String(action)}`);
        }
        const promptPlayerId = promptArgs.playerId;

        let pingCount = 0;
        let pingTime = 30000;

        const pingUser = () => {
          this.socketMap.get(promptPlayerId)?.emit('ping', ++pingCount);
          pingTime -= 10000;
          pingTime = Math.max(pingTime, 10000);
          asyncTimeout = setTimeout(pingUser, pingTime);
        };

        asyncTimeout = setTimeout(pingUser, pingTime);
      }

      const result = await this._gameActionsController!.invokeAction(action, ...args);

      clearTimeout(asyncTimeout);
      asyncTimeout = undefined;

      this.calculateScores();
      this._interactivityController?.checkCardInteractivity();
      this.match.cardOverrides = this._cardPriceController?.calculateOverrides() ?? {};

      if (isTopLevel) {
        this.broadcastPatch({ ...this._matchSnapshot });
        this._logManager?.flushQueue();
        this._matchSnapshot = null;
      }

      if (await this.checkGameEnd()) {
        console.log(`[match] game ended`);
      }

      return result as Promise<GameActionReturnTypeMap[K]>;
    } finally {
      this._actionDepth = Math.max(0, this._actionDepth - 1);
    }
  }

  public broadcastPatch(prev: Match, playerId?: PlayerId) {
    const patch: Operation[] = jsonPatch.compare(prev, this.match);
    const cardLibraryPatch = jsonPatch.compare(this._cardLibSnapshot, this.cardLibrary.getAllCards());

    if (patch.length || cardLibraryPatch.length) {
      console.debug(`[match] sending match update to clients`);

      if (playerId) {
        this.socketMap.get(playerId)?.emit('patchUpdate', patch, cardLibraryPatch);
      } else {
        this.socketMap.forEach((s) => s.emit('patchUpdate', patch, cardLibraryPatch));
      }
    }
  }

  private onClientReady = (playerId: number) => {
    const player = this.match.config?.players.find((player) => player.id === playerId);

    console.info(`[match] received clientReady event from ${player}`);

    if (!player) {
      console.error(`[match] player not found`);
      return;
    }

    if (!this.match.config) {
      console.error(`[match] no match config`);
      return;
    }

    player.ready = true;

    if (this.match.config.players.some((p) => !p.ready)) {
      console.debug(`[match] not all players marked ready, waiting for everyone`);
      return;
    }

    console.log('[match] all players ready');

    for (const socket of this.socketMap.values()) {
      socket.off('clientReady', this.onClientReady);
    }

    void this.startMatch();
  };

  private async startMatch() {
    console.log(`[match] starting match`);

    await this._reactionManager?.runGameLifecycleEvent('onGameStart', { match: this.match });

    for (const socket of this.socketMap.values()) {
      this._playerReconnectOrchestrator?.bindGameplaySocketListeners(socket);
    }

    this._matchSnapshot = this.getMatchSnapshot();
    this.match.playerBuys = 1;
    this.match.playerActions = 1;

    this.socketMap.forEach((s) => s.emit('matchStarted'));

    for (const player of this.match.players!) {
      await this.runGameAction('drawHand', { playerId: player.id });
    }

    this._logManager?.addLogEntry({
      root: true,
      type: 'newTurn',
      turn: Math.floor(this.match.turnNumber / this.match.players.length) + 1,
    });

    this._logManager?.addLogEntry({
      root: true,
      type: 'newPlayerTurn',
      turn: Math.floor(this.match.turnNumber / this.match.players.length) + 1,
      playerId: getCurrentPlayer(this.match).id,
    });

    // Seed turn history with the initial started turn.
    this.match.stats.turns = [{
      turnNumber: this.match.turnNumber,
      controllerId: getCurrentPlayer(this.match).id,
      playerId: getCurrentPlayer(this.match).id,
    }];

    // Kick off the first turn, including any computer player automation.
    await this.runGameAction('checkForRemainingPlayerActions');
  }

  private calculateScores() {
    console.info(`[match] calculating scores`);

    const match = this.match;
    // Victory tokens now live as token instances; precompute counts per player for scoring.
    const victoryTokenCounts = new Map<PlayerId, number>();
    const victoryTokenId = prosperityTokenIds.victory;
    for (const token of Object.values(match.tokens ?? {})) {
      if (token.tokenId !== victoryTokenId) continue;
      if (token.location.type !== 'player') continue;
      const tokenCount = token.counters ?? 1;
      const currentCount = victoryTokenCounts.get(token.location.playerId) ?? 0;
      victoryTokenCounts.set(token.location.playerId, currentCount + tokenCount);
    }

    for (const player of match.players ?? []) {
      const playerId = player.id;
      const cards = this.cardLibrary.getCardsByOwner(playerId);

      let score = 0;

      for (const card of cards) {
        score += card.victoryPoints ?? 0;

        const customScoringFn = scoringFunctionMap[card?.cardKey ?? ''];
        if (customScoringFn) {
          console.debug(`[match] processing scoring function for ${card}`);
          score += customScoringFn({
            cardSourceController: this.cardSourceController,
            cardPriceController: this._cardPriceController!,
            logManager: this._logManager!,
            findCardService: this._findCardService,
            supplyGainService: this._supplyGainService,
            reactionManager: this._reactionManager!,
            match: this.match,
            cardLibrary: this.cardLibrary,
            ownerId: playerId,
          });
        }
      }
      // Add victory tokens counted from token instances.
      score += victoryTokenCounts.get(playerId) ?? 0;
      match.scores[playerId] = score;

      for (const expansionScoringFn of this._expansionScoringFns) {
        expansionScoringFn(playerId, match, this.cardLibrary);
      }
    }
  }

  // Returns the Fleet project id when Fleet is in the current project lineup.
  private getFleetProjectId(): CardId | undefined {
    return this.match.projects.find((project) => project.cardKey === 'fleet')?.id;
  }

  // Returns true when the given player currently owns Fleet via a cube token.
  private doesPlayerOwnFleet(playerId: PlayerId): boolean {
    const fleetProjectId = this.getFleetProjectId();
    if (fleetProjectId === undefined) {
      return false;
    }

    return Object.values(this.match.tokens ?? {}).some((token) =>
      token.tokenId === renaissanceTokenIds.cube &&
      token.ownerId === playerId &&
      token.location.type === 'cardLike' &&
      token.location.cardLikeId === fleetProjectId
    );
  }

  // Builds Fleet turn order starting with the next player after the player ending the game.
  private getFleetEligiblePlayerIdsInOrder(endingPlayerIndex: number): PlayerId[] {
    const players = this.match.players;
    const eligiblePlayerIds: PlayerId[] = [];
    if (!players.length) {
      return eligiblePlayerIds;
    }

    for (let offset = 1; offset <= players.length; offset++) {
      const playerIndex = (endingPlayerIndex + offset) % players.length;
      const player = players[playerIndex];
      if (!player) {
        continue;
      }
      if (this.doesPlayerOwnFleet(player.id)) {
        eligiblePlayerIds.push(player.id);
      }
    }

    return eligiblePlayerIds;
  }

  private async checkGameEnd() {
    console.info(`[match] checking if the game has ended`);

    const match = this.match;
    // Fleet latches game-end state once activated; do not re-evaluate end conditions during Fleet turns.
    if (match.fleetRound.completed) {
      console.info('[match] Fleet round completed; finalizing game end');
      await this.endGame();
      return true;
    }
    if (match.fleetRound.active) {
      console.info('[match] game end latched; Fleet round still active');
      return false;
    }

    const shouldEndGame = this._endGameEvaluator?.shouldEndGame(this._expansionEndGameConditionFns) ?? false;

    if (!shouldEndGame) {
      return false;
    }

    // Determine Fleet-eligible players once at game-end latch time.
    const fleetEligiblePlayerIds = this.getFleetEligiblePlayerIdsInOrder(match.currentPlayerTurnIndex);
    if (!fleetEligiblePlayerIds.length) {
      console.info('[match] no Fleet owners; ending game immediately');
      await this.endGame();
      return true;
    }

    // Activate Fleet endgame round and defer final scoring until all Fleet turns are complete.
    match.fleetRound.active = true;
    match.fleetRound.completed = false;
    match.fleetRound.eligiblePlayerIdsInOrder = fleetEligiblePlayerIds;
    match.fleetRound.nextFleetPlayerIndex = 0;
    match.fleetRound.endingPlayerId = getCurrentPlayer(match).id;
    match.fleetRound.startedAtTurnNumber = match.turnNumber;

    console.info(
      `[match] Fleet round activated by player ${match.fleetRound.endingPlayerId}; order: ${
        fleetEligiblePlayerIds.join(', ')
      }`,
    );

    return false;
  }

  private async endGame() {
    console.log(`[match] ending the game`);

    this._reactionManager?.endGame();
    this._interactivityController?.endGame();

    console.debug(`[match] removing socket listeners for 'nextPhase'`);
    this.socketMap.forEach((s) => s.off('nextPhase'));

    console.debug(`[match] removing listener for match state updates`);

    const match = this.match;

    for (const player of this.match.players) {
      const setAsideCardIds = this.cardSourceController.getSource('set-aside', player.id);
      // Iterate over a snapshot since move actions mutate the source array.
      for (const cardId of [...setAsideCardIds]) {
        await this.runGameAction('moveCard', {
          toPlayerId: player.id,
          cardId,
          to: { location: 'playerDeck' },
        });
      }
    }

    for (const event of this._registeredEvents) {
      this.socketMap.forEach((s) => s.off(event));
    }

    const summary: MatchSummary = {
      playerSummary: match.players.reduce((prev, player) => {
        const playerId = player.id;
        // Tiebreaker turns are counted from recorded turn history.
        // Seize the Day turns are excluded from this count per event FAQ.
        const turnsTaken = match.stats.turns.filter((turnStats) => {
          if (turnStats.playerId !== playerId) {
            return false;
          }

          const sourceId = turnStats.sourceId;
          if (sourceId === undefined) {
            return true;
          }

          const sourceEvent = match.events.find((event) => event.id === sourceId);
          if (!sourceEvent) {
            return true;
          }

          return sourceEvent.cardKey !== 'seize-the-day';
        }).length;

        prev.push({
          playerId,
          turnsTaken,
          score: match.scores[playerId],
          deck: this._findCardService.findCards([{ owner: playerId }]).map((card) => card.id),
        });
        return prev;
      }, [] as MatchSummary['playerSummary'])
        .sort((a, b) => {
          if (a.score < b.score) return 1;
          if (b.score < a.score) return -1;
          if (a.turnsTaken < b.turnsTaken) return -1;
          if (b.turnsTaken < a.turnsTaken) return 1;
          const aIdx = match.players.findIndex((player) => player.id === a.playerId);
          const bIdx = match.players.findIndex((player) => player.id === b.playerId);
          if (aIdx < bIdx) return -1;
          if (bIdx < aIdx) return 1;
          return 0;
        }),
    };

    console.info(`[match] match summary created`);
    console.debug(summary);

    this.socketMap.forEach((s) => s.emit('gameOver', summary));
    this.emit('gameOver');
  }

  private createEvents(config: ComputedMatchConfiguration) {
    console.debug(`[match] creating events`);
    for (const event of config.events) {
      this.match.events.push(createEvent(event));
    }
  }

  // Creates and shuffles the boon deck when Fate cards are present.
  private createBoons(config: ComputedMatchConfiguration) {
    const boons = config.boons ?? [];
    if (boons.length < 1) {
      console.info('[match] no boons configured for this match');
      return;
    }

    console.info('[match] creating boons');
    // Initialize boon deck state before shuffling.
    this.match.boons = {
      cards: [],
      deck: [],
      discard: [],
      setAside: [],
    };

    for (const boon of boons) {
      const boonInstance = createBoon(boon);
      this.match.boons.cards.push(boonInstance);
      this.match.boons.deck.push(boonInstance.id);
    }

    // Shuffle the boon deck for randomized draws.
    void this._gameActionsController?.shuffleCardLike({ kind: 'boon' });

    console.debug(`[match] boon deck initialized with ${this.match.boons.deck.length} boons`);
  }

  // Creates and shuffles the hex deck when Doom cards are present.
  private createHexes(config: ComputedMatchConfiguration) {
    const hexes = config.hexes ?? [];
    if (hexes.length < 1) {
      console.info('[match] no hexes configured for this match');
      return;
    }

    console.info('[match] creating hexes');
    // Initialize hex deck state before shuffling.
    this.match.hexes = {
      cards: [],
      deck: [],
      discard: [],
    };

    for (const hex of hexes) {
      const hexInstance = createHex(hex);
      this.match.hexes.cards.push(hexInstance);
      this.match.hexes.deck.push(hexInstance.id);
    }

    // Shuffle the hex deck for randomized draws.
    fisherYatesShuffle(this.match.hexes.deck, true);

    console.debug(`[match] hex deck initialized with ${this.match.hexes.deck.length} hexes`);
  }

  // Creates state instances for the match when state cards are present.
  private createStates(config: ComputedMatchConfiguration) {
    const states = config.states ?? [];
    if (states.length < 1) {
      console.info('[match] no states configured for this match');
      return;
    }

    console.info('[match] creating states');
    // Initialize state storage before instantiating state cards.
    this.match.states = {
      cards: [],
      byPlayer: {},
    };

    for (const state of states) {
      const stateInstance = createState(state);
      this.match.states.cards.push(stateInstance);
    }

    console.debug(`[match] states initialized with ${this.match.states.cards.length} state(s)`);
  }

  // Creates artifact instances for the match when artifact cards are present.
  private createArtifacts(config: ComputedMatchConfiguration) {
    const artifacts = config.artifacts ?? [];
    if (artifacts.length < 1) {
      console.info('[match] no artifacts configured for this match');
      return;
    }

    console.info('[match] creating artifacts');
    // Initialize artifact storage before instantiating artifact cards.
    this.match.artifacts = {
      cards: [],
      byPlayer: {},
    };

    for (const artifact of artifacts) {
      const artifactInstance = createArtifact(artifact);
      this.match.artifacts.cards.push(artifactInstance);
    }

    console.debug(`[match] artifacts initialized with ${this.match.artifacts.cards.length} artifact(s)`);
  }

  private createLandmarks(config: ComputedMatchConfiguration) {
    // Create landmark card-like instances for the active match.
    console.debug(`[match] creating landmarks`);
    for (const landmark of config.landmarks ?? []) {
      this.match.landmarks.push(createLandmark(landmark));
    }
  }

  private createProjects(config: ComputedMatchConfiguration) {
    // Create project card-like instances for the active match.
    console.debug(`[match] creating projects`);
    for (const project of config.projects ?? []) {
      this.match.projects.push(createProject(project));
    }
  }
}
