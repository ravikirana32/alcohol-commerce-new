export type PegQuarantineDisposition = 'DISPOSED' | 'RELEASED_BY_COMPLIANCE';
export type PegQuarantineDecision = { disposition: PegQuarantineDisposition; reason: string; complianceReference?: string };

export function validatePegQuarantineDecision(input: PegQuarantineDecision): void {
  if (!input.reason || input.reason.trim().length < 5 || input.reason.length > 1000) throw new Error('A reason between 5 and 1000 characters is required');
  if (input.disposition === 'RELEASED_BY_COMPLIANCE' && (!input.complianceReference || input.complianceReference.trim().length < 3)) {
    throw new Error('A compliance approval reference is required');
  }
  if (input.complianceReference && input.complianceReference.length > 160) throw new Error('Compliance reference is too long');
}
