import { ExpansionConfiguratorFactory } from '@server-types/index.ts';
import { addMatToMatchConfig } from '../../utils/add-mat-to-match-config.ts';

const configurator: ExpansionConfiguratorFactory = () => {
  return async (args) => {
    // Menagerie Exile mat is only needed when at least one selected Kingdom card uses it.
    const requiresExileMat = args.config.kingdomSupply.some((supply) =>
      supply.cards.some((card) => card.mat === 'exile')
    );

    if (!requiresExileMat) {
      return args.config;
    }

    // Avoid duplicate zone registration across configurator re-runs.
    const exileZoneAlreadyRegisteredForAllPlayers = args.config.players.every((player) => {
      try {
        args.cardSourceController.getSource('exile', player.id);
        return true;
      } catch {
        return false;
      }
    });

    if (exileZoneAlreadyRegisteredForAllPlayers) {
      console.debug('[menagerie configurator] exile mat already configured for all players');
      return args.config;
    }

    console.info('[menagerie configurator] adding exile mat zones for all players');
    addMatToMatchConfig('exile', args.config, args);
    return args.config;
  };
};

export default configurator;
