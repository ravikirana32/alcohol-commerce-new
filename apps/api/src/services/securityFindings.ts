export type FindingSeverity='CRITICAL'|'HIGH'|'MEDIUM'|'LOW';
export function securityReleaseGate(findings:{severity:FindingSeverity;status:'OPEN'|'REMEDIATED'|'ACCEPTED'}[]){const blockers=findings.filter(f=>f.status==='OPEN'&&(f.severity==='CRITICAL'||f.severity==='HIGH'));return {approved:blockers.length===0,blockerCount:blockers.length};}
