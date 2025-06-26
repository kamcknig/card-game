import { expansionLibrary, rawCardLibrary } from '@expansions/expansion-library.ts';
import { MatchBaseConfiguration } from '../types.ts';
import { compare } from 'https://esm.sh/v123/fast-json-patch@3.1.1/index.js';
import { getDefaultKingdomSupplySize } from '../utils/get-default-kingdom-supply-size.ts';
/**
 * Return a new array with at most one element for every distinct `prop` value.
 *
 * @template T extends Record<string, any>
 * @param   list  Source array
 * @param   prop  Property whose value determines uniqueness
 * @param   keep  'first' | 'last'  – keeps the first or last occurrence (default 'first')
 * @returns Deduplicated array
 */ export function uniqueByProp(list, prop, keep = 'first') {
  if (keep === 'first') {
    // Keep the first occurrence
    const seen = new Set();
    return list.filter((item)=>{
      const key = item[prop];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  // Keep the **last** occurrence
  const idxByKey = new Map(); // key → index of last sighting
  list.forEach((item, i)=>idxByKey.set(item[prop], i));
  return list.filter((_, i)=>idxByKey.get(list[i][prop]) === i);
}
/**
 * The configurator takes a MatchConfiguration instance and creates a ComputedMatchConfiguration.
 *
 * The former is what is created during match configuration before a match has started. The latter is a completed
 * configuration after the base configuration, and all included expansion configurations have run.
 *
 * The configurator is responsible for coordinating and running these "child" configurators.
 */ export class MatchConfigurator {
  _requestedKingdoms = [];
  _bannedKingdoms = [];
  _config;
  constructor(config){
    // when creating the clone, it will break the custom Deno.customInspect symbols on classes so they won't
    // properly print. I'm not sure if we NEED the structured clone, might just remove it eventually. I tested
    // and that worked as well as of this fix. but i kind of want all changes to be self-contained in the configurator
    // so i like having that "separation" of it coming in and being clean from then in to this configurator instance
    const players = [
      ...config.players
    ];
    this._config = structuredClone(config);
    this._config.players = players;
    console.log(`[match configurator] created`);
  }
  async createConfiguration(initContext) {
    const requisiteKingdomCardKeys = Deno.env.get('REQUISITE_KINGDOM_CARD_KEYS')?.toLowerCase()?.split(',')?.map((e)=>e.trim())?.filter((e)=>!!e) ?? [];
    if (requisiteKingdomCardKeys && requisiteKingdomCardKeys.length > 0) {
      console.warn(`[match configurator] hard-coded keeper cards ${requisiteKingdomCardKeys}`);
      console.log(requisiteKingdomCardKeys?.join('\n'));
    }
    this._config.preselectedKingdoms = this._config.preselectedKingdoms.filter((card)=>!!card);
    if (this._config.preselectedKingdoms?.length > 0) {
      console.log(`[match configurator] requested kingdom cards ${this._config.preselectedKingdoms.length}`);
      console.log(this._config.preselectedKingdoms?.map((card)=>card.cardKey)?.join('\n'));
    } else {
      console.log(`[match configurator] no cards requested in during match configuration`);
    }
    console.log(`[match configurator] removing possible duplicates from requested and hard-coded kingdoms`);
    this._requestedKingdoms = Array.from(new Set([
      ...requisiteKingdomCardKeys,
      ...this._config.preselectedKingdoms?.map((card)=>card.cardKey) ?? []
    ])).map((key)=>structuredClone(rawCardLibrary[key])).filter((card)=>!!card);
    if (this._requestedKingdoms.length > MatchBaseConfiguration.numberOfKingdomPiles) {
      const requestedKingdomCardKeys = this._requestedKingdoms.map((card)=>card.cardKey);
      console.log(`[match configurator] requested kingdom cards exceeds 10, truncating to 10 ${requestedKingdomCardKeys.join(', ')}`);
      this._requestedKingdoms.length = MatchBaseConfiguration.numberOfKingdomPiles;
    }
    this._bannedKingdoms = this._config.bannedKingdoms?.slice() ?? [];
    this.selectKingdomSupply();
    this.selectBasicSupply();
    await this.runExpansionConfigurators(initContext);
    this.createCardSources(initContext.match, initContext.cardSourceController);
    return {
      config: this._config
    };
  }
  createCardSources(match, cardSourceController) {
    // todo: right now these register locations that were previously hard-coded in the match state.
    // i'm converting to use this CardSourceController class and these might be able to be converted
    // into non-hardcoded locations.
    cardSourceController.registerZone('kingdomSupply', []);
    cardSourceController.registerZone('basicSupply', []);
    cardSourceController.registerZone('nonSupplyCards', []);
    cardSourceController.registerZone('activeDuration', []);
    cardSourceController.registerZone('playArea', []);
    cardSourceController.registerZone('trash', []);
    for (const player of this._config.players){
      cardSourceController.registerZone('playerHand', [], player.id);
      cardSourceController.registerZone('playerDiscard', [], player.id);
      cardSourceController.registerZone('playerDeck', [], player.id);
      cardSourceController.registerZone('set-aside', [], player.id);
    }
  }
  selectKingdomSupply() {
    let selectedKingdoms = this._requestedKingdoms.slice();
    const additionalKingdoms = [];
    if (selectedKingdoms.length === MatchBaseConfiguration.numberOfKingdomPiles) {
      console.log(`[match configurator] number of requested kingdoms ${this._requestedKingdoms.length} is enough`);
    } else {
      // reduces the player-configured expansions into an array whose elements are the expansions' library data
      const selectedExpansions = this._config.expansions.reduce((acc, allowedExpansion)=>{
        const expansionData = expansionLibrary[allowedExpansion.name];
        if (!expansionData) {
          console.warn(`[match configurator] expansion ${allowedExpansion.name} not found`);
          return acc;
        }
        acc.push(expansionData);
        return acc;
      }, []);
      // list of randomizers that are banned or already pre-selected
      const bannedKingdomRandomizers = this._bannedKingdoms.map((card)=>card.randomizer);
      const alreadyIncludedKingdomRandomizers = selectedKingdoms.map((card)=>card.randomizer);
      console.log(`[match configurator] banned kingdoms ${bannedKingdomRandomizers.join(', ') ?? '- no banned kingdoms'}`);
      // loop over the selected expansions, and filter out any kingdom cards that
      // are banned, are already included, or do not have a randomizer
      const availableRandomizers = selectedExpansions.flatMap((nextExpansion)=>[
          ...Object.values(nextExpansion.cardData.kingdomSupply).filter((card)=>card.randomizer !== null && !bannedKingdomRandomizers.includes(card.randomizer) && !alreadyIncludedKingdomRandomizers.includes(card.cardKey)).map((card)=>{
            return {
              randomizer: card.randomizer,
              cardLike: card,
              type: 'card'
            };
          }),
          ...Object.values(nextExpansion.events).filter((event)=>event.randomizer !== null).map((event)=>({
              randomizer: event.randomizer,
              cardLike: event,
              type: 'event'
            }))
        ]);
      const uniqueRandomizers = uniqueByProp(availableRandomizers, 'randomizer');
      console.log(`[match configurator] available kingdoms ${uniqueRandomizers.length}`);
      console.log(uniqueRandomizers.join('\n'));
      const numKingdomsToSelect = MatchBaseConfiguration.numberOfKingdomPiles - this._requestedKingdoms.length;
      console.log(`[match configurator] need to select ${numKingdomsToSelect} kingdoms`);
      const allowedEventsAndOthers = MatchBaseConfiguration.numberOfEventsAndOthers;
      let selectedEventsAndOthers = this._config.events.length;
      for(let i = 0; i < numKingdomsToSelect; i++){
        const randomIndex = Math.floor(Math.random() * uniqueRandomizers.length);
        const selectedRandomizer = uniqueRandomizers[randomIndex];
        if (selectedRandomizer.type === 'card') {
          console.log(`[match configurator] selected kingdom ${selectedRandomizer.randomizer}`);
          const cardsInRandomizer = availableRandomizers.filter((randomizer)=>randomizer.randomizer === selectedRandomizer.randomizer).map((randomizer)=>randomizer.cardLike);
          // this makes an assumption that if there are more cards within a randomizer group (such as knights from dark
          // ages) that they will all be in the same kingdom.
          const kingdom = cardsInRandomizer[0].kingdom;
          let cards = [];
          if (!cardsInRandomizer.length) {
            throw new Error(`[match configurator] no cards found for randomizer ${selectedRandomizer.randomizer}`);
          }
          if (cardsInRandomizer.length === 1) {
            cards = new Array(getDefaultKingdomSupplySize(cardsInRandomizer[0], this._config)).fill(cardsInRandomizer[0]);
          } else {
            cards = cardsInRandomizer;
          }
          additionalKingdoms.push({
            name: kingdom,
            cards
          });
        } else {
          console.log(`[match configurator] selected event ${selectedRandomizer.randomizer}`);
          if (++selectedEventsAndOthers <= allowedEventsAndOthers) {
            console.log(`[match configurator] selected event ${selectedRandomizer.randomizer} is allowed, adding to match`);
            const event = availableRandomizers.find((randomizer)=>randomizer.randomizer === selectedRandomizer.randomizer)?.cardLike;
            if (!event) {
              throw new Error(`[match configurator] event not found for randomizer ${selectedRandomizer.randomizer}`);
            }
            this._config.events.push(event);
          } else {
            console.log(`[match configurator] selected event ${selectedRandomizer.randomizer} is not allowed, already have max number of events and others`);
          }
          // reduce the counter because events don't count against kingdom selection
          i--;
        }
        // remove the randomizer so it can't be selected again
        uniqueRandomizers.splice(randomIndex, 1);
      }
    }
    this._config.kingdomSupply = structuredClone(selectedKingdoms.map((card)=>{
      return {
        name: card.cardKey,
        cards: new Array(getDefaultKingdomSupplySize(card, this._config)).fill(card)
      };
    }).concat(additionalKingdoms));
    console.log(`[match configurator] finalized selected kingdoms count ${this._config.kingdomSupply.length}`);
    console.log(this._config.kingdomSupply.map((supply)=>supply.name).join('\n'));
  }
  selectBasicSupply() {
    // based on the number of players, get the basic supply card counts
    const basicCardCounts = {
      ...MatchBaseConfiguration.basicSupplyByPlayerCount[this._config.players.length - 1]
    };
    // coppers come from the supply, so they are removed here, because these represent the cards IN the supply at the
    // start of game. The coppers in a player's hand come from the supply, whereas the estates do not.
    this._config.basicSupply = Object.keys(basicCardCounts).reduce((acc, nextKey)=>{
      const cardData = {
        ...rawCardLibrary[nextKey]
      };
      acc.push({
        name: cardData.cardKey,
        cards: new Array(nextKey === 'copper' ? this._config.players.length * MatchBaseConfiguration.playerStartingHand.copper : basicCardCounts[nextKey]).fill(cardData)
      });
      return acc;
    }, []);
    const basicSupply = this._config.basicSupply.map((supply)=>supply.name).join(', ');
    console.log(`[match configurator] setting default basic cards ${basicSupply}`);
  }
  async getExpansionConfigurators() {
    const configurators = new Map();
    const uniqueExpansions = Array.from(new Set(this._config.kingdomSupply.map((supply)=>supply.cards.map((card)=>card.expansionName)).flat()));
    for (const expansionName of uniqueExpansions){
      try {
        console.log(`[match configurator] loading configurator for expansion '${expansionName}'`);
        const configuratorFactory = (await import(`@expansions/${expansionName}/configurator-${expansionName}.ts`)).default;
        configurators.set(expansionName, configuratorFactory());
      } catch (error) {
        console.log(`[match configurator] no configurator factory found for expansion '${expansionName}'`);
      }
    }
    return configurators;
  }
  async runExpansionConfigurators(initContext) {
    const configuratorIterator = (await this.getExpansionConfigurators()).entries();
    let iteration = 0;
    let changes = [];
    let configSnapshot = structuredClone(this._config);
    do {
      iteration++;
      for (const [expansionName, expansionConfigurator] of configuratorIterator){
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
    }while (changes.length > 0 && iteration < 10)
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
  async registerGameEventListeners(gameEventRegistrar) {
    const uniqueExpansions = Array.from(new Set(this._config.kingdomSupply.map((supply)=>supply.cards.map((card)=>card.expansionName)).flat()));
    for (const expansion of uniqueExpansions){
      try {
        const module = await import(`@expansions/${expansion}/configurator-${expansion}.ts`);
        if (!module.registerGameEvents) continue;
        module.registerGameEvents(gameEventRegistrar, this._config);
      } catch (error) {
        if (error?.code === 'ERR_MODULE_NOT_FOUND') {
          continue;
        }
        console.warn(`[match configurator] failed to register expansion actions for ${expansion}`);
        console.log(error);
      }
    }
  }
  async registerExpansionEndGameConditions(registrar) {
    const uniqueExpansions = Array.from(new Set(this._config.kingdomSupply.map((supply)=>supply.cards.map((card)=>card.expansionName)).flat()));
    for (const expansion of uniqueExpansions){
      try {
        const module = await import(`@expansions/${expansion}/configurator-${expansion}.ts`);
        if (!module.registerEndGameConditions) continue;
        module.registerEndGameConditions(registrar);
      } catch (error) {
        if (error?.code === 'ERR_MODULE_NOT_FOUND') {
          continue;
        }
        console.warn(`[match configurator] failed to register expansion end game conditions for ${expansion}`);
        console.log(error);
      }
    }
  }
  async registerExpansionPlayerScoreDecorators(registrar) {
    const uniqueExpansions = Array.from(new Set(this._config.kingdomSupply.map((supply)=>supply.cards.map((card)=>card.expansionName)).flat()));
    for (const expansion of uniqueExpansions){
      try {
        const module = await import(`@expansions/${expansion}/configurator-${expansion}.ts`);
        if (!module.registerScoringFunctions) continue;
        module.registerScoringFunctions(registrar);
      } catch (error) {
        if (error?.code === 'ERR_MODULE_NOT_FOUND') {
          continue;
        }
        console.warn(`[match configurator] failed to register expansion scoring functions for ${expansion}`);
        console.log(error);
      }
    }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvY29yZS9tYXRjaC1jb25maWd1cmF0b3IudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ2FyZEtleSxcbiAgQ2FyZExpa2VOb0lkLFxuICBDYXJkTm9JZCxcbiAgQ29tcHV0ZWRNYXRjaENvbmZpZ3VyYXRpb24sXG4gIEV2ZW50Tm9JZCxcbiAgTWF0Y2gsXG4gIE1hdGNoQ29uZmlndXJhdGlvbixcbiAgU3VwcGx5XG59IGZyb20gJ3NoYXJlZC9zaGFyZWQtdHlwZXMudHMnO1xuaW1wb3J0IHsgRXhwYW5zaW9uRGF0YSwgZXhwYW5zaW9uTGlicmFyeSwgcmF3Q2FyZExpYnJhcnkgfSBmcm9tICdAZXhwYW5zaW9ucy9leHBhbnNpb24tbGlicmFyeS50cyc7XG5pbXBvcnQge1xuICBFbmRHYW1lQ29uZGl0aW9uUmVnaXN0cmFyLFxuICBFeHBhbnNpb25Db25maWd1cmF0b3IsXG4gIEV4cGFuc2lvbkNvbmZpZ3VyYXRvckZhY3RvcnksXG4gIEdhbWVFdmVudFJlZ2lzdHJhcixcbiAgSW5pdGlhbGl6ZUV4cGFuc2lvbkNvbnRleHQsXG4gIE1hdGNoQmFzZUNvbmZpZ3VyYXRpb24sXG4gIFBsYXllclNjb3JlRGVjb3JhdG9yUmVnaXN0cmFyXG59IGZyb20gJy4uL3R5cGVzLnRzJztcbmltcG9ydCB7IGNvbXBhcmUsIE9wZXJhdGlvbiB9IGZyb20gJ2h0dHBzOi8vZXNtLnNoL3YxMjMvZmFzdC1qc29uLXBhdGNoQDMuMS4xL2luZGV4LmpzJztcbmltcG9ydCB7IENhcmRTb3VyY2VDb250cm9sbGVyIH0gZnJvbSAnLi9jYXJkLXNvdXJjZS1jb250cm9sbGVyLnRzJztcbmltcG9ydCB7IGdldERlZmF1bHRLaW5nZG9tU3VwcGx5U2l6ZSB9IGZyb20gJy4uL3V0aWxzL2dldC1kZWZhdWx0LWtpbmdkb20tc3VwcGx5LXNpemUudHMnO1xuXG4vKipcbiAqIFJldHVybiBhIG5ldyBhcnJheSB3aXRoIGF0IG1vc3Qgb25lIGVsZW1lbnQgZm9yIGV2ZXJ5IGRpc3RpbmN0IGBwcm9wYCB2YWx1ZS5cbiAqXG4gKiBAdGVtcGxhdGUgVCBleHRlbmRzIFJlY29yZDxzdHJpbmcsIGFueT5cbiAqIEBwYXJhbSAgIGxpc3QgIFNvdXJjZSBhcnJheVxuICogQHBhcmFtICAgcHJvcCAgUHJvcGVydHkgd2hvc2UgdmFsdWUgZGV0ZXJtaW5lcyB1bmlxdWVuZXNzXG4gKiBAcGFyYW0gICBrZWVwICAnZmlyc3QnIHwgJ2xhc3QnICDigJMga2VlcHMgdGhlIGZpcnN0IG9yIGxhc3Qgb2NjdXJyZW5jZSAoZGVmYXVsdCAnZmlyc3QnKVxuICogQHJldHVybnMgRGVkdXBsaWNhdGVkIGFycmF5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1bmlxdWVCeVByb3A8XG4gIFQgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuICBLIGV4dGVuZHMga2V5b2YgVCA9IGtleW9mIFRcbj4oXG4gIGxpc3Q6IFRbXSxcbiAgcHJvcDogSyxcbiAga2VlcDogJ2ZpcnN0JyB8ICdsYXN0JyA9ICdmaXJzdCcsXG4pOiBUW10ge1xuICBpZiAoa2VlcCA9PT0gJ2ZpcnN0Jykge1xuICAgIC8vIEtlZXAgdGhlIGZpcnN0IG9jY3VycmVuY2VcbiAgICBjb25zdCBzZWVuID0gbmV3IFNldDxhbnk+KCk7XG4gICAgcmV0dXJuIGxpc3QuZmlsdGVyKGl0ZW0gPT4ge1xuICAgICAgY29uc3Qga2V5ID0gaXRlbVtwcm9wXTtcbiAgICAgIGlmIChzZWVuLmhhcyhrZXkpKSByZXR1cm4gZmFsc2U7XG4gICAgICBzZWVuLmFkZChrZXkpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH1cbiAgXG4gIC8vIEtlZXAgdGhlICoqbGFzdCoqIG9jY3VycmVuY2VcbiAgY29uc3QgaWR4QnlLZXkgPSBuZXcgTWFwPGFueSwgbnVtYmVyPigpOyAvLyBrZXkg4oaSIGluZGV4IG9mIGxhc3Qgc2lnaHRpbmdcbiAgbGlzdC5mb3JFYWNoKChpdGVtLCBpKSA9PiBpZHhCeUtleS5zZXQoaXRlbVtwcm9wXSwgaSkpO1xuICByZXR1cm4gbGlzdC5maWx0ZXIoKF8sIGkpID0+IGlkeEJ5S2V5LmdldChsaXN0W2ldW3Byb3BdKSA9PT0gaSk7XG59XG5cblxuXG4vKipcbiAqIFRoZSBjb25maWd1cmF0b3IgdGFrZXMgYSBNYXRjaENvbmZpZ3VyYXRpb24gaW5zdGFuY2UgYW5kIGNyZWF0ZXMgYSBDb21wdXRlZE1hdGNoQ29uZmlndXJhdGlvbi5cbiAqXG4gKiBUaGUgZm9ybWVyIGlzIHdoYXQgaXMgY3JlYXRlZCBkdXJpbmcgbWF0Y2ggY29uZmlndXJhdGlvbiBiZWZvcmUgYSBtYXRjaCBoYXMgc3RhcnRlZC4gVGhlIGxhdHRlciBpcyBhIGNvbXBsZXRlZFxuICogY29uZmlndXJhdGlvbiBhZnRlciB0aGUgYmFzZSBjb25maWd1cmF0aW9uLCBhbmQgYWxsIGluY2x1ZGVkIGV4cGFuc2lvbiBjb25maWd1cmF0aW9ucyBoYXZlIHJ1bi5cbiAqXG4gKiBUaGUgY29uZmlndXJhdG9yIGlzIHJlc3BvbnNpYmxlIGZvciBjb29yZGluYXRpbmcgYW5kIHJ1bm5pbmcgdGhlc2UgXCJjaGlsZFwiIGNvbmZpZ3VyYXRvcnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBNYXRjaENvbmZpZ3VyYXRvciB7XG4gIHByaXZhdGUgX3JlcXVlc3RlZEtpbmdkb21zOiBDYXJkTm9JZFtdID0gW107XG4gIHByaXZhdGUgX2Jhbm5lZEtpbmdkb21zOiBDYXJkTm9JZFtdID0gW107XG4gIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZzogQ29tcHV0ZWRNYXRjaENvbmZpZ3VyYXRpb247XG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IE1hdGNoQ29uZmlndXJhdGlvbikge1xuICAgIFxuICAgIC8vIHdoZW4gY3JlYXRpbmcgdGhlIGNsb25lLCBpdCB3aWxsIGJyZWFrIHRoZSBjdXN0b20gRGVuby5jdXN0b21JbnNwZWN0IHN5bWJvbHMgb24gY2xhc3NlcyBzbyB0aGV5IHdvbid0XG4gICAgLy8gcHJvcGVybHkgcHJpbnQuIEknbSBub3Qgc3VyZSBpZiB3ZSBORUVEIHRoZSBzdHJ1Y3R1cmVkIGNsb25lLCBtaWdodCBqdXN0IHJlbW92ZSBpdCBldmVudHVhbGx5LiBJIHRlc3RlZFxuICAgIC8vIGFuZCB0aGF0IHdvcmtlZCBhcyB3ZWxsIGFzIG9mIHRoaXMgZml4LiBidXQgaSBraW5kIG9mIHdhbnQgYWxsIGNoYW5nZXMgdG8gYmUgc2VsZi1jb250YWluZWQgaW4gdGhlIGNvbmZpZ3VyYXRvclxuICAgIC8vIHNvIGkgbGlrZSBoYXZpbmcgdGhhdCBcInNlcGFyYXRpb25cIiBvZiBpdCBjb21pbmcgaW4gYW5kIGJlaW5nIGNsZWFuIGZyb20gdGhlbiBpbiB0byB0aGlzIGNvbmZpZ3VyYXRvciBpbnN0YW5jZVxuICAgIGNvbnN0IHBsYXllcnMgPSBbLi4uY29uZmlnLnBsYXllcnNdO1xuICAgIHRoaXMuX2NvbmZpZyA9IHN0cnVjdHVyZWRDbG9uZShjb25maWcpIGFzIENvbXB1dGVkTWF0Y2hDb25maWd1cmF0aW9uO1xuICAgIHRoaXMuX2NvbmZpZy5wbGF5ZXJzID0gcGxheWVycztcbiAgICBcbiAgICBjb25zb2xlLmxvZyhgW21hdGNoIGNvbmZpZ3VyYXRvcl0gY3JlYXRlZGApO1xuICB9XG4gIFxuICBwdWJsaWMgYXN5bmMgY3JlYXRlQ29uZmlndXJhdGlvbihpbml0Q29udGV4dDogSW5pdGlhbGl6ZUV4cGFuc2lvbkNvbnRleHQpIHtcbiAgICBjb25zdCByZXF1aXNpdGVLaW5nZG9tQ2FyZEtleXMgPSBEZW5vLmVudi5nZXQoJ1JFUVVJU0lURV9LSU5HRE9NX0NBUkRfS0VZUycpXG4gICAgICA/LnRvTG93ZXJDYXNlKClcbiAgICAgID8uc3BsaXQoJywnKVxuICAgICAgPy5tYXAoZSA9PiBlLnRyaW0oKSlcbiAgICAgID8uZmlsdGVyKGUgPT4gISFlKSA/PyBbXTtcbiAgICBcbiAgICBpZiAocmVxdWlzaXRlS2luZ2RvbUNhcmRLZXlzICYmIHJlcXVpc2l0ZUtpbmdkb21DYXJkS2V5cy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zb2xlLndhcm4oYFttYXRjaCBjb25maWd1cmF0b3JdIGhhcmQtY29kZWQga2VlcGVyIGNhcmRzICR7cmVxdWlzaXRlS2luZ2RvbUNhcmRLZXlzfWApO1xuICAgICAgY29uc29sZS5sb2cocmVxdWlzaXRlS2luZ2RvbUNhcmRLZXlzPy5qb2luKCdcXG4nKSk7XG4gICAgfVxuICAgIFxuICAgIHRoaXMuX2NvbmZpZy5wcmVzZWxlY3RlZEtpbmdkb21zID0gdGhpcy5fY29uZmlnLnByZXNlbGVjdGVkS2luZ2RvbXMuZmlsdGVyKGNhcmQgPT4gISFjYXJkKTtcbiAgICBcbiAgICBpZiAodGhpcy5fY29uZmlnLnByZXNlbGVjdGVkS2luZ2RvbXM/Lmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnNvbGUubG9nKGBbbWF0Y2ggY29uZmlndXJhdG9yXSByZXF1ZXN0ZWQga2luZ2RvbSBjYXJkcyAke3RoaXMuX2NvbmZpZy5wcmVzZWxlY3RlZEtpbmdkb21zLmxlbmd0aH1gKTtcbiAgICAgIGNvbnNvbGUubG9nKHRoaXMuX2NvbmZpZy5wcmVzZWxlY3RlZEtpbmdkb21zPy5tYXAoY2FyZCA9PiBjYXJkLmNhcmRLZXkpPy5qb2luKCdcXG4nKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coYFttYXRjaCBjb25maWd1cmF0b3JdIG5vIGNhcmRzIHJlcXVlc3RlZCBpbiBkdXJpbmcgbWF0Y2ggY29uZmlndXJhdGlvbmApO1xuICAgIH1cbiAgICBcbiAgICBjb25zb2xlLmxvZyhgW21hdGNoIGNvbmZpZ3VyYXRvcl0gcmVtb3ZpbmcgcG9zc2libGUgZHVwbGljYXRlcyBmcm9tIHJlcXVlc3RlZCBhbmQgaGFyZC1jb2RlZCBraW5nZG9tc2ApO1xuICAgIFxuICAgIHRoaXMuX3JlcXVlc3RlZEtpbmdkb21zID1cbiAgICAgIEFycmF5LmZyb20obmV3IFNldChbXG4gICAgICAgIC4uLnJlcXVpc2l0ZUtpbmdkb21DYXJkS2V5cyxcbiAgICAgICAgLi4uKHRoaXMuX2NvbmZpZy5wcmVzZWxlY3RlZEtpbmdkb21zPy5tYXAoY2FyZCA9PiBjYXJkLmNhcmRLZXkpID8/IFtdKVxuICAgICAgXSkpXG4gICAgICAgIC5tYXAoa2V5ID0+IHN0cnVjdHVyZWRDbG9uZShyYXdDYXJkTGlicmFyeVtrZXldKSlcbiAgICAgICAgLmZpbHRlcihjYXJkID0+ICEhY2FyZCk7XG4gICAgXG4gICAgaWYgKHRoaXMuX3JlcXVlc3RlZEtpbmdkb21zLmxlbmd0aCA+IE1hdGNoQmFzZUNvbmZpZ3VyYXRpb24ubnVtYmVyT2ZLaW5nZG9tUGlsZXMpIHtcbiAgICAgIGNvbnN0IHJlcXVlc3RlZEtpbmdkb21DYXJkS2V5cyA9IHRoaXMuX3JlcXVlc3RlZEtpbmdkb21zLm1hcChjYXJkID0+IGNhcmQuY2FyZEtleSk7XG4gICAgICBjb25zb2xlLmxvZyhgW21hdGNoIGNvbmZpZ3VyYXRvcl0gcmVxdWVzdGVkIGtpbmdkb20gY2FyZHMgZXhjZWVkcyAxMCwgdHJ1bmNhdGluZyB0byAxMCAke3JlcXVlc3RlZEtpbmdkb21DYXJkS2V5cy5qb2luKCcsICcpfWApO1xuICAgICAgdGhpcy5fcmVxdWVzdGVkS2luZ2RvbXMubGVuZ3RoID0gTWF0Y2hCYXNlQ29uZmlndXJhdGlvbi5udW1iZXJPZktpbmdkb21QaWxlcztcbiAgICB9XG4gICAgXG4gICAgdGhpcy5fYmFubmVkS2luZ2RvbXMgPSB0aGlzLl9jb25maWcuYmFubmVkS2luZ2RvbXM/LnNsaWNlKCkgPz8gW107XG4gICAgXG4gICAgdGhpcy5zZWxlY3RLaW5nZG9tU3VwcGx5KCk7XG4gICAgdGhpcy5zZWxlY3RCYXNpY1N1cHBseSgpO1xuICAgIFxuICAgIGF3YWl0IHRoaXMucnVuRXhwYW5zaW9uQ29uZmlndXJhdG9ycyhpbml0Q29udGV4dCk7XG4gICAgXG4gICAgdGhpcy5jcmVhdGVDYXJkU291cmNlcyhpbml0Q29udGV4dC5tYXRjaCwgaW5pdENvbnRleHQuY2FyZFNvdXJjZUNvbnRyb2xsZXIpO1xuICAgIFxuICAgIHJldHVybiB7IGNvbmZpZzogdGhpcy5fY29uZmlnIH07XG4gIH1cbiAgXG4gIHByaXZhdGUgY3JlYXRlQ2FyZFNvdXJjZXMobWF0Y2g6IE1hdGNoLCBjYXJkU291cmNlQ29udHJvbGxlcjogQ2FyZFNvdXJjZUNvbnRyb2xsZXIpIHtcbiAgICAvLyB0b2RvOiByaWdodCBub3cgdGhlc2UgcmVnaXN0ZXIgbG9jYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IGhhcmQtY29kZWQgaW4gdGhlIG1hdGNoIHN0YXRlLlxuICAgIC8vIGknbSBjb252ZXJ0aW5nIHRvIHVzZSB0aGlzIENhcmRTb3VyY2VDb250cm9sbGVyIGNsYXNzIGFuZCB0aGVzZSBtaWdodCBiZSBhYmxlIHRvIGJlIGNvbnZlcnRlZFxuICAgIC8vIGludG8gbm9uLWhhcmRjb2RlZCBsb2NhdGlvbnMuXG4gICAgY2FyZFNvdXJjZUNvbnRyb2xsZXIucmVnaXN0ZXJab25lKCdraW5nZG9tU3VwcGx5JywgW10pO1xuICAgIGNhcmRTb3VyY2VDb250cm9sbGVyLnJlZ2lzdGVyWm9uZSgnYmFzaWNTdXBwbHknLCBbXSk7XG4gICAgY2FyZFNvdXJjZUNvbnRyb2xsZXIucmVnaXN0ZXJab25lKCdub25TdXBwbHlDYXJkcycsIFtdKTtcbiAgICBjYXJkU291cmNlQ29udHJvbGxlci5yZWdpc3RlclpvbmUoJ2FjdGl2ZUR1cmF0aW9uJywgW10pO1xuICAgIGNhcmRTb3VyY2VDb250cm9sbGVyLnJlZ2lzdGVyWm9uZSgncGxheUFyZWEnLCBbXSk7XG4gICAgY2FyZFNvdXJjZUNvbnRyb2xsZXIucmVnaXN0ZXJab25lKCd0cmFzaCcsIFtdKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBsYXllciBvZiB0aGlzLl9jb25maWcucGxheWVycykge1xuICAgICAgY2FyZFNvdXJjZUNvbnRyb2xsZXIucmVnaXN0ZXJab25lKCdwbGF5ZXJIYW5kJywgW10sIHBsYXllci5pZCk7XG4gICAgICBjYXJkU291cmNlQ29udHJvbGxlci5yZWdpc3RlclpvbmUoJ3BsYXllckRpc2NhcmQnLCBbXSwgcGxheWVyLmlkKTtcbiAgICAgIGNhcmRTb3VyY2VDb250cm9sbGVyLnJlZ2lzdGVyWm9uZSgncGxheWVyRGVjaycsIFtdLCBwbGF5ZXIuaWQpO1xuICAgICAgY2FyZFNvdXJjZUNvbnRyb2xsZXIucmVnaXN0ZXJab25lKCdzZXQtYXNpZGUnLCBbXSwgcGxheWVyLmlkKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgc2VsZWN0S2luZ2RvbVN1cHBseSgpIHtcbiAgICBsZXQgc2VsZWN0ZWRLaW5nZG9tczogQ2FyZE5vSWRbXSA9IHRoaXMuX3JlcXVlc3RlZEtpbmdkb21zLnNsaWNlKCk7XG4gICAgY29uc3QgYWRkaXRpb25hbEtpbmdkb21zOiB7IG5hbWU6IHN0cmluZzsgY2FyZHM6IENhcmROb0lkW107IH1bXSA9IFtdO1xuICAgIFxuICAgIGlmIChzZWxlY3RlZEtpbmdkb21zLmxlbmd0aCA9PT0gTWF0Y2hCYXNlQ29uZmlndXJhdGlvbi5udW1iZXJPZktpbmdkb21QaWxlcykge1xuICAgICAgY29uc29sZS5sb2coYFttYXRjaCBjb25maWd1cmF0b3JdIG51bWJlciBvZiByZXF1ZXN0ZWQga2luZ2RvbXMgJHt0aGlzLl9yZXF1ZXN0ZWRLaW5nZG9tcy5sZW5ndGh9IGlzIGVub3VnaGApO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIHJlZHVjZXMgdGhlIHBsYXllci1jb25maWd1cmVkIGV4cGFuc2lvbnMgaW50byBhbiBhcnJheSB3aG9zZSBlbGVtZW50cyBhcmUgdGhlIGV4cGFuc2lvbnMnIGxpYnJhcnkgZGF0YVxuICAgICAgY29uc3Qgc2VsZWN0ZWRFeHBhbnNpb25zID0gdGhpcy5fY29uZmlnLmV4cGFuc2lvbnMucmVkdWNlKChhY2MsIGFsbG93ZWRFeHBhbnNpb24pID0+IHtcbiAgICAgICAgY29uc3QgZXhwYW5zaW9uRGF0YSA9IGV4cGFuc2lvbkxpYnJhcnlbYWxsb3dlZEV4cGFuc2lvbi5uYW1lXTtcbiAgICAgICAgaWYgKCFleHBhbnNpb25EYXRhKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBbbWF0Y2ggY29uZmlndXJhdG9yXSBleHBhbnNpb24gJHthbGxvd2VkRXhwYW5zaW9uLm5hbWV9IG5vdCBmb3VuZGApO1xuICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgIH1cbiAgICAgICAgYWNjLnB1c2goZXhwYW5zaW9uRGF0YSk7XG4gICAgICAgIHJldHVybiBhY2M7XG4gICAgICB9LCBbXSBhcyBFeHBhbnNpb25EYXRhW10pO1xuICAgICAgXG4gICAgICAvLyBsaXN0IG9mIHJhbmRvbWl6ZXJzIHRoYXQgYXJlIGJhbm5lZCBvciBhbHJlYWR5IHByZS1zZWxlY3RlZFxuICAgICAgY29uc3QgYmFubmVkS2luZ2RvbVJhbmRvbWl6ZXJzID0gdGhpcy5fYmFubmVkS2luZ2RvbXMubWFwKGNhcmQgPT4gY2FyZC5yYW5kb21pemVyKSBhcyBzdHJpbmdbXTtcbiAgICAgIGNvbnN0IGFscmVhZHlJbmNsdWRlZEtpbmdkb21SYW5kb21pemVycyA9IHNlbGVjdGVkS2luZ2RvbXMubWFwKGNhcmQgPT4gY2FyZC5yYW5kb21pemVyKSBhcyBzdHJpbmdbXTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFttYXRjaCBjb25maWd1cmF0b3JdIGJhbm5lZCBraW5nZG9tcyAke2Jhbm5lZEtpbmdkb21SYW5kb21pemVycy5qb2luKCcsICcpID8/ICctIG5vIGJhbm5lZCBraW5nZG9tcyd9YCk7XG4gICAgICBcbiAgICAgIC8vIGxvb3Agb3ZlciB0aGUgc2VsZWN0ZWQgZXhwYW5zaW9ucywgYW5kIGZpbHRlciBvdXQgYW55IGtpbmdkb20gY2FyZHMgdGhhdFxuICAgICAgLy8gYXJlIGJhbm5lZCwgYXJlIGFscmVhZHkgaW5jbHVkZWQsIG9yIGRvIG5vdCBoYXZlIGEgcmFuZG9taXplclxuICAgICAgY29uc3QgYXZhaWxhYmxlUmFuZG9taXplcnMgPSBzZWxlY3RlZEV4cGFuc2lvbnMuZmxhdE1hcCgobmV4dEV4cGFuc2lvbikgPT4gW1xuICAgICAgICAuLi5PYmplY3RcbiAgICAgICAgICAudmFsdWVzKG5leHRFeHBhbnNpb24uY2FyZERhdGEua2luZ2RvbVN1cHBseSlcbiAgICAgICAgICAuZmlsdGVyKGNhcmQgPT5cbiAgICAgICAgICAgIGNhcmQucmFuZG9taXplciAhPT0gbnVsbCAmJiAhYmFubmVkS2luZ2RvbVJhbmRvbWl6ZXJzLmluY2x1ZGVzKGNhcmQucmFuZG9taXplcikgJiYgIWFscmVhZHlJbmNsdWRlZEtpbmdkb21SYW5kb21pemVycy5pbmNsdWRlcyhjYXJkLmNhcmRLZXkpXG4gICAgICAgICAgKVxuICAgICAgICAgIC5tYXAoY2FyZCA9PiB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICByYW5kb21pemVyOiBjYXJkLnJhbmRvbWl6ZXIsXG4gICAgICAgICAgICAgIGNhcmRMaWtlOiBjYXJkLFxuICAgICAgICAgICAgICB0eXBlOiAnY2FyZCcsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0pLFxuICAgICAgICAuLi5PYmplY3QudmFsdWVzKG5leHRFeHBhbnNpb24uZXZlbnRzKVxuICAgICAgICAgIC5maWx0ZXIoZXZlbnQgPT4gZXZlbnQucmFuZG9taXplciAhPT0gbnVsbClcbiAgICAgICAgICAubWFwKGV2ZW50ID0+ICh7XG4gICAgICAgICAgICByYW5kb21pemVyOiBldmVudC5yYW5kb21pemVyLFxuICAgICAgICAgICAgY2FyZExpa2U6IGV2ZW50LFxuICAgICAgICAgICAgdHlwZTogJ2V2ZW50J1xuICAgICAgICAgIH0pKVxuICAgICAgXSkgYXMgeyByYW5kb21pemVyOiBzdHJpbmc7IHR5cGU6ICdjYXJkJyB8ICdldmVudCc7IGNhcmRMaWtlOiBDYXJkTGlrZU5vSWQ7IH1bXTtcbiAgICAgIFxuICAgICAgY29uc3QgdW5pcXVlUmFuZG9taXplcnMgPSB1bmlxdWVCeVByb3AoYXZhaWxhYmxlUmFuZG9taXplcnMsICdyYW5kb21pemVyJyk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbbWF0Y2ggY29uZmlndXJhdG9yXSBhdmFpbGFibGUga2luZ2RvbXMgJHt1bmlxdWVSYW5kb21pemVycy5sZW5ndGh9YCk7XG4gICAgICBjb25zb2xlLmxvZyh1bmlxdWVSYW5kb21pemVycy5qb2luKCdcXG4nKSk7XG4gICAgICBcbiAgICAgIGNvbnN0IG51bUtpbmdkb21zVG9TZWxlY3QgPSBNYXRjaEJhc2VDb25maWd1cmF0aW9uLm51bWJlck9mS2luZ2RvbVBpbGVzIC0gdGhpcy5fcmVxdWVzdGVkS2luZ2RvbXMubGVuZ3RoO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW21hdGNoIGNvbmZpZ3VyYXRvcl0gbmVlZCB0byBzZWxlY3QgJHtudW1LaW5nZG9tc1RvU2VsZWN0fSBraW5nZG9tc2ApO1xuICAgICAgXG4gICAgICBjb25zdCBhbGxvd2VkRXZlbnRzQW5kT3RoZXJzID0gTWF0Y2hCYXNlQ29uZmlndXJhdGlvbi5udW1iZXJPZkV2ZW50c0FuZE90aGVycztcbiAgICAgIGxldCBzZWxlY3RlZEV2ZW50c0FuZE90aGVycyA9IHRoaXMuX2NvbmZpZy5ldmVudHMubGVuZ3RoO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUtpbmdkb21zVG9TZWxlY3Q7IGkrKykge1xuICAgICAgICBjb25zdCByYW5kb21JbmRleCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHVuaXF1ZVJhbmRvbWl6ZXJzLmxlbmd0aCk7XG4gICAgICAgIGNvbnN0IHNlbGVjdGVkUmFuZG9taXplciA9IHVuaXF1ZVJhbmRvbWl6ZXJzW3JhbmRvbUluZGV4XTtcbiAgICAgICAgXG4gICAgICAgIGlmIChzZWxlY3RlZFJhbmRvbWl6ZXIudHlwZSA9PT0gJ2NhcmQnKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFttYXRjaCBjb25maWd1cmF0b3JdIHNlbGVjdGVkIGtpbmdkb20gJHtzZWxlY3RlZFJhbmRvbWl6ZXIucmFuZG9taXplcn1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBjYXJkc0luUmFuZG9taXplciA9IGF2YWlsYWJsZVJhbmRvbWl6ZXJzXG4gICAgICAgICAgICAuZmlsdGVyKHJhbmRvbWl6ZXIgPT4gcmFuZG9taXplci5yYW5kb21pemVyID09PSBzZWxlY3RlZFJhbmRvbWl6ZXIucmFuZG9taXplcilcbiAgICAgICAgICAgIC5tYXAocmFuZG9taXplciA9PiByYW5kb21pemVyLmNhcmRMaWtlKSBhcyBDYXJkTm9JZFtdO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIHRoaXMgbWFrZXMgYW4gYXNzdW1wdGlvbiB0aGF0IGlmIHRoZXJlIGFyZSBtb3JlIGNhcmRzIHdpdGhpbiBhIHJhbmRvbWl6ZXIgZ3JvdXAgKHN1Y2ggYXMga25pZ2h0cyBmcm9tIGRhcmtcbiAgICAgICAgICAvLyBhZ2VzKSB0aGF0IHRoZXkgd2lsbCBhbGwgYmUgaW4gdGhlIHNhbWUga2luZ2RvbS5cbiAgICAgICAgICBjb25zdCBraW5nZG9tID0gY2FyZHNJblJhbmRvbWl6ZXJbMF0ua2luZ2RvbTtcbiAgICAgICAgICBcbiAgICAgICAgICBsZXQgY2FyZHM6IENhcmROb0lkW10gPSBbXTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIWNhcmRzSW5SYW5kb21pemVyLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBbbWF0Y2ggY29uZmlndXJhdG9yXSBubyBjYXJkcyBmb3VuZCBmb3IgcmFuZG9taXplciAke3NlbGVjdGVkUmFuZG9taXplci5yYW5kb21pemVyfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoY2FyZHNJblJhbmRvbWl6ZXIubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICBjYXJkcyA9IG5ldyBBcnJheShnZXREZWZhdWx0S2luZ2RvbVN1cHBseVNpemUoY2FyZHNJblJhbmRvbWl6ZXJbMF0sIHRoaXMuX2NvbmZpZykpLmZpbGwoY2FyZHNJblJhbmRvbWl6ZXJbMF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhcmRzID0gY2FyZHNJblJhbmRvbWl6ZXI7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGFkZGl0aW9uYWxLaW5nZG9tcy5wdXNoKHtcbiAgICAgICAgICAgIG5hbWU6IGtpbmdkb20sXG4gICAgICAgICAgICBjYXJkc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbbWF0Y2ggY29uZmlndXJhdG9yXSBzZWxlY3RlZCBldmVudCAke3NlbGVjdGVkUmFuZG9taXplci5yYW5kb21pemVyfWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICgrK3NlbGVjdGVkRXZlbnRzQW5kT3RoZXJzIDw9IGFsbG93ZWRFdmVudHNBbmRPdGhlcnMpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbbWF0Y2ggY29uZmlndXJhdG9yXSBzZWxlY3RlZCBldmVudCAke3NlbGVjdGVkUmFuZG9taXplci5yYW5kb21pemVyfSBpcyBhbGxvd2VkLCBhZGRpbmcgdG8gbWF0Y2hgKTtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50ID0gYXZhaWxhYmxlUmFuZG9taXplcnNcbiAgICAgICAgICAgICAgLmZpbmQocmFuZG9taXplciA9PiByYW5kb21pemVyLnJhbmRvbWl6ZXIgPT09IHNlbGVjdGVkUmFuZG9taXplci5yYW5kb21pemVyKVxuICAgICAgICAgICAgICA/LmNhcmRMaWtlIGFzIEV2ZW50Tm9JZDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFldmVudCkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFttYXRjaCBjb25maWd1cmF0b3JdIGV2ZW50IG5vdCBmb3VuZCBmb3IgcmFuZG9taXplciAke3NlbGVjdGVkUmFuZG9taXplci5yYW5kb21pemVyfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLl9jb25maWcuZXZlbnRzLnB1c2goZXZlbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbbWF0Y2ggY29uZmlndXJhdG9yXSBzZWxlY3RlZCBldmVudCAke3NlbGVjdGVkUmFuZG9taXplci5yYW5kb21pemVyfSBpcyBub3QgYWxsb3dlZCwgYWxyZWFkeSBoYXZlIG1heCBudW1iZXIgb2YgZXZlbnRzIGFuZCBvdGhlcnNgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gcmVkdWNlIHRoZSBjb3VudGVyIGJlY2F1c2UgZXZlbnRzIGRvbid0IGNvdW50IGFnYWluc3Qga2luZ2RvbSBzZWxlY3Rpb25cbiAgICAgICAgICBpLS07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIHJlbW92ZSB0aGUgcmFuZG9taXplciBzbyBpdCBjYW4ndCBiZSBzZWxlY3RlZCBhZ2FpblxuICAgICAgICB1bmlxdWVSYW5kb21pemVycy5zcGxpY2UocmFuZG9tSW5kZXgsIDEpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICB0aGlzLl9jb25maWcua2luZ2RvbVN1cHBseSA9XG4gICAgICBzdHJ1Y3R1cmVkQ2xvbmUoXG4gICAgICAgIHNlbGVjdGVkS2luZ2RvbXMubWFwKGNhcmQgPT4ge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBuYW1lOiBjYXJkLmNhcmRLZXksXG4gICAgICAgICAgICBjYXJkczogbmV3IEFycmF5KGdldERlZmF1bHRLaW5nZG9tU3VwcGx5U2l6ZShjYXJkLCB0aGlzLl9jb25maWcpKS5maWxsKGNhcmQpXG4gICAgICAgICAgfVxuICAgICAgICB9KS5jb25jYXQoYWRkaXRpb25hbEtpbmdkb21zKVxuICAgICAgKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZyhgW21hdGNoIGNvbmZpZ3VyYXRvcl0gZmluYWxpemVkIHNlbGVjdGVkIGtpbmdkb21zIGNvdW50ICR7dGhpcy5fY29uZmlnLmtpbmdkb21TdXBwbHkubGVuZ3RofWApO1xuICAgIGNvbnNvbGUubG9nKHRoaXMuX2NvbmZpZy5raW5nZG9tU3VwcGx5Lm1hcChzdXBwbHkgPT4gc3VwcGx5Lm5hbWUpLmpvaW4oJ1xcbicpKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBzZWxlY3RCYXNpY1N1cHBseSgpIHtcbiAgICAvLyBiYXNlZCBvbiB0aGUgbnVtYmVyIG9mIHBsYXllcnMsIGdldCB0aGUgYmFzaWMgc3VwcGx5IGNhcmQgY291bnRzXG4gICAgY29uc3QgYmFzaWNDYXJkQ291bnRzID0geyAuLi5NYXRjaEJhc2VDb25maWd1cmF0aW9uLmJhc2ljU3VwcGx5QnlQbGF5ZXJDb3VudFt0aGlzLl9jb25maWcucGxheWVycy5sZW5ndGggLSAxXSB9IGFzIFJlY29yZDxDYXJkS2V5LCBudW1iZXI+O1xuICAgIFxuICAgIC8vIGNvcHBlcnMgY29tZSBmcm9tIHRoZSBzdXBwbHksIHNvIHRoZXkgYXJlIHJlbW92ZWQgaGVyZSwgYmVjYXVzZSB0aGVzZSByZXByZXNlbnQgdGhlIGNhcmRzIElOIHRoZSBzdXBwbHkgYXQgdGhlXG4gICAgLy8gc3RhcnQgb2YgZ2FtZS4gVGhlIGNvcHBlcnMgaW4gYSBwbGF5ZXIncyBoYW5kIGNvbWUgZnJvbSB0aGUgc3VwcGx5LCB3aGVyZWFzIHRoZSBlc3RhdGVzIGRvIG5vdC5cbiAgICB0aGlzLl9jb25maWcuYmFzaWNTdXBwbHkgPSBPYmplY3Qua2V5cyhiYXNpY0NhcmRDb3VudHMpLnJlZHVjZSgoYWNjLCBuZXh0S2V5KSA9PiB7XG4gICAgICBjb25zdCBjYXJkRGF0YSA9IHsgLi4ucmF3Q2FyZExpYnJhcnlbbmV4dEtleV0gfTtcbiAgICAgIGFjYy5wdXNoKHtcbiAgICAgICAgbmFtZTogY2FyZERhdGEuY2FyZEtleSxcbiAgICAgICAgY2FyZHM6IG5ldyBBcnJheShuZXh0S2V5ID09PSAnY29wcGVyJyA/IHRoaXMuX2NvbmZpZy5wbGF5ZXJzLmxlbmd0aCAqIE1hdGNoQmFzZUNvbmZpZ3VyYXRpb24ucGxheWVyU3RhcnRpbmdIYW5kLmNvcHBlciA6IGJhc2ljQ2FyZENvdW50c1tuZXh0S2V5XSkuZmlsbChjYXJkRGF0YSlcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGFjYztcbiAgICB9LCBbXSBhcyBTdXBwbHlbXSk7XG4gICAgXG4gICAgY29uc3QgYmFzaWNTdXBwbHkgPSB0aGlzLl9jb25maWcuYmFzaWNTdXBwbHkubWFwKHN1cHBseSA9PiBzdXBwbHkubmFtZSkuam9pbignLCAnKTtcbiAgICBjb25zb2xlLmxvZyhgW21hdGNoIGNvbmZpZ3VyYXRvcl0gc2V0dGluZyBkZWZhdWx0IGJhc2ljIGNhcmRzICR7YmFzaWNTdXBwbHl9YCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgZ2V0RXhwYW5zaW9uQ29uZmlndXJhdG9ycygpIHtcbiAgICBjb25zdCBjb25maWd1cmF0b3JzID0gbmV3IE1hcDxzdHJpbmcsIEV4cGFuc2lvbkNvbmZpZ3VyYXRvcj4oKTtcbiAgICBjb25zdCB1bmlxdWVFeHBhbnNpb25zID1cbiAgICAgIEFycmF5LmZyb20oXG4gICAgICAgIG5ldyBTZXQodGhpcy5fY29uZmlnLmtpbmdkb21TdXBwbHlcbiAgICAgICAgICAubWFwKHN1cHBseSA9PiBzdXBwbHkuY2FyZHMubWFwKGNhcmQgPT4gY2FyZC5leHBhbnNpb25OYW1lKSlcbiAgICAgICAgICAuZmxhdCgpXG4gICAgICAgIClcbiAgICAgICk7XG4gICAgZm9yIChjb25zdCBleHBhbnNpb25OYW1lIG9mIHVuaXF1ZUV4cGFuc2lvbnMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWF0Y2ggY29uZmlndXJhdG9yXSBsb2FkaW5nIGNvbmZpZ3VyYXRvciBmb3IgZXhwYW5zaW9uICcke2V4cGFuc2lvbk5hbWV9J2ApO1xuICAgICAgICBjb25zdCBjb25maWd1cmF0b3JGYWN0b3J5ID0gKGF3YWl0IGltcG9ydChgQGV4cGFuc2lvbnMvJHtleHBhbnNpb25OYW1lfS9jb25maWd1cmF0b3ItJHtleHBhbnNpb25OYW1lfS50c2ApKS5kZWZhdWx0IGFzIEV4cGFuc2lvbkNvbmZpZ3VyYXRvckZhY3Rvcnk7XG4gICAgICAgIGNvbmZpZ3VyYXRvcnMuc2V0KGV4cGFuc2lvbk5hbWUsIGNvbmZpZ3VyYXRvckZhY3RvcnkoKSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmxvZyhgW21hdGNoIGNvbmZpZ3VyYXRvcl0gbm8gY29uZmlndXJhdG9yIGZhY3RvcnkgZm91bmQgZm9yIGV4cGFuc2lvbiAnJHtleHBhbnNpb25OYW1lfSdgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNvbmZpZ3VyYXRvcnNcbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBydW5FeHBhbnNpb25Db25maWd1cmF0b3JzKGluaXRDb250ZXh0OiBJbml0aWFsaXplRXhwYW5zaW9uQ29udGV4dCkge1xuICAgIGNvbnN0IGNvbmZpZ3VyYXRvckl0ZXJhdG9yID0gKGF3YWl0IHRoaXMuZ2V0RXhwYW5zaW9uQ29uZmlndXJhdG9ycygpKS5lbnRyaWVzKCk7XG4gICAgXG4gICAgbGV0IGl0ZXJhdGlvbiA9IDA7XG4gICAgbGV0IGNoYW5nZXM6IE9wZXJhdGlvbltdID0gW107XG4gICAgbGV0IGNvbmZpZ1NuYXBzaG90ID0gc3RydWN0dXJlZENsb25lKHRoaXMuX2NvbmZpZyk7XG4gICAgXG4gICAgZG8ge1xuICAgICAgaXRlcmF0aW9uKys7XG4gICAgICBmb3IgKGNvbnN0IFtleHBhbnNpb25OYW1lLCBleHBhbnNpb25Db25maWd1cmF0b3JdIG9mIGNvbmZpZ3VyYXRvckl0ZXJhdG9yKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWF0Y2ggY29uZmlndXJhdG9yXSBydW5uaW5nIGV4cGFuc2lvbiBjb25maWd1cmF0b3IgZm9yIGV4cGFuc2lvbiAnJHtleHBhbnNpb25OYW1lfSdgKTtcbiAgICAgICAgYXdhaXQgZXhwYW5zaW9uQ29uZmlndXJhdG9yKHtcbiAgICAgICAgICAuLi5pbml0Q29udGV4dCxcbiAgICAgICAgICBjb25maWc6IHRoaXMuX2NvbmZpZyxcbiAgICAgICAgICBjYXJkTGlicmFyeTogcmF3Q2FyZExpYnJhcnksXG4gICAgICAgICAgZXhwYW5zaW9uRGF0YTogZXhwYW5zaW9uTGlicmFyeVtleHBhbnNpb25OYW1lXVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2hhbmdlcyA9IGNvbXBhcmUoY29uZmlnU25hcHNob3QsIHRoaXMuX2NvbmZpZyk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbbWF0Y2ggY29uZmlndXJhdG9yXSBleHBhbnNpb24gY29uZmlndXJhdG9yIGl0ZXJhdGlvbiAke2l0ZXJhdGlvbn0gY2hhbmdlcyAke2NoYW5nZXMubGVuZ3RofWApO1xuICAgICAgXG4gICAgICBjb25maWdTbmFwc2hvdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLl9jb25maWcpO1xuICAgIH0gd2hpbGUgKGNoYW5nZXMubGVuZ3RoID4gMCAmJiBpdGVyYXRpb24gPCAxMCk7XG4gICAgXG4gICAgaWYgKGl0ZXJhdGlvbiA+PSAxMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBbbWF0Y2ggY29uZmlndXJhdG9yXSBleHBhbnNpb24gY29uZmlndXJhdG9yIGZhaWxlZCB0byBjb252ZXJnZSBhZnRlciAxMCBpdGVyYXRpb25zYCk7XG4gICAgfVxuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbbWF0Y2ggY29uZmlndXJhdG9yXSByZWdpc3RlcmluZyBleHBhbnNpb24gZW5kIGdhbWUgY29uZGl0aW9uc2ApO1xuICAgIGF3YWl0IHRoaXMucmVnaXN0ZXJFeHBhbnNpb25FbmRHYW1lQ29uZGl0aW9ucyhpbml0Q29udGV4dC5lbmRHYW1lQ29uZGl0aW9uUmVnaXN0cmFyKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZyhgW21hdGNoIGNvbmZpZ3VyYXRvcl0gcmVnaXN0ZXJpbmcgZXhwYW5zaW9uIHNjb3JpbmcgZWZmZWN0c2ApO1xuICAgIGF3YWl0IHRoaXMucmVnaXN0ZXJFeHBhbnNpb25QbGF5ZXJTY29yZURlY29yYXRvcnMoaW5pdENvbnRleHQucGxheWVyU2NvcmVEZWNvcmF0b3JSZWdpc3RyYXIpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbbWF0Y2ggY29uZmlndXJhdG9yXSByZWdpc3RlcmluZyBnYW1lIGV2ZW50IGxpc3RlbmVyc2ApO1xuICAgIGF3YWl0IHRoaXMucmVnaXN0ZXJHYW1lRXZlbnRMaXN0ZW5lcnMoaW5pdENvbnRleHQuZ2FtZUV2ZW50UmVnaXN0cmFyKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyByZWdpc3RlckdhbWVFdmVudExpc3RlbmVycyhnYW1lRXZlbnRSZWdpc3RyYXI6IEdhbWVFdmVudFJlZ2lzdHJhcikge1xuICAgIGNvbnN0IHVuaXF1ZUV4cGFuc2lvbnMgPSBBcnJheS5mcm9tKG5ldyBTZXQodGhpcy5fY29uZmlnLmtpbmdkb21TdXBwbHkubWFwKHN1cHBseSA9PiBzdXBwbHkuY2FyZHMubWFwKGNhcmQgPT4gY2FyZC5leHBhbnNpb25OYW1lKSlcbiAgICAgIC5mbGF0KCkpKTtcbiAgICBmb3IgKGNvbnN0IGV4cGFuc2lvbiBvZiB1bmlxdWVFeHBhbnNpb25zKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBtb2R1bGUgPSBhd2FpdCBpbXBvcnQoKGBAZXhwYW5zaW9ucy8ke2V4cGFuc2lvbn0vY29uZmlndXJhdG9yLSR7ZXhwYW5zaW9ufS50c2ApKTtcbiAgICAgICAgaWYgKCFtb2R1bGUucmVnaXN0ZXJHYW1lRXZlbnRzKSBjb250aW51ZTtcbiAgICAgICAgbW9kdWxlLnJlZ2lzdGVyR2FtZUV2ZW50cyhnYW1lRXZlbnRSZWdpc3RyYXIsIHRoaXMuX2NvbmZpZyk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoKGVycm9yIGFzIGFueSk/LmNvZGUgPT09ICdFUlJfTU9EVUxFX05PVF9GT1VORCcpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zb2xlLndhcm4oYFttYXRjaCBjb25maWd1cmF0b3JdIGZhaWxlZCB0byByZWdpc3RlciBleHBhbnNpb24gYWN0aW9ucyBmb3IgJHtleHBhbnNpb259YCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgcmVnaXN0ZXJFeHBhbnNpb25FbmRHYW1lQ29uZGl0aW9ucyhyZWdpc3RyYXI6IEVuZEdhbWVDb25kaXRpb25SZWdpc3RyYXIpIHtcbiAgICBjb25zdCB1bmlxdWVFeHBhbnNpb25zID0gQXJyYXkuZnJvbShuZXcgU2V0KHRoaXMuX2NvbmZpZy5raW5nZG9tU3VwcGx5Lm1hcChzdXBwbHkgPT4gc3VwcGx5LmNhcmRzLm1hcChjYXJkID0+IGNhcmQuZXhwYW5zaW9uTmFtZSkpXG4gICAgICAuZmxhdCgpKSk7XG4gICAgZm9yIChjb25zdCBleHBhbnNpb24gb2YgdW5pcXVlRXhwYW5zaW9ucykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgbW9kdWxlID0gYXdhaXQgaW1wb3J0KChgQGV4cGFuc2lvbnMvJHtleHBhbnNpb259L2NvbmZpZ3VyYXRvci0ke2V4cGFuc2lvbn0udHNgKSk7XG4gICAgICAgIGlmICghbW9kdWxlLnJlZ2lzdGVyRW5kR2FtZUNvbmRpdGlvbnMpIGNvbnRpbnVlO1xuICAgICAgICBtb2R1bGUucmVnaXN0ZXJFbmRHYW1lQ29uZGl0aW9ucyhyZWdpc3RyYXIpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaWYgKChlcnJvciBhcyBhbnkpPy5jb2RlID09PSAnRVJSX01PRFVMRV9OT1RfRk9VTkQnKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS53YXJuKGBbbWF0Y2ggY29uZmlndXJhdG9yXSBmYWlsZWQgdG8gcmVnaXN0ZXIgZXhwYW5zaW9uIGVuZCBnYW1lIGNvbmRpdGlvbnMgZm9yICR7ZXhwYW5zaW9ufWApO1xuICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIHJlZ2lzdGVyRXhwYW5zaW9uUGxheWVyU2NvcmVEZWNvcmF0b3JzKHJlZ2lzdHJhcjogUGxheWVyU2NvcmVEZWNvcmF0b3JSZWdpc3RyYXIpIHtcbiAgICBjb25zdCB1bmlxdWVFeHBhbnNpb25zID0gQXJyYXkuZnJvbShuZXcgU2V0KHRoaXMuX2NvbmZpZy5raW5nZG9tU3VwcGx5Lm1hcChzdXBwbHkgPT4gc3VwcGx5LmNhcmRzLm1hcChjYXJkID0+IGNhcmQuZXhwYW5zaW9uTmFtZSkpXG4gICAgICAuZmxhdCgpKSk7XG4gICAgZm9yIChjb25zdCBleHBhbnNpb24gb2YgdW5pcXVlRXhwYW5zaW9ucykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgbW9kdWxlID0gYXdhaXQgaW1wb3J0KChgQGV4cGFuc2lvbnMvJHtleHBhbnNpb259L2NvbmZpZ3VyYXRvci0ke2V4cGFuc2lvbn0udHNgKSk7XG4gICAgICAgIGlmICghbW9kdWxlLnJlZ2lzdGVyU2NvcmluZ0Z1bmN0aW9ucykgY29udGludWU7XG4gICAgICAgIG1vZHVsZS5yZWdpc3RlclNjb3JpbmdGdW5jdGlvbnMocmVnaXN0cmFyKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmICgoZXJyb3IgYXMgYW55KT8uY29kZSA9PT0gJ0VSUl9NT0RVTEVfTk9UX0ZPVU5EJykge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnNvbGUud2FybihgW21hdGNoIGNvbmZpZ3VyYXRvcl0gZmFpbGVkIHRvIHJlZ2lzdGVyIGV4cGFuc2lvbiBzY29yaW5nIGZ1bmN0aW9ucyBmb3IgJHtleHBhbnNpb259YCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBVUEsU0FBd0IsZ0JBQWdCLEVBQUUsY0FBYyxRQUFRLG1DQUFtQztBQUNuRyxTQU1FLHNCQUFzQixRQUVqQixjQUFj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
// denoCacheMetadata=7907385344567756303,13866123267954602516