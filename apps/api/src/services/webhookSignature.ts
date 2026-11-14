// P486: Payment webhook signature decision
export const isWebhookSignatureValid = (provided:string,expected:string) => { if(!provided||!expected||provided.length!==expected.length)return false; let diff=0; for(let i=0;i<provided.length;i++)diff|=provided.charCodeAt(i)^expected.charCodeAt(i); return diff===0; };
