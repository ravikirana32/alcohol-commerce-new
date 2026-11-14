// P475: Accounting period close prerequisites
export const evaluatePeriodClose = (x:{unpostedJournals:number;unreconciledBankLines:number;openShifts:number;unapprovedExpenses:number}) => { const blockers=Object.entries(x).filter(([,v])=>!Number.isInteger(v)||v!==0).map(([k])=>k); return {canClose:blockers.length===0,blockers}; };
