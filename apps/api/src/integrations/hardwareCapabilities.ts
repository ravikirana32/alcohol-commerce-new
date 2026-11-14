export type HardwareCapability='BARCODE_SCANNER'|'THERMAL_PRINTER'|'CASH_DRAWER'|'CUSTOMER_DISPLAY';
export function requireHardwareCapability(available:HardwareCapability[],required:HardwareCapability[]){const missing=required.filter(x=>!available.includes(x));if(missing.length)throw new Error(`Missing hardware capabilities: ${missing.join(',')}`);return true;}
