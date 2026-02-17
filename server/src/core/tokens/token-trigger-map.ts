import { CardId, Match, PlayerId, TokenId } from 'shared/types/index.ts';
import { ActionService } from '@server-types/index.ts';

export type TokenCardPlayedContext = {
  match: Match;
  playerId: PlayerId;
  cardId: CardId;
  actionService: ActionService;
};

export type TokenCardPlayedHandler = (context: TokenCardPlayedContext) => Promise<void>;

// Map of token id to card-played handlers for token-triggered bonuses.
export const tokenCardPlayedHandlerMap: Record<TokenId, TokenCardPlayedHandler> = {};

// Register a card-played handler for a token id.
export const registerTokenCardPlayedHandler = (tokenId: TokenId, handler: TokenCardPlayedHandler): void => {
  if (tokenCardPlayedHandlerMap[tokenId]) {
    console.warn(`[token triggers] handler for ${tokenId} already registered, overwriting`);
  }
  tokenCardPlayedHandlerMap[tokenId] = handler;
};
