// P487: Webhook replay window guard
export const isWebhookWithinReplayWindow = (timestampMs:number,nowMs:number,toleranceMs=300000) => Number.isFinite(timestampMs)&&Number.isFinite(nowMs)&&Number.isFinite(toleranceMs)&&toleranceMs>=0&&Math.abs(nowMs-timestampMs)<=toleranceMs;
