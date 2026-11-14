export type RetailLine={productId:string;quantity:number;unitPriceMinor:number;discountMinor?:number};
export function validateRetailCart(lines:RetailLine[],maxLines=100):number {
 if(!Array.isArray(lines)||lines.length===0||lines.length>maxLines) throw new Error('Cart must contain 1..maxLines lines');
 const ids=new Set<string>(); let total=0;
 for(const l of lines){ if(!l.productId.trim()||ids.has(l.productId)) throw new Error('Duplicate or missing product'); ids.add(l.productId);
  if(!Number.isSafeInteger(l.quantity)||l.quantity<1||!Number.isSafeInteger(l.unitPriceMinor)||l.unitPriceMinor<0) throw new Error('Invalid quantity or price');
  const gross=l.quantity*l.unitPriceMinor, discount=l.discountMinor??0;
  if(!Number.isSafeInteger(gross)||!Number.isSafeInteger(discount)||discount<0||discount>gross) throw new Error('Invalid line discount'); total+=gross-discount;
 }
 if(!Number.isSafeInteger(total)) throw new Error('Cart total overflow'); return total;
}
