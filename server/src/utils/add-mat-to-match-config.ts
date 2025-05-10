import { ComputedMatchConfiguration } from 'shared/shared-types.ts';
import { InitializeExpansionContext } from '../types.ts';

export const addMatToMatchConfig = (mat: string, config: ComputedMatchConfiguration, initContext: InitializeExpansionContext) => {
  for (const player of config.players) {
    initContext.cardSourceController.registerZone(mat, [], player.id, ['mat']);
  }
}