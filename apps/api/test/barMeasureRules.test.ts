import { describe, expect, it } from 'vitest';
import { barLineTaxMinor, pegConsumedMl, unreservedBottleMl } from '../src/services/barMeasureRules.js';

describe('P531 bar measure and bottle rules', () => {
  it.each([30, 60, 90, 120, 150])('converts %i ml measures into exact bottle depletion', (measure) => {
    expect(pegConsumedMl(measure, 2)).toBe(measure * 2);
  });

  it('aggregates consumption for repeated measures and prevents fractional quantity', () => {
    expect(pegConsumedMl(30, 3) + pegConsumedMl(60, 2)).toBe(240);
    expect(() => pegConsumedMl(30, 1.5)).toThrow();
  });

  it('subtracts active reservations from available bottle volume', () => {
    expect(unreservedBottleMl(750, 180)).toBe(570);
    expect(unreservedBottleMl(100, 140)).toBe(0);
  });

  it('calculates tax in integer paise without floating currency arithmetic', () => {
    expect(barLineTaxMinor(10000, 2, 10)).toBe(2000);
    expect(barLineTaxMinor(999, 1, 5)).toBe(50);
  });
});
