// P458: Receipt sequence allocation guard
export const nextReceiptSequence = (current:number,expected:number) => { if(!Number.isSafeInteger(current)||current<0||!Number.isSafeInteger(expected)||expected<1) throw new Error('Invalid receipt sequence'); if(current+1!==expected) throw new Error('Receipt sequence conflict'); return expected; };
