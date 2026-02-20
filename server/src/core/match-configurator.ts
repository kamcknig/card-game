import {
  BaseCardMetadata,
  CardKey,
  CardNoId,
  ComputedMatchConfiguration,
  EventNoId,
  LandmarkNoId,
  MatchConfiguration,
  ProjectNoId,
  Supply,
  WayNoId,
} from 'shared/types/index.ts';
import { ExpansionData } from '@expansions/expansion-library.ts';
import {
  EndGamePolicyRegistrar,
  ExpansionConfigurator,
  ExpansionConfiguratorFactory,
  GameEventRegistrar,
  InitializeExpansionContext,
  MatchBaseConfiguration,
  PlayerScoreDecoratorRegistrar,
} from '@server-types/index.ts';
import jsonPatch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';
import { CardSourceController } from './card-source-controller.ts';
import { getDefaultKingdomSupplySize } from '../utils/get-default-kingdom-supply-size.ts';
import { getCardPileKey } from '../utils/get-card-pile-key.ts';
import { getAvailableKingdomRandomizerGroups } from '../utils/get-available-kingdom-randomizer-groups.ts';
import { ExpansionCatalogService } from './expansion-catalog-service.ts';
import { RngService } from './rng-service.ts';
import { LoggerService } from './logger-service.ts';

/**
 * Return a new array with at most one element for every distinct `prop` value.
 *
 * @template T extends Record<string, any>
 * @param   list  Source array
 * @param   prop  Property whose value determines uniqueness
 * @param   keep  'first' | 'last'  – keeps the first or last occurrence (default 'first')
 * @returns Deduplicated array
 */
export function uniqueByProp<
  T extends Record<string, any>,
  K extends keyof T = keyof T,
>(
  list: T[],
  prop: K,
  keep: 'first' | 'last' = 'first',
): T[] {
  if (keep === 'first') {
    // Keep the first occurrence
    const seen = new Set<any>();
    return list.filter((item) => {
      const key = item[prop];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Keep the **last** occurrence
  const idxByKey = new Map<any, number>(); // key → index of last sighting
  list.forEach((item, i) => idxByKey.set(item[prop], i));
  return list.filter((_, i) => idxByKey.get(list[i][prop]) === i);
}

/**
 * The configurator takes a MatchConfiguration instance and creates a ComputedMatchConfiguration.
 *
 * The former is what is created during match configuration before a match has started. The latter is a completed
 * configuration after the base configuration, and all included expansion configurations have run.
 *
 * The configurator is responsible for coordinating and running these "child" configurators.
 */
export class MatchConfigurator {
  private _requestedKingdoms: CardNoId[] = [];
  private _bannedKingdoms: CardNoId[] = [];
  private readonly _config: ComputedMatchConfiguration;
  private readonly _initContext: InitializeExpansionContext;
  private readonly _expansionCatalogService: ExpansionCatalogService;
  private readonly _rngService: RngService;
  private readonly _loggerService: LoggerService;

  constructor(
    config: MatchConfiguration,
    initContext: InitializeExpansionContext,
    expansionCatalogService: ExpansionCatalogService,
    rngService: RngService,
    loggerService: LoggerService,
  ) {
    // when creating the clone, it will break the custom Deno.customInspect symbols on classes so they won't
    // properly print. I'm not sure if we NEED the structured clone, might just remove it eventually. I tested
    // and that worked as well as of this fix. but i kind of want all changes to be self-contained in the configurator
    // so i like having that "separation" of it coming in and being clean from then in to this configurator instance
    const players = [...config.players];
    this._config = structuredClone(config) as ComputedMatchConfiguration;
    this._config.players = players;
    // Ensure landmarks array exists for downstream selection logic.
    this._config.landmarks ??= [];
    // Ensure projects array exists for downstream selection logic.
    this._config.projects ??= [];
    // Ensure ways array exists for downstream selection logic.
    this._config.ways ??= [];
    // Ensure states array exists for downstream configuration logic.
    this._config.states ??= [];
    // Ensure artifacts array exists for downstream configuration logic.
    this._config.artifacts ??= [];
    this._initContext = initContext;
    this._expansionCatalogService = expansionCatalogService;
    this._rngService = rngService;
    this._loggerService = loggerService;

    this._loggerService.info(`[match configurator] created`);
  }

  public async createConfiguration() {
    this._config.preselectedKingdoms = this._config.preselectedKingdoms.filter((card) => !!card);

    if (this._config.preselectedKingdoms?.length > 0) {
      this._loggerService.info(
        `[match configurator] requested kingdom cards ${this._config.preselectedKingdoms.length}`,
      );
      this._loggerService.info(this._config.preselectedKingdoms?.map((card) => card.cardKey)?.join('\n'));
    } else {
      this._loggerService.info(`[match configurator] no cards requested in during match configuration`);
    }

    this._loggerService.info(
      `[match configurator] removing possible duplicates from requested kingdoms`,
    );

    this._requestedKingdoms = Array.from(
      new Set([
        ...(this._config.preselectedKingdoms?.map((card) => card.cardKey) ?? []),
      ]),
    )
      .map((key) => structuredClone(this._expansionCatalogService.getRawCard(key)))
      .filter((card) => !!card);

    if (this._requestedKingdoms.length > MatchBaseConfiguration.numberOfKingdomPiles) {
      const requestedKingdomCardKeys = this._requestedKingdoms.map((card) => card.cardKey);
      this._loggerService.info(
        `[match configurator] requested kingdom cards exceeds 10, truncating to 10 ${
          requestedKingdomCardKeys.join(', ')
        }`,
      );
      this._requestedKingdoms.length = MatchBaseConfiguration.numberOfKingdomPiles;
    }

    this._bannedKingdoms = this._config.bannedKingdoms?.slice() ?? [];

    // Trim preselected landscapes (events/landmarks/projects/ways) to the configured landscape cap before selection.
    this.enforceLandscapeLimit();
    this.selectKingdomSupply();
    this.selectBasicSupply();

    await this.runExpansionConfigurators();
    // Remove temporary setup-only proxy piles after configurators have converged.
    this.removeTemporarySetupProxyKingdomPiles();

    this.createCardSources(this._initContext.cardSourceController);

    return { config: this._config };
  }

  // Returns true when all cards in the pile are tagged as temporary setup proxies.
  private isTemporarySetupProxySupply(supply: Supply): boolean {
    if (!supply.cards.length) {
      return false;
    }
    return supply.cards.every((card) => {
      const metadata = card.metadata as BaseCardMetadata | undefined;
      return metadata?.base?.setupProxyKingdomPile === true;
    });
  }

  // Removes temporary setup proxy piles before finalizing config.
  private removeTemporarySetupProxyKingdomPiles(): void {
    const before = this._config.kingdomSupply.length;
    this._config.kingdomSupply = this._config.kingdomSupply.filter((supply) =>
      !this.isTemporarySetupProxySupply(supply)
    );
    const removed = before - this._config.kingdomSupply.length;
    if (removed > 0) {
      this._loggerService.info(`[match configurator] removed ${removed} temporary setup proxy kingdom pile(s)`);
    }
  }

  // Logs when preselected landscapes exceed the configured cap; random selection handles limits.
  private enforceLandscapeLimit(): void {
    const allowedEventsAndOthers = MatchBaseConfiguration.numberOfEventsAndOthers;
    const events = this._config.events ?? [];
    const landmarks = this._config.landmarks ?? [];
    const projects = this._config.projects ?? [];
    const ways = this._config.ways ?? [];
    const total = events.length + landmarks.length + projects.length + ways.length;

    if (total <= allowedEventsAndOthers) {
      return;
    }

    this._loggerService.info(
      `[match configurator] ${total} landscapes preselected, skipping random landscape selection cap of ${allowedEventsAndOthers}`,
    );
  }

  private createCardSources(cardSourceController: CardSourceController) {
    // todo: right now these register locations that were previously hard-coded in the match state.
    // i'm converting to use this CardSourceController class and these might be able to be converted
    // into non-hardcoded locations.
    cardSourceController.registerZone('kingdomSupply', []);
    cardSourceController.registerZone('basicSupply', []);
    cardSourceController.registerZone('nonSupplyCards', []);
    cardSourceController.registerZone('activeDuration', []);
    cardSourceController.registerZone('playArea', []);
    cardSourceController.registerZone('trash', []);
    // Shared set-aside zone for match-level cards (e.g., Way of the Mouse setup card).
    cardSourceController.registerZone('set-aside', []);

    for (const player of this._config.players) {
      cardSourceController.registerZone('playerHand', [], player.id);
      cardSourceController.registerZone('playerDiscard', [], player.id);
      cardSourceController.registerZone('playerDeck', [], player.id);
      cardSourceController.registerZone('set-aside', [], player.id);
    }
  }

  private selectKingdomSupply() {
    let selectedKingdoms: CardNoId[] = this._requestedKingdoms.slice();
    const additionalKingdoms: { name: string; cards: CardNoId[] }[] = [];

    if (selectedKingdoms.length === MatchBaseConfiguration.numberOfKingdomPiles) {
      this._loggerService.info(
        `[match configurator] number of requested kingdoms ${this._requestedKingdoms.length} is enough`,
      );
    } else {
      // reduces the player-configured expansions into an array whose elements are the expansions' library data
      const selectedExpansions = this._config.expansions.reduce((acc, allowedExpansion) => {
        const expansionData = this._expansionCatalogService.getExpansion(allowedExpansion.name);
        if (!expansionData) {
          this._loggerService.warn(`[match configurator] expansion ${allowedExpansion.name} not found`);
          return acc;
        }
        acc.push(expansionData);
        return acc;
      }, [] as ExpansionData[]);

      // list of pile keys that are banned or already pre-selected
      const bannedKingdomRandomizers = this._bannedKingdoms.map((card) => getCardPileKey(card));
      const alreadyIncludedKingdomRandomizers = selectedKingdoms.map((card) => getCardPileKey(card));

      this._loggerService.info(
        `[match configurator] banned kingdoms ${bannedKingdomRandomizers.join(', ') ?? '- no banned kingdoms'}`,
      );

      // Build kingdom candidates once so all configurators can share pile-key selection semantics.
      // This intentionally includes only kingdom piles so kingdom-only selectors (e.g. Bane) never pull landscapes.
      const availableKingdomRandomizerGroups = getAvailableKingdomRandomizerGroups({
        expansions: selectedExpansions,
        bannedPileKeys: bannedKingdomRandomizers,
        excludedPileKeys: alreadyIncludedKingdomRandomizers,
      });

      type AvailableRandomizer =
        | { randomizer: string; type: 'card'; cardsInRandomizer: CardNoId[] }
        | { randomizer: string; type: 'event'; cardLike: EventNoId }
        | { randomizer: string; type: 'landmark'; cardLike: LandmarkNoId }
        | { randomizer: string; type: 'project'; cardLike: ProjectNoId }
        | { randomizer: string; type: 'way'; cardLike: WayNoId };

      const availableRandomizers: AvailableRandomizer[] = [
        ...availableKingdomRandomizerGroups.map((group) => ({
          randomizer: group.pileKey,
          type: 'card' as const,
          cardsInRandomizer: group.cards,
        })),
        ...selectedExpansions.flatMap((nextExpansion) => [
        ...Object.values(nextExpansion.events)
          .filter((event) => event.randomizer !== null)
          .map((event) => ({
            randomizer: event.randomizer!,
            cardLike: event,
            type: 'event' as const,
          })),
        // Landmarks participate in the shared "events and others" randomizer pool.
        ...Object.values(nextExpansion.landmarks)
          .filter((landmark) => landmark.randomizer !== null)
          .map((landmark) => ({
            randomizer: landmark.randomizer!,
            cardLike: landmark,
            type: 'landmark' as const,
          })),
        // Projects participate in the shared "events and others" randomizer pool.
        ...Object.values(nextExpansion.projects ?? {})
          .filter((project) => project.randomizer !== null)
          .map((project) => ({
            randomizer: project.randomizer!,
            cardLike: project,
            type: 'project' as const,
          })),
        // Ways participate in the shared "events and others" randomizer pool.
        ...Object.values(nextExpansion.ways ?? {})
          .filter((way) => way.randomizer !== null)
          .map((way) => ({
            randomizer: way.randomizer!,
            cardLike: way,
            type: 'way' as const,
          })),
        ]),
      ];

      const uniqueRandomizers = uniqueByProp(availableRandomizers, 'randomizer');

      this._loggerService.info(`[match configurator] available kingdoms ${uniqueRandomizers.length}`);
      this._loggerService.info(uniqueRandomizers.map((randomizer) => randomizer.randomizer).join('\n'));

      const numKingdomsToSelect = MatchBaseConfiguration.numberOfKingdomPiles - this._requestedKingdoms.length;

      this._loggerService.info(`[match configurator] need to select ${numKingdomsToSelect} kingdoms`);

      const allowedEventsAndOthers = MatchBaseConfiguration.numberOfEventsAndOthers;
      // Track the combined limit for events and other landscape types (landmarks included).
      let selectedEventsAndOthers = this._config.events.length +
        (this._config.landmarks?.length ?? 0) +
        (this._config.projects?.length ?? 0) +
        (this._config.ways?.length ?? 0);

      for (let i = 0; i < numKingdomsToSelect; i++) {
        const randomIndex = this._rngService.nextIndex(uniqueRandomizers.length);
        const selectedRandomizer = uniqueRandomizers[randomIndex];

        if (selectedRandomizer.type === 'card') {
          this._loggerService.info(`[match configurator] selected kingdom ${selectedRandomizer.randomizer}`);
          const cardsInRandomizer = selectedRandomizer.cardsInRandomizer;

          // this makes an assumption that if there are more cards within a randomizer group (such as knights from dark
          // ages) that they will all be in the same kingdom.
          const kingdom = cardsInRandomizer[0].kingdom;

          let cards: CardNoId[] = [];

          if (!cardsInRandomizer.length) {
            throw new Error(`[match configurator] no cards found for randomizer ${selectedRandomizer.randomizer}`);
          }

          if (cardsInRandomizer.length === 1) {
            cards = new Array(getDefaultKingdomSupplySize(cardsInRandomizer[0], this._config)).fill(
              cardsInRandomizer[0],
            );
          } else {
            cards = cardsInRandomizer;
          }

          additionalKingdoms.push({
            name: kingdom,
            cards,
          });
        } else if (selectedRandomizer.type === 'event') {
          this._loggerService.info(`[match configurator] selected event ${selectedRandomizer.randomizer}`);

          if (++selectedEventsAndOthers <= allowedEventsAndOthers) {
            this._loggerService.info(
              `[match configurator] selected event ${selectedRandomizer.randomizer} is allowed, adding to match`,
            );
            const event = selectedRandomizer.cardLike;

            if (!event) {
              throw new Error(`[match configurator] event not found for randomizer ${selectedRandomizer.randomizer}`);
            }

            this._config.events.push(event);
          } else {
            this._loggerService.info(
              `[match configurator] selected event ${selectedRandomizer.randomizer} is not allowed, already have max number of events and others`,
            );
          }

          // reduce the counter because events don't count against kingdom selection
          i--;
        } else if (selectedRandomizer.type === 'landmark') {
          // Landmarks are treated as "others" alongside events for random selection limits.
          this._loggerService.info(`[match configurator] selected landmark ${selectedRandomizer.randomizer}`);

          if (++selectedEventsAndOthers <= allowedEventsAndOthers) {
            this._loggerService.info(
              `[match configurator] selected landmark ${selectedRandomizer.randomizer} is allowed, adding to match`,
            );
            const landmark = selectedRandomizer.cardLike;

            if (!landmark) {
              throw new Error(
                `[match configurator] landmark not found for randomizer ${selectedRandomizer.randomizer}`,
              );
            }

            this._config.landmarks ??= [];
            this._config.landmarks.push(landmark);
          } else {
            this._loggerService.info(
              `[match configurator] selected landmark ${selectedRandomizer.randomizer} is not allowed, already have max number of events and others`,
            );
          }

          // reduce the counter because landmarks don't count against kingdom selection
          i--;
        } else if (selectedRandomizer.type === 'project') {
          // Projects are treated as "others" alongside events for random selection limits.
          this._loggerService.info(`[match configurator] selected project ${selectedRandomizer.randomizer}`);

          if (++selectedEventsAndOthers <= allowedEventsAndOthers) {
            this._loggerService.info(
              `[match configurator] selected project ${selectedRandomizer.randomizer} is allowed, adding to match`,
            );
            const project = selectedRandomizer.cardLike;

            if (!project) {
              throw new Error(`[match configurator] project not found for randomizer ${selectedRandomizer.randomizer}`);
            }

            this._config.projects ??= [];
            this._config.projects.push(project);
          } else {
            this._loggerService.info(
              `[match configurator] selected project ${selectedRandomizer.randomizer} is not allowed, already have max number of events and others`,
            );
          }

          // reduce the counter because projects don't count against kingdom selection
          i--;
        } else if (selectedRandomizer.type === 'way') {
          // Ways are treated as "others" alongside events for random selection limits.
          this._loggerService.info(`[match configurator] selected way ${selectedRandomizer.randomizer}`);

          if (++selectedEventsAndOthers <= allowedEventsAndOthers) {
            this._loggerService.info(
              `[match configurator] selected way ${selectedRandomizer.randomizer} is allowed, adding to match`,
            );
            const way = selectedRandomizer.cardLike;

            if (!way) {
              throw new Error(`[match configurator] way not found for randomizer ${selectedRandomizer.randomizer}`);
            }

            this._config.ways ??= [];
            this._config.ways.push(way);
          } else {
            this._loggerService.info(
              `[match configurator] selected way ${selectedRandomizer.randomizer} is not allowed, already have max number of events and others`,
            );
          }

          // reduce the counter because ways don't count against kingdom selection
          i--;
        }

        // remove the selected pile so it can't be selected again
        uniqueRandomizers.splice(randomIndex, 1);
      }
    }

    this._config.kingdomSupply = structuredClone(
      selectedKingdoms.map((card) => {
        return {
          name: card.cardKey,
          cards: new Array(getDefaultKingdomSupplySize(card, this._config)).fill(card),
        };
      }).concat(additionalKingdoms),
    );

    this._loggerService.info(
      `[match configurator] finalized selected kingdoms count ${this._config.kingdomSupply.length}`,
    );
    this._loggerService.info(this._config.kingdomSupply.map((supply) => supply.name).join('\n'));
  }

  private selectBasicSupply() {
    // based on the number of players, get the basic supply card counts
    const basicCardCounts = {
      ...MatchBaseConfiguration.basicSupplyByPlayerCount[this._config.players.length - 1],
    } as Record<CardKey, number>;
    const rawCardLibrary = this._expansionCatalogService.getRawCardLibrary();

    // coppers come from the supply, so they are removed here, because these represent the cards IN the supply at the
    // start of game. The coppers in a player's hand come from the supply, whereas the estates do not.
    this._config.basicSupply = Object.keys(basicCardCounts).reduce((acc, nextKey) => {
      const cardData = { ...rawCardLibrary[nextKey] };
      acc.push({
        name: cardData.cardKey,
        cards: new Array(
          nextKey === 'copper'
            ? this._config.players.length * MatchBaseConfiguration.playerStartingHand.copper
            : basicCardCounts[nextKey],
        ).fill(cardData),
      });
      return acc;
    }, [] as Supply[]);

    const basicSupply = this._config.basicSupply.map((supply) => supply.name).join(', ');
    this._loggerService.info(`[match configurator] setting default basic cards ${basicSupply}`);
  }

  private async getExpansionConfigurators() {
    const configurators = new Map<string, ExpansionConfigurator>();
    const uniqueExpansions = this.getConfiguredExpansionNames();
    for (const expansionName of uniqueExpansions) {
      try {
        this._loggerService.info(`[match configurator] loading configurator for expansion '${expansionName}'`);
        const configuratorFactory = (await import(`@expansions/${expansionName}/configurator-${expansionName}.ts`))
          .default as ExpansionConfiguratorFactory;
        configurators.set(expansionName, configuratorFactory());
      } catch (error) {
        this._loggerService.info(`[match configurator] no configurator factory found for expansion '${expansionName}'`);
      }
    }
    return configurators;
  }

  // Resolves all expansion names relevant to this configuration, including selected expansion toggles.
  private getConfiguredExpansionNames(): string[] {
    const configuredExpansionNames = this._config.expansions.map((expansion) => expansion.name);
    const selectedKingdomExpansions = this._config.kingdomSupply
      .flatMap((supply) => supply.cards.map((card) => card.expansionName));
    return Array.from(new Set([
      ...configuredExpansionNames,
      ...selectedKingdomExpansions,
    ]));
  }

  private async runExpansionConfigurators() {
    const configurators = await this.getExpansionConfigurators();
    const expansionCatalog = this._expansionCatalogService.getExpansionLibrary();
    const rawCardLibrary = this._expansionCatalogService.getRawCardLibrary();

    let iteration = 0;
    let changes: Operation[] = [];
    let configSnapshot = structuredClone(this._config);

    do {
      iteration++;
      for (const [expansionName, expansionConfigurator] of configurators.entries()) {
        this._loggerService.info(
          `[match configurator] running expansion configurator for expansion '${expansionName}'`,
        );
        await expansionConfigurator({
          ...this._initContext,
          config: this._config,
          cardLibrary: rawCardLibrary,
          expansionCatalog,
          expansionData: expansionCatalog[expansionName],
        });
      }

      changes = jsonPatch.compare(configSnapshot, this._config);

      this._loggerService.info(
        `[match configurator] expansion configurator iteration ${iteration} changes ${changes.length}`,
      );

      configSnapshot = structuredClone(this._config);
    } while (changes.length > 0 && iteration < 10);

    if (iteration >= 10) {
      throw new Error(`[match configurator] expansion configurator failed to converge after 10 iterations`);
    }

    this._loggerService.info(`[match configurator] registering expansion scoring effects`);
    await this.registerExpansionPlayerScoreDecorators(this._initContext.playerScoreDecoratorRegistrar);

    this._loggerService.info(`[match configurator] registering expansion end game policies`);
    await this.registerExpansionEndGamePolicies(this._initContext.endGamePolicyRegistrar);

    this._loggerService.info(`[match configurator] registering game event listeners`);
    await this.registerGameEventListeners(this._initContext.gameEventRegistrar);
  }

  private async registerGameEventListeners(gameEventRegistrar: GameEventRegistrar) {
    const uniqueExpansions = this.getConfiguredExpansionNames();
    for (const expansion of uniqueExpansions) {
      try {
        const module = await import(`@expansions/${expansion}/configurator-${expansion}.ts`);
        if (!module.registerGameEvents) continue;
        module.registerGameEvents(gameEventRegistrar, this._config);
      } catch (error) {
        if ((error as any)?.code === 'ERR_MODULE_NOT_FOUND') {
          continue;
        }
        this._loggerService.warn(`[match configurator] failed to register expansion actions for ${expansion}`);
        this._loggerService.error(error);
      }
    }
  }

  private async registerExpansionEndGamePolicies(registrar: EndGamePolicyRegistrar) {
    const uniqueExpansions = this.getConfiguredExpansionNames();
    for (const expansion of uniqueExpansions) {
      try {
        const module = await import(`@expansions/${expansion}/configurator-${expansion}.ts`);
        if (!module.registerEndGamePolicies) continue;
        module.registerEndGamePolicies(registrar);
      } catch (error) {
        if ((error as any)?.code === 'ERR_MODULE_NOT_FOUND') {
          continue;
        }
        this._loggerService.warn(
          `[match configurator] failed to register expansion end game policies for ${expansion}`,
        );
        this._loggerService.error(error);
      }
    }
  }

  private async registerExpansionPlayerScoreDecorators(registrar: PlayerScoreDecoratorRegistrar) {
    const uniqueExpansions = this.getConfiguredExpansionNames();
    for (const expansion of uniqueExpansions) {
      try {
        const module = await import(`@expansions/${expansion}/configurator-${expansion}.ts`);
        if (!module.registerScoringFunctions) continue;
        module.registerScoringFunctions(registrar);
      } catch (error) {
        if ((error as any)?.code === 'ERR_MODULE_NOT_FOUND') {
          continue;
        }
        this._loggerService.warn(
          `[match configurator] failed to register expansion scoring functions for ${expansion}`,
        );
        this._loggerService.error(error);
      }
    }
  }
}
