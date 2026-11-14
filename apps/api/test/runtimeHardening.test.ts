import { describe, expect, it } from 'vitest';
import { normaliseCorrelationId } from '../src/services/correlationId.js';
import { canAcceptRequests } from '../src/services/shutdownState.js';

describe('runtime hardening policies', () => {
  it('generates a request id when the client does not provide one', () => {
    expect(normaliseCorrelationId(undefined)).toMatch(/^req-[0-9a-f-]{36}$/);
  });

  it('accepts bounded safe request ids', () => {
    expect(normaliseCorrelationId('client-req-123')).toBe('client-req-123');
  });

  it('rejects malformed request ids', () => {
    expect(() => normaliseCorrelationId('bad id')).toThrow('Invalid correlation id');
  });

  it('only accepts traffic while runtime is ready', () => {
    expect(canAcceptRequests('READY')).toBe(true);
    expect(canAcceptRequests('DRAINING')).toBe(false);
    expect(canAcceptRequests('STOPPED')).toBe(false);
  });
});
