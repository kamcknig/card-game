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
  TraitNoId,
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
export function uniqueByProp<T extends Record<string, unknown>, K extends keyof T = keyof T>(
  list: T[],
  prop: K,
  keep: 'first' | 'last' = 'first',
): T[] {
  if (keep === 'first') {
    // Keep the first occurrence
    const seen = new Set<unknown>();
    return list.filter(item => {
      const key = item[prop];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Keep the **last** occurrence
  const idxByKey = new Map<unknown, number>(); // key → index of last sighting
  list.forEach((item, i) => idxByKey.set(item[prop], i));
  return list.filter((_, i) => idxByKey.get(list[i][prop]) === i);
}

// Landscape kinds that share the "events and others" randomizer pool
// selection semantics (as opposed to kingdom piles, which are counted
// separately). Events, landmarks, projects, ways, and traits are otherwise
// handled identically during selection.
type LandscapeKind = 'event' | 'landmark' | 'project' | 'way' | 'trait';

// The card-like shape produced by any of the landscape kinds above.
type LandscapeCardLike = EventNoId | LandmarkNoId | ProjectNoId | WayNoId | TraitNoId;

// Per-kind wiring: where randomizer candidates come from on an expansion's
// library data. Used to build the shared "events and others" candidate pool
// without five near-identical blocks.
const LANDSCAPE_KIND_DEFINITIONS: ReadonlyArray<{
  type: LandscapeKind;
  candidatesFor: (expansion: ExpansionData) => Record<string, LandscapeCardLike>;
}> = [
  { type: 'event', candidatesFor: expansion => expansion.events ?? {} },
  { type: 'landmark', candidatesFor: expansion => expansion.landmarks ?? {} },
  { type: 'project', candidatesFor: expansion => expansion.projects ?? {} },
  { type: 'way', candidatesFor: expansion => expansion.ways ?? {} },
  { type: 'trait', candidatesFor: expansion => expansion.traits ?? {} },
];

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
    // Ensure traits array exists for downstream selection logic.
    this._config.traits ??= [];
    // Ensure ally array exists for downstream configuration logic.
    this._config.allies ??= [];
    // Ensure prophecy array exists for downstream configuration logic.
    this._config.prophecies ??= [];
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
    this._config.preselectedKingdoms = this._config.preselectedKingdoms.filter(card => !!card);

    if (this._config.preselectedKingdoms?.length > 0) {
      this._loggerService.info(
        `[match configurator] requested kingdom cards ${this._config.preselectedKingdoms.length}`,
      );
      this._loggerService.info(this._config.preselectedKingdoms?.map(card => card.cardKey)?.join('\n'));
    } else {
      this._loggerService.info(`[match configurator] no cards requested in during match configuration`);
    }

    this._loggerService.info(`[match configurator] removing possible duplicates from requested kingdoms`);

    this._requestedKingdoms = Array.from(
      new Set([...(this._config.preselectedKingdoms?.map(card => card.cardKey) ?? [])]),
    )
      .map(key => structuredClone(this._expansionCatalogService.getRawCard(key)))
      .filter(card => !!card);

    if (this._requestedKingdoms.length > MatchBaseConfiguration.numberOfKingdomPiles) {
      const requestedKingdomCardKeys = this._requestedKingdoms.map(card => card.cardKey);
      this._loggerService.info(
        `[match configurator] requested kingdom cards exceeds 10, truncating to 10 ${requestedKingdomCardKeys.join(
          ', ',
        )}`,
      );
      this._requestedKingdoms.length = MatchBaseConfiguration.numberOfKingdomPiles;
    }

    this._bannedKingdoms = this._config.bannedKingdoms?.slice() ?? [];

    // Trim preselected landscapes (events/landmarks/projects/ways/traits) before random selection.
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
    return supply.cards.every(card => {
      const metadata = card.metadata as BaseCardMetadata | undefined;
      return metadata?.base?.isSetupProxyKingdomPile === true;
    });
  }

  // Removes temporary setup proxy piles before finalizing config.
  private removeTemporarySetupProxyKingdomPiles(): void {
    const before = this._config.kingdomSupply.length;
    this._config.kingdomSupply = this._config.kingdomSupply.filter(supply => !this.isTemporarySetupProxySupply(supply));
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
    const traits = this._config.traits ?? [];
    const total = events.length + landmarks.length + projects.length + ways.length + traits.length;

    if (total <= allowedEventsAndOthers) {
      return;
    }

    this._loggerService.info(
      `[match configurator] ${total} landscapes preselected, skipping random landscape selection cap of ${allowedEventsAndOthers}`,
    );
  }

  // Resolves the player-configured expansions into an array of the expansions'
  // library data. Shared by kingdom-candidate gathering and pile-member
  // resolution — both previously duplicated this exact reduce.
  private getSelectedExpansionData(): ExpansionData[] {
    return this._config.expansions.reduce((acc, allowedExpansion) => {
      const expansionData = this._expansionCatalogService.getExpansion(allowedExpansion.name);
      if (!expansionData) {
        this._loggerService.warn(`[match configurator] expansion ${allowedExpansion.name} not found`);
        return acc;
      }
      acc.push(expansionData);
      return acc;
    }, [] as ExpansionData[]);
  }

  // Pushes a selected landscape card-like onto its corresponding config array.
  // The cast on each branch is safe because `type` and `cardLike` originate
  // from the same discriminated LANDSCAPE_KIND_DEFINITIONS entry.
  private pushLandscapeSelection(type: LandscapeKind, cardLike: LandscapeCardLike): void {
    switch (type) {
      case 'event':
        this._config.events.push(cardLike as EventNoId);
        return;
      case 'landmark':
        (this._config.landmarks ??= []).push(cardLike as LandmarkNoId);
        return;
      case 'project':
        (this._config.projects ??= []).push(cardLike as ProjectNoId);
        return;
      case 'way':
        (this._config.ways ??= []).push(cardLike as WayNoId);
        return;
      case 'trait':
        (this._config.traits ??= []).push(cardLike as TraitNoId);
        return;
    }
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
    const selectedKingdoms: CardNoId[] = this._requestedKingdoms.slice();
    const additionalKingdoms: { name: string; cards: CardNoId[] }[] = [];

    if (selectedKingdoms.length === MatchBaseConfiguration.numberOfKingdomPiles) {
      this._loggerService.info(
        `[match configurator] number of requested kingdoms ${this._requestedKingdoms.length} is enough`,
      );
    } else {
      // Resolves the player-configured expansions into an array of the expansions' library data.
      const selectedExpansions = this.getSelectedExpansionData();

      // list of pile keys that are banned or already pre-selected
      const bannedKingdomRandomizers = this._bannedKingdoms.map(card => getCardPileKey(card));
      const alreadyIncludedKingdomRandomizers = selectedKingdoms.map(card => getCardPileKey(card));

      this._loggerService.info(
        `[match configurator] banned kingdoms ${bannedKingdomRandomizers.join(', ') ?? '- no banned kingdoms'}`,
      );

      // Build kingdoms candidates once so all configurators can share pile-key selection semantics.
      // This intentionally includes only kingdoms piles so kingdoms-only selectors (e.g. Bane) never pull landscapes.
      const availableKingdomRandomizerGroups = getAvailableKingdomRandomizerGroups({
        expansions: selectedExpansions,
        bannedPileKeys: bannedKingdomRandomizers,
        excludedPileKeys: alreadyIncludedKingdomRandomizers,
      });

      type AvailableRandomizer =
        | { randomizer: string; type: 'card'; cardsInRandomizer: CardNoId[] }
        | { randomizer: string; type: LandscapeKind; cardLike: LandscapeCardLike };

      // Landscapes (events, landmarks, projects, ways, traits) all participate
      // in the shared "events and others" randomizer pool with identical
      // candidate-gathering rules — one loop over LANDSCAPE_KIND_DEFINITIONS
      // replaces five near-identical blocks.
      const availableRandomizers: AvailableRandomizer[] = [
        ...availableKingdomRandomizerGroups.map(group => ({
          randomizer: group.pileKey,
          type: 'card' as const,
          cardsInRandomizer: group.cards,
        })),
        ...selectedExpansions.flatMap(nextExpansion =>
          LANDSCAPE_KIND_DEFINITIONS.flatMap(({ type, candidatesFor }) =>
            Object.values(candidatesFor(nextExpansion))
              .filter(cardLike => cardLike.randomizer !== null)
              .map(cardLike => ({
                randomizer: cardLike.randomizer!,
                cardLike,
                type,
              })),
          ),
        ),
      ];

      const uniqueRandomizers = uniqueByProp(availableRandomizers, 'randomizer');

      this._loggerService.info(`[match configurator] available kingdoms ${uniqueRandomizers.length}`);
      this._loggerService.info(uniqueRandomizers.map(randomizer => randomizer.randomizer).join('\n'));

      const numKingdomsToSelect = MatchBaseConfiguration.numberOfKingdomPiles - this._requestedKingdoms.length;

      this._loggerService.info(`[match configurator] need to select ${numKingdomsToSelect} kingdoms`);

      const allowedEventsAndOthers = MatchBaseConfiguration.numberOfEventsAndOthers;
      // Track the combined limit for events and other landscape types (landmarks included).
      let selectedEventsAndOthers =
        this._config.events.length +
        (this._config.landmarks?.length ?? 0) +
        (this._config.projects?.length ?? 0) +
        (this._config.ways?.length ?? 0) +
        (this._config.traits?.length ?? 0);

      for (let i = 0; i < numKingdomsToSelect; i++) {
        if (uniqueRandomizers.length === 0) {
          // The pool emptied before enough kingdoms/landscapes could be selected —
          // typically too many banned/excluded piles for the enabled expansions.
          // nextIndex(0) would throw a much less actionable error below, so fail
          // fast with a message that names the shortfall.
          throw new Error(
            `[match configurator] randomizer pool exhausted after selecting ${i} of ${numKingdomsToSelect} kingdoms — too many banned/excluded piles for the enabled expansions`,
          );
        }

        const randomIndex = this._rngService.nextIndex(uniqueRandomizers.length);
        const selectedRandomizer = uniqueRandomizers[randomIndex];

        if (selectedRandomizer.type === 'card') {
          this._loggerService.info(`[match configurator] selected kingdom ${selectedRandomizer.randomizer}`);
          const cardsInRandomizer = selectedRandomizer.cardsInRandomizer;

          // Guard before dereferencing cardsInRandomizer[0] below.
          if (!cardsInRandomizer.length) {
            throw new Error(`[match configurator] no cards found for randomizer ${selectedRandomizer.randomizer}`);
          }

          // this makes an assumption that if there are more cards within a randomizer group (such as knights from dark
          // ages) that they will all be in the same kingdoms.
          const kingdom = cardsInRandomizer[0].kingdom;

          let cards: CardNoId[] = [];

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
        } else {
          // Events, landmarks, projects, ways, and traits all share the same
          // "events and others" selection-limit semantics — one branch
          // replaces five near-identical blocks.
          const landscapeType = selectedRandomizer.type;
          this._loggerService.info(`[match configurator] selected ${landscapeType} ${selectedRandomizer.randomizer}`);

          if (++selectedEventsAndOthers <= allowedEventsAndOthers) {
            this._loggerService.info(
              `[match configurator] selected ${landscapeType} ${selectedRandomizer.randomizer} is allowed, adding to match`,
            );
            const cardLike = selectedRandomizer.cardLike;

            if (!cardLike) {
              throw new Error(
                `[match configurator] ${landscapeType} not found for randomizer ${selectedRandomizer.randomizer}`,
              );
            }

            this.pushLandscapeSelection(landscapeType, cardLike);
          } else {
            this._loggerService.info(
              `[match configurator] selected ${landscapeType} ${selectedRandomizer.randomizer} is not allowed, already have max number of events and others`,
            );
          }

          // reduce the counter because non-kingdom landscapes don't count against kingdoms selection
          i--;
        }

        // remove the selected pile so it can't be selected again
        uniqueRandomizers.splice(randomIndex, 1);
      }
    }

    // Resolve the full member list for each pile so that a preselected randomizer
    // card (e.g. Castles, Knights, Augurs) expands to the full pile in the supply
    // instead of producing N copies of just the randomizer card. Mirrors how the
    // random-kingdom path treats multi-card piles (see the cardsInRandomizer branch above).
    const allSelectedExpansions = this.getSelectedExpansionData();

    const randomizerGroups = getAvailableKingdomRandomizerGroups({
      expansions: allSelectedExpansions,
    });
    const groupByPileKey = new Map(randomizerGroups.map(group => [group.pileKey, group]));

    this._config.kingdomSupply = structuredClone(
      selectedKingdoms
        .map(card => {
          const pileKey = getCardPileKey(card);
          const group = groupByPileKey.get(pileKey);
          const members = group?.cards ?? [card];

          // Single-card pile: keep the existing N-copies behaviour.
          if (members.length === 1) {
            return {
              name: pileKey,
              cards: new Array(getDefaultKingdomSupplySize(members[0], this._config)).fill(members[0]),
            };
          }

          // Multi-card pile: every member appears once, mirroring the random-kingdom path.
          return {
            name: pileKey,
            cards: structuredClone(members),
          };
        })
        .concat(additionalKingdoms),
    );

    this._loggerService.info(
      `[match configurator] finalized selected kingdoms count ${this._config.kingdomSupply.length}`,
    );
    this._loggerService.info(this._config.kingdomSupply.map(supply => supply.name).join('\n'));
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

    const basicSupply = this._config.basicSupply.map(supply => supply.name).join(', ');
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
        if ((error as { code?: string })?.code === 'ERR_MODULE_NOT_FOUND') {
          // No configurator file for this expansion — a normal, expected case.
          this._loggerService.info(
            `[match configurator] no configurator factory found for expansion '${expansionName}'`,
          );
          continue;
        }
        // The configurator module exists but failed to import/execute (syntax
        // error, throwing top-level code, etc.) — this must not be silently
        // treated as "absent"; surface it loudly so match init fails visibly
        // instead of silently running without that expansion's rules.
        this._loggerService.error(
          `[match configurator] configurator for expansion '${expansionName}' exists but failed to load`,
        );
        this._loggerService.error(error);
        throw error;
      }
    }
    return configurators;
  }

  // Resolves a card-like key (event/landmark/project/way/etc) back to its owning expansion name.
  private resolveCardLikeExpansionName(cardLikeKey: string): string | undefined {
    const expansionLibrary = this._expansionCatalogService.getExpansionLibrary();
    for (const [expansionName, expansionData] of Object.entries(expansionLibrary)) {
      if (
        expansionData.events[cardLikeKey] ||
        expansionData.allies[cardLikeKey] ||
        expansionData.prophecies[cardLikeKey] ||
        expansionData.traits[cardLikeKey] ||
        expansionData.landmarks[cardLikeKey] ||
        expansionData.projects[cardLikeKey] ||
        expansionData.ways[cardLikeKey]
      ) {
        return expansionName;
      }
    }
    return undefined;
  }

  // Resolves all expansion names relevant to this configuration, including selected expansion toggles.
  private getConfiguredExpansionNames(): string[] {
    const configuredExpansionNames = this._config.expansions.map(expansion => expansion.name);
    const selectedKingdomExpansions = this._config.kingdomSupply.flatMap(supply =>
      supply.cards.map(card => card.expansionName),
    );
    // Card-likes can require expansion configurators even when no kingdoms card from that expansion is selected.
    const selectedCardLikeKeys = [
      ...(this._config.events ?? []).map(event => event.cardKey),
      ...(this._config.allies ?? []).map(ally => ally.cardKey),
      ...(this._config.prophecies ?? []).map(prophecy => prophecy.cardKey),
      ...(this._config.landmarks ?? []).map(landmark => landmark.cardKey),
      ...(this._config.projects ?? []).map(project => project.cardKey),
      ...(this._config.ways ?? []).map(way => way.cardKey),
      ...(this._config.traits ?? []).map(trait => trait.cardKey),
    ];
    const selectedCardLikeExpansions = selectedCardLikeKeys
      .map(cardLikeKey => this.resolveCardLikeExpansionName(cardLikeKey))
      .filter((expansionName): expansionName is string => !!expansionName);

    return Array.from(
      new Set([...configuredExpansionNames, ...selectedKingdomExpansions, ...selectedCardLikeExpansions]),
    );
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
        if ((error as { code?: string })?.code === 'ERR_MODULE_NOT_FOUND') {
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
        if ((error as { code?: string })?.code === 'ERR_MODULE_NOT_FOUND') {
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
        if ((error as { code?: string })?.code === 'ERR_MODULE_NOT_FOUND') {
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
