export type PixiSceneTheme = {
  text: {
    onOverlay: string;
  };
  overlay: {
    color: number;
    softAlpha: number;
    mediumAlpha: number;
    strongAlpha: number;
  };
  surfaces: {
    countBadge: number;
  };
};

export type PixiAppTheme = {
  surface: {
    canvasBackground: number;
  };
};

const readCssVar = (name: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw || fallback;
};

const parseHexToNumber = (color: string, fallback: number): number => {
  const normalized = color.trim();
  const shortMatch = normalized.match(/^#([0-9a-fA-F]{3})$/);
  if (shortMatch) {
    const expanded = shortMatch[1].split('').map((char) => `${char}${char}`).join('');
    return Number.parseInt(expanded, 16);
  }
  const longMatch = normalized.match(/^#([0-9a-fA-F]{6})$/);
  if (longMatch) {
    return Number.parseInt(longMatch[1], 16);
  }
  return fallback;
};

const readCssAlpha = (name: string, fallback: number): number => {
  const value = Number.parseFloat(readCssVar(name, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
};

// Resolves Pixi-specific semantic theme values from shared app CSS tokens.
export const getPixiSceneTheme = (): PixiSceneTheme => ({
  text: {
    onOverlay: readCssVar('--theme-text-on-dark', '#ffffff'),
  },
  overlay: {
    color: parseHexToNumber(readCssVar('--theme-overlay-color', '#000000'), 0x000000),
    softAlpha: readCssAlpha('--theme-overlay-alpha-soft', 0.5),
    mediumAlpha: readCssAlpha('--theme-overlay-alpha-medium', 0.6),
    strongAlpha: readCssAlpha('--theme-overlay-alpha-strong', 0.8),
  },
  surfaces: {
    countBadge: parseHexToNumber(readCssVar('--theme-surface-count-badge', '#aaaaaa'), 0xaaaaaa),
  },
});

// Resolves Pixi application-level theme values from shared app CSS tokens.
export const getPixiAppTheme = (): PixiAppTheme => ({
  surface: {
    canvasBackground: parseHexToNumber(readCssVar('--theme-surface-app-end', '#ece2cf'), 0xece2cf),
  },
});
