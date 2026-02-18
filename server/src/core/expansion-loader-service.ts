import { createEmptyExpansionData } from '@expansions/expansion-library.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { CardCost, CardKey, CardNoId, CardType } from 'shared/types/index.ts';
import { createCardData, createCardLike } from '../utils/create-card-data.ts';
import { ExpansionEffectRegistryService } from './expansion-effect-registry-service.ts';
import { ExpansionCardMetadataRegistryService } from './expansion-card-metadata-registry-service.ts';
import { ExpansionCatalogService } from './expansion-catalog-service.ts';
import { LoggerService } from './logger-service.ts';
import { EventLoaderService } from './events/load-events.ts';
import { LandmarkLoaderService } from './landmarks/load-landmarks.ts';
import { ProjectLoaderService } from './projects/load-projects.ts';

// Randomizer pile definition for split piles in card libraries.
type RandomizerPileDefinition = {
  pile: {
    randomizer?: string;
    cost?: CardCost;
    type?: CardType[];
  };
  cards: Array<Partial<CardNoId> & { cardKey: CardKey }>;
};

// Loads expansion card and card-like data, plus effect registrations, into the runtime catalog.
export class ExpansionLoaderService {
  constructor(
    private readonly expansionEffectRegistryService: ExpansionEffectRegistryService,
    private readonly expansionCardMetadataRegistryService: ExpansionCardMetadataRegistryService,
    private readonly expansionCatalogService: ExpansionCatalogService,
    private readonly eventLoaderService: EventLoaderService,
    private readonly landmarkLoaderService: LandmarkLoaderService,
    private readonly projectLoaderService: ProjectLoaderService,
    private readonly loggerService: LoggerService,
  ) {}

  // Loads a single expansion by name when not already loaded.
  public async loadExpansion(expansion: { name: string }): Promise<void> {
    const expansionName = expansion.name;
    const expansionPath = `@expansions/${expansionName}`;

    if (this.expansionCatalogService.hasExpansion(expansionName)) {
      this.loggerService.info(`[expansion loader] expansion ${expansionName} already loaded`);
      return;
    }

    this.loggerService.log(`[expansion loader] loading expansion ${expansionName}`);
    const expansionData = createEmptyExpansionData(expansionName);
    this.expansionCatalogService.setExpansion(expansionName, expansionData);

    try {
      // Load expansion metadata when provided.
      this.loggerService.info(`[expansion loader] loading expansion configuration for ${expansionName}`);
      const configModule = await import(`${expansionPath}/configuration-${expansionName}.json`, {
        with: { type: 'json' },
      });
      const expansionConfiguration = configModule.default as { title?: string; mutuallyExclusive?: string[] };
      this.loggerService.info(`[expansion loader] expansion configuration loaded`);

      const currentTitle = expansionData.title;
      expansionData.title = expansionConfiguration.title ? expansionConfiguration.title : currentTitle;
      expansionData.mutuallyExclusive = expansionConfiguration.mutuallyExclusive ?? [];
    } catch (error) {
      if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
        this.loggerService.warn(`[expansion loader] failed to load configuration for expansion ${expansionName}`);
        this.loggerService.error(error);
      }
    }

    try {
      const cardData = expansionData.cardData;

      this.loggerService.info(`[expansion loader] loading card library for ${expansionName}`);
      const cardLibraryModule = await import(`${expansionPath}/card-library-${expansionName}.json`, {
        with: { type: 'json' },
      });
      const cards = cardLibraryModule.default as Record<string, Partial<CardNoId> | RandomizerPileDefinition>;

      for (const key of Object.keys(cards)) {
        const entry = cards[key];
        if (ExpansionLoaderService.isRandomizerPileDefinition(entry)) {
          // Build cards from a randomizer pile entry with shared pile metadata.
          const pileRandomizer = entry.pile.randomizer ?? key;
          const randomizerData = {
            randomizer: pileRandomizer,
            cost: entry.pile.cost,
            type: entry.pile.type,
          };
          this.loggerService.debug(
            `[expansion loader] processing randomizer pile ${pileRandomizer} with ${entry.cards.length} cards`,
          );
          for (const cardEntry of entry.cards) {
            const cardKey = cardEntry.cardKey;
            if (!cardKey) {
              this.loggerService.warn(`[expansion loader] randomizer pile ${pileRandomizer} missing cardKey`);
              continue;
            }

            // Route card-like definitions to their dedicated catalogs.
            if (ExpansionLoaderService.isBoonCardEntry(cardEntry)) {
              this.loggerService.debug(`[expansion loader] registering boon ${cardKey} from pile ${pileRandomizer}`);
              const boonData = createCardLike(cardKey, expansionName, {
                ...cardEntry,
                kingdomSelectable: cardEntry.kingdomSelectable ?? false,
              });
              expansionData.boons[cardKey] = boonData as any;
              continue;
            }
            if (ExpansionLoaderService.isHexCardEntry(cardEntry)) {
              this.loggerService.debug(`[expansion loader] registering hex ${cardKey} from pile ${pileRandomizer}`);
              const hexData = createCardLike(cardKey, expansionName, {
                ...cardEntry,
                kingdomSelectable: cardEntry.kingdomSelectable ?? false,
              });
              expansionData.hexes[cardKey] = hexData as any;
              continue;
            }
            if (ExpansionLoaderService.isStateCardEntry(cardEntry)) {
              this.loggerService.debug(`[expansion loader] registering state ${cardKey} from pile ${pileRandomizer}`);
              const stateData = createCardLike(cardKey, expansionName, {
                ...cardEntry,
                kingdomSelectable: cardEntry.kingdomSelectable ?? false,
              });
              expansionData.states[cardKey] = stateData as any;
              continue;
            }
            if (ExpansionLoaderService.isArtifactCardEntry(cardEntry)) {
              this.loggerService.debug(
                `[expansion loader] registering artifact ${cardKey} from pile ${pileRandomizer}`,
              );
              const artifactData = createCardLike(cardKey, expansionName, {
                ...cardEntry,
                kingdomSelectable: cardEntry.kingdomSelectable ?? false,
              });
              expansionData.artifacts[cardKey] = artifactData as any;
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
            this.expansionCatalogService.setRawCard(cardKey, newCardData as any);
          }
          continue;
        }

        // Route card-like definitions to their dedicated catalogs.
        if (ExpansionLoaderService.isBoonCardEntry(entry as Partial<CardNoId>)) {
          this.loggerService.debug(`[expansion loader] registering boon ${key}`);
          const boonData = createCardLike(key as CardKey, expansionName, {
            ...(entry as Partial<CardNoId>),
            kingdomSelectable: (entry as Partial<CardNoId>).kingdomSelectable ?? false,
          });
          expansionData.boons[key] = boonData as any;
          continue;
        }
        if (ExpansionLoaderService.isHexCardEntry(entry as Partial<CardNoId>)) {
          this.loggerService.debug(`[expansion loader] registering hex ${key}`);
          const hexData = createCardLike(key as CardKey, expansionName, {
            ...(entry as Partial<CardNoId>),
            kingdomSelectable: (entry as Partial<CardNoId>).kingdomSelectable ?? false,
          });
          expansionData.hexes[key] = hexData as any;
          continue;
        }
        if (ExpansionLoaderService.isStateCardEntry(entry as Partial<CardNoId>)) {
          this.loggerService.debug(`[expansion loader] registering state ${key}`);
          const stateData = createCardLike(key as CardKey, expansionName, {
            ...(entry as Partial<CardNoId>),
            kingdomSelectable: (entry as Partial<CardNoId>).kingdomSelectable ?? false,
          });
          expansionData.states[key] = stateData as any;
          continue;
        }
        if (ExpansionLoaderService.isArtifactCardEntry(entry as Partial<CardNoId>)) {
          this.loggerService.debug(`[expansion loader] registering artifact ${key}`);
          const artifactData = createCardLike(key as CardKey, expansionName, {
            ...(entry as Partial<CardNoId>),
            kingdomSelectable: (entry as Partial<CardNoId>).kingdomSelectable ?? false,
          });
          expansionData.artifacts[key] = artifactData as any;
          continue;
        }

        const newCardData = createCardData(key as CardKey, expansionName, entry as Partial<CardNoId>);
        const isBasic = newCardData.isBasic;
        cardData[isBasic ? 'basicSupply' : 'kingdomSupply'][key] = newCardData as any;
        this.expansionCatalogService.setRawCard(key as CardKey, newCardData as any);
      }

      this.loggerService.info('[expansion loader] card library loaded');
      this.loggerService.info(`[expansion loader] loading ${expansionName} card effects`);

      const cardEffectsModule = await import(`${expansionPath}/card-effects-${expansionName}.ts`);
      const cardEffects = cardEffectsModule.default as CardExpansionModule;

      Object.keys(cardEffects).forEach((key) => {
        if (cardEffects[key].registerScoringFunction) {
          this.loggerService.debug(`[expansion loader] registering scoring function for ${key}`);
          this.expansionCardMetadataRegistryService.registerScoringFunction(
            key as CardKey,
            cardEffects[key].registerScoringFunction(),
          );
        }

        if (cardEffects[key].registerLifeCycleMethods) {
          this.loggerService.debug(`[expansion loader] registering lifecycle methods for ${key}`);
          this.expansionCardMetadataRegistryService.registerLifecycleMethods(
            key as CardKey,
            cardEffects[key].registerLifeCycleMethods(),
          );
        }

        if (cardEffects[key].registerEffects) {
          this.loggerService.debug(`[expansion loader] registering effects for ${key}`);
          this.expansionEffectRegistryService.registerCardEffectFactory(key as CardKey, cardEffects[key].registerEffects);
        }

        if (cardEffects[key].registerActionConditions) {
          this.expansionEffectRegistryService.registerCardActionConditions(
            key as CardKey,
            cardEffects[key].registerActionConditions(),
          );
        }

        if (cardEffects[key].registerAlternateBuyOptions) {
          // Register expansion-provided alternate buy paths for this card key.
          this.expansionEffectRegistryService.registerCardAlternateBuyOptions(
            key as CardKey,
            cardEffects[key].registerAlternateBuyOptions(),
          );
        }
      });
      this.loggerService.log('[expansion loader] base supply card effects loaded');
    } catch (error) {
      this.loggerService.warn(`[expansion loader] Failed to load expansion: ${expansionName}`);
      this.loggerService.error(error);
      this.expansionCatalogService.removeExpansion(expansionName);
    }

    this.loggerService.info(`[expansion loader] attempting to load events for ${expansionName}`);
    await this.eventLoaderService.loadExpansionEvents(expansionName);
    this.loggerService.log(`[expansion loader] finished loading events for ${expansionName}`);

    // Landmarks are loaded after events to mirror landscape loading order.
    this.loggerService.info(`[expansion loader] attempting to load landmarks for ${expansionName}`);
    await this.landmarkLoaderService.loadExpansionLandmarks(expansionName);
    this.loggerService.log(`[expansion loader] finished loading landmarks for ${expansionName}`);

    // Projects are loaded after landmarks to mirror landscape loading order.
    this.loggerService.info(`[expansion loader] attempting to load projects for ${expansionName}`);
    await this.projectLoaderService.loadExpansionProjects(expansionName);
    this.loggerService.log(`[expansion loader] finished loading projects for ${expansionName}`);
  }

  // Type guard for boon entries in card libraries.
  private static isBoonCardEntry(entry: Partial<CardNoId>): boolean {
    return (entry.type ?? []).includes('BOON');
  }

  // Type guard for hex entries in card libraries.
  private static isHexCardEntry(entry: Partial<CardNoId>): boolean {
    return (entry.type ?? []).includes('HEX');
  }

  // Type guard for state entries in card libraries.
  private static isStateCardEntry(entry: Partial<CardNoId>): boolean {
    return (entry.type ?? []).includes('STATE');
  }

  // Type guard for artifact entries in card libraries.
  private static isArtifactCardEntry(entry: Partial<CardNoId>): boolean {
    return (entry.type ?? []).includes('ARTIFACT');
  }

  // Type guard for randomizer pile entries in card library JSON.
  private static isRandomizerPileDefinition(entry: unknown): entry is RandomizerPileDefinition {
    if (!entry || typeof entry !== 'object') {
      return false;
    }
    const maybeEntry = entry as { pile?: unknown; cards?: unknown };
    return Array.isArray(maybeEntry.cards) && !!maybeEntry.pile;
  }
}
