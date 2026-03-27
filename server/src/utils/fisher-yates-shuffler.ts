export const fisherYatesShuffle = <T>(array: T[], inPlace = false, random: () => number = Math.random): T[] => {
  const a = inPlace ? array : array.slice(); // avoid using concat() for perf
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
