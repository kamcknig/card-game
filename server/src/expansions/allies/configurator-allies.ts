import { ExpansionConfiguratorFactory, GameEventRegistrar } from '@server-types/index.ts';
import { CardKey, ComputedMatchConfiguration } from 'shared/types/index.ts';
import { uniqueByProp } from '../../core/match-configurator.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { configureSplitPile } from '../../utils/configure-split-pile.ts';

const IMPORTER_PILE_KEY = 'importer';
const AUGURS_PILE_KEY = 'augurs';
const CLASHES_PILE_KEY = 'clashes';
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

// Returns true when at least one selected kingdom pile contains a Liaison card.
const hasLiaisonInKingdom = (config: ComputedMatchConfiguration): boolean => {
  return config.kingdomSupply.some((supply) => supply.cards.some((card) => card.type.includes('LIAISON')));
};

const configurator: ExpansionConfiguratorFactory = () => {
  return async (args) => {
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

    const hasLiaison = hasLiaisonInKingdom(args.config);
    if (!hasLiaison) {
      if ((args.config.allies ?? []).length > 0) {
        args.loggerService.info('[allies configurator] no Liaison cards in kingdom; clearing computed allies');
      }
      args.config.allies = [];
      return args.config;
    }

    const configuredAllies = uniqueByProp(args.config.allies ?? [], 'cardKey');
    if (configuredAllies.length > 1) {
      args.loggerService.warn(
        `[allies configurator] ${configuredAllies.length} allies configured; trimming to one deterministic ally`,
      );
    }

    if (configuredAllies.length > 0) {
      args.config.allies = [configuredAllies[0]];
      args.loggerService.info(
        `[allies configurator] using preselected ally ${configuredAllies[0].cardKey}`,
      );
      return args.config;
    }

    const candidateAllies = args.config.expansions.flatMap((expansion) =>
      Object.values(args.expansionCatalog[expansion.name]?.allies ?? {})
    );
    const uniqueCandidates = uniqueByProp(candidateAllies, 'cardKey');
    if (uniqueCandidates.length < 1) {
      args.loggerService.warn('[allies configurator] Liaison present but no ally data available in loaded expansions');
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

// Seeds starting Favor resources when Liaison cards are present.
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

  registrar('onGameStart', async (args) => {
    args.loggerService.info(`[allies onGameStart] initializing Favor counts to ${startingFavors}`);
    args.match.favors ??= {};
    for (const player of args.match.players) {
      args.match.favors[player.id] = startingFavors;
      args.loggerService.debug(`[allies onGameStart] player ${player.id} favors=${args.match.favors[player.id]}`);
    }
  });
};
