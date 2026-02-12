import { CardLocation } from 'shared/shared-types';

export const isLocationInPlay = (location?: CardLocation) => {
  return !!location && location === 'playArea' || location === 'activeDuration';
};
