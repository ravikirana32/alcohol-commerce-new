import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dbDir = fileURLToPath(new URL('../src/db/', import.meta.url));

describe('database migration ordering', () => {
  const files = fs.readdirSync(dbDir).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();

  it('creates the phase delivery register before P151 and P176 seed migrations', () => {
    const createIndex = files.indexOf('150_z_phase_delivery_register.sql');
    expect(createIndex).toBeGreaterThanOrEqual(0);
    expect(createIndex).toBeLessThan(files.indexOf('151_p151_complete_implementation_gap_closure.sql'));
    expect(createIndex).toBeLessThan(files.indexOf('176_p176_complete_backend_implementation.sql'));
  });

  it('runs outlet price and idempotency schema after foundational bar tables', () => {
    expect(files.indexOf('203_p203_outlet_product_prices.sql')).toBeGreaterThan(files.indexOf('008_bar_pos.sql'));
    expect(files.indexOf('208_p208_retail_checkout_integrity.sql')).toBeGreaterThan(files.indexOf('203_p203_outlet_product_prices.sql'));
  });

  it('keeps reviewed duplicate-prefix migrations in deterministic dependency order', () => {
    const expectedSequence = [
      '150_p150_enterprise_platform_excellence.sql',
      '150_z_phase_delivery_register.sql',
      '151_p151_complete_implementation_gap_closure.sql',
      '151_p151_p175_phase_delivery_register.sql',
      '176_p176_complete_backend_implementation.sql',
      '176_p176_p200_delivery_register.sql',
      '223_p521_finance_accounting.sql',
      '223_p523_trade_portals.sql'
    ];
    const actualSequence = files.filter((name) => expectedSequence.includes(name));
    expect(actualSequence).toEqual(expectedSequence);
  });
});
