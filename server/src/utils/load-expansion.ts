import { cardEffectFunctionMapFactory } from '../core/effects/card-effect-function-map-factory.ts';
import { scoringFunctionMap } from '@expansions/scoring-function-map.ts';
import { expansionLibrary, rawCardLibrary } from '@expansions/expansion-library.ts';
import { cardLifecycleMap } from '../core/card-lifecycle-map.ts';
import { CardExpansionModule } from '../types.ts';
import { CardCost, CardKey, CardNoId, CardType } from 'shared/shared-types.ts';
import { cardActionConditionMapFactory } from '../core/actions/card-action-condition-map-factory.ts';
import { createCardData, createCardLike } from './create-card-data.ts';
import { loadEvents } from '../core/events/load-events.ts';
import { loadLandmarks } from '../core/landmarks/load-landmarks.ts';
import { loadProjects } from '../core/projects/load-projects.ts';

// Randomizer pile definition for split piles in card libraries.
type RandomizerPileDefinition = {
  pile: {
    randomizer?: string;
    cost?: CardCost;
    type?: CardType[];
  };
  cards: Array<Partial<CardNoId> & { cardKey: CardKey }>;
};

// Type guard for boon entries in card libraries.
const isBoonCardEntry = (entry: Partial<CardNoId>): boolean => {
  return (entry.type ?? []).includes('BOON');
};

// Type guard for hex entries in card libraries.
const isHexCardEntry = (entry: Partial<CardNoId>): boolean => {
  return (entry.type ?? []).includes('HEX');
};

// Type guard for state entries in card libraries.
const isStateCardEntry = (entry: Partial<CardNoId>): boolean => {
  return (entry.type ?? []).includes('STATE');
};

// Type guard for artifact entries in card libraries.
const isArtifactCardEntry = (entry: Partial<CardNoId>): boolean => {
  return (entry.type ?? []).includes('ARTIFACT');
};

// Type guard for randomizer pile entries in card library JSON.
const isRandomizerPileDefinition = (entry: unknown): entry is RandomizerPileDefinition => {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  const maybeEntry = entry as { pile?: unknown; cards?: unknown };
  return Array.isArray(maybeEntry.cards) && !!maybeEntry.pile;
};

export const loadExpansion = async (expansion: { name: string }) => {
  const expansionPath = `@expansions/${expansion.name}`;
  const expansionName = expansion.name;
  if (expansionLibrary[expansionName]) {
    console.info(`[expansion loader] expansion ${expansionName} already loaded`);
    return;
  }

  console.log(`[expansion loader] loading expansion ${expansionName}`);

  expansionLibrary[expansionName] = {
    title: expansionName,
    name: expansionName,
    cardData: {
      basicSupply: {},
      kingdomSupply: {},
    },
    events: {},
    // Landmarks live alongside events as landscape card-likes.
    landmarks: {},
    // Boons live alongside other non-supply card-likes.
    boons: {},
    // Hexes live alongside boons as non-supply card-likes.
    hexes: {},
    // States live alongside other non-supply card-likes.
    states: {},
    // Artifacts live alongside other non-supply card-likes.
    artifacts: {},
    // Projects live alongside other non-supply card-likes.
    projects: {},
  };

  let expansionConfiguration;

  try {
    // loads the configuration file for the module if any
    console.info(`[expansion loader] loading expansion configuration for ${expansionName}`);

    const configModule = await import(`${expansionPath}/configuration-${expansionName}.json`, {
      with: { type: 'json' },
    });
    expansionConfiguration = configModule.default;
    console.info(`[expansion loader] expansion configuration loaded`);

    const currValue = expansionLibrary[expansionName].title;
    expansionLibrary[expansionName].title = expansionConfiguration.title ? expansionConfiguration.title : currValue;
    expansionLibrary[expansionName].mutuallyExclusive = expansionConfiguration.mutuallyExclusive ?? [];
  } catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(`[expansion loader] failed to load configuration for expansion ${expansionName}`);
      console.error(error);
    }
  }

  try {
    const cardData = expansionLibrary[expansionName].cardData;

    console.info(`[expansion loader] loading card library for ${expansionName}`);

    const cardLibraryModule = await import(`${expansionPath}/card-library-${expansionName}.json`, {
      with: { type: 'json' },
    });
    const cards = cardLibraryModule.default as Record<string, Partial<CardNoId> | RandomizerPileDefinition>;

    for (const key of Object.keys(cards)) {
      const entry = cards[key];
      if (isRandomizerPileDefinition(entry)) {
        // Build cards from a randomizer pile entry with shared pile metadata.
        const pileRandomizer = entry.pile.randomizer ?? key;
        const randomizerData = {
          randomizer: pileRandomizer,
          cost: entry.pile.cost,
          type: entry.pile.type,
        };
        console.debug(
          `[expansion loader] processing randomizer pile ${pileRandomizer} with ${entry.cards.length} cards`,
        );
        for (const cardEntry of entry.cards) {
          const cardKey = cardEntry.cardKey;
          if (!cardKey) {
            console.warn(`[expansion loader] randomizer pile ${pileRandomizer} missing cardKey`);
            continue;
          }
          // Route boon definitions to the boon library instead of the supply.
          if (isBoonCardEntry(cardEntry)) {
            console.debug(`[expansion loader] registering boon ${cardKey} from pile ${pileRandomizer}`);
            const boonData = createCardLike(cardKey, expansionName, {
              ...cardEntry,
              kingdomSelectable: cardEntry.kingdomSelectable ?? false,
            });
            expansionLibrary[expansionName].boons[cardKey] = boonData as any;
            continue;
          }
          if (isHexCardEntry(cardEntry)) {
            console.debug(`[expansion loader] registering hex ${cardKey} from pile ${pileRandomizer}`);
            const hexData = createCardLike(cardKey, expansionName, {
              ...cardEntry,
              kingdomSelectable: cardEntry.kingdomSelectable ?? false,
            });
            expansionLibrary[expansionName].hexes[cardKey] = hexData as any;
            continue;
          }
          if (isStateCardEntry(cardEntry)) {
            console.debug(`[expansion loader] registering state ${cardKey} from pile ${pileRandomizer}`);
            const stateData = createCardLike(cardKey, expansionName, {
              ...cardEntry,
              kingdomSelectable: cardEntry.kingdomSelectable ?? false,
            });
            expansionLibrary[expansionName].states[cardKey] = stateData as any;
            continue;
          }
          if (isArtifactCardEntry(cardEntry)) {
            console.debug(`[expansion loader] registering artifact ${cardKey} from pile ${pileRandomizer}`);
            const artifactData = createCardLike(cardKey, expansionName, {
              ...cardEntry,
              kingdomSelectable: cardEntry.kingdomSelectable ?? false,
            });
            expansionLibrary[expansionName].artifacts[cardKey] = artifactData as any;
            continue;
          }
          // Apply pile-level randomizer metadata to each card in the pile.
          const templateData = {
            ...cardEntry,
            randomizerData,
            kingdom: cardEntry.kingdom ?? pileRandomizer,
          };
          const newCardData = createCardData(cardKey, expansionName, templateData);
          const isBasic = newCardData.isBasic;
          cardData[isBasic ? 'basicSupply' : 'kingdomSupply'][cardKey] = newCardData as any;
          rawCardLibrary[cardKey] = newCardData as any;
        }
        continue;
      }

      // Route boon definitions to the boon library instead of the supply.
      if (isBoonCardEntry(entry as Partial<CardNoId>)) {
        console.debug(`[expansion loader] registering boon ${key}`);
        const boonData = createCardLike(key as CardKey, expansionName, {
          ...(entry as Partial<CardNoId>),
          kingdomSelectable: (entry as Partial<CardNoId>).kingdomSelectable ?? false,
        });
        expansionLibrary[expansionName].boons[key] = boonData as any;
        continue;
      }
      if (isHexCardEntry(entry as Partial<CardNoId>)) {
        console.debug(`[expansion loader] registering hex ${key}`);
        const hexData = createCardLike(key as CardKey, expansionName, {
          ...(entry as Partial<CardNoId>),
          kingdomSelectable: (entry as Partial<CardNoId>).kingdomSelectable ?? false,
        });
        expansionLibrary[expansionName].hexes[key] = hexData as any;
        continue;
      }
      if (isStateCardEntry(entry as Partial<CardNoId>)) {
        console.debug(`[expansion loader] registering state ${key}`);
        const stateData = createCardLike(key as CardKey, expansionName, {
          ...(entry as Partial<CardNoId>),
          kingdomSelectable: (entry as Partial<CardNoId>).kingdomSelectable ?? false,
        });
        expansionLibrary[expansionName].states[key] = stateData as any;
        continue;
      }
      if (isArtifactCardEntry(entry as Partial<CardNoId>)) {
        console.debug(`[expansion loader] registering artifact ${key}`);
        const artifactData = createCardLike(key as CardKey, expansionName, {
          ...(entry as Partial<CardNoId>),
          kingdomSelectable: (entry as Partial<CardNoId>).kingdomSelectable ?? false,
        });
        expansionLibrary[expansionName].artifacts[key] = artifactData as any;
        continue;
      }

      const newCardData = createCardData(key as CardKey, expansionName, entry as Partial<CardNoId>);

      const isBasic = newCardData.isBasic;
      cardData[isBasic ? 'basicSupply' : 'kingdomSupply'][key] = newCardData as any;
      rawCardLibrary[key] = newCardData as any;
    }

    console.info('[expansion loader] card library loaded');

    console.info(`[expansion loader] loading ${expansionName} card effects`);

    const cardEffectsModule = await import(`${expansionPath}/card-effects-${expansionName}.ts`);
    const cardEffects = cardEffectsModule.default as CardExpansionModule;

    Object.keys(cardEffects).forEach((key) => {
      if (cardEffects[key].registerScoringFunction) {
        console.debug(`[expansion loader] registering scoring function for ${key}`);
        scoringFunctionMap[key] = cardEffects[key].registerScoringFunction();
      }

      if (cardEffects[key].registerLifeCycleMethods) {
        console.debug(`[expansion loader] registering lifecycle methods for ${key}`);
        cardLifecycleMap[key] = cardEffects[key].registerLifeCycleMethods();
      }

      if (cardEffects[key].registerEffects) {
        console.debug(`[expansion loader] registering effects for ${key}`);
        cardEffectFunctionMapFactory[key] = cardEffects[key].registerEffects;
      }

      if (cardEffects[key].registerActionConditions) {
        cardActionConditionMapFactory[key] = cardEffects[key].registerActionConditions();
      }
    });
    console.log('[expansion loader] base supply card effects loaded');
  } catch (error) {
    console.warn(`[expansion loader] Failed to load expansion: ${expansionName}`);
    console.error(error);
    delete expansionLibrary[expansionName];
  }

  console.info(`[expansion loader] attempting to load events for ${expansionName}`);
  await loadEvents(expansionName);
  console.log(`[expansion loader] finished loading events for ${expansionName}`);

  // Landmarks are loaded after events to mirror landscape loading order.
  console.info(`[expansion loader] attempting to load landmarks for ${expansionName}`);
  await loadLandmarks(expansionName);
  console.log(`[expansion loader] finished loading landmarks for ${expansionName}`);

  // Projects are loaded after landmarks to mirror landscape loading order.
  console.info(`[expansion loader] attempting to load projects for ${expansionName}`);
  await loadProjects(expansionName);
  console.log(`[expansion loader] finished loading projects for ${expansionName}`);
};
