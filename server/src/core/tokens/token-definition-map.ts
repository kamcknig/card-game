import { TokenDefinition, TokenId } from "shared/shared-types";

// Central registry for token definitions; expansions can extend this map.
export const tokenDefinitionMap: Record<TokenId, TokenDefinition> = {};

// Registers a token definition, overwriting any existing entry with the same id.
export const registerTokenDefinition = (definition: TokenDefinition): void => {
  if (tokenDefinitionMap[definition.id]) {
    console.warn(
      `[token definitions] token ${definition.id} already registered, overwriting`,
    );
  }
  tokenDefinitionMap[definition.id] = definition;
};
