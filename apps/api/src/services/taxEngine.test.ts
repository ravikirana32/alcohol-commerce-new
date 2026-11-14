import { describe,it,expect } from 'vitest';
import { calculateTax, validateTaxChannelMeasure } from './taxEngine.js';
const base={unitPrice:118,quantity:1,mrp:150,abv:0,packSizeMl:500,productClass:'FOOD',gstExemptForAlcohol:false,channel:'RETAIL' as const};
describe('P534 tax calculation engine',()=>{
 it('extracts inclusive GST from tax-inclusive price',()=>{const r=calculateTax({...base,components:[{component_code:'CGST',calculation_basis:'PERCENT_INCLUSIVE',rate:9},{component_code:'SGST',calculation_basis:'PERCENT_INCLUSIVE',rate:9}]});expect(r.inclusiveTax).toBe(18);expect(r.grandTotal).toBe(118);});
 it('adds exclusive percentage tax to base',()=>{const r=calculateTax({...base,components:[{component_code:'STATE_EXCISE',calculation_basis:'PERCENT_EXCLUSIVE',rate:10}]});expect(r.exclusiveTax).toBe(11.8);expect(r.grandTotal).toBe(129.8);});
 it('rejects MRP overrun',()=>{expect(()=>calculateTax({...base,unitPrice:151,components:[]})).toThrow('MRP_EXCEEDED');});
 it('requires bar menu ceiling for alcohol',()=>{expect(()=>calculateTax({...base,productClass:'SPIRIT',abv:40,channel:'BAR',mrp:null,components:[]})).toThrow('BAR_MENU_CEILING_REQUIRED');});
 it('rejects GST applied to GST-exempt alcohol',()=>{expect(()=>calculateTax({...base,productClass:'SPIRIT',abv:40,gstExemptForAlcohol:true,components:[{component_code:'CGST',calculation_basis:'PERCENT_EXCLUSIVE',rate:9},{component_code:'SGST',calculation_basis:'PERCENT_EXCLUSIVE',rate:9}]})).toThrow('ALCOHOL_GST_DOUBLE_CHARGE');});
 it('rejects incomplete local GST pair',()=>{expect(()=>calculateTax({...base,components:[{component_code:'CGST',calculation_basis:'PERCENT_EXCLUSIVE',rate:9}]})).toThrow('GST_PAIR_INCOMPLETE');});
 it('calculates pure alcohol duty basis',()=>{const r=calculateTax({...base,productClass:'SPIRIT',abv:40,components:[{component_code:'STATE_EXCISE',calculation_basis:'PER_LITRE_PURE_ALCOHOL',rate:100}]});expect(r.exclusiveTax).toBe(20);});
});

describe('P534 measure-specific price books',()=>{
 it('allows retail UNIT prices only',()=>{expect(validateTaxChannelMeasure({channel:'RETAIL',measureType:'UNIT'})).toBe('UNIT');expect(()=>validateTaxChannelMeasure({channel:'RETAIL',measureType:'PEG'})).toThrow('INVALID_PRICE_MEASURE');});
 it('allows independent BAR PEG, BOTTLE and PACKAGED prices',()=>{for(const measureType of ['PEG','BOTTLE','PACKAGED'] as const)expect(validateTaxChannelMeasure({channel:'BAR',measureType})).toBe(measureType);});
 it('rejects BAR UNIT pricing',()=>{expect(()=>validateTaxChannelMeasure({channel:'BAR',measureType:'UNIT'})).toThrow('INVALID_PRICE_MEASURE');});
});
