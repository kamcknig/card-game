import jsonPatch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';
import { BaseCardMetadata, CardKey, CardNoId, ComputedMatchConfiguration, Match, Supply } from 'shared/types/index.ts';
import {
  ClientEventRegistrar,
  EndGamePolicyRegistrar,
  ExpansionConfigurator,
  ExpansionConfiguratorContext,
  ExpansionConfiguratorFactory,
  ExpansionRegistrationFacade,
  GameEventRegistrar,
  PlayerScoreDecoratorRegistrar,
} from '@server-types/index.ts';
import type { ExpansionDataLibrary } from '@expansions/expansion-library.ts';
import { CardSourceController } from '../core/card-source-controller.ts';
import { CardInstanceFactoryService } from '../core/card-instance-factory-service.ts';
import { RngService } from '../core/rng-service.ts';
import { LoggerService } from '../core/logger-service.ts';

// Returns true when every card in a kingdom pile is tagged as a temporary setup-only proxy
// (Way of the Mouse / Riverboat set-aside stand-ins). Mirrors
// `MatchConfigurator['isTemporarySetupProxySupply']` (match-configurator.ts:180-188). Exported
// so the strip step below can be unit tested directly without exercising the full convergence
// loop (which requires real, dynamically-imported expansion configurator modules).
export const isTemporarySetupProxySupply = (supply: Pick<Supply, 'cards'>): boolean => {
  if (!supply.cards.length) {
    return false;
  }
  return supply.cards.every(card => (card.metadata as BaseCardMetadata | undefined)?.base?.isSetupProxyKingdomPile === true);
};

// Removes temporary setup proxy kingdom piles from `config.kingdomSupply` in place, mirroring
// `MatchConfigurator['removeTemporarySetupProxyKingdomPiles']` (match-configurator.ts:190-198).
// A mid-game configurator rerun (Rising Sun's Divine Wind) must replicate this strip because it
// re-runs the same expansion configurators that push proxy piles during convergence (Way of the
// Mouse, Riverboat) — those piles are setup-only scaffolding and must never survive into the
// live Supply.
export const stripTemporarySetupProxyKingdomPiles = (config: ComputedMatchConfiguration, loggerService: LoggerService): void => {
  const before = config.kingdomSupply.length;
  config.kingdomSupply = config.kingdomSupply.filter(supply => !isTemporarySetupProxySupply(supply));
  const removed = before - config.kingdomSupply.length;
  if (removed > 0) {
    loggerService.info(`[rerun-expansion-configurators-mid-game] removed ${removed} temporary setup proxy kingdom pile(s)`);
  }
};

// Applies the Divine Wind FAQ's "do not re-determine" guards after a mid-game configurator
// rerun has converged:
// - "do not re-determine Shelters": `playerStartingHand` (the source for each player's starting
//   Copper/Estate-vs-Shelter mix) is restored verbatim to its pre-rerun snapshot, discarding any
//   change an expansion configurator made while re-running against the post-swap kingdom.
// - "do not re-determine Platinum/Colony": any `basicSupply` entry an expansion configurator adds
//   during the rerun is discarded unless it is `'potion'` — the one basic pile the FAQ explicitly
//   calls out ("putting out the Potions if necessary").
// Exported so both guards can be unit tested directly against fabricated pre/post config state.
export const applyMidGameFaqGuards = (
  config: ComputedMatchConfiguration,
  guards: { startingHandSnapshot: Record<CardKey, number>; basicSupplyNamesBefore: Set<string> },
  loggerService: LoggerService,
): void => {
  config.playerStartingHand = guards.startingHandSnapshot;

  const before = config.basicSupply.length;
  config.basicSupply = config.basicSupply.filter(supply => {
    if (guards.basicSupplyNamesBefore.has(supply.name) || supply.name === 'potion') {
      return true;
    }
    loggerService.warn(
      `[rerun-expansion-configurators-mid-game] discarding unexpected new basicSupply entry '${supply.name}' introduced by the rerun (FAQ: do not re-determine Platinum/Colony)`,
    );
    return false;
  });

  if (config.basicSupply.length !== before) {
    loggerService.info(
      `[rerun-expansion-configurators-mid-game] basicSupply after FAQ guard: ${config.basicSupply.map(supply => supply.name).join(', ')}`,
    );
  }
};

/**
 * Re-runs every configured expansion's configurator against the live `match.config` until it
 * converges, mirroring `MatchConfigurator.runExpansionConfigurators` (match-configurator.ts:588-633).
 *
 * Used when the kingdom changes mid-game (Rising Sun's Divine Wind): each expansion's own
 * configurator performs the setup its cards require — extra piles (Bane/Ferryman), companion
 * piles, mats, Potion, split-pile ordering, boon/hex/ally/artifact seeding — exactly as it would
 * at match start, with zero duplicated per-card knowledge in the caller.
 *
 * Side-effect policy:
 * - `match.config` mutation is the primary intended effect. Configurators write directly into the
 *   object passed as `args.config` (return values are discarded, mirroring
 *   `MatchConfigurator.runExpansionConfigurators`, which never assigns the awaited result either).
 * - `cardSourceController` is passed through unmodified. `registerZone` calls it may trigger (mat
 *   zones, via `addMatToMatchConfig`) are already idempotency-guarded with `hasSource()` at every
 *   call site, so a mid-game zone registration is a desired, safe effect.
 * - `expansionRegistration` (registerCardEffect/registerBoonEffect/registerHexEffect/
 *   registerStateEffect/registerArtifactEffect/registerProjectEffect/registerTokenDefinition/
 *   registerTokenCardPlayedHandler) is passed through unmodified. Every registrar backing these
 *   (`GameActionController`, `TokenRegistryService`) is a map-slot overwrite guarded with a
 *   warn-and-overwrite, never an append — re-invoking with the same arguments is a safe no-op,
 *   and re-invoking for a newly dealt pile's card key is the desired effect.
 * - `gameEventRegistrar`, `clientEventRegistrar`, `endGamePolicyRegistrar`, and
 *   `playerScoreDecoratorRegistrar` are stubbed to logged no-ops. None of their backing calls are
 *   append-safe (each pushes onto an array or registers a fresh socket handler), and no expansion
 *   configurator body invokes them directly today (verified by grep) — the module-level
 *   `registerGameEvents` / `registerEndGamePolicies` / `registerScoringFunctions` exports that DO
 *   use them are invoked separately, once, at match start, and are deliberately not re-invoked
 *   here. Per-card game-start setup for newly dealt piles is dispatched explicitly by the caller
 *   instead (Divine Wind, Phases 5-6).
 *
 * FAQ guards: see `applyMidGameFaqGuards`, applied after convergence.
 */
export const rerunExpansionConfiguratorsMidGame = async (args: {
  match: Match;
  expansionCatalog: ExpansionDataLibrary;
  rawCardLibrary: Record<CardKey, CardNoId>;
  cardSourceController: CardSourceController;
  cardInstanceFactoryService: CardInstanceFactoryService;
  rngService: RngService;
  loggerService: LoggerService;
  expansionRegistration: ExpansionRegistrationFacade;
}): Promise<void> => {
  const {
    match,
    expansionCatalog,
    rawCardLibrary,
    cardSourceController,
    cardInstanceFactoryService,
    rngService,
    loggerService,
    expansionRegistration,
  } = args;

  loggerService.info('[rerun-expansion-configurators-mid-game] starting mid-game expansion reconfiguration');

  // Snapshot the FAQ-protected fields before any configurator runs.
  const startingHandSnapshot = structuredClone(match.config.playerStartingHand);
  const basicSupplyNamesBefore = new Set(match.config.basicSupply.map(supply => supply.name));

  // Load a fresh configurator instance per configured expansion. Fresh instances are safe here
  // *because* the registrars they close over are either idempotent overwrites (expansionRegistration)
  // or stubbed no-ops (gameEventRegistrar etc.) — see the doc comment above.
  const configurators = new Map<string, ExpansionConfigurator>();
  for (const { name: expansionName } of match.config.expansions) {
    try {
      loggerService.debug(`[rerun-expansion-configurators-mid-game] loading configurator for expansion '${expansionName}'`);
      const configuratorFactory = (await import(`@expansions/${expansionName}/configurator-${expansionName}.ts`))
        .default as ExpansionConfiguratorFactory;
      configurators.set(expansionName, configuratorFactory());
    } catch (error) {
      if ((error as { code?: string })?.code === 'ERR_MODULE_NOT_FOUND') {
        // No configurator file for this expansion — a normal, expected case.
        loggerService.debug(
          `[rerun-expansion-configurators-mid-game] no configurator factory found for expansion '${expansionName}'`,
        );
        continue;
      }
      // The configurator module exists but failed to import/execute — surface it loudly rather
      // than silently proceeding without that expansion's mid-game setup.
      loggerService.error(
        `[rerun-expansion-configurators-mid-game] configurator for expansion '${expansionName}' exists but failed to load`,
      );
      loggerService.error(error);
      throw error;
    }
  }

  // Stubbed registrars — see the "Side-effect policy" section of the doc comment above for why
  // none of these are safe to re-invoke mid-game.
  const noopGameEventRegistrar: GameEventRegistrar = event => {
    loggerService.debug(
      `[rerun-expansion-configurators-mid-game] suppressed gameEventRegistrar('${event}') during rerun`,
    );
  };
  const noopClientEventRegistrar: ClientEventRegistrar = event => {
    loggerService.debug(
      `[rerun-expansion-configurators-mid-game] suppressed clientEventRegistrar('${String(event)}') during rerun`,
    );
  };
  const noopEndGamePolicyRegistrar: EndGamePolicyRegistrar = () => {
    loggerService.debug('[rerun-expansion-configurators-mid-game] suppressed endGamePolicyRegistrar call during rerun');
  };
  const noopPlayerScoreDecoratorRegistrar: PlayerScoreDecoratorRegistrar = () => {
    loggerService.debug('[rerun-expansion-configurators-mid-game] suppressed playerScoreDecoratorRegistrar call during rerun');
  };

  // Builds the synthesized ExpansionConfiguratorContext for one expansion's configurator call.
  const buildContext = (expansionName: string): ExpansionConfiguratorContext => ({
    config: match.config,
    cardLibrary: rawCardLibrary,
    expansionCatalog,
    expansionData: expansionCatalog[expansionName],
    match,
    cardSourceController,
    cardInstanceFactoryService,
    rngService,
    loggerService,
    gameEventRegistrar: noopGameEventRegistrar,
    clientEventRegistrar: noopClientEventRegistrar,
    endGamePolicyRegistrar: noopEndGamePolicyRegistrar,
    playerScoreDecoratorRegistrar: noopPlayerScoreDecoratorRegistrar,
    expansionRegistration,
  });

  // Convergence loop — mirrors MatchConfigurator.runExpansionConfigurators (match-configurator.ts:588-633).
  let iteration = 0;
  let changes: Operation[] = [];
  let configSnapshot = structuredClone(match.config);

  do {
    iteration++;
    for (const [expansionName, expansionConfigurator] of configurators.entries()) {
      loggerService.debug(
        `[rerun-expansion-configurators-mid-game] running expansion configurator '${expansionName}' (iteration ${iteration})`,
      );
      await expansionConfigurator(buildContext(expansionName));
    }

    changes = jsonPatch.compare(configSnapshot, match.config);

    loggerService.debug(
      `[rerun-expansion-configurators-mid-game] iteration ${iteration} produced ${changes.length} config change(s)`,
    );

    configSnapshot = structuredClone(match.config);
  } while (changes.length > 0 && iteration < 10);

  if (iteration >= 10) {
    throw new Error('[rerun-expansion-configurators-mid-game] expansion configurators failed to converge after 10 iterations');
  }

  stripTemporarySetupProxyKingdomPiles(match.config, loggerService);
  applyMidGameFaqGuards(match.config, { startingHandSnapshot, basicSupplyNamesBefore }, loggerService);

  loggerService.info('[rerun-expansion-configurators-mid-game] mid-game expansion reconfiguration complete');
};
