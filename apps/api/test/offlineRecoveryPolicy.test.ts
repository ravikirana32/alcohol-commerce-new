import { describe, expect, it } from 'vitest';
import { canCancelRecovery, canDecideCompensation, canRequestCompensation, canRequestRetry, canTriage } from '../src/services/offlineRecoveryPolicy.js';

describe('P532 offline recovery policy', () => {
  it('allows triage only for open or triaged cases', () => {
    expect(canTriage('OPEN')).toBe(true);
    expect(canTriage('TRIAGED')).toBe(true);
    expect(canTriage('CANCELLED')).toBe(false);
  });
  it('requires a triaged blocked execution for retry request', () => {
    expect(canRequestRetry('TRIAGED', 'BLOCKED')).toBe(true);
    expect(canRequestRetry('OPEN', 'BLOCKED')).toBe(false);
    expect(canRequestRetry('TRIAGED', 'POSTED')).toBe(false);
  });
  it('cancels only blocked, held or authorised unposted intents', () => {
    expect(canCancelRecovery('TRIAGED', 'BLOCKED', 'HELD')).toBe(true);
    expect(canCancelRecovery('RETRY_REQUIRED', 'BLOCKED', 'AUTHORIZED_TO_POST')).toBe(true);
    expect(canCancelRecovery('OPEN', 'POSTED', 'HELD')).toBe(false);
    expect(canCancelRecovery('OPEN', 'BLOCKED', 'POSTED')).toBe(false);
  });
  it('requires posted execution for compensation request', () => {
    expect(canRequestCompensation('OPEN', 'POSTED')).toBe(true);
    expect(canRequestCompensation('TRIAGED', 'BLOCKED')).toBe(false);
    expect(canRequestCompensation('CANCELLED', 'POSTED')).toBe(false);
  });
  it('enforces independent compensation decision', () => {
    expect(canDecideCompensation('COMPENSATION_PENDING', 'maker', 'checker')).toBe(true);
    expect(canDecideCompensation('COMPENSATION_PENDING', 'maker', 'maker')).toBe(false);
    expect(canDecideCompensation('OPEN', 'maker', 'checker')).toBe(false);
  });
});
