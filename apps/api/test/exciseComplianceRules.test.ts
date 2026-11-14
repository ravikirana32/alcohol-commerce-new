import { describe, expect, it } from 'vitest';
import { hoursAllow, normaliseLicenceClass } from '../src/services/exciseCompliance.js';

describe('P533 excise rule helpers', () => {
  it('normalises current and legacy Karnataka licence class labels', () => {
    expect(normaliseLicenceClass('CL(2-A)')).toBe('CL2A');
    expect(normaliseLicenceClass('CL-9A')).toBe('CL9A');
    expect(normaliseLicenceClass('CL-9')).toBe('CL9');
  });
  it('requires explicit day hours and respects opening/closing boundaries', () => {
    const hours = { mon: { open: '10:00', close: '22:00' } };
    expect(hoursAllow(hours, 'mon', '10:00')).toBe(true);
    expect(hoursAllow(hours, 'mon', '21:59')).toBe(true);
    expect(hoursAllow(hours, 'mon', '22:00')).toBe(false);
    expect(hoursAllow(hours, 'tue', '12:00')).toBe(false);
    expect(hoursAllow({}, 'mon', '12:00')).toBe(false);
  });
  it('supports overnight licence schedules without extending a closed day', () => {
    const hours = { fri: { open: '18:00', close: '02:00' } };
    expect(hoursAllow(hours, 'fri', '23:00')).toBe(true);
    expect(hoursAllow(hours, 'sat', '01:00')).toBe(true);
    expect(hoursAllow(hours, 'fri', '01:00')).toBe(false);
  });
});
