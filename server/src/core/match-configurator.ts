import {
  CardKey,
  CardLikeNoId,
  CardNoId,
  ComputedMatchConfiguration,
  EventNoId,
  Match,
  MatchConfiguration,
  Supply
} from 'shared/shared-types.ts';
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
import { compare, Operation } from 'https://esm.sh/v123/fast-json-patch@3.1.1/index.js';
import { CardSourceController } from './card-source-controller.ts';
import { getDefaultKingdomSupplySize } from '../utils/get-default-kingdom-supply-size.ts';

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
    
    console.log(`[match configurator] created`);
  }
  
  public async createConfiguration(initContext: InitializeExpansionContext) {
    const requisiteKingdomCardKeys = Deno.env.get('REQUISITE_KINGDOM_CARD_KEYS')
      ?.toLowerCase()
      ?.split(',')
      ?.map(e => e.trim())
      ?.filter(e => !!e) ?? [];
    
    if (requisiteKingdomCardKeys && requisiteKingdomCardKeys.length > 0) {
      console.warn(`[match configurator] hard-coded keeper cards ${requisiteKingdomCardKeys}`);
      console.log(requisiteKingdomCardKeys?.join('\n'));
    }
    
    this._config.preselectedKingdoms = this._config.preselectedKingdoms.filter(card => !!card);
    
    if (this._config.preselectedKingdoms?.length > 0) {
      console.log(`[match configurator] requested kingdom cards ${this._config.preselectedKingdoms.length}`);
      console.log(this._config.preselectedKingdoms?.map(card => card.cardKey)?.join('\n'));
    }
    else {
      console.log(`[match configurator] no cards requested in during match configuration`);
    }
    
    console.log(`[match configurator] removing possible duplicates from requested and hard-coded kingdoms`);
    
    this._requestedKingdoms =
      Array.from(new Set([
        ...requisiteKingdomCardKeys,
        ...(this._config.preselectedKingdoms?.map(card => card.cardKey) ?? [])
      ]))
        .map(key => structuredClone(rawCardLibrary[key]))
        .filter(card => !!card);
    
    if (this._requestedKingdoms.length > MatchBaseConfiguration.numberOfKingdomPiles) {
      const requestedKingdomCardKeys = this._requestedKingdoms.map(card => card.cardKey);
      console.log(`[match configurator] requested kingdom cards exceeds 10, truncating to 10 ${requestedKingdomCardKeys.join(', ')}`);
      this._requestedKingdoms.length = MatchBaseConfiguration.numberOfKingdomPiles;
    }
    
    this._bannedKingdoms = this._config.bannedKingdoms?.slice() ?? [];
    
    this.selectKingdomSupply();
    this.selectBasicSupply();
    
    await this.runExpansionConfigurators(initContext);
    
    this.createCardSources(initContext.match, initContext.cardSourceController);
    
    return { config: this._config };
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
      console.log(`[match configurator] number of requested kingdoms ${this._requestedKingdoms.length} is enough`);
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
      
      // list of randomizers that are banned or already pre-selected
      const bannedKingdomRandomizers = this._bannedKingdoms.map(card => card.randomizer) as string[];
      const alreadyIncludedKingdomRandomizers = selectedKingdoms.map(card => card.randomizer) as string[];
      
      console.log(`[match configurator] banned kingdoms ${bannedKingdomRandomizers.join(', ') ?? '- no banned kingdoms'}`);
      
      // loop over the selected expansions, and filter out any kingdom cards that
      // are banned, are already included, or do not have a randomizer
      const availableRandomizers = selectedExpansions.flatMap((nextExpansion) => [
        ...Object
          .values(nextExpansion.cardData.kingdomSupply)
          .filter(card =>
            card.randomizer !== null && !bannedKingdomRandomizers.includes(card.randomizer) && !alreadyIncludedKingdomRandomizers.includes(card.cardKey)
          )
          .map(card => {
            return {
              randomizer: card.randomizer,
              cardLike: card,
              type: 'card',
            };
          }),
        ...Object.values(nextExpansion.events)
          .filter(event => event.randomizer !== null)
          .map(event => ({
            randomizer: event.randomizer,
            cardLike: event,
            type: 'event'
          }))
      ]) as { randomizer: string; type: 'card' | 'event'; cardLike: CardLikeNoId; }[];
      
      const uniqueRandomizers = uniqueByProp(availableRandomizers, 'randomizer');
      
      console.log(`[match configurator] available kingdoms ${uniqueRandomizers.length}`);
      console.log(uniqueRandomizers.join('\n'));
      
      const numKingdomsToSelect = MatchBaseConfiguration.numberOfKingdomPiles - this._requestedKingdoms.length;
      
      console.log(`[match configurator] need to select ${numKingdomsToSelect} kingdoms`);
      
      const allowedEventsAndOthers = MatchBaseConfiguration.numberOfEventsAndOthers;
      let selectedEventsAndOthers = this._config.events.length;
      
      for (let i = 0; i < numKingdomsToSelect; i++) {
        const randomIndex = Math.floor(Math.random() * uniqueRandomizers.length);
        const selectedRandomizer = uniqueRandomizers[randomIndex];
        
        if (selectedRandomizer.type === 'card') {
          console.log(`[match configurator] selected kingdom ${selectedRandomizer.randomizer}`);
          
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
        else {
          console.log(`[match configurator] selected event ${selectedRandomizer.randomizer}`);
          
          if (++selectedEventsAndOthers <= allowedEventsAndOthers) {
            console.log(`[match configurator] selected event ${selectedRandomizer.randomizer} is allowed, adding to match`);
            const event = availableRandomizers
              .find(randomizer => randomizer.randomizer === selectedRandomizer.randomizer)
              ?.cardLike as EventNoId;
            
            if (!event) {
              throw new Error(`[match configurator] event not found for randomizer ${selectedRandomizer.randomizer}`);
            }
            
            this._config.events.push(event);
          }
          else {
            console.log(`[match configurator] selected event ${selectedRandomizer.randomizer} is not allowed, already have max number of events and others`);
          }
          
          // reduce the counter because events don't count against kingdom selection
          i--;
        }
        
        // remove the randomizer so it can't be selected again
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
    
    console.log(`[match configurator] finalized selected kingdoms count ${this._config.kingdomSupply.length}`);
    console.log(this._config.kingdomSupply.map(supply => supply.name).join('\n'));
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
    console.log(`[match configurator] setting default basic cards ${basicSupply}`);
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
        console.log(`[match configurator] loading configurator for expansion '${expansionName}'`);
        const configuratorFactory = (await import(`@expansions/${expansionName}/configurator-${expansionName}.ts`)).default as ExpansionConfiguratorFactory;
        configurators.set(expansionName, configuratorFactory());
      } catch (error) {
        console.log(`[match configurator] no configurator factory found for expansion '${expansionName}'`);
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
        console.log(`[match configurator] running expansion configurator for expansion '${expansionName}'`);
        await expansionConfigurator({
          ...initContext,
          config: this._config,
          cardLibrary: rawCardLibrary,
          expansionData: expansionLibrary[expansionName]
        });
      }
      
      changes = compare(configSnapshot, this._config);
      
      console.log(`[match configurator] expansion configurator iteration ${iteration} changes ${changes.length}`);
      
      configSnapshot = structuredClone(this._config);
    } while (changes.length > 0 && iteration < 10);
    
    if (iteration >= 10) {
      throw new Error(`[match configurator] expansion configurator failed to converge after 10 iterations`);
    }
    
    console.log(`[match configurator] registering expansion end game conditions`);
    await this.registerExpansionEndGameConditions(initContext.endGameConditionRegistrar);
    
    console.log(`[match configurator] registering expansion scoring effects`);
    await this.registerExpansionPlayerScoreDecorators(initContext.playerScoreDecoratorRegistrar);
    
    console.log(`[match configurator] registering game event listeners`);
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
        console.log(error);
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
        console.log(error);
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
        console.log(error);
      }
    }
  }
}