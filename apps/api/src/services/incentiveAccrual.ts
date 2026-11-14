// P478: Trade incentive accrual validation
export const validateIncentiveAccrual = (x:{partnerId:string;schemeId:string;points:number;eventId:string}) => ({valid:!!x.partnerId.trim()&&!!x.schemeId.trim()&&!!x.eventId.trim()&&Number.isSafeInteger(x.points)&&x.points>0,points:x.points});
