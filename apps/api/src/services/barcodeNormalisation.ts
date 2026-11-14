// P460: Barcode input normalisation
export const normaliseBarcode = (value:string) => { const v=value.replace(/[\s-]/g,''); if(!/^[0-9A-Za-z]{6,32}$/.test(v)) throw new Error('Invalid barcode'); return v.toUpperCase(); };
