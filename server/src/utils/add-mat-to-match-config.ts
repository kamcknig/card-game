import { ComputedMatchConfiguration, Mats } from 'shared/shared-types.ts';

export const addMatToMatchConfig = (mat: string, config: ComputedMatchConfiguration) => {
  for (const player of config.players) {
    config.mats ??= {} as any;
    config.mats[player.id] ??= {} as any;
    config.mats[player.id][mat as Mats] = [];
  }
}