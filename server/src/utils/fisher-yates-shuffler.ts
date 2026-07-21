// `random` is required (no Math.random default) so every caller is forced to
// route through the injected RNG — a silent default here previously let a
// caller (Inn) bypass it and use non-deterministic shuffling.
export const fisherYatesShuffle = <T>(array: T[], inPlace = false, random: () => number): T[] => {
  const a = inPlace ? array : array.slice(); // avoid using concat() for perf
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
