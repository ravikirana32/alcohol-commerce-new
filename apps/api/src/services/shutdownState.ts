// P455: Graceful shutdown state policy
export const canAcceptRequests = (state:'STARTING'|'READY'|'DRAINING'|'STOPPED') => state==='READY';
