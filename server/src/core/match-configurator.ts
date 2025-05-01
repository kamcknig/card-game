import { CardKey, CardNoId, ComputedMatchConfiguration, MatchConfiguration } from 'shared/shared-types.ts';
import { allCardLibrary, ExpansionData, expansionLibrary } from '@expansions/expansion-library.ts';
import { MatchBaseConfiguration } from '../types.ts';
import { addMatToMatchConfig } from '../utils/add-mat-to-match-config.ts';

type MatchConfiguratorOptions = {
  keeperCards: CardKey[];
}

export class MatchConfigurator {
  private _requestedKingdoms: CardNoId[] = [];
  private _bannedKingdoms: CardNoId[] = [];
  private _config: ComputedMatchConfiguration;
  private readonly _expansionEndGameConditionFuncs: ((...args: any[]) => boolean)[] = [];
  
  constructor(
    config: MatchConfiguration,
    private _options?: MatchConfiguratorOptions
  ) {
    
    this._config = structuredClone(config) as ComputedMatchConfiguration;
    
    console.log(`[match configurator] created`);
  }
  
  public async createConfiguration() {
    if (this._options?.keeperCards && this._options.keeperCards.length > 0) {
      console.warn(`[match configurator] hard-coded keeper cards ${this._options?.keeperCards?.length}`);
      console.log(this._options?.keeperCards?.join('\n'));
    }
    
    if (this._config.kingdomCards?.length > 0) {
      console.log(`[match configurator] requested kingdom cards ${this._config.kingdomCards.length}`);
      console.log(this._config.kingdomCards?.map(card => card.cardKey)?.join('\n'));
    }
    
    this._requestedKingdoms =
      Array.from(new Set([
        ...(this._options?.keeperCards ?? []),
        ...(this._config.kingdomCards?.map(card => card.cardKey) ?? [])
      ]))
        .map(key => structuredClone(allCardLibrary[key]))
        .filter(card => !!card)
    
    if (this._requestedKingdoms.length > MatchBaseConfiguration.numberOfKingdomPiles) {
      const requestedKingdomCardKeys = this._requestedKingdoms.map(card => card.cardKey);
      console.log(`[match configurator] requested kingdom cards exceeds 10, truncating to 10 ${requestedKingdomCardKeys.join(', ')}`);
      this._requestedKingdoms.length = MatchBaseConfiguration.numberOfKingdomPiles;
    }
    
    this._bannedKingdoms = this._config.bannedKingdoms?.slice() ?? [];
    
    this.selectKingdomSupply();
    this.selectBasicSupply();
    addMatToMatchConfig('set-aside', this._config);
    await this.runExpansionConfigurations();
    return { config: this._config, endGameConditionFns: this._expansionEndGameConditionFuncs };
  }
  
  private selectKingdomSupply() {
    let selectedKingdoms: CardNoId[] = [];
    
    if (this._requestedKingdoms.length === MatchBaseConfiguration.numberOfKingdomPiles) {
      console.log(`[match configurator] number of requested kingdoms ${this._requestedKingdoms.length} is enough`);
      selectedKingdoms = this._requestedKingdoms.slice();
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
      console.log(`[match configurator] banned kingdoms ${bannedKingdomKeys.join(', ') ?? '- no banned kingdoms'}`);
      
      const availableKingdoms = selectedExpansions.flatMap((nextExpansion) => {
        return Object.values(nextExpansion.cardData.kingdomSupply)
          .filter(card => !bannedKingdomKeys.includes(card.cardKey));
      });
      
      console.log(`[match configurator] available kingdoms ${availableKingdoms.length}`);
      console.log(availableKingdoms.map(card => card.cardKey).join('\n'));
      
      const numKingdomsToSelect = MatchBaseConfiguration.numberOfKingdomPiles - this._requestedKingdoms.length;
      
      console.log(`[match configurator] need to select ${numKingdomsToSelect} kingdoms`);
      
      const additionalKingdoms: CardNoId[] = [];
      
      for (let i = 0; i < numKingdomsToSelect; i++) {
        const randomIndex = Math.floor(Math.random() * availableKingdoms.length);
        const randomKingdom = availableKingdoms[randomIndex];
        additionalKingdoms.push({...randomKingdom});
        availableKingdoms.splice(randomIndex, 1);
      }
      
      console.log(`[match configurator] additional kingdoms to add`);
      console.log(additionalKingdoms.map(card => card.cardKey).join('\n'));
      
      selectedKingdoms = [...selectedKingdoms, ...additionalKingdoms];
      
      console.log(`[match configurator] finalized kingdoms ${selectedKingdoms.length}`);
      console.log(selectedKingdoms.map(card => card.cardKey).join('\n'));
      
      this._config.kingdomCards = structuredClone([...this._requestedKingdoms, ...selectedKingdoms]);
      
      this._config.kingdomCardCount = this._config.kingdomCards.reduce((acc, nextKingdom) => {
        const cardKey = nextKingdom.cardKey;
        acc[cardKey] = nextKingdom.type.includes('VICTORY')
          ? (this._config.players.length < 3 ? 8 : 12)
          : 10;
        
        console.log(`[match configurator] setting card count to ${acc[cardKey]} for ${cardKey}`);
        return acc;
      }, {} as Record<CardKey, number>)
    }
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
  
  private async runExpansionConfigurations() {
    const uniqueExpansions = Array.from(new Set(this._config.kingdomCards.map(card => card.expansionName)));
    for (const expansionName of uniqueExpansions) {
      try {
        const expansionConfigurator = (await import(`@expansions/${expansionName}/configurator-${expansionName}.ts`)).default;
        const { endGameConditions } = expansionConfigurator({
          config: this._config,
          cardLibrary: allCardLibrary,
          expansionData: expansionLibrary[expansionName]
        });
        if (endGameConditions) {
          this._expansionEndGameConditionFuncs.push(endGameConditions);
        }
      } catch (error) {
        console.warn(`[match configurator] failed to load expansion configurator for ${expansionName}`);
        console.log(error);
      }
    }
  }
}