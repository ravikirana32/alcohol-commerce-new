// P479: Campaign budget guard
export const canCommitCampaignSpend = (budgetMinor:number,spentMinor:number,proposedMinor:number) => { const valid=[budgetMinor,spentMinor,proposedMinor].every(Number.isSafeInteger)&&budgetMinor>=0&&spentMinor>=0&&proposedMinor>0; return {allowed:valid&&spentMinor+proposedMinor<=budgetMinor,remainingMinor:budgetMinor-spentMinor}; };
