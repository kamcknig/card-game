import { CardLocation } from 'shared/types/index.ts';

export const isLocationInPlay = (location?: CardLocation) => {
  return (!!location && location === 'playArea') || location === 'activeDuration';
};
