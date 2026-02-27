import { CardId, CardLocation, PlayerId } from 'shared/types/index.ts';

// Returns a player zone source when available; otherwise returns an empty list.
export const getPlayerSourceSafe = (
  args: {
    cardSourceController: {
      getSource: (source: CardLocation, playerId?: PlayerId) => CardId[];
    };
  },
  source: CardLocation,
  playerId: PlayerId,
): CardId[] => {
  try {
    return args.cardSourceController.getSource(source, playerId);
  } catch {
    return [];
  }
};
