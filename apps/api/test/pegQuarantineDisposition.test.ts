import { describe, expect, it } from 'vitest';
import { validatePegQuarantineDecision } from '../src/services/pegQuarantineDisposition.js';

describe('peg quarantine disposition validation', () => {
  it('accepts a documented disposal', () => {
    expect(() => validatePegQuarantineDecision({ disposition: 'DISPOSED', reason: 'Discarded under outlet SOP' })).not.toThrow();
  });
  it('requires compliance reference before compliance release', () => {
    expect(() => validatePegQuarantineDecision({ disposition: 'RELEASED_BY_COMPLIANCE', reason: 'Reviewed and approved' })).toThrow(/compliance approval reference/i);
  });
  it('accepts compliance release with a reference', () => {
    expect(() => validatePegQuarantineDecision({ disposition: 'RELEASED_BY_COMPLIANCE', reason: 'Reviewed and approved', complianceReference: 'EXCISE-APPROVAL-2026-01' })).not.toThrow();
  });
  it('rejects short reasons', () => {
    expect(() => validatePegQuarantineDecision({ disposition: 'DISPOSED', reason: 'bad' })).toThrow(/reason/i);
  });
});
