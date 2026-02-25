import {
  ExpansionConfiguratorFactory,
  GameEventRegistrar,
  PlayerScoreDecoratorRegistrar,
} from '@server-types/index.ts';
import { validateCostSpec } from '@shared/validate-cost-spec.ts';
import { CardCost, CardKey, ComputedMatchConfiguration, CostSpec } from 'shared/types/index.ts';
import { uniqueByProp } from '../../core/match-configurator.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { configureSplitPile } from '../../utils/configure-split-pile.ts';
import { registerAlliesTokenDefinitions } from './token-definitions-allies.ts';
import {
  getPlayerFavorCount,
  registerActiveAllyEffects,
  skippedAllyImplementations,
} from './ally-effects-allies.ts';
import { alliesTokenIds } from './token-ids-allies.ts';

const IMPORTER_PILE_KEY = 'importer';
const AUGURS_PILE_KEY = 'augurs';
const CLASHES_PILE_KEY = 'clashes';
const FORTS_PILE_KEY = 'forts';
const ODYSSEYS_PILE_KEY = 'odysseys';
const TOWNSFOLK_PILE_KEY = 'townsfolk';
const WIZARDS_PILE_KEY = 'wizards';
const PLATEAU_SHEPHERDS_KEY = 'plateau-shepherds';
// Plateau Shepherds pairs Favor with cards costing exactly $2.
const EXACT_TWO_COST: CardCost = {
  treasure: 2,
  potion: 0,
  debt: 0,
};
// Canonical Augurs split-pile order (bottom -> top).
const AUGURS_ORDER: CardKey[] = [
  'sibyl',
  'sibyl',
  'sibyl',
  'sibyl',
  'sorceress',
  'sorceress',
  'sorceress',
  'sorceress',
  'acolyte',
  'acolyte',
  'acolyte',
  'acolyte',
  'herb-gatherer',
  'herb-gatherer',
  'herb-gatherer',
  'herb-gatherer',
];
// Canonical Clashes split-pile order (bottom -> top).
const CLASHES_ORDER: CardKey[] = [
  'territory',
  'territory',
  'territory',
  'territory',
  'warlord',
  'warlord',
  'warlord',
  'warlord',
  'archer',
  'archer',
  'archer',
  'archer',
  'battle-plan',
  'battle-plan',
  'battle-plan',
  'battle-plan',
];
// Canonical Forts split-pile order (bottom -> top).
const FORTS_ORDER: CardKey[] = [
  'stronghold',
  'stronghold',
  'stronghold',
  'stronghold',
  'hill-fort',
  'hill-fort',
  'hill-fort',
  'hill-fort',
  'garrison',
  'garrison',
  'garrison',
  'garrison',
  'tent',
  'tent',
  'tent',
  'tent',
];
// Canonical Odysseys split-pile order (bottom -> top).
const ODYSSEYS_ORDER: CardKey[] = [
  'distant-shore',
  'distant-shore',
  'distant-shore',
  'distant-shore',
  'sunken-treasure',
  'sunken-treasure',
  'sunken-treasure',
  'sunken-treasure',
  'voyage',
  'voyage',
  'voyage',
  'voyage',
  'old-map',
  'old-map',
  'old-map',
  'old-map',
];
// Canonical Townsfolk split-pile order (bottom -> top).
const TOWNSFOLK_ORDER: CardKey[] = [
  'elder',
  'elder',
  'elder',
  'elder',
  'miller',
  'miller',
  'miller',
  'miller',
  'blacksmith',
  'blacksmith',
  'blacksmith',
  'blacksmith',
  'town-crier',
  'town-crier',
  'town-crier',
  'town-crier',
];
// Canonical Wizards split-pile order (bottom -> top).
const WIZARDS_ORDER: CardKey[] = [
  'lich',
  'lich',
  'lich',
  'lich',
  'sorcerer',
  'sorcerer',
  'sorcerer',
  'sorcerer',
  'conjurer',
  'conjurer',
  'conjurer',
  'conjurer',
  'student',
  'student',
  'student',
  'student',
];

// Returns true when at least one selected kingdom pile contains a Liaison card.
const hasLiaisonInKingdom = (config: ComputedMatchConfiguration): boolean => {
  return config.kingdomSupply.some((supply) => supply.cards.some((card) => card.type.includes('LIAISON')));
};

// Ally effects with known missing engine support are excluded from setup selection.
const skippedAllyKeys = new Set(skippedAllyImplementations.map((entry) => entry.cardKey));

const configurator: ExpansionConfiguratorFactory = () => {
  // Ensures Ally token definitions are only registered once per match scope.
  let tokenDefinitionsRegistered = false;

  return async (args) => {
    if (!tokenDefinitionsRegistered) {
      registerAlliesTokenDefinitions(args.expansionRegistration.registerTokenDefinition);
      tokenDefinitionsRegistered = true;
    }

    // Keep Augurs split pile in canonical order whenever selected.
    configureSplitPile(args, {
      pileKey: AUGURS_PILE_KEY,
      desiredOrder: AUGURS_ORDER,
      logLabel: AUGURS_PILE_KEY,
    });
    // Keep Clashes split pile in canonical order whenever selected.
    configureSplitPile(args, {
      pileKey: CLASHES_PILE_KEY,
      desiredOrder: CLASHES_ORDER,
      logLabel: CLASHES_PILE_KEY,
    });
    // Keep Forts split pile in canonical order whenever selected.
    configureSplitPile(args, {
      pileKey: FORTS_PILE_KEY,
      desiredOrder: FORTS_ORDER,
      logLabel: FORTS_PILE_KEY,
    });
    // Keep Odysseys split pile in canonical order whenever selected.
    configureSplitPile(args, {
      pileKey: ODYSSEYS_PILE_KEY,
      desiredOrder: ODYSSEYS_ORDER,
      logLabel: ODYSSEYS_PILE_KEY,
    });
    // Keep Townsfolk split pile in canonical order whenever selected.
    configureSplitPile(args, {
      pileKey: TOWNSFOLK_PILE_KEY,
      desiredOrder: TOWNSFOLK_ORDER,
      logLabel: TOWNSFOLK_PILE_KEY,
    });
    // Keep Wizards split pile in canonical order whenever selected.
    configureSplitPile(args, {
      pileKey: WIZARDS_PILE_KEY,
      desiredOrder: WIZARDS_ORDER,
      logLabel: WIZARDS_PILE_KEY,
    });

    const hasLiaison = hasLiaisonInKingdom(args.config);
    if (!hasLiaison) {
      if ((args.config.allies ?? []).length > 0) {
        args.loggerService.info('[ally configurator] no Liaison cards in kingdom; clearing computed ally');
      }
      args.config.allies = [];
      return args.config;
    }

    const configuredAllies = uniqueByProp(args.config.allies ?? [], 'cardKey');
    const supportedConfiguredAllies = configuredAllies.filter((ally) => !skippedAllyKeys.has(ally.cardKey));
    if (supportedConfiguredAllies.length !== configuredAllies.length) {
      const skippedConfigured = configuredAllies
        .filter((ally) => skippedAllyKeys.has(ally.cardKey))
        .map((ally) => ally.cardKey);
      args.loggerService.warn(
        `[allies configurator] removing unsupported ally selection(s): ${skippedConfigured.join(', ')}`,
      );
    }

    if (configuredAllies.length > 1) {
      args.loggerService.warn(
        `[allies configurator] ${configuredAllies.length} allies configured; trimming to one deterministic ally`,
      );
    }

    if (supportedConfiguredAllies.length > 0) {
      args.config.allies = [supportedConfiguredAllies[0]];
      args.loggerService.info(
        `[allies configurator] using preselected ally ${supportedConfiguredAllies[0].cardKey}`,
      );
      return args.config;
    }

    const candidateAllies = args.config.expansions.flatMap((expansion) =>
      Object.values(args.expansionCatalog[expansion.name]?.allies ?? {})
    );
    const uniqueCandidates = uniqueByProp(candidateAllies, 'cardKey')
      .filter((ally) => !skippedAllyKeys.has(ally.cardKey));
    if (uniqueCandidates.length < 1) {
      args.loggerService.warn(
        '[ally configurator] Liaison present but no supported ally data available in loaded expansions',
      );
      args.config.allies = [];
      return args.config;
    }

    const selectedAlly = structuredClone(uniqueCandidates[args.rngService.nextIndex(uniqueCandidates.length)]);
    args.config.allies = [selectedAlly];
    args.loggerService.info(`[allies configurator] randomly selected ally ${selectedAlly.cardKey}`);
    return args.config;
  };
};

export default configurator;

// Seeds starting Favor tokens when Liaison cards are present.
export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  const hasLiaison = hasLiaisonInKingdom(config);
  if (!hasLiaison) {
    return;
  }

  const hasImporter = config.kingdomSupply.some((supply) =>
    supply.cards.some((card) => getCardPileKey(card) === IMPORTER_PILE_KEY)
  );
  const startingFavors = hasImporter ? 5 : 1;

  registrar('onGameStartSetup', async (args) => {
    args.loggerService.info(`[allies onGameStart] initializing Favor tokens to ${startingFavors}`);
    for (const player of args.match.players) {
      for (let index = 0; index < startingFavors; index += 1) {
        await args.actionService.run('placeToken', {
          tokenId: alliesTokenIds.favor,
          ownerId: player.id,
          location: { type: 'player', playerId: player.id },
        });
      }
      args.loggerService.debug(`[allies onGameStart] player ${player.id} favorTokens=${startingFavors}`);
    }

    // Register active Ally behavior after Favor tokens are initialized.
    registerActiveAllyEffects(args, config);
  });
};

// Registers Allies end-game scoring decorators for score-only allies.
export const registerScoringFunctions = (registrar: PlayerScoreDecoratorRegistrar) => {
  registrar((playerId, match, cardLibrary) => {
    // Plateau Shepherds scores only when it is the active ally in the match.
    if (match.allies?.[0]?.cardKey !== PLATEAU_SHEPHERDS_KEY) {
      return;
    }

    // Favor is modeled as player-owned Favor tokens.
    const favorCount = getPlayerFavorCount(match, playerId);
    if (favorCount < 1) {
      return;
    }

    // Count all cards the player owns with effective cost exactly $2.
    // Non-turn-limited reducers like Flourishing Trade apply during scoring.
    const exactTwoCostSpec: CostSpec = { kind: 'exact', playerId, amount: EXACT_TWO_COST };
    const playerCards = cardLibrary.getCardsByOwner(playerId);
    let costTwoCardCount = 0;
    for (const card of playerCards) {
      const effectiveCost = match.cardOverrides[playerId]?.[card.id]?.cost ?? card.cost;
      if (!validateCostSpec(exactTwoCostSpec, effectiveCost)) {
        continue;
      }
      costTwoCardCount++;
    }

    if (costTwoCardCount < 1) {
      return;
    }

    // Score 2 VP per Favor/card pair.
    const pairCount = Math.min(favorCount, costTwoCardCount);
    const bonus = pairCount * 2;
    match.scores[playerId] = (match.scores[playerId] ?? 0) + bonus;
  });
};
