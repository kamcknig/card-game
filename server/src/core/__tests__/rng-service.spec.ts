import { assertEquals, assertThrows } from '@std/assert';
import { RngService } from '../rng-service.ts';

class FixedRngService extends RngService {
  constructor(private readonly fixedValue: number) {
    super();
  }

  // Returns a fixed float to make nextIndex deterministic for tests.
  public override nextFloat(): number {
    return this.fixedValue;
  }
}

Deno.test('RngService.nextIndex returns zero for zero-ish random values', () => {
  const rngService = new FixedRngService(0);

  assertEquals(rngService.nextIndex(5), 0);
});

Deno.test('RngService.nextIndex returns the upper bound minus one for high random values', () => {
  const rngService = new FixedRngService(0.999999);

  assertEquals(rngService.nextIndex(5), 4);
});

Deno.test('RngService.nextIndex throws when length is zero or less', () => {
  const rngService = new RngService();

  assertThrows(() => rngService.nextIndex(0), Error, 'length > 0');
  assertThrows(() => rngService.nextIndex(-1), Error, 'length > 0');
});

Deno.test('RngService.nextIndex returns zero when length is one', () => {
  const rngService = new FixedRngService(0.5);

  assertEquals(rngService.nextIndex(1), 0);
});

Deno.test('RngService.nextFloat returns a value in [0, 1)', () => {
  const rngService = new RngService();
  const value = rngService.nextFloat();

  assertEquals(value >= 0, true);
  assertEquals(value < 1, true);
});

Deno.test('RngService.nextIndex maps mid-range random to middle index', () => {
  const rngService = new FixedRngService(0.5);

  assertEquals(rngService.nextIndex(10), 5);
});
