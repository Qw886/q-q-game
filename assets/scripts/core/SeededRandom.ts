export class SeededRandom {
  private state: number;

  public constructor(seed: number) {
    this.state = seed >>> 0;

    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  public next(): number {
    // Mulberry32: small deterministic PRNG, enough for board generation without dependencies.
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  public nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) {
      throw new Error('maxExclusive must be positive.');
    }

    return Math.floor(this.next() * maxExclusive);
  }

  public shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];

    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = this.nextInt(index + 1);
      const current = result[index];
      result[index] = result[swapIndex];
      result[swapIndex] = current;
    }

    return result;
  }
}
