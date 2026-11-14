// P494: Licence evidence expiry policy
export const isLicenceEvidenceCurrent = (validUntil:string,asOf:string,verified:boolean) => verified&&Number.isFinite(Date.parse(validUntil))&&Number.isFinite(Date.parse(asOf))&&Date.parse(validUntil+'T23:59:59Z')>=Date.parse(asOf);
