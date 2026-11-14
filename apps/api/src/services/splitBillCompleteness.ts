// P462: Split bill allocation completeness
export const validateSplitBill = (billMinor:number,parts:number[]) => { const validParts=parts.every(n=>Number.isSafeInteger(n)&&n>0); const sum=parts.reduce((a,b)=>a+b,0); return {valid:validParts&&parts.length>0&&sum===billMinor,allocatedMinor:sum,remainingMinor:billMinor-sum}; };
