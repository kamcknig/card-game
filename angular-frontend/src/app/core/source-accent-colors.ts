import type { Card, SetAsideSourceKind } from 'shared/types';
import type { MatchCardLikeKind } from 'shared/find-card-like-in-match';

type SourceAccentToken =
  | 'default'
  | 'treasure'
  | 'victory'
  | 'curse'
  | 'duration'
  | 'event'
  | 'landmark'
  | 'project'
  | 'way'
  | 'boon'
  | 'hex'
  | 'state'
  | 'artifact';

const sourceAccentThemeVars: Record<SourceAccentToken, string> = {
  default: '--theme-color-source-default',
  treasure: '--theme-color-source-treasure',
  victory: '--theme-color-source-victory',
  curse: '--theme-color-source-curse',
  duration: '--theme-color-source-duration',
  event: '--theme-color-source-event',
  landmark: '--theme-color-source-landmark',
  project: '--theme-color-source-project',
  way: '--theme-color-way',
  boon: '--theme-color-source-boon',
  hex: '--theme-color-source-hex',
  state: '--theme-color-source-state',
  artifact: '--theme-color-source-artifact',
};

const sourceAccentFallbacks: Record<SourceAccentToken, string> = {
  default: '#ffffff',
  treasure: '#fdda56',
  victory: '#8efb49',
  curse: '#d45ffb',
  duration: '#ff8d34',
  event: '#ffe0a8',
  landmark: '#ffd09d',
  project: '#b6f1ad',
  way: '#9fc6ff',
  boon: '#a4f0ff',
  hex: '#f2a9ff',
  state: '#c4d4ff',
  artifact: '#ffdca8',
};

// Reads a theme color token with a stable fallback for early boot and tests.
const readThemeColor = (token: SourceAccentToken): string => {
  const fallback = sourceAccentFallbacks[token];
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(sourceAccentThemeVars[token]).trim();
  return value || fallback;
};

// Returns a tokenized source accent color for standard Dominion card types.
export const getSourceAccentColorForCard = (card: Pick<Card, 'cardKey' | 'type'> | undefined): string => {
  if (!card) {
    return readThemeColor('default');
  }
  if (card.cardKey === 'curse') {
    return readThemeColor('curse');
  }
  if (card.type.includes('TREASURE')) {
    return readThemeColor('treasure');
  }
  if (card.type.includes('VICTORY')) {
    return readThemeColor('victory');
  }
  if (card.type.includes('DURATION')) {
    return readThemeColor('duration');
  }
  return readThemeColor('default');
};

// Returns a tokenized source accent color for card-like categories.
export const getSourceAccentColorForCardLikeKind = (kind: MatchCardLikeKind | undefined): string => {
  switch (kind) {
    case 'event':
      return readThemeColor('event');
    case 'landmark':
      return readThemeColor('landmark');
    case 'project':
      return readThemeColor('project');
    case 'way':
      return readThemeColor('way');
    case 'boon':
      return readThemeColor('boon');
    case 'hex':
      return readThemeColor('hex');
    case 'state':
      return readThemeColor('state');
    case 'artifact':
      return readThemeColor('artifact');
    default:
      return readThemeColor('default');
  }
};

// Returns a tokenized source accent color for set-aside source-kind fallback rendering.
export const getSourceAccentColorForSetAsideSourceKind = (kind: SetAsideSourceKind | undefined): string => {
  switch (kind) {
    case 'card':
      return readThemeColor('default');
    case 'event':
      return readThemeColor('event');
    case 'landmark':
      return readThemeColor('landmark');
    case 'project':
      return readThemeColor('project');
    case 'way':
      return readThemeColor('way');
    case 'boon':
      return readThemeColor('boon');
    case 'hex':
      return readThemeColor('hex');
    case 'state':
      return readThemeColor('state');
    case 'artifact':
      return readThemeColor('artifact');
    default:
      return readThemeColor('default');
  }
};
