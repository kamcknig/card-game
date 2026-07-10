import {
  Card,
  CardId,
  CardKey,
  ComputedMatchConfiguration,
  Match,
  MatchConfiguration,
  PlayerId,
  SelectActionCardArgs,
  ServerListenEvents,
  UserPromptActionArgs,
} from 'shared/types/index.ts';
import { MatchConfigurator } from './match-configurator.ts';
import { getCurrentPlayer } from '../utils/get-current-player.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import jsonPatch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';
import { EventEmitter } from '@denosaurs/event';
import {
  AppSocket,
  FindCardService,
  GameActionDefinitionMap,
  GameActionReturnTypeMap,
  GameActions,
  GameLifecycleCallback,
  GameLifecycleEvent,
  PlayerScoreDecorator,
  PromptService,
  SupplyGainService,
} from '@server-types/index.ts';
import { CardSourceController } from './card-source-controller.ts';
import { prosperityTokenIds } from '@expansions/prosperity/token-prosperity-ids.ts';
import { ReactionManager } from './reactions/reaction-manager.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { LogManager } from './log-manager.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { GameActionController } from './actions/game-action-controller.ts';
import { MatchConfiguratorFactory } from './match-configurator-factory.ts';
import { EndGameEvaluatorService } from './end-game-evaluator-service.ts';
import { PlayerReconnectOrchestrator } from './player-reconnect-orchestrator.ts';
import { MatchSetupService } from './match-setup-service.ts';
import { EndGamePolicyRegistryService } from './end-game-policy-registry-service.ts';
import { CardInstanceFactoryService } from './card-instance-factory-service.ts';
import { MatchEndService } from './match-end-service.ts';
import { ExpansionCardMetadataRegistryService } from './expansion-card-metadata-registry-service.ts';
import { TokenRegistryService } from './tokens/token-registry-service.ts';
import { RngService } from './rng-service.ts';
import { ServerConfigService } from './server-config-service.ts';
import { LoggerService } from './logger-service.ts';
import { MatchUndoService } from './undo/match-undo-service.ts';
import { MatchUndoVoteService } from './undo/match-undo-vote-service.ts';
import { PromptAbortRegistry, UndoAbortError } from './undo/prompt-abort-registry.ts';

export class MatchController extends EventEmitter<{ gameOver: [void] }> {
  private _cardLibSnapshot = {};
  private _matchSnapshot: Match | null | undefined;
  private _matchConfiguration: ComputedMatchConfiguration | undefined;
  private _matchConfigurator: MatchConfigurator | undefined;
  // Prevents duplicate initialize runs for the same match controller instance.
  private _isInitialized = false;
  // Tracks the in-flight initialize operation so concurrent calls can coalesce safely.
  private _initializePromise: Promise<void> | null = null;
  private _expansionScoringFns: PlayerScoreDecorator[] = [];
  private _registeredEvents: (keyof ServerListenEvents)[] = [];
  // Tracks nested runGameAction calls to avoid corrupting patch snapshots.
  private _actionDepth: number = 0;
  // Set when endGame() is first entered. Used to suppress the top-level patchUpdate broadcast
  // and any re-entrant endGame() calls that would occur when a nested action triggers the end
  // condition before the outer broadcastPatch runs.
  private _gameEnding: boolean = false;
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
    private readonly matchConfiguratorFactory: MatchConfiguratorFactory,
    private readonly match: Match,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly cardSourceController: CardSourceController,
    private readonly matchSetupService: MatchSetupService,
    private readonly endGamePolicyRegistryService: EndGamePolicyRegistryService,
    private readonly cardInstanceFactoryService: CardInstanceFactoryService,
    private readonly reactionManager: ReactionManager,
    private readonly interactivityController: CardInteractivityController,
    private readonly logManager: LogManager,
    private readonly gameActionsController: GameActionController,
    private readonly cardPriceController: CardPriceRulesController,
    private readonly endGameEvaluator: EndGameEvaluatorService,
    private readonly playerReconnectOrchestrator: PlayerReconnectOrchestrator,
    private readonly findCardService: FindCardService,
    private readonly supplyGainService: SupplyGainService,
    private readonly promptService: PromptService,
    private readonly matchEndService: MatchEndService,
    private readonly expansionCardMetadataRegistryService: ExpansionCardMetadataRegistryService,
    private readonly tokenRegistryService: TokenRegistryService,
    private readonly rngService: RngService,
    private readonly serverConfigService: ServerConfigService,
    private readonly loggerService: LoggerService,
    private readonly undoService: MatchUndoService,
    private readonly promptAbortRegistry: PromptAbortRegistry,
    private readonly undoVoteService: MatchUndoVoteService,
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
    if (this._isInitialized) {
      this.loggerService.warn('[match] initialize ignored; controller already initialized');
      return;
    }

    if (this._initializePromise) {
      this.loggerService.warn('[match] initialize already in progress; awaiting existing initialization');
      await this._initializePromise;
      return;
    }

    this._initializePromise = this.initializeInternal(config);

    try {
      await this._initializePromise;
      this._isInitialized = true;
    } finally {
      this._initializePromise = null;
    }
  }

  // Exposes whether this controller has completed (or is running) match initialization.
  public isInitialized(): boolean {
    return this._isInitialized || this._initializePromise !== null;
  }

  // Runs the one-time match setup pipeline for this controller instance.
  private async initializeInternal(config: MatchConfiguration) {
    this.broadcastPatch({} as Match);

    const snapshot = this.getMatchSnapshot();
    // Load an optional match override from disk for local dev/debugging.
    this._loadedMatchState = await this.tryLoadMatchStateOverride();

    this._matchConfigurator = this.matchConfiguratorFactory.create(config, {
      match: this.match,
      cardSourceController: this.cardSourceController,
      cardInstanceFactoryService: this.cardInstanceFactoryService,
      loggerService: this.loggerService,
      rngService: this.rngService,
      gameEventRegistrar: (event: GameLifecycleEvent, handler: GameLifecycleCallback) =>
        this.reactionManager.registerGameEvent(event, handler),
      clientEventRegistrar: (event, handler) => this.clientEventRegistrar(event, handler),
      endGamePolicyRegistrar: val => this.endGamePolicyRegistryService.register(val),
      expansionRegistration: {
        registerCardEffect: (...args) => this.gameActionsController.registerCardEffect(...args),
        registerBoonEffect: (cardKey, effectFn) => this.gameActionsController.registerBoonEffect(cardKey, effectFn),
        registerHexEffect: (cardKey, effectFn) => this.gameActionsController.registerHexEffect(cardKey, effectFn),
        registerStateEffect: (cardKey, effectFn) => this.gameActionsController.registerStateEffect(cardKey, effectFn),
        registerArtifactEffect: (cardKey, effectFn) =>
          this.gameActionsController.registerArtifactEffect(cardKey, effectFn),
        registerProjectEffect: (cardKey, effectFn) =>
          this.gameActionsController.registerProjectEffect(cardKey, effectFn),
        registerTokenDefinition: definition => this.tokenRegistryService.registerTokenDefinition(definition),
        registerTokenCardPlayedHandler: (tokenId, handler) =>
          this.tokenRegistryService.registerTokenCardPlayedHandler(tokenId, handler),
      },
      playerScoreDecoratorRegistrar: (val: PlayerScoreDecorator) => this._expansionScoringFns.push(val),
    });
    const { config: newConfig } = await this._matchConfigurator.createConfiguration();

    // Use the loaded match state if provided; otherwise build a fresh match state.
    if (this._loadedMatchState) {
      this.applyLoadedMatchState(this._loadedMatchState.match);
      this.matchSetupService.loadCardLibraryFromState(this._loadedMatchState.cardLibrary);
      this._matchConfiguration = this._loadedMatchState.match.config ?? newConfig;
      // Ensure match config is always populated for downstream logic.
      this.match.config = this.match.config ?? this._matchConfiguration;
    } else {
      this._matchConfiguration = newConfig;

      this.match.players = this._matchConfiguration.players;
      this.matchSetupService.createBaseSupply(this._matchConfiguration);
      this.matchSetupService.createKingdom(this._matchConfiguration);
      this.matchSetupService.createEvents(this._matchConfiguration);
      // Allies are landscapes selected in Liaison games.
      this.matchSetupService.createAllies(this._matchConfiguration);
      // Prophecies are landscapes selected when Omen cards are present.
      this.matchSetupService.createProphecies(this._matchConfiguration);
      // Landmarks are landscapes that should be created alongside events.
      this.matchSetupService.createLandmarks(this._matchConfiguration);
      // Projects are landscapes that should be created alongside events.
      this.matchSetupService.createProjects(this._matchConfiguration);
      // Ways are landscapes that should be created alongside events/projects.
      this.matchSetupService.createWays(this._matchConfiguration);
      // Traits are landscapes attached to kingdoms piles at setup.
      this.matchSetupService.createTraits(this._matchConfiguration);
      // Boons are initialized after events/landmarks if Fate cards are present.
      this.matchSetupService.createBoons(this._matchConfiguration);
      // Hexes are initialized after boons if Doom cards are present.
      this.matchSetupService.createHexes(this._matchConfiguration);
      // States are initialized after boons/hexes for any state-granting cards.
      this.matchSetupService.createStates(this._matchConfiguration);
      // Artifacts are initialized after states for any artifact-granting cards.
      this.matchSetupService.createArtifacts(this._matchConfiguration);
      this.matchSetupService.createNonSupplyCards(this._matchConfiguration);
      this.matchSetupService.createPlayerDecks(this._matchConfiguration, this._playerHands);
      // Shuffle Boons/Hexes once setup has initialized their decks. Awaited so
      // initializeInternal cannot resolve (and send matchReady) before the
      // shuffle actually finished — a fire-and-forget void call here would let
      // the client race ahead of the actual boon/hex deck ordering.
      await this.gameActionsController.shuffleCardLike({ kind: 'boon' });
      await this.gameActionsController.shuffleCardLike({ kind: 'hex' });
      this.match.config = this._matchConfiguration;
    }

    this.loggerService.log(`[match] ready, sending to clients and listening for when clients are ready`);

    this.broadcastPatch(snapshot);

    this.socketMap.forEach(s => {
      // Register readiness listener before notifying client that match data is ready.
      s.on('clientReady', this.onClientReady);
      s.emit('setCardLibrary', this.cardLibrary.getAllCards());
      s.emit('setTokenDefinitions', this.tokenRegistryService.getTokenDefinitions());
      s.emit('matchReady');
    });
  }

  // Attempts to load a match state JSON override from disk for development.
  private async tryLoadMatchStateOverride(): Promise<{ match: Match; cardLibrary: Record<CardId, Card> } | null> {
    const matchStatePath = this.serverConfigService.getMatchStatePath();
    if (!matchStatePath) return null;
    try {
      const contents = await Deno.readTextFile(matchStatePath);
      const parsed = JSON.parse(contents) as { match: Match; cardLibrary: Record<CardId, Card> };
      if (!parsed?.match || !parsed?.cardLibrary) {
        throw new Error('match state file must include match and cardLibrary');
      }
      this.loggerService.info(`[match] loaded match state override from ${matchStatePath}`);
      return parsed;
    } catch (error) {
      this.loggerService.warn(`[match] failed to load match state override from ${matchStatePath}`);
      this.loggerService.error(error);
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
    this.match.skippedTurns ??= {};
    this.match.setAsideSourceById ??= {};
    this.match.allies ??= [];
    this.match.prophecies ??= [];
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
    this.match.ways ??= [];
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
    this.match.config ??= {} as ComputedMatchConfiguration;
    this.match.config.allies ??= [];
    this.match.config.prophecies ??= [];
    this.match.config.traits ??= [];
    this.match.traits ??= [];
  }

  private clientEventRegistrar<T extends keyof ServerListenEvents>(event: T, handler: ServerListenEvents[T]) {
    this._registeredEvents.push(event);
    this.socketMap.forEach(s => {
      // deno-lint-ignore no-explicit-any -- Socket.IO generic event handler requires any to satisfy overloaded on() signature
      s.on(event, handler as any);
    });
  }

  public playerReconnected(playerId: PlayerId, socket: AppSocket) {
    this.playerReconnectOrchestrator.playerReconnected(playerId, socket);
  }

  public playerDisconnected(playerId: number) {
    // Cancel or adjust any in-flight undo vote before cleaning up the socket.
    this.undoVoteService.handlePlayerDisconnected(playerId);

    // Use whichever array is populated depending on phase
    const roster = this.match.players?.length ? this.match.players : this.match.config.players;

    // There should always be at least one entry after a single disconnect
    const leaving = roster.find(p => p.id === playerId);
    this.loggerService.info(`[match] ${leaving ?? `{id:${playerId}}`} has disconnected`);

    this.socketMap.get(playerId)?.offAnyIncoming();
    this.interactivityController.playerRemoved(this.socketMap.get(playerId));
    this.socketMap.delete(playerId);
  }

  // Detaches match gameplay listeners from one socket when the player leaves but remains connected.
  public detachPlayerGameplaySocketListeners(playerId: PlayerId): void {
    const socket = this.socketMap.get(playerId);
    if (!socket) {
      this.loggerService.debug(`[match] no socket found for player ${playerId} while detaching gameplay listeners`);
      return;
    }

    this.loggerService.debug(`[match] detaching gameplay listeners for player ${playerId}`);
    this.interactivityController.playerRemoved(socket);
    this.playerReconnectOrchestrator.unbindGameplaySocketListeners(socket);
    socket.off('clientReady', this.onClientReady);
    for (const event of this._registeredEvents) {
      socket.off(event);
    }
  }

  // Adds and flushes a player-left log entry so clients see resignation immediately.
  public logPlayerLeft(playerId: PlayerId): void {
    this.logManager.addLogEntry({
      interject: true,
      type: 'playerLeft',
      playerId,
      reason: 'resigned',
    });
    this.logManager.flushQueue();
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
      'setAsideSourceById',
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
      this.loggerService.warn('[match] partial match update rejected due to unknown keys', validationErrors);
      return { ok: false, errors: validationErrors };
    }

    MatchController.mergePartialMatch(
      this.match as unknown as Record<string, unknown>,
      partial as Record<string, unknown>,
    );

    this.calculateScores();
    this.interactivityController.checkCardInteractivity();
    this.match.cardOverrides = this.cardPriceController.calculateOverrides() ?? {};

    this.broadcastPatch(prev);

    return { ok: true };
  }

  // Removes a player from the live match state and updates turn ordering.
  public removePlayerFromMatch(playerId: PlayerId): void {
    // getMatchSnapshot() also refreshes _cardLibSnapshot — a plain
    // structuredClone(this.match) here left it stale, so broadcastPatch below
    // diffed the card library against whatever the last action happened to
    // leave behind and re-sent that action's library ops instead of a clean
    // no-op/delta for this removal.
    const prev = this.getMatchSnapshot();
    const playerIdx = this.match.players.findIndex(player => player.id === playerId);
    if (playerIdx === -1) return;

    this.match.players.splice(playerIdx, 1);
    if (this.match.config?.players) {
      const configIdx = this.match.config.players.findIndex(player => player.id === playerId);
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

    this.interactivityController.checkCardInteractivity();
    this.broadcastPatch(prev);
  }

  async runGameAction<K extends GameActions>(
    action: K,
    ...args: Parameters<GameActionDefinitionMap[K]>
  ): Promise<GameActionReturnTypeMap[K]> {
    const actionLogContext = {
      action: String(action),
      turnNumber: this.match.turnNumber,
      phaseIndex: this.match.turnPhaseIndex,
    };
    const isTopLevel = this._actionDepth === 0;
    this._actionDepth += 1;
    this._matchSnapshot ??= this.getMatchSnapshot();

    // Snapshot the engine for undo BEFORE executing the action — only at
    // the top-level boundary, only when the game isn't ending. We skip
    // pure-prompt actions because they don't mutate state on their own;
    // their effects are inside the parent action that ran the prompt.
    // We also skip checkForRemainingPlayerActions because it is always a
    // housekeeping follow-up invoked automatically after a user action
    // (never directly initiated by the player) and must not create its own
    // undo boundary.
    // drawHand is called at top-level only during match initialization;
    // during gameplay it is always nested within another action. Excluding
    // it here prevents init-phase snapshots from appearing in the undo stack
    // (the stack is also explicitly cleared after startMatch completes).
    if (
      isTopLevel &&
      !this._gameEnding &&
      action !== 'selectCard' &&
      action !== 'selectSingleCard' &&
      action !== 'userPrompt' &&
      action !== 'checkForRemainingPlayerActions' &&
      action !== 'drawHand'
    ) {
      const initiatingPlayerId = getCurrentPlayer(this.match)?.id ?? null;
      this.undoService.pushSnapshot(initiatingPlayerId);
    }

    let asyncTimeout: number | undefined = undefined;

    try {
      if (action === 'selectCard' || action === 'selectSingleCard' || action === 'userPrompt') {
        // Always sync patches before prompting; advance the snapshot to avoid duplicate diffs.
        this.broadcastPatch(this._matchSnapshot);
        this.logManager.flushQueue();
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

      const result = await this.gameActionsController.invokeAction(action, ...args);

      clearTimeout(asyncTimeout);
      asyncTimeout = undefined;

      this.calculateScores();
      this.interactivityController.checkCardInteractivity();
      this.match.cardOverrides = this.cardPriceController.calculateOverrides() ?? {};

      if (isTopLevel) {
        // Skip broadcasting if game is already ending — a nested action fired endGame()
        // (emitting gameOver) before this top-level broadcast ran. Sending patchUpdate
        // after gameOver would cause the client to fail applying the patch against a null
        // match store.
        if (!this._gameEnding) {
          this.broadcastPatch({ ...this._matchSnapshot });
          this.logManager.flushQueue();
          this.broadcastCanUndo();
        }
        this._matchSnapshot = null;
      }

      if (await this.checkGameEnd()) {
        this.loggerService.logWithContext(actionLogContext, `[match] game ended`);
      }

      return result as Promise<GameActionReturnTypeMap[K]>;
    } catch (error) {
      if (error instanceof UndoAbortError) {
        // Clear the ping timer so it doesn't fire after the abort.
        clearTimeout(asyncTimeout);
        asyncTimeout = undefined;

        // Discard any pending log queue from the aborted action so it
        // doesn't leak into the next broadcast.
        this.logManager.flushQueue();

        if (isTopLevel) {
          // Reset patch bookkeeping so the post-restore broadcast diffs
          // against the right baseline.
          this._matchSnapshot = null;
          // Notify the undo service that the call stack has unwound; it
          // is awaiting this barrier before performing the restore.
          this.undoService.signalUnwindComplete();
          // Swallow the abort at the top — restore happens in the undo
          // service. Returning null mimics a "no-op" action result.
          return null as unknown as GameActionReturnTypeMap[K];
        }
        // Re-throw so outer runGameAction layers also unwind.
        throw error;
      }
      throw error;
    } finally {
      this._actionDepth = Math.max(0, this._actionDepth - 1);
    }
  }

  /**
   * Notifies each connected player whether they personally have an undo
   * snapshot available. Each player's value is computed individually so
   * ownership is respected — a player who has not yet acted cannot undo.
   */
  public broadcastCanUndo(): void {
    for (const [playerId, socket] of this.socketMap) {
      socket.emit('undoAvailable', this.undoService.canUndoForPlayer(playerId));
    }
  }

  public broadcastPatch(prev: Match, playerId?: PlayerId) {
    const patch: Operation[] = jsonPatch.compare(prev, this.match);
    const cardLibraryPatch = jsonPatch.compare(this._cardLibSnapshot, this.cardLibrary.getAllCards());

    if (patch.length || cardLibraryPatch.length) {
      this.loggerService.debug(`[match] sending match update to clients`);

      if (playerId) {
        this.socketMap.get(playerId)?.emit('patchUpdate', patch, cardLibraryPatch);
      } else {
        this.socketMap.forEach(s => s.emit('patchUpdate', patch, cardLibraryPatch));
      }
    }
  }

  private onClientReady = (playerId: number) => {
    const player = this.match.config?.players.find(player => player.id === playerId);

    this.loggerService.info(`[match] received clientReady event from ${player}`);

    if (!player) {
      this.loggerService.error(`[match] player not found`);
      return;
    }

    if (!this.match.config) {
      this.loggerService.error(`[match] no match config`);
      return;
    }

    player.ready = true;

    if (this.match.config.players.some(p => !p.ready)) {
      this.loggerService.debug(`[match] not all players marked ready, waiting for everyone`);
      return;
    }

    this.loggerService.log('[match] all players ready');

    for (const socket of this.socketMap.values()) {
      socket.off('clientReady', this.onClientReady);
    }

    void this.startMatch();
  };

  private async startMatch() {
    this.loggerService.log(`[match] starting match`);

    // Run setup hooks first, then true game-start hooks.
    await this.reactionManager.runGameLifecycleEvent('onGameStartSetup', { match: this.match });
    await this.reactionManager.runGameLifecycleEvent('onGameStart', { match: this.match });

    for (const [playerId, socket] of this.socketMap.entries()) {
      // Bind card interaction handlers for all active players at match start.
      this.interactivityController.playerAdded(socket);
      // Pass playerId so per-player undo socket events are attributed correctly.
      this.playerReconnectOrchestrator.bindGameplaySocketListeners(socket, playerId);
    }

    this._matchSnapshot = this.getMatchSnapshot();
    this.match.playerBuys = 1;
    this.match.playerActions = 1;

    this.socketMap.forEach(s => s.emit('matchStarted'));

    for (const player of this.match.players!) {
      await this.runGameAction('drawHand', { playerId: player.id });
    }

    // Discard any initialisation-phase snapshots so no player's undo
    // button is enabled before the first real player action.
    this.undoService.clear();

    this.logManager.addLogEntry({
      root: true,
      type: 'newTurn',
      turn: Math.floor(this.match.turnNumber / this.match.players.length) + 1,
    });

    this.logManager.addLogEntry({
      root: true,
      type: 'newPlayerTurn',
      turn: Math.floor(this.match.turnNumber / this.match.players.length) + 1,
      playerId: getCurrentPlayer(this.match).id,
    });

    // Seed turn history with the initial started turn.
    this.match.stats.turns = [
      {
        turnNumber: this.match.turnNumber,
        controllerId: getCurrentPlayer(this.match).id,
        playerId: getCurrentPlayer(this.match).id,
      },
    ];

    // Kick off the first turn, including any computer player automation.
    await this.runGameAction('checkForRemainingPlayerActions');
  }

  private calculateScores() {
    this.loggerService.info(`[match] calculating scores`);

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

        const customScoringFn = this.expansionCardMetadataRegistryService.getScoringFunction(card.cardKey);
        if (customScoringFn) {
          this.loggerService.debug(`[match] processing scoring function for ${card}`);
          score += customScoringFn({
            cardSourceController: this.cardSourceController,
            cardPriceController: this.cardPriceController,
            logManager: this.logManager,
            loggerService: this.loggerService,
            rngService: this.rngService,
            findCardService: this.findCardService,
            supplyGainService: this.supplyGainService,
            promptService: this.promptService,
            reactionManager: this.reactionManager,
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

  private async checkGameEnd() {
    this.loggerService.info(`[match] checking if the game has ended`);
    const endGameEvaluation = this.endGameEvaluator.evaluateEndGame();
    if (!endGameEvaluation) {
      return false;
    }

    if (endGameEvaluation.shouldEndNow) {
      await this.endGame();
      return true;
    }

    return false;
  }

  /** Forcibly ends the match immediately, bypassing end-condition evaluation. Used by the debug API. */
  public async forceEndGame(): Promise<void> {
    this.loggerService.log(`[match] force-ending game via debug endpoint`);
    await this.endGame();
  }

  /**
   * Debug-only: pops the most recent undo snapshot and restores state
   * without a vote. Handles both the idle case and the case where a
   * userPrompt/selectCard is currently in flight.
   * Returns true when a snapshot was available and restored, false otherwise.
   */
  public async debugPerformUndo(): Promise<boolean> {
    if (!this.undoService.canUndo()) {
      this.loggerService.warn('[match] debug undo requested but no snapshot available');
      return false;
    }

    // Capture state as clients currently see it so the diff broadcasts cleanly.
    const prev = this.getMatchSnapshot();

    // If a prompt is currently awaiting player input, abort it so the
    // engine call stack unwinds before we restore state.
    const inFlight = this.promptAbortRegistry.hasInFlight();
    if (inFlight) {
      this.loggerService.debug('[match] debug undo: aborting in-flight prompt before restore');
      this.promptAbortRegistry.abortAll();
    }

    const snapshot = await this.undoService.restoreLatest(inFlight);
    if (!snapshot) {
      return false;
    }

    // Update derived state after restore.
    this.calculateScores();
    this.interactivityController.checkCardInteractivity();
    this.match.cardOverrides = this.cardPriceController.calculateOverrides() ?? {};

    // Broadcast restored state to all clients.
    this.broadcastPatch(prev);
    this.logManager.flushQueue();

    // Sync clients' log to the truncated history.
    this.socketMap.forEach(s => s.emit('setLog', this.logManager.getHistory()));

    // Update undo button state after the stack has been popped.
    this.broadcastCanUndo();

    this.loggerService.info('[match] debug undo applied');
    return true;
  }

  private async endGame() {
    // Guard against re-entrant calls — pile counts remain depleted after the first endGame,
    // so a second checkGameEnd would fire endGame again and emit a duplicate gameOver.
    if (this._gameEnding) {
      this.loggerService.debug(`[match] endGame re-entry suppressed`);
      return;
    }
    this._gameEnding = true;
    this.loggerService.log(`[match] ending the game`);

    await this.matchEndService.endMatch({
      reactionManager: this.reactionManager,
      interactivityController: this.interactivityController,
      registeredEvents: this._registeredEvents,
    });
    this.emit('gameOver');
  }
}
