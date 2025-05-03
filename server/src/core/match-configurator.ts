import { CardKey, CardNoId, ComputedMatchConfiguration, Match, MatchConfiguration } from 'shared/shared-types.ts';
import { allCardLibrary, ExpansionData, expansionLibrary } from '@expansions/expansion-library.ts';
import {
  ActionRegistrar,
  CardEffectRegistrar,
  EndGameConditionRegistrar,
  ExpansionConfigurator,
  ExpansionConfiguratorFactory,
  MatchBaseConfiguration,
  PlayerScoreDecoratorRegistrar
} from '../types.ts';
import { addMatToMatchConfig } from '../utils/add-mat-to-match-config.ts';
import { compare, Operation } from 'https://esm.sh/v123/fast-json-patch@3.1.1/index.js';

type InitializeExpansionContext = {
  match: Match;
  actionRegistrar: ActionRegistrar;
  endGameConditionRegistrar: EndGameConditionRegistrar;
  playerScoreDecoratorRegistrar: PlayerScoreDecoratorRegistrar;
  cardEffectRegistrar: CardEffectRegistrar;
}

export class MatchConfigurator {
  private _requestedKingdoms: CardNoId[] = [];
  private _bannedKingdoms: CardNoId[] = [];
  private readonly _config: ComputedMatchConfiguration;
  
  constructor(
    config: MatchConfiguration
  ) {
    
    this._config = structuredClone(config) as ComputedMatchConfiguration;
    
    console.log(`[match configurator] created`);
  }
  
  public async createConfiguration() {
    const requisiteKingdomCardKeys = Deno.env.get('REQUISITE_KINGDOM_CARD_KEYS')
      ?.toLowerCase()
      ?.split(',')
      ?.map(e => e.trim()) ?? [];
    
    if (requisiteKingdomCardKeys && requisiteKingdomCardKeys.length > 0) {
      console.warn(`[match configurator] hard-coded keeper cards ${requisiteKingdomCardKeys}`);
      console.log(requisiteKingdomCardKeys?.join('\n'));
    }
    
    if (this._config.kingdomCards?.length > 0) {
      console.log(`[match configurator] requested kingdom cards ${this._config.kingdomCards.length}`);
      console.log(this._config.kingdomCards?.map(card => card.cardKey)?.join('\n'));
    }
    else {
      console.log(`[match configurator] no cards requested in during match configuration`);
    }
    
    console.log(`[match configurator] removing possible duplicates from requested and hard-coded kingdoms`);
    
    this._requestedKingdoms =
      Array.from(new Set([
        ...requisiteKingdomCardKeys,
        ...(this._config.kingdomCards?.map(card => card.cardKey) ?? [])
      ]))
        .map(key => structuredClone(allCardLibrary[key]))
        .filter(card => !!card);
    
    if (this._requestedKingdoms.length > MatchBaseConfiguration.numberOfKingdomPiles) {
      const requestedKingdomCardKeys = this._requestedKingdoms.map(card => card.cardKey);
      console.log(`[match configurator] requested kingdom cards exceeds 10, truncating to 10 ${requestedKingdomCardKeys.join(', ')}`);
      this._requestedKingdoms.length = MatchBaseConfiguration.numberOfKingdomPiles;
    }
    
    this._bannedKingdoms = this._config.bannedKingdoms?.slice() ?? [];
    
    this.selectKingdomSupply();
    this.selectBasicSupply();
    addMatToMatchConfig('set-aside', this._config);
    await this.registerExpansionConfigurators();
    
    return { config: this._config };
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
    
    this._config.kingdomCards = structuredClone(selectedKingdoms);
    
    console.log(`[match configurator] finalized selected kingdoms count ${this._config.kingdomCards.length}`);
    console.log(this._config.kingdomCards.map(card => card.cardKey).join('\n'));
  }
  
  private selectBasicSupply() {
    // based on the number of players, get the basic supply card counts
    const basicCardCounts = { ...MatchBaseConfiguration.basicSupplyByPlayerCount[this._config.players.length - 1] } as Record<CardKey, number>;
    
    // coppers come from the supply, so they are removed here, because these represent the cards IN the supply at the
    // start of game. The coppers in a player's hand come from the supply, whereas the estates do not.
    this._config.basicCardCount = Object.keys(basicCardCounts).reduce((acc, nextKey) => {
      acc[nextKey] = nextKey === 'copper' ? this._config.players.length * MatchBaseConfiguration.playerStartingHand.copper : basicCardCounts[nextKey];
      return acc;
    }, {} as Record<CardKey, number>);
    
    // create the basic cards map
    this._config.basicCards = structuredClone(Object.keys(basicCardCounts).reduce((acc, nextKey) => {
      acc.push({ ...allCardLibrary[nextKey] });
      return acc;
    }, [] as CardNoId[]));
    
    console.log(`[match configurator] setting default basic cards ${this._config.basicCards.map(card => card.cardKey)
      .join(', ')}`);
  }
  
  private _expansionConfigurators = new Map<string, ExpansionConfigurator>();
  
  private async registerExpansionConfigurators() {
    const uniqueExpansions = Array.from(new Set(this._config.kingdomCards.map(card => card.expansionName)));
    for (const expansionName of uniqueExpansions) {
      try {
        console.log(`[match configurator] loading configurator for expansion '${expansionName}'`);
        const configuratorFactory = (await import(`@expansions/${expansionName}/configurator-${expansionName}.ts`)).default as ExpansionConfiguratorFactory;
        this._expansionConfigurators.set(expansionName, configuratorFactory());
      } catch (error) {
        console.log(`[match configurator] no configurator factory found for expansion '${expansionName}'`);
      }
    }
  }
  
  public async initializeExpansions({
    match,
    endGameConditionRegistrar,
    actionRegistrar,
    playerScoreDecoratorRegistrar,
    cardEffectRegistrar
  }: InitializeExpansionContext) {
    console.log(`[match configurator] initializing expansions`);
    
    await this.runExpansionConfigurators({ actionRegistrar, cardEffectRegistrar });
    
    this._config.kingdomCardCount = this._config.kingdomCards.reduce((acc, nextKingdom) => {
      const cardKey = nextKingdom.cardKey;
      acc[cardKey] = nextKingdom.type.includes('VICTORY')
        ? (this._config.players.length < 3 ? 8 : 12)
        : 10;
      
      console.log(`[match configurator] setting card count to ${acc[cardKey]} for ${cardKey}`);
      return acc;
    }, {} as Record<CardKey, number>)
    
    console.log(`[match configurator] registering expansion actions`);
    await this.registerExpansionActions(actionRegistrar, match);
    
    console.log(`[match configurator] registering expansion card effects`);
    await this.registerExpansionCardEffects(cardEffectRegistrar);
    
    console.log(`[match configurator] registering expansion end game conditions`);
    await this.registerExpansionEndGameConditions(endGameConditionRegistrar);
    
    console.log(`[match configurator] registering expansion scoring effects`);
    await this.registerExpansionPlayerScoreDecorators(playerScoreDecoratorRegistrar);
  }
  
  private async runExpansionConfigurators({ actionRegistrar, cardEffectRegistrar }: {
    cardEffectRegistrar: CardEffectRegistrar;
    actionRegistrar: ActionRegistrar;
  }) {
    const iter = this._expansionConfigurators.entries();
    
    let iteration = 0;
    let changes: Operation[] = [];
    let configSnapshot = structuredClone(this._config);
    
    do {
      iteration++;
      for (const [expansionName, expansionConfigurator] of iter) {
        console.log(`[match configurator] running expansion configurator for expansion '${expansionName}'`);
        expansionConfigurator({
          cardEffectRegistrar,
          actionRegistrar,
          config: this._config,
          cardLibrary: allCardLibrary,
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
  }
  
  private async registerExpansionActions(actionRegistrar: ActionRegistrar, match: Match) {
    const uniqueExpansions = Array.from(new Set(this._config.kingdomCards.map(card => card.expansionName)));
    for (const expansion of uniqueExpansions) {
      try {
        const module = await import((`@expansions/${expansion}/configurator-${expansion}.ts`));
        if (!module.registerActions) continue;
        module.registerActions(actionRegistrar, { match });
      } catch (error) {
        console.warn(`[match configurator] failed to register expansion actions for ${expansion}`);
        console.log(error);
      }
    }
  }
  
  private async registerExpansionCardEffects(registrar: CardEffectRegistrar) {
    const uniqueExpansions = Array.from(new Set(this._config.kingdomCards.map(card => card.expansionName)));
    for (const expansion of uniqueExpansions) {
      try {
        const module = await import((`@expansions/${expansion}/configurator-${expansion}.ts`));
        if (!module.registerCardEffects) continue;
        module.registerCardEffects(registrar);
      } catch (error) {
        console.warn(`[match configurator] failed to register expansion actions for ${expansion}`);
        console.log(error);
      }
    }
  }
  
  private async registerExpansionEndGameConditions(registrar: EndGameConditionRegistrar) {
    const uniqueExpansions = Array.from(new Set(this._config.kingdomCards.map(card => card.expansionName)));
    for (const expansion of uniqueExpansions) {
      try {
        const module = await import((`@expansions/${expansion}/configurator-${expansion}.ts`));
        if (!module.registerEndGameConditions) continue;
        module.registerEndGameConditions(registrar);
      } catch (error) {
        console.warn(`[match configurator] failed to register expansion end game conditions for ${expansion}`);
        console.log(error);
      }
    }
  }
  
  private async registerExpansionPlayerScoreDecorators(registrar: PlayerScoreDecoratorRegistrar) {
    const uniqueExpansions = Array.from(new Set(this._config.kingdomCards.map(card => card.expansionName)));
    for (const expansion of uniqueExpansions) {
      try {
        const module = await import((`@expansions/${expansion}/configurator-${expansion}.ts`));
        if (!module.registerScoringFunctions) continue;
        module.registerScoringFunctions(registrar);
      } catch (error) {
        console.warn(`[match configurator] failed to register expansion coring functions for ${expansion}`);
        console.log(error);
      }
    }
  }
}