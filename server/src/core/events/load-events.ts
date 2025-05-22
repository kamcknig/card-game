import { expansionLibrary } from '@expansions/expansion-library.ts';
import { createCardLike } from '../../utils/create-card-data.ts';
import { CardExpansionModule } from '../../types.ts';
import { EventNoId } from 'shared/shared-types.ts';
import { eventEffectFactoryMap } from './event-effect-factory-map.ts';

export const loadEvents = async (expansionName: string) => {
  const expansionEvents = (expansionLibrary[expansionName].events ??= {});
  
  try {
    const eventLibraryModule = await import(`@expansions/${expansionName}/event-library-${expansionName}.json`, { with: { type: 'json' } });
    const events = eventLibraryModule.default as Record<string, Partial<EventNoId>>;
    
    for (const cardKey of Object.keys(events)) {
      expansionEvents[cardKey] = createCardLike(cardKey, expansionName, events[cardKey]);
    }
  }
  catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(`[load-events] failed to load expansion event library for expansion ${expansionName}`);
      console.log(error);
    }
  }
  
  try {
    const eventModule = await import(`@expansions/${expansionName}/event-effects-${expansionName}.ts`);
    const events = eventModule.default as CardExpansionModule;
    
    for (const cardKey of Object.keys(events)) {
      if (eventEffectFactoryMap[cardKey]) {
        console.warn(`[load-events] card key ${cardKey} already exists in cardEffectFunctionMapFactory, overwriting`);
      }
      
      if (events[cardKey].registerEffects) {
        console.log(`[load-events] registering event effects for ${cardKey}`);
        eventEffectFactoryMap[cardKey] = events[cardKey].registerEffects;
      }
    }
  }
  catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(`[load-events] failed to load expansion event effects for expansion ${expansionName}`);
      console.log(error);
    }
  }
}
