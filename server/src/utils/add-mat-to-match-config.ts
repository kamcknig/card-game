import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { InitializeExpansionContext } from '@server-types/index.ts';

export const addMatToMatchConfig = (
  mat: string,
  config: ComputedMatchConfiguration,
  initContext: InitializeExpansionContext,
) => {
  for (const player of config.players) {
    initContext.cardSourceController.registerZone(mat, [], player.id, ['mat']);
  }
};
