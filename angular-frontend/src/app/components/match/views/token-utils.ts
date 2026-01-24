import { TokenDefinition, TokenId } from 'shared/shared-types';

// Maps token definitions to compact labels for in-game badges.
export const getTokenShortLabel = (tokenId: TokenId, tokenDefinition?: TokenDefinition): string => {
  const labelMap: Record<string, string> = {
    'adventures:plus-action': 'A',
    'adventures:plus-buy': 'B',
    'adventures:plus-card': 'C',
    'adventures:plus-coin': '$',
  };
  return labelMap[tokenId] ?? tokenDefinition?.name ?? 'T';
};
