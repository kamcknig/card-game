import { Match, TokenDefinition, TokenId, TokenInstance } from 'shared/types';

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
    // Generic coin counter token.
    'base-v2:coin': '$',
  };
  return labelMap[tokenId] ?? tokenDefinition?.name ?? 'T';
};

export type PileTokenVisual = {
  tokenBadges: Array<{ id: string; label: string; color: number }>;
  tokenChips: Array<{ id: string; assetKey: string; count: number; textColor?: string }>;
};

// Builds deterministic token visual state for each pile key from supplyPile-located tokens.
export const getSupplyPileTokenVisualMap = (
  match: Match | null,
  tokenDefinitions: Record<TokenId, TokenDefinition>,
): Record<string, PileTokenVisual> => {
  const visualByPile: Record<string, PileTokenVisual> = {};
  if (!match) {
    return visualByPile;
  }

  const playerColorMap = new Map(match.players.map((player) => [player.id, player.color]));
  const supplyPileTokens = (Object.values(match.tokens ?? {}) as TokenInstance[])
    .filter((token) => token.location.type === 'supplyPile')
    .sort((left, right) => left.id.localeCompare(right.id));

  for (const token of supplyPileTokens) {
    if (token.location.type !== 'supplyPile') {
      continue;
    }

    const pileKey = token.location.cardKey;
    visualByPile[pileKey] ??= { tokenBadges: [], tokenChips: [] };
    if (token.tokenId === 'base-v2:debt') {
      const debtChipId = 'base-v2:debt-chip';
      const existingDebtChip = visualByPile[pileKey].tokenChips.find((chip) => chip.id === debtChipId);
      const debtCount = Math.max(1, token.counters ?? 1);
      if (existingDebtChip) {
        existingDebtChip.count += debtCount;
      } else {
        visualByPile[pileKey].tokenChips.push({
          id: debtChipId,
          assetKey: 'debt-token-chip',
          count: debtCount,
          textColor: '#f4ebde',
        });
      }
      continue;
    }

    const tokenDefinition = tokenDefinitions[token.tokenId];
    const label = getTokenShortLabel(token.tokenId, tokenDefinition);
    const color = parseColor(
      token.ownerId !== undefined && token.ownerId !== null
        ? playerColorMap.get(token.ownerId) ?? '#ffffff'
        : '#cccccc',
    );
    visualByPile[pileKey].tokenBadges.push({
      id: token.id,
      label,
      color,
    });
  }

  return visualByPile;
};

// Parses a hex color string into a numeric value used by token visual models.
const parseColor = (color: string): number => {
  if (!color) {
    return 0xffffff;
  }
  return Number.parseInt(color.replace('#', ''), 16);
};
