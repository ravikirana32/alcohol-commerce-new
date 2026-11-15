import { describe, expect, it } from 'vitest';
import { scaleRecipeQuantity } from '../src/services/barRecipe.js';

describe('bar recipe quantity scaling', () => {
  it('scales ingredients by sold portions relative to recipe yield', () => {
    expect(scaleRecipeQuantity(0.045, 3, 2)).toBe(0.03);
  });

  it('retains three-decimal inventory precision', () => {
    expect(scaleRecipeQuantity(0.125, 2, 1)).toBe(0.063);
  });

  it('rejects invalid quantities rather than silently skipping depletion', () => {
    expect(() => scaleRecipeQuantity(1, 0, 1)).toThrow('Recipe quantities must be positive finite numbers');
    expect(() => scaleRecipeQuantity(Number.NaN, 1, 1)).toThrow('Recipe quantities must be positive finite numbers');
  });

  it('rejects a positive input that rounds below the supported inventory precision', () => {
    expect(() => scaleRecipeQuantity(0.0001, 1, 1)).toThrow('Scaled recipe quantity is invalid');
  });
});
