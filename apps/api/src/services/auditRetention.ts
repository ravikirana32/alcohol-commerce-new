// P493: Audit retention eligibility
export const isAuditEventPurgeEligible = (occurredAt:string,now:string,retentionDays:number,legalHold:boolean) => { const age=(Date.parse(now)-Date.parse(occurredAt))/86400000; return !legalHold&&Number.isFinite(age)&&age>=retentionDays&&retentionDays>=0; };
