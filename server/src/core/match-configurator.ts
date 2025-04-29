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
  
  constructor(config: MatchConfiguration, private _options?: MatchConfiguratorOptions) {
    
    this._config = {
      ...config
    } as ComputedMatchConfiguration;
    
    console.log(`[match configurator] created`);
  }
  
  public async createConfiguration() {
    if (this._options?.keeperCards && this._options.keeperCards.length > 0) {
      console.warn(`[match configurator] hard-coded keeper cards ${this._options?.keeperCards?.join(', ') ?? '- no hard-coded kingdom cards'}`);
    }
    
    if (this._config.kingdomCards?.length > 0) {
      console.log(`[match configurator] requested kingdom cards ${this._config.kingdomCards?.map(card => card.cardKey)?.join(', ') ?? '- no requested kingdom cards'}`);
    }
    
    this._requestedKingdoms = Array.from(new Set([
      ...(this._options?.keeperCards?.map(key => allCardLibrary[key])?.filter(card => !!card)?.slice() ?? []),
      ...(this._config.kingdomCards?.slice() ?? [])
    ]));
    
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
    return this._config;
  }
  
  private selectKingdomSupply() {
    let selectedKingdoms: CardNoId[] = [];
    
    if (this._requestedKingdoms.length === MatchBaseConfiguration.numberOfKingdomPiles) {
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
      
      console.log(`[match configurator] available kingdoms ${availableKingdoms.map(card => card.cardKey).join(', ')}`);
      
      const numKingdomsToSelect = MatchBaseConfiguration.numberOfKingdomPiles - this._requestedKingdoms.length;
      
      for (let i = 0; i < numKingdomsToSelect; i++) {
        const randomIndex = Math.floor(Math.random() * availableKingdoms.length);
        const randomKingdom = availableKingdoms[randomIndex];
        selectedKingdoms.push({ ...randomKingdom });
        availableKingdoms.splice(randomIndex, 1);
      }
      
      console.log(`[match configurator] finalized kingdoms ${selectedKingdoms.map(card => card.cardKey).join(', ')}`);
      
      this._config.kingdomCards = [...this._requestedKingdoms, ...selectedKingdoms];
      
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
    
    // coppers come from the supply, so they are removed here, because these represent the cards IN the supply at the start
    // of game. The coppers in a player's hand come from the supply, whereas the estates do not.
    this._config.basicCardCount = Object.keys(basicCardCounts).reduce((acc, nextKey) => {
      acc[nextKey] = nextKey === 'copper' ? this._config.players.length * MatchBaseConfiguration.playerStartingHand.copper : basicCardCounts[nextKey];
      return acc;
    }, {} as Record<CardKey, number>);
    
    // create the basic cards map
    this._config.basicCards = Object.keys(basicCardCounts).reduce((acc, nextKey) => {
      acc.push({ ...allCardLibrary[nextKey] });
      return acc;
    }, [] as CardNoId[]);
    
    console.log(`[match configurator] setting default basic cards ${this._config.basicCards.map(card => card.cardKey).join(', ')}`);
  }
  
  private async runExpansionConfigurations() {
    const uniqueExpansions = Array.from(new Set(this._config.kingdomCards.map(card => card.expansionName)));
    for (const expansionName of uniqueExpansions) {
      try {
        const expansionConfigurator = (await import(`@expansions/${expansionName}/configure-match-${expansionName}.ts`)).default;
        expansionConfigurator({ config: this._config, cardLibrary: allCardLibrary });
      } catch (error) {
        console.warn(`[match configurator] failed to load expansion configurator for ${expansionName}`);
        console.log(error);
      }
    }
  }
}