import { FindCardsFn } from '@server-types/index.ts';

export const getCardsInPlay = (findCards: FindCardsFn) => findCards({ location: ['playArea', 'activeDuration'] });
