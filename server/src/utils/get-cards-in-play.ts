import { FindCardsFn } from '../types.ts';

export const getCardsInPlay = (findCards: FindCardsFn) => findCards({ location: ['playArea', 'activeDuration'] });
