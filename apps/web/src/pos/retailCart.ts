export type CartLine = { productId: string; label: string; quantity: number; unitPriceMinor: number };
export type CartAction = { type:'add'; line:CartLine } | { type:'quantity'; productId:string; quantity:number } | { type:'remove'; productId:string } | { type:'clear' };
export function retailCartReducer(lines:CartLine[], action:CartAction):CartLine[] {
 if(action.type==='clear') return [];
 if(action.type==='remove') return lines.filter(x=>x.productId!==action.productId);
 if(action.type==='quantity') { if(!Number.isSafeInteger(action.quantity)||action.quantity<1) throw new Error('Quantity must be a positive integer'); return lines.map(x=>x.productId===action.productId?{...x,quantity:action.quantity}:x); }
 if(!action.line.productId.trim()||!Number.isSafeInteger(action.line.quantity)||action.line.quantity<1||!Number.isSafeInteger(action.line.unitPriceMinor)||action.line.unitPriceMinor<0) throw new Error('Invalid cart line');
 const found=lines.find(x=>x.productId===action.line.productId); return found?lines.map(x=>x.productId===found.productId?{...x,quantity:x.quantity+action.line.quantity}:x):[...lines,action.line];
}
