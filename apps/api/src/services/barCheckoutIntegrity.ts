import { createHash } from 'node:crypto';

export type BarCheckoutFingerprintInput = {
  outletId:string;
  ticketNumber:string;
  tableLabel?:string;
  tableSessionId?:string;
  lines:Array<{productId:string;lineType:'PEG'|'BOTTLE'|'PACKAGED';quantity:number;volumeMl?:number;openBottleId?:string;modifierOptionIds?:string[]}>;
  payments:Array<{method:string;amount:number;reference?:string}>;
};
export function createBarCheckoutFingerprint(input:BarCheckoutFingerprintInput):string{
 const canonical={
  outletId:input.outletId.toLowerCase(),
  ticketNumber:input.ticketNumber.trim(),
  tableLabel:input.tableLabel?.trim()??'',
  tableSessionId:input.tableSessionId?.toLowerCase()??null,
  lines:input.lines.map(line=>({
   productId:line.productId.toLowerCase(),lineType:line.lineType,quantityMilli:Math.round(line.quantity*1000),
   volumeMl:line.volumeMl??null,openBottleId:line.openBottleId?.toLowerCase()??null,
   modifierOptionIds:[...(line.modifierOptionIds??[])].map(id=>id.toLowerCase()).sort()
  })).sort((a,b)=>a.productId.localeCompare(b.productId)||a.lineType.localeCompare(b.lineType)||(a.volumeMl??0)-(b.volumeMl??0)||(a.openBottleId??'').localeCompare(b.openBottleId??'')||a.quantityMilli-b.quantityMilli||a.modifierOptionIds.join(',').localeCompare(b.modifierOptionIds.join(','))),
  payments:input.payments.map(p=>({method:p.method,amountMinor:Math.round(p.amount*100),reference:p.reference?.trim()??''}))
   .sort((a,b)=>a.method.localeCompare(b.method)||a.amountMinor-b.amountMinor||a.reference.localeCompare(b.reference))
 };
 return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
