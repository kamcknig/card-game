import { CardKey } from 'shared/shared-types';
import { GameLifecycleCallbackContext } from '../../types.ts';
import { prosperityTokenIds } from '../prosperity/token-prosperity-ids.ts';

// Configuration for placing victory tokens on a landmark.
export type PlaceVictoryTokenPerPlayerOptions = {
  // Landmark card key that receives the tokens.
  landmarkKey: CardKey;
  // Prefix used for logging messages.
  logKey: string;
  // Human-readable landmark name for logging.
  landmarkName: string;
  // Tokens to place per player (defaults to 6 for Empires landmarks).
  tokensPerPlayer?: number;
};

// Places victory tokens on a landmark based on the current player count.
export const placeVictoryTokensPerPlayer = async (
  args: Omit<GameLifecycleCallbackContext, 'cardId'>,
  options: PlaceVictoryTokenPerPlayerOptions,
): Promise<void> => {
  // Default to the Empires landmark setup count of 6 VP per player.
  const tokensPerPlayer = options.tokensPerPlayer ?? 6;
  const victoryTokenId = prosperityTokenIds.victory;
  const totalTokens = Math.max(0, args.match.players.length * tokensPerPlayer);

  console.info(
    `[${options.logKey} onGameStart] placing ${totalTokens} VP token(s) on ${options.landmarkName}`,
  );

  // Place the computed number of victory tokens on the landmark supply pile.
  for (let i = 0; i < totalTokens; i += 1) {
    await args.runGameActionDelegate('placeToken', {
      tokenId: victoryTokenId,
      location: { type: 'supplyPile', cardKey: options.landmarkKey },
    });
  }
};
