// P492: Secret rotation overlap policy
export const isSecretAcceptedDuringRotation = (keyId:string,currentKeyId:string,previousKeyId:string|undefined,previousValidUntil:number|undefined,now:number) => keyId===currentKeyId || (!!previousKeyId&&keyId===previousKeyId&&previousValidUntil!==undefined&&now<=previousValidUntil);
