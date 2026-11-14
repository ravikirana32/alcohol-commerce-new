import { createHash } from 'node:crypto';
export type TaxComponent = { component_code:string; calculation_basis:'PERCENT_EXCLUSIVE'|'PERCENT_INCLUSIVE'|'PER_LITRE_PURE_ALCOHOL'|'PER_BULK_LITRE'|'FIXED_PER_UNIT'|'PRICE_SLAB'; rate:number|string; slab_min?:number|string|null; slab_max?:number|string|null };
export type TaxChannelMeasure = { channel:'RETAIL'|'BAR'; measureType:'UNIT'|'PEG'|'BOTTLE'|'PACKAGED' };
export function validateTaxChannelMeasure(value:TaxChannelMeasure){
 if(value.channel==='RETAIL'&&value.measureType!=='UNIT') throw new Error('INVALID_PRICE_MEASURE');
 if(value.channel==='BAR'&&value.measureType==='UNIT') throw new Error('INVALID_PRICE_MEASURE');
 return value.measureType;
}
export type TaxInput = { unitPrice:number; quantity:number; mrp?:number|null; menuCeiling?:number|null; abv:number; packSizeMl:number; productClass:string; gstExemptForAlcohol:boolean; channel:'RETAIL'|'BAR'; components:TaxComponent[] };
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function sha256(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export function calculateTax(input:TaxInput){
 const {unitPrice,quantity,abv,packSizeMl,components}=input;
 if(!Number.isFinite(unitPrice)||unitPrice<=0||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(abv)||abv<0||abv>100||!Number.isFinite(packSizeMl)||packSizeMl<=0) throw new Error('INVALID_TAX_INPUT');
 if(input.channel==='RETAIL'&&input.mrp!=null&&unitPrice>input.mrp)throw new Error('MRP_EXCEEDED');
 if(input.channel==='BAR'&&input.productClass!=='NON_ALCOHOLIC'&&input.menuCeiling==null)throw new Error('BAR_MENU_CEILING_REQUIRED');
 if(input.channel==='BAR'&&input.menuCeiling!=null&&unitPrice>input.menuCeiling)throw new Error('MENU_CEILING_EXCEEDED');
 const alcohol=['SPIRIT','WINE','BEER'].includes(input.productClass);
 if(alcohol&&input.gstExemptForAlcohol&&components.some(c=>['CGST','SGST','IGST'].includes(c.component_code)))throw new Error('ALCOHOL_GST_DOUBLE_CHARGE');
 const gst=components.filter(c=>['CGST','SGST','IGST'].includes(c.component_code));
 if(gst.some(c=>c.component_code==='IGST')&&gst.some(c=>['CGST','SGST'].includes(c.component_code)))throw new Error('GST_COMPONENT_CONFLICT');
 if(gst.some(c=>['CGST','SGST'].includes(c.component_code))&&!(gst.some(c=>c.component_code==='CGST')&&gst.some(c=>c.component_code==='SGST')))throw new Error('GST_PAIR_INCOMPLETE');
 const base=round(unitPrice*quantity); let inclusive=0,exclusive=0; const breakdown:any[]=[];
 const inclusiveRateTotal=components.filter(c=>c.calculation_basis==='PERCENT_INCLUSIVE').reduce((sum,c)=>sum+Number(c.rate),0);
 for(const c of components){const rate=Number(c.rate);if(!Number.isFinite(rate)||rate<0)throw new Error('INVALID_COMPONENT_RATE');let amount=0;
  switch(c.calculation_basis){case 'PERCENT_EXCLUSIVE': amount=base*rate/100;exclusive+=amount;break;case 'PERCENT_INCLUSIVE': amount=base*rate/(100+inclusiveRateTotal);inclusive+=amount;break;case 'PER_LITRE_PURE_ALCOHOL': amount=(packSizeMl*quantity/1000)*(abv/100)*rate;exclusive+=amount;break;case 'PER_BULK_LITRE':amount=(packSizeMl*quantity/1000)*rate;exclusive+=amount;break;case 'FIXED_PER_UNIT':amount=quantity*rate;exclusive+=amount;break;case 'PRICE_SLAB':{const min=Number(c.slab_min??0),max=c.slab_max==null?Infinity:Number(c.slab_max);if(unitPrice>=min&&unitPrice<max){amount=quantity*rate;exclusive+=amount;}break;}}
  breakdown.push({component:c.component_code,basis:c.calculation_basis,rate,amount:round(amount)});
 }
 return {currency:'INR',baseAmount:base,inclusiveTax:round(inclusive),exclusiveTax:round(exclusive),taxTotal:round(inclusive+exclusive),grandTotal:round(base+exclusive),breakdown};
}
