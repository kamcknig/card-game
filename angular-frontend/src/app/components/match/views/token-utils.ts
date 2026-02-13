import { TokenDefinition, TokenId } from 'shared/types/index.ts';

// Maps token definitions to compact labels for in-game badges.
export const getTokenShortLabel = (tokenId: TokenId, tokenDefinition?: TokenDefinition): string => {
  const labelMap: Record<string, string> = {
    // Journey token badge for player area.
    'adventures:journey': 'J',
    // Ferry token badge for supply piles.
    'adventures:minus-cost-two': '-$2',
    // teacher +1 tokens
    'adventures:plus-action': '+1A', // action
    'adventures:plus-buy': '+1B', // buy
    'adventures:plus-card': '+1C', // card
    'adventures:plus-coin': '+1$', // treasure
    // bridge troll -1 treasure token
    'adventures:minus-coin': '-1$',
    // relic -1 card token
    'adventures:minus-card': '-1C',
    // Inheritance estate token
    'adventures:estate': 'E',
  };
  return labelMap[tokenId] ?? tokenDefinition?.name ?? 'T';
};
