import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { InitializeExpansionContext } from '@server-types/index.ts';

export const addMatToMatchConfig = (
  mat: string,
  config: ComputedMatchConfiguration,
  initContext: InitializeExpansionContext,
) => {
  for (const player of config.players) {
    // Configurators can run multiple times; skip zones already registered for this player/mat.
    if (initContext.cardSourceController.hasSource(mat, player.id)) {
      initContext.loggerService.debug(
        `[match configurator] mat zone '${mat}:${player.id}' already exists, skipping duplicate registration`,
      );
      continue;
    }

    initContext.loggerService.debug(`[match configurator] registering mat zone '${mat}:${player.id}'`);
    initContext.cardSourceController.registerZone(mat, [], player.id, ['mat']);
  }
};
