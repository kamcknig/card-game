import { Card, CardFacing, Match } from 'shared/types/index.ts';
import { getConfiguredCardPileLocation } from './get-configured-card-pile-location.ts';

type MoveCardRunner = {
  run: (
    action: 'moveCard',
    args: {
      cardId: number;
      to: { location: 'basicSupply' | 'kingdomSupply' | 'nonSupplyCards' };
      facing?: CardFacing;
    },
  ) => Promise<unknown>;
};

type LoggerLike = {
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

// Returns a card to the top of its configured pile when that pile exists in match config.
export const returnCardToConfiguredPileTop = async (args: {
  actionService: MoveCardRunner;
  loggerService: LoggerLike;
  match: Match;
  card: Card;
  logTag: string;
  facing?: CardFacing;
}): Promise<boolean> => {
  const destination = getConfiguredCardPileLocation(args.match, args.card);
  if (!destination) {
    args.loggerService.warn(`[${args.logTag}] no configured pile found for ${args.card}`);
    return false;
  }

  args.loggerService.debug(
    `[${args.logTag}] returning ${args.card} to ${destination.location} pile ${destination.pileName}`,
  );
  await args.actionService.run('moveCard', {
    cardId: args.card.id,
    to: { location: destination.location },
    facing: args.facing,
  });
  return true;
};
