import { map } from 'nanostores';
import { TokenDefinition, TokenId } from 'shared/types';

// Token definitions available to the client for UI labeling and icons.
export const tokenDefinitionStore = map<Record<TokenId, TokenDefinition>>({});
