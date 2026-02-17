import type { ActionService } from '@server-types/index.ts';
import { CardId, Match, PlayerId, TokenDefinition, TokenId } from 'shared/types/index.ts';
import { LoggerService } from '../logger-service.ts';

export type TokenCardPlayedContext = {
  match: Match;
  playerId: PlayerId;
  cardId: CardId;
  actionService: ActionService;
};

export type TokenCardPlayedHandler = (context: TokenCardPlayedContext) => Promise<void>;

// Stores token definitions and token-triggered handlers.
export class TokenRegistryService {
  private readonly _tokenDefinitions: Record<TokenId, TokenDefinition> = {} as Record<TokenId, TokenDefinition>;
  private readonly _tokenCardPlayedHandlers: Record<TokenId, TokenCardPlayedHandler> = {} as Record<
    TokenId,
    TokenCardPlayedHandler
  >;

  constructor(
    private readonly loggerService: LoggerService,
  ) {}

  // Registers a token definition by token id.
  public registerTokenDefinition(definition: TokenDefinition): void {
    if (this._tokenDefinitions[definition.id]) {
      this.loggerService.warn(`[token registry] token definition for ${definition.id} already registered, overwriting`);
    }
    this._tokenDefinitions[definition.id] = definition;
  }

  // Returns all registered token definitions.
  public getTokenDefinitions(): Record<TokenId, TokenDefinition> {
    return this._tokenDefinitions;
  }

  // Returns a token definition by token id, if present.
  public getTokenDefinition(tokenId: TokenId): TokenDefinition | undefined {
    return this._tokenDefinitions[tokenId];
  }

  // Registers a card-played handler for a token id.
  public registerTokenCardPlayedHandler(tokenId: TokenId, handler: TokenCardPlayedHandler): void {
    if (this._tokenCardPlayedHandlers[tokenId]) {
      this.loggerService.warn(`[token registry] token card-played handler for ${tokenId} already registered, overwriting`);
    }
    this._tokenCardPlayedHandlers[tokenId] = handler;
  }

  // Returns a token card-played handler by token id, if present.
  public getTokenCardPlayedHandler(tokenId: TokenId): TokenCardPlayedHandler | undefined {
    return this._tokenCardPlayedHandlers[tokenId];
  }
}
