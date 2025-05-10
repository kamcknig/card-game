import { CardLocation } from 'shared/shared-types.ts';

export const isLocationInPlay = (location: CardLocation) => {
  return location === 'playArea' || location === 'activeDuration';
}
