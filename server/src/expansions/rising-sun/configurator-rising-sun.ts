import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { ExpansionConfiguratorFactory, GameEventRegistrar } from '@server-types/index.ts';
import { uniqueByProp } from '../../core/match-configurator.ts';
import { registerRisingSunTokenDefinitions } from './token-definitions-rising-sun.ts';
import { risingSunTokenIds } from './token-ids-rising-sun.ts';

const SUN_TOKEN_COUNT_BY_PLAYER_COUNT: Record<number, number> = {
  2: 5,
  3: 8,
  4: 10,
  5: 12,
  6: 13,
};

// Returns true when at least one selected kingdom pile contains an Omen card.
const hasOmenInKingdom = (config: ComputedMatchConfiguration): boolean => {
  return config.kingdomSupply.some((supply) => supply.cards.some((card) => card.type.includes('OMEN')));
};

const configurator: ExpansionConfiguratorFactory = () => {
  // Ensures Rising Sun token definitions are only registered once per match scope.
  let tokenDefinitionsRegistered = false;

  return async (args) => {
    if (!tokenDefinitionsRegistered) {
      registerRisingSunTokenDefinitions(args.expansionRegistration.registerTokenDefinition);
      tokenDefinitionsRegistered = true;
      args.loggerService.debug('[rising-sun configurator] registered sun token definitions');
    }

    const hasOmen = hasOmenInKingdom(args.config);
    if (!hasOmen) {
      if ((args.config.prophecies ?? []).length > 0) {
        args.loggerService.info('[rising-sun configurator] no Omen cards in kingdom; clearing configured prophecy');
      }
      args.config.prophecies = [];
      return args.config;
    }

    const configuredProphecies = uniqueByProp(args.config.prophecies ?? [], 'cardKey');
    const candidateProphecies = uniqueByProp(
      args.config.expansions.flatMap((expansion) => Object.values(args.expansionCatalog[expansion.name]?.prophecies ?? {})),
      'cardKey',
    );
    const candidateByKey = new Set(candidateProphecies.map((prophecy) => prophecy.cardKey));
    const supportedConfiguredProphecies = configuredProphecies.filter((prophecy) => candidateByKey.has(prophecy.cardKey));

    if (supportedConfiguredProphecies.length !== configuredProphecies.length) {
      const removed = configuredProphecies
        .filter((prophecy) => !candidateByKey.has(prophecy.cardKey))
        .map((prophecy) => prophecy.cardKey);
      args.loggerService.warn(
        `[rising-sun configurator] removing unsupported prophecy selection(s): ${removed.join(', ')}`,
      );
    }

    if (configuredProphecies.length > 1) {
      args.loggerService.warn(
        `[rising-sun configurator] ${configuredProphecies.length} prophecies configured; trimming to one deterministic prophecy`,
      );
    }

    if (supportedConfiguredProphecies.length > 0) {
      args.config.prophecies = [supportedConfiguredProphecies[0]];
      args.loggerService.info(
        `[rising-sun configurator] using preselected prophecy ${supportedConfiguredProphecies[0].cardKey}`,
      );
      return args.config;
    }

    if (candidateProphecies.length < 1) {
      args.loggerService.warn('[rising-sun configurator] Omen present but no prophecy data available in loaded expansions');
      args.config.prophecies = [];
      return args.config;
    }

    const selectedProphecy = structuredClone(candidateProphecies[args.rngService.nextIndex(candidateProphecies.length)]);
    args.config.prophecies = [selectedProphecy];
    args.loggerService.info(`[rising-sun configurator] randomly selected prophecy ${selectedProphecy.cardKey}`);
    return args.config;
  };
};

export default configurator;

// Seeds Sun tokens on the active prophecy when Omen cards are present.
export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  if (!hasOmenInKingdom(config)) {
    return;
  }

  registrar('onGameStartSetup', async (args) => {
    const prophecy = args.match.prophecies?.[0];
    if (!prophecy) {
      args.loggerService.warn('[rising-sun onGameStart] Omen present but no active prophecy instance was created');
      return;
    }

    const playerCount = args.match.players.length;
    const startingSunTokens = SUN_TOKEN_COUNT_BY_PLAYER_COUNT[playerCount] ?? SUN_TOKEN_COUNT_BY_PLAYER_COUNT[6];

    args.loggerService.info(
      `[rising-sun onGameStart] placing ${startingSunTokens} Sun token counter(s) on prophecy ${prophecy.cardKey}`,
    );
    await args.actionService.run('placeToken', {
      tokenId: risingSunTokenIds.sun,
      counters: startingSunTokens,
      location: { type: 'cardLike', cardLikeId: prophecy.id },
    });
    args.loggerService.debug(
      `[rising-sun onGameStart] prophecy=${prophecy.cardKey} cardLikeId=${prophecy.id} counters=${startingSunTokens}`,
    );
  });
};
