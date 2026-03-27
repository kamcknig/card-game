// Injectable RNG wrapper so randomness can be centralized and swapped in tests.
export class RngService {
  // Returns the next random float in [0, 1).
  public nextFloat(): number {
    return Math.random();
  }

  // Returns a random integer in [0, length) for non-empty collections.
  public nextIndex(length: number): number {
    if (length <= 0) {
      throw new Error('[rng] nextIndex requires length > 0');
    }
    return Math.floor(this.nextFloat() * length);
  }
}
