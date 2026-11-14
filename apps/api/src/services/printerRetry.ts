// P489: Printer job retry scheduling
export const nextPrinterRetryMs = (attempt:number,baseMs=1000,maxMs=60000) => { if(!Number.isInteger(attempt)||attempt<0||baseMs<1||maxMs<baseMs)throw new Error('Invalid retry parameters'); return Math.min(maxMs,baseMs*2**Math.min(attempt,20)); };
