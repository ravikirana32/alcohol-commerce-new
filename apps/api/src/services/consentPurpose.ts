// P480: Customer consent purpose gate
export const hasValidPurposeConsent = (consents:{purpose:string;granted:boolean;capturedAt:string;withdrawnAt?:string}[],purpose:string) => consents.some(c=>c.purpose===purpose&&c.granted&&!c.withdrawnAt&&Number.isFinite(Date.parse(c.capturedAt)));
