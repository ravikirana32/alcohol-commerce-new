// P466: Purchase order line validation
export const validatePurchaseOrderLine = (x:{sku:string;ordered:number;unitCostMinor:number}) => ({valid:x.sku.trim().length>0&&Number.isSafeInteger(x.ordered)&&x.ordered>0&&Number.isSafeInteger(x.unitCostMinor)&&x.unitCostMinor>=0,extendedMinor:x.ordered*x.unitCostMinor});
