export class Rng {
  private state: number;

  constructor(seed = 1337) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0xffffffff;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  signed(scale = 1): number {
    return this.range(-scale, scale);
  }

  pick<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}
