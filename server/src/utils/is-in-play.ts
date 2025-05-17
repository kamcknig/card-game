import { CardLocation } from 'shared/shared-types.ts';

export const isLocationInPlay = (location?: CardLocation) => {
  return !!location && location === 'playArea' || location === 'activeDuration';
}
