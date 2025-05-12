import {
  CardKey,
  CardNoId,
  ComputedMatchConfiguration,
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
    
    this._config = structuredClone(config) as ComputedMatchConfiguration;
    
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
    
    if (selectedKingdoms.length === MatchBaseConfiguration.numberOfKingdomPiles) {
      console.log(`[match configurator] number of requested kingdoms ${this._requestedKingdoms.length} is enough`);
    }
    else {
      const selectedExpansions = this._config.expansions.reduce((acc, allowedExpansion) => {
        const expansionData = expansionLibrary[allowedExpansion.name];
        if (!expansionData) {
          console.warn(`[match configurator] expansion ${allowedExpansion.name} not found`);
          return acc;
        }
        acc.push(expansionData);
        return acc;
      }, [] as ExpansionData[]);
      
      const bannedKingdomKeys = this._bannedKingdoms.map(card => card.cardKey);
      const alreadyIncludedKeys = selectedKingdoms.map(card => card.cardKey);
      
      console.log(`[match configurator] banned kingdoms ${bannedKingdomKeys.join(', ') ?? '- no banned kingdoms'}`);
      
      const availableKingdoms = selectedExpansions.flatMap((nextExpansion) => {
        return Object.values(nextExpansion.cardData.kingdomSupply)
          .filter(card => !bannedKingdomKeys.includes(card.cardKey) && !alreadyIncludedKeys.includes(card.cardKey));
      });
      
      console.log(`[match configurator] available kingdoms ${availableKingdoms.length}`);
      console.log(availableKingdoms.map(card => card.cardKey).join('\n'));
      
      const numKingdomsToSelect = MatchBaseConfiguration.numberOfKingdomPiles - this._requestedKingdoms.length;
      
      console.log(`[match configurator] need to select ${numKingdomsToSelect} kingdoms`);
      
      const additionalKingdoms: CardNoId[] = [];
      
      for (let i = 0; i < numKingdomsToSelect; i++) {
        const randomIndex = Math.floor(Math.random() * availableKingdoms.length);
        const randomKingdom = availableKingdoms[randomIndex];
        additionalKingdoms.push({ ...randomKingdom });
        availableKingdoms.splice(randomIndex, 1);
      }
      
      console.log(`[match configurator] additional kingdoms to add`);
      console.log(additionalKingdoms.map(card => card.cardKey).join('\n'));
      
      selectedKingdoms = [...selectedKingdoms, ...additionalKingdoms];
    }
    
    this._config.kingdomSupply = structuredClone(selectedKingdoms.map(card => {
      return {
        name: card.cardKey,
        cards: new Array(getDefaultKingdomSupplySize(card, this._config)).fill(card)
      }
    }));
    
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