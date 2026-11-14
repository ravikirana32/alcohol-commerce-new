// P484: Device enrollment challenge validation
export const validateDeviceEnrollment = (x:{deviceId:string;challenge:string;proofValid:boolean;tenantId:string}) => ({accepted:!!x.deviceId.trim()&&!!x.tenantId.trim()&&/^[A-Za-z0-9_-]{24,128}$/.test(x.challenge)&&x.proofValid,reason:!x.proofValid?'PROOF_INVALID':'INVALID_ENROLLMENT'});
