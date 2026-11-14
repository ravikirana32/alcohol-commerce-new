// P488: Provider circuit breaker policy
export const providerCircuitState = (x:{failures:number;openedAt?:number;now:number;resetAfterMs:number;failureThreshold:number}) => { if(x.failures>=x.failureThreshold){if(x.openedAt===undefined||x.now-x.openedAt<x.resetAfterMs)return 'OPEN';return 'HALF_OPEN';} return 'CLOSED'; };
