import {
  Card,
  CardId,
  CardKey,
  ComputedMatchConfiguration,
  Match,
  MatchConfiguration,
  SetAsideSourceDescriptor,
} from 'shared/types/index.ts';
import { MatchBaseConfiguration } from '@server-types/index.ts';
import { fisherYatesShuffle } from '../utils/fisher-yates-shuffler.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { CardSourceController } from './card-source-controller.ts';
import { CardInstanceFactoryService } from './card-instance-factory-service.ts';
import { RngService } from './rng-service.ts';
import { LoggerService } from './logger-service.ts';

type WayOfTheMouseWayCardLikeMetadata = {
  menagerie?: {
    wayOfTheMouse?: {
      setAsideCardKey?: CardKey;
      setAsidePileKey?: string;
      runtimeSetAsidePileKey?: string;
    };
  };
};

type WayOfTheMouseRuntimeSetAsideCardMetadata = {
  base?: {
    immovable?: true;
  };
  menagerie?: {
    wayOfTheMouse?: {
      runtimeSetAsideCard?: true;
      runtimeSetAsidePileKey?: string;
      selectedPileKey?: string;
    };
  };
};

// Owns deterministic match-state setup for supply/landscape/player-deck creation.
export class MatchSetupService {
  constructor(
    private readonly match: Match,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly cardSourceController: CardSourceController,
    private readonly cardInstanceFactoryService: CardInstanceFactoryService,
    private readonly rngService: RngService,
    private readonly loggerService: LoggerService,
  ) {}

  // Loads a card library snapshot for a loaded match state.
  public loadCardLibraryFromState(cardLibrary: Record<CardId, Card>): void {
    for (const card of Object.values(cardLibrary)) {
      // Rehydrate card instances so downstream logic uses Card class methods.
      this.cardLibrary.addCard(this.cardInstanceFactoryService.rehydrateCard(card));
    }
  }

  public createBaseSupply(config: ComputedMatchConfiguration): void {
    this.loggerService.info('[match] creating base supply cards');
    const cardSource = this.cardSourceController.getSource('basicSupply');

    for (const supply of Object.values(config.basicSupply)) {
      for (const card of supply.cards) {
        if (!card) {
          throw new Error(`[match] no card data found for ${supply}`);
        }

        const instance = this.cardInstanceFactoryService.createCard(card.cardKey, { ...card, kingdom: supply.name });
        this.cardLibrary.addCard(instance);
        cardSource.push(instance.id);
      }
    }
  }

  public createKingdom(config: ComputedMatchConfiguration): void {
    this.loggerService.info('[match] creating kingdom cards');
    const cardSource = this.cardSourceController.getSource('kingdomSupply');

    for (const kingdom of Object.values(config.kingdomSupply)) {
      for (const card of kingdom.cards) {
        if (!card) {
          throw new Error(`[match] no card data found for ${kingdom}`);
        }

        const instance = this.cardInstanceFactoryService.createCard(card.cardKey, { ...card, kingdom: kingdom.name });
        this.cardLibrary.addCard(instance);
        cardSource.push(instance.id);
      }
    }
  }

  public createNonSupplyCards(config: ComputedMatchConfiguration): void {
    this.loggerService.info('[match] creating non-supply cards');
    const cardSource = this.cardSourceController.getSource('nonSupplyCards');

    for (const supply of Object.values(config.nonSupply ?? {})) {
      for (const card of supply.cards) {
        if (!card) {
          throw new Error(`[match] no card data found for ${supply}`);
        }

        const instance = this.cardInstanceFactoryService.createCard(card.cardKey, { ...card, kingdom: supply.name });
        this.cardLibrary.addCard(instance);
        cardSource.push(instance.id);
      }
    }

    // Way of the Mouse runtime card is setup-only and belongs in shared set-aside, not in non-supply.
    this.createWayOfTheMouseSetAsideCard(config);
  }

  // Creates the Way of the Mouse runtime set-aside card directly into shared set-aside.
  private createWayOfTheMouseSetAsideCard(config: ComputedMatchConfiguration): void {
    const wayOfTheMouse = config.ways.find((way) => way.cardKey === 'way-of-the-mouse');
    if (!wayOfTheMouse) {
      return;
    }

    const wayMetadata = (wayOfTheMouse.metadata as WayOfTheMouseWayCardLikeMetadata | undefined)?.menagerie
      ?.wayOfTheMouse;
    const setAsideCardKey = wayMetadata?.setAsideCardKey;
    const runtimeSetAsidePileKey = wayMetadata?.runtimeSetAsidePileKey;
    if (!setAsideCardKey || !runtimeSetAsidePileKey) {
      this.loggerService.warn('[match] Way of the Mouse metadata missing set-aside setup details');
      return;
    }

    const instance = this.cardInstanceFactoryService.createCard(setAsideCardKey, {
      kingdom: runtimeSetAsidePileKey,
      partOfSupply: false,
      kingdomSelectable: false,
    });

    const runtimeMetadata = (instance.metadata as WayOfTheMouseRuntimeSetAsideCardMetadata | undefined) ?? {};
    runtimeMetadata.base ??= {};
    runtimeMetadata.base.immovable = true;
    runtimeMetadata.menagerie ??= {};
    runtimeMetadata.menagerie.wayOfTheMouse ??= {};
    runtimeMetadata.menagerie.wayOfTheMouse.runtimeSetAsideCard = true;
    runtimeMetadata.menagerie.wayOfTheMouse.runtimeSetAsidePileKey = runtimeSetAsidePileKey;
    runtimeMetadata.menagerie.wayOfTheMouse.selectedPileKey = wayMetadata?.setAsidePileKey;
    instance.metadata = runtimeMetadata;

    this.cardLibrary.addCard(instance);
    const globalSetAsideSource = this.cardSourceController.getSource('set-aside');
    globalSetAsideSource.push(instance.id);
    this.match.setAsideSourceById[instance.id] = {
      sourceKind: 'way',
      sourceCardKey: 'way-of-the-mouse',
    } satisfies SetAsideSourceDescriptor;
    this.loggerService.info(
      `[match] Way of the Mouse set-aside card created ${instance.cardKey} (${runtimeSetAsidePileKey})`,
    );
  }

  public createPlayerDecks(config: MatchConfiguration, playerHands: Record<CardKey, number>[] = []): void {
    this.loggerService.info('[match] creating player decks');

    for (const [idx, player] of Object.values(config.players).entries()) {
      this.loggerService.debug('initializing player', player.id, 'cards...');

      let playerStartHand = playerHands.length > 0
        ? playerHands[idx]
        : config.playerStartingHand as Record<string, number>;

      playerStartHand ??= MatchBaseConfiguration.playerStartingHand;

      const deck = this.cardSourceController.getSource('playerDeck', player.id);
      Object.entries(playerStartHand).forEach(([key, count]) => {
        deck.push(
          ...new Array(count).fill(0).map(() => {
            const instance = this.cardInstanceFactoryService.createCard(key, { owner: player.id });
            // Cards in the deck should start face down; client rendering uses facing.
            instance.facing = 'back';
            this.cardLibrary.addCard(instance);
            return instance.id;
          }),
        );
        fisherYatesShuffle(deck, true, () => this.rngService.nextFloat());
      });
    }
  }

  public createEvents(config: ComputedMatchConfiguration): void {
    this.loggerService.debug('[match] creating events');
    for (const event of config.events) {
      this.match.events.push(this.cardInstanceFactoryService.createEvent(event));
    }
  }

  public createAllies(config: ComputedMatchConfiguration): void {
    const allies = config.allies ?? [];
    if (allies.length < 1) {
      this.loggerService.info('[match] no allies configured for this match');
      return;
    }

    this.loggerService.info('[match] creating allies');
    for (const ally of allies) {
      this.match.allies.push(this.cardInstanceFactoryService.createAlly(ally));
    }
  }

  public createLandmarks(config: ComputedMatchConfiguration): void {
    this.loggerService.debug('[match] creating landmarks');
    for (const landmark of config.landmarks ?? []) {
      this.match.landmarks.push(this.cardInstanceFactoryService.createLandmark(landmark));
    }
  }

  public createProjects(config: ComputedMatchConfiguration): void {
    this.loggerService.debug('[match] creating projects');
    for (const project of config.projects ?? []) {
      this.match.projects.push(this.cardInstanceFactoryService.createProject(project));
    }
  }

  public createWays(config: ComputedMatchConfiguration): void {
    const ways = config.ways ?? [];
    if (ways.length < 1) {
      this.loggerService.info('[match] no ways configured for this match');
      return;
    }

    this.loggerService.info('[match] creating ways');
    for (const way of ways) {
      this.match.ways.push(this.cardInstanceFactoryService.createWay(way));
    }
  }

  public createBoons(config: ComputedMatchConfiguration): void {
    const boons = config.boons ?? [];
    if (boons.length < 1) {
      this.loggerService.info('[match] no boons configured for this match');
      return;
    }

    this.loggerService.info('[match] creating boons');
    this.match.boons = {
      cards: [],
      deck: [],
      discard: [],
      setAside: [],
    };

    for (const boon of boons) {
      const instance = this.cardInstanceFactoryService.createBoon(boon);
      this.match.boons.cards.push(instance);
      this.match.boons.deck.push(instance.id);
    }
  }

  public createHexes(config: ComputedMatchConfiguration): void {
    const hexes = config.hexes ?? [];
    if (hexes.length < 1) {
      this.loggerService.info('[match] no hexes configured for this match');
      return;
    }

    this.loggerService.info('[match] creating hexes');
    this.match.hexes = {
      cards: [],
      deck: [],
      discard: [],
    };

    for (const hex of hexes) {
      const instance = this.cardInstanceFactoryService.createHex(hex);
      this.match.hexes.cards.push(instance);
      this.match.hexes.deck.push(instance.id);
    }
  }

  public createStates(config: ComputedMatchConfiguration): void {
    const states = config.states ?? [];
    if (states.length < 1) {
      this.loggerService.info('[match] no states configured for this match');
      return;
    }

    this.loggerService.info('[match] creating states');
    this.match.states = {
      cards: [],
      byPlayer: {},
    };

    for (const state of states) {
      this.match.states.cards.push(this.cardInstanceFactoryService.createState(state));
    }
  }

  public createArtifacts(config: ComputedMatchConfiguration): void {
    const artifacts = config.artifacts ?? [];
    if (artifacts.length < 1) {
      this.loggerService.info('[match] no artifacts configured for this match');
      return;
    }

    this.loggerService.info('[match] creating artifacts');
    this.match.artifacts = {
      cards: [],
      byPlayer: {},
    };

    for (const artifact of artifacts) {
      this.match.artifacts.cards.push(this.cardInstanceFactoryService.createArtifact(artifact));
    }
  }
}
