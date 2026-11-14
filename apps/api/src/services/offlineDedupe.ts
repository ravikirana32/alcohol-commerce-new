// P482: Offline event deduplication key
export const buildOfflineDedupeKey = (deviceId:string,localId:string,sequence:number) => { if(!deviceId.trim()||!localId.trim()||!Number.isSafeInteger(sequence)||sequence<1)throw new Error('Invalid offline event identity'); return `${deviceId}:${localId}:${sequence}`; };
