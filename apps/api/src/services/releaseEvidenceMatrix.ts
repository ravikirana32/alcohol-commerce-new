// P495: Release evidence matrix completeness
export const evaluateReleaseEvidence = (required:string[],evidence:Record<string,{passed:boolean;verifiedAt:string}>) => { const missing=required.filter(k=>!evidence[k]||!evidence[k].passed||!Number.isFinite(Date.parse(evidence[k].verifiedAt))); return {complete:missing.length===0,missing}; };
