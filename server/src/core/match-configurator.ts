import {
  CardKey,
  CardLikeNoId,
  CardNoId,
  ComputedMatchConfiguration,
  EventNoId,
  LandmarkNoId,
  Match,
  MatchConfiguration,
  Supply
} from 'shared/shared-types';
import { ExpansionData, expansionLibrary, rawCardLibrary } from '@expansions/expansion-library.ts';
import {
  EndGameConditionRegistrar,
  ExpansionConfigurator,
  ExpansionConfiguratorFactory,
  GameEventRegistrar,
  InitializeExpansionContext,
  MatchBaseConfiguration,
  PlayerScoreDecoratorRegistrar
} from '../types.ts';
import { compare, Operation } from "fast-json-patch";
import { CardSourceController } from './card-source-controller.ts';
import { getDefaultKingdomSupplySize } from '../utils/get-default-kingdom-supply-size.ts';
import { getCardPileKey } from '../utils/get-card-pile-key.ts';

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
  K extends keyof T = keyof T
>(
  list: T[],
  prop: K,
  keep: 'first' | 'last' = 'first',
): T[] {
  if (keep === 'first') {
    // Keep the first occurrence
    const seen = new Set<any>();
    return list.filter(item => {
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

  constructor(config: MatchConfiguration) {

    // when creating the clone, it will break the custom Deno.customInspect symbols on classes so they won't
    // properly print. I'm not sure if we NEED the structured clone, might just remove it eventually. I tested
    // and that worked as well as of this fix. but i kind of want all changes to be self-contained in the configurator
    // so i like having that "separation" of it coming in and being clean from then in to this configurator instance
    const players = [...config.players];
    this._config = structuredClone(config) as ComputedMatchConfiguration;
    this._config.players = players;
    // Ensure landmarks array exists for downstream selection logic.
    this._config.landmarks ??= [];
    // Ensure states array exists for downstream configuration logic.
    this._config.states ??= [];
    // Ensure artifacts array exists for downstream configuration logic.
    this._config.artifacts ??= [];

    console.info(`[match configurator] created`);
  }

  public async createConfiguration(initContext: InitializeExpansionContext) {
    const requisiteKingdomCardKeys = Deno.env.get('REQUISITE_KINGDOM_CARD_KEYS')
      ?.toLowerCase()
      ?.split(',')
      ?.map(e => e.trim())
      ?.filter(e => !!e) ?? [];

    if (requisiteKingdomCardKeys && requisiteKingdomCardKeys.length > 0) {
      console.warn(`[match configurator] hard-coded keeper cards ${requisiteKingdomCardKeys}`);
      console.info(requisiteKingdomCardKeys?.join('\n'));
    }

    this._config.preselectedKingdoms = this._config.preselectedKingdoms.filter(card => !!card);

    if (this._config.preselectedKingdoms?.length > 0) {
      console.info(`[match configurator] requested kingdom cards ${this._config.preselectedKingdoms.length}`);
      console.info(this._config.preselectedKingdoms?.map(card => card.cardKey)?.join('\n'));
    }
    else {
      console.info(`[match configurator] no cards requested in during match configuration`);
    }

    console.info(`[match configurator] removing possible duplicates from requested and hard-coded kingdoms`);

    this._requestedKingdoms =
      Array.from(new Set([
        ...requisiteKingdomCardKeys,
        ...(this._config.preselectedKingdoms?.map(card => card.cardKey) ?? [])
      ]))
        .map(key => structuredClone(rawCardLibrary[key]))
        .filter(card => !!card);

    if (this._requestedKingdoms.length > MatchBaseConfiguration.numberOfKingdomPiles) {
      const requestedKingdomCardKeys = this._requestedKingdoms.map(card => card.cardKey);
      console.info(`[match configurator] requested kingdom cards exceeds 10, truncating to 10 ${requestedKingdomCardKeys.join(', ')}`);
      this._requestedKingdoms.length = MatchBaseConfiguration.numberOfKingdomPiles;
    }

    this._bannedKingdoms = this._config.bannedKingdoms?.slice() ?? [];

    // Trim preselected events/landmarks to the configured landscape cap before selection.
    this.enforceLandscapeLimit();
    this.selectKingdomSupply();
    this.selectBasicSupply();

    await this.runExpansionConfigurators(initContext);

    this.createCardSources(initContext.match, initContext.cardSourceController);

    return { config: this._config };
  }

  // Logs when preselected landscapes exceed the configured cap; random selection handles limits.
  private enforceLandscapeLimit(): void {
    const allowedEventsAndOthers = MatchBaseConfiguration.numberOfEventsAndOthers;
    const events = this._config.events ?? [];
    const landmarks = this._config.landmarks ?? [];
    const total = events.length + landmarks.length;

    if (total <= allowedEventsAndOthers) {
      return;
    }

    console.info(
      `[match configurator] ${total} landscapes preselected, skipping random landscape selection cap of ${allowedEventsAndOthers}`,
    );
  }

  private createCardSources(match: Match, cardSourceController: CardSourceController) {
    // todo: right now these register locations that were previously hard-coded in the match state.
    // i'm converting to use this CardSourceController class and these might be able to be converted
    // into non-hardcoded locations.
    cardSourceController.registerZone('kingdomSupply', []);
    cardSourceController.registerZone('basicSupply', []);
    cardSourceController.registerZone('nonSupplyCards', []);
    cardSourceController.registerZone('activeDuration', []);
    cardSourceController.registerZone('playArea', []);
    cardSourceController.registerZone('trash', []);

    for (const player of this._config.players) {
      cardSourceController.registerZone('playerHand', [], player.id);
      cardSourceController.registerZone('playerDiscard', [], player.id);
      cardSourceController.registerZone('playerDeck', [], player.id);
      cardSourceController.registerZone('set-aside', [], player.id);
    }
  }

  private selectKingdomSupply() {
    let selectedKingdoms: CardNoId[] = this._requestedKingdoms.slice();
    const additionalKingdoms: { name: string; cards: CardNoId[]; }[] = [];

    if (selectedKingdoms.length === MatchBaseConfiguration.numberOfKingdomPiles) {
      console.info(`[match configurator] number of requested kingdoms ${this._requestedKingdoms.length} is enough`);
    }
    else {
      // reduces the player-configured expansions into an array whose elements are the expansions' library data
      const selectedExpansions = this._config.expansions.reduce((acc, allowedExpansion) => {
        const expansionData = expansionLibrary[allowedExpansion.name];
        if (!expansionData) {
          console.warn(`[match configurator] expansion ${allowedExpansion.name} not found`);
          return acc;
        }
        acc.push(expansionData);
        return acc;
      }, [] as ExpansionData[]);

      // list of pile keys that are banned or already pre-selected
      const bannedKingdomRandomizers = this._bannedKingdoms.map(card => getCardPileKey(card));
      const alreadyIncludedKingdomRandomizers = selectedKingdoms.map(card => getCardPileKey(card));

      console.info(`[match configurator] banned kingdoms ${bannedKingdomRandomizers.join(', ') ?? '- no banned kingdoms'}`);

      // loop over the selected expansions, and filter out any kingdom cards that
      // are banned, are already included, or are not kingdom-selectable
      const availableRandomizers = selectedExpansions.flatMap((nextExpansion) => [
        ...Object
          .values(nextExpansion.cardData.kingdomSupply)
          .filter(card => (card.kingdomSelectable ?? true))
          .map(card => {
            const pileKey = getCardPileKey(card);
            if (bannedKingdomRandomizers.includes(pileKey)) return null;
            if (alreadyIncludedKingdomRandomizers.includes(pileKey)) return null;
            return {
              randomizer: pileKey,
              cardLike: card,
              type: 'card',
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => !!entry),
        ...Object.values(nextExpansion.events)
          .filter(event => event.randomizer !== null)
          .map(event => ({
            randomizer: event.randomizer,
            cardLike: event,
            type: 'event'
          })),
        // Landmarks participate in the shared "events and others" randomizer pool.
        ...Object.values(nextExpansion.landmarks)
          .filter(landmark => landmark.randomizer !== null)
          .map(landmark => ({
            randomizer: landmark.randomizer,
            cardLike: landmark,
            type: 'landmark'
          }))
      ]) as { randomizer: string; type: 'card' | 'event' | 'landmark'; cardLike: CardLikeNoId | CardNoId; }[];

      const uniqueRandomizers = uniqueByProp(availableRandomizers, 'randomizer');

      console.info(`[match configurator] available kingdoms ${uniqueRandomizers.length}`);
      console.info(uniqueRandomizers.join('\n'));

      const numKingdomsToSelect = MatchBaseConfiguration.numberOfKingdomPiles - this._requestedKingdoms.length;

      console.info(`[match configurator] need to select ${numKingdomsToSelect} kingdoms`);

      const allowedEventsAndOthers = MatchBaseConfiguration.numberOfEventsAndOthers;
      // Track the combined limit for events and other landscape types (landmarks included).
      let selectedEventsAndOthers = this._config.events.length + (this._config.landmarks?.length ?? 0);

      for (let i = 0; i < numKingdomsToSelect; i++) {
        const randomIndex = Math.floor(Math.random() * uniqueRandomizers.length);
        const selectedRandomizer = uniqueRandomizers[randomIndex];

        if (selectedRandomizer.type === 'card') {
          console.info(`[match configurator] selected kingdom ${selectedRandomizer.randomizer}`);

          const cardsInRandomizer = availableRandomizers
            .filter(randomizer => randomizer.randomizer === selectedRandomizer.randomizer)
            .map(randomizer => randomizer.cardLike) as CardNoId[];

          // this makes an assumption that if there are more cards within a randomizer group (such as knights from dark
          // ages) that they will all be in the same kingdom.
          const kingdom = cardsInRandomizer[0].kingdom;

          let cards: CardNoId[] = [];

          if (!cardsInRandomizer.length) {
            throw new Error(`[match configurator] no cards found for randomizer ${selectedRandomizer.randomizer}`);
          }

          if (cardsInRandomizer.length === 1) {
            cards = new Array(getDefaultKingdomSupplySize(cardsInRandomizer[0], this._config)).fill(cardsInRandomizer[0]);
          }
          else {
            cards = cardsInRandomizer;
          }

          additionalKingdoms.push({
            name: kingdom,
            cards
          });
        }
        else if (selectedRandomizer.type === 'event') {
          console.info(`[match configurator] selected event ${selectedRandomizer.randomizer}`);

          if (++selectedEventsAndOthers <= allowedEventsAndOthers) {
            console.info(`[match configurator] selected event ${selectedRandomizer.randomizer} is allowed, adding to match`);
            const event = availableRandomizers
              .find(randomizer => randomizer.randomizer === selectedRandomizer.randomizer)
              ?.cardLike as EventNoId;

            if (!event) {
              throw new Error(`[match configurator] event not found for randomizer ${selectedRandomizer.randomizer}`);
            }

            this._config.events.push(event);
          }
          else {
            console.info(`[match configurator] selected event ${selectedRandomizer.randomizer} is not allowed, already have max number of events and others`);
          }

          // reduce the counter because events don't count against kingdom selection
          i--;
        }
        else {
          // Landmarks are treated as "others" alongside events for random selection limits.
          console.info(`[match configurator] selected landmark ${selectedRandomizer.randomizer}`);

          if (++selectedEventsAndOthers <= allowedEventsAndOthers) {
            console.info(`[match configurator] selected landmark ${selectedRandomizer.randomizer} is allowed, adding to match`);
            const landmark = availableRandomizers
              .find(randomizer => randomizer.randomizer === selectedRandomizer.randomizer)
              ?.cardLike as LandmarkNoId;

            if (!landmark) {
              throw new Error(`[match configurator] landmark not found for randomizer ${selectedRandomizer.randomizer}`);
            }

            this._config.landmarks ??= [];
            this._config.landmarks.push(landmark);
          }
          else {
            console.info(`[match configurator] selected landmark ${selectedRandomizer.randomizer} is not allowed, already have max number of events and others`);
          }

          // reduce the counter because landmarks don't count against kingdom selection
          i--;
        }

        // remove the selected pile so it can't be selected again
        uniqueRandomizers.splice(randomIndex, 1);
      }
    }

    this._config.kingdomSupply =
      structuredClone(
        selectedKingdoms.map(card => {
          return {
            name: card.cardKey,
            cards: new Array(getDefaultKingdomSupplySize(card, this._config)).fill(card)
          }
        }).concat(additionalKingdoms)
      );

    console.info(`[match configurator] finalized selected kingdoms count ${this._config.kingdomSupply.length}`);
    console.info(this._config.kingdomSupply.map(supply => supply.name).join('\n'));
  }

  private selectBasicSupply() {
    // based on the number of players, get the basic supply card counts
    const basicCardCounts = { ...MatchBaseConfiguration.basicSupplyByPlayerCount[this._config.players.length - 1] } as Record<CardKey, number>;

    // coppers come from the supply, so they are removed here, because these represent the cards IN the supply at the
    // start of game. The coppers in a player's hand come from the supply, whereas the estates do not.
    this._config.basicSupply = Object.keys(basicCardCounts).reduce((acc, nextKey) => {
      const cardData = { ...rawCardLibrary[nextKey] };
      acc.push({
        name: cardData.cardKey,
        cards: new Array(nextKey === 'copper' ? this._config.players.length * MatchBaseConfiguration.playerStartingHand.copper : basicCardCounts[nextKey]).fill(cardData)
      });
      return acc;
    }, [] as Supply[]);

    const basicSupply = this._config.basicSupply.map(supply => supply.name).join(', ');
    console.info(`[match configurator] setting default basic cards ${basicSupply}`);
  }

  private async getExpansionConfigurators() {
    const configurators = new Map<string, ExpansionConfigurator>();
    const uniqueExpansions =
      Array.from(
        new Set(this._config.kingdomSupply
          .map(supply => supply.cards.map(card => card.expansionName))
          .flat()
        )
      );
    for (const expansionName of uniqueExpansions) {
      try {
        console.info(`[match configurator] loading configurator for expansion '${expansionName}'`);
        const configuratorFactory = (await import(`@expansions/${expansionName}/configurator-${expansionName}.ts`)).default as ExpansionConfiguratorFactory;
        configurators.set(expansionName, configuratorFactory());
      } catch (error) {
        console.info(`[match configurator] no configurator factory found for expansion '${expansionName}'`);
      }
    }
    return configurators
  }

  private async runExpansionConfigurators(initContext: InitializeExpansionContext) {
    const configuratorIterator = (await this.getExpansionConfigurators()).entries();

    let iteration = 0;
    let changes: Operation[] = [];
    let configSnapshot = structuredClone(this._config);

    do {
      iteration++;
      for (const [expansionName, expansionConfigurator] of configuratorIterator) {
        console.info(`[match configurator] running expansion configurator for expansion '${expansionName}'`);
        await expansionConfigurator({
          ...initContext,
          config: this._config,
          cardLibrary: rawCardLibrary,
          expansionData: expansionLibrary[expansionName]
        });
      }

      changes = compare(configSnapshot, this._config);

      console.info(`[match configurator] expansion configurator iteration ${iteration} changes ${changes.length}`);

      configSnapshot = structuredClone(this._config);
    } while (changes.length > 0 && iteration < 10);

    if (iteration >= 10) {
      throw new Error(`[match configurator] expansion configurator failed to converge after 10 iterations`);
    }

    console.info(`[match configurator] registering expansion end game conditions`);
    await this.registerExpansionEndGameConditions(initContext.endGameConditionRegistrar);

    console.info(`[match configurator] registering expansion scoring effects`);
    await this.registerExpansionPlayerScoreDecorators(initContext.playerScoreDecoratorRegistrar);

    console.info(`[match configurator] registering game event listeners`);
    await this.registerGameEventListeners(initContext.gameEventRegistrar);
  }

  private async registerGameEventListeners(gameEventRegistrar: GameEventRegistrar) {
    const uniqueExpansions = Array.from(new Set(this._config.kingdomSupply.map(supply => supply.cards.map(card => card.expansionName))
      .flat()));
    for (const expansion of uniqueExpansions) {
      try {
        const module = await import((`@expansions/${expansion}/configurator-${expansion}.ts`));
        if (!module.registerGameEvents) continue;
        module.registerGameEvents(gameEventRegistrar, this._config);
      } catch (error) {
        if ((error as any)?.code === 'ERR_MODULE_NOT_FOUND') {
          continue;
        }
        console.warn(`[match configurator] failed to register expansion actions for ${expansion}`);
        console.error(error);
      }
    }
  }

  private async registerExpansionEndGameConditions(registrar: EndGameConditionRegistrar) {
    const uniqueExpansions = Array.from(new Set(this._config.kingdomSupply.map(supply => supply.cards.map(card => card.expansionName))
      .flat()));
    for (const expansion of uniqueExpansions) {
      try {
        const module = await import((`@expansions/${expansion}/configurator-${expansion}.ts`));
        if (!module.registerEndGameConditions) continue;
        module.registerEndGameConditions(registrar);
      } catch (error) {
        if ((error as any)?.code === 'ERR_MODULE_NOT_FOUND') {
          continue;
        }
        console.warn(`[match configurator] failed to register expansion end game conditions for ${expansion}`);
        console.error(error);
      }
    }
  }

  private async registerExpansionPlayerScoreDecorators(registrar: PlayerScoreDecoratorRegistrar) {
    const uniqueExpansions = Array.from(new Set(this._config.kingdomSupply.map(supply => supply.cards.map(card => card.expansionName))
      .flat()));
    for (const expansion of uniqueExpansions) {
      try {
        const module = await import((`@expansions/${expansion}/configurator-${expansion}.ts`));
        if (!module.registerScoringFunctions) continue;
        module.registerScoringFunctions(registrar);
      } catch (error) {
        if ((error as any)?.code === 'ERR_MODULE_NOT_FOUND') {
          continue;
        }
        console.warn(`[match configurator] failed to register expansion scoring functions for ${expansion}`);
        console.error(error);
      }
    }
  }
}
