// Formats a card name from its key using the standard dash/underscore to title case rules.
export const formatCardName = (cardKey: string): string => {
  const words = cardKey
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => `${word[0].toUpperCase()}${word.slice(1)}`);
  return words.join(' ');
};
