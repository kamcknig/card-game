import { TokenDefinition, TokenId } from 'shared/shared-types';

// Maps token definitions to compact labels for in-game badges.
export const getTokenShortLabel = (tokenId: TokenId, tokenDefinition?: TokenDefinition): string => {
  const labelMap: Record<string, string> = {
    'adventures:plus-action': '+1A',
    'adventures:plus-buy': '+1B',
    'adventures:plus-card': '+1C',
    'adventures:plus-coin': '+1$',
    'adventures:minus-coin': '-1$',
  };
  return labelMap[tokenId] ?? tokenDefinition?.name ?? 'T';
};
