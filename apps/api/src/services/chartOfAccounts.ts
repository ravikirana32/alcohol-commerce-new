export type AccountType='ASSET'|'LIABILITY'|'EQUITY'|'INCOME'|'EXPENSE';
export function validateAccount(a:{code:string;name:string;type:AccountType;parentCode?:string}){if(!/^[A-Z0-9-]{2,20}$/.test(a.code)||a.name.trim().length<2)throw new Error('Invalid account code or name');if(a.parentCode===a.code)throw new Error('Account cannot parent itself');return a;}
