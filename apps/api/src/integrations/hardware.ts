export interface BarcodeScannerAdapter { connect():Promise<void>; disconnect():Promise<void>; onBarcode(handler:(value:string)=>void):()=>void }
export interface ReceiptPrinterAdapter { print(documentHtml:string):Promise<{jobId:string}>; status():Promise<'READY'|'OFFLINE'|'ERROR'> }
export interface PaymentTerminalAdapter { initiate(amountMinor:number,currency:'INR',reference:string):Promise<{providerReference:string;status:'PENDING'|'APPROVED'|'DECLINED'}> }
