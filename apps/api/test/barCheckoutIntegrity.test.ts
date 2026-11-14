import { describe, expect, it } from 'vitest';
import { createBarCheckoutFingerprint } from '../src/services/barCheckoutIntegrity.js';

const checkout={
 outletId:'11111111-1111-4111-8111-111111111111',
 ticketNumber:'B-100',
 tableLabel:'T4',
 lines:[
  {productId:'22222222-2222-4222-8222-222222222222',lineType:'PEG' as const,quantity:2,volumeMl:30,openBottleId:'33333333-3333-4333-8333-333333333333'},
  {productId:'44444444-4444-4444-8444-444444444444',lineType:'BOTTLE' as const,quantity:1}
 ],
 payments:[{method:'CASH',amount:100},{method:'UPI',amount:50,reference:'upi-1'}]
};
describe('bar checkout fingerprint',()=>{
 it('is stable across line and tender ordering',()=>{
  const withRepeatedPeg={...checkout,lines:[...checkout.lines,{...checkout.lines[0],quantity:1}]};
  expect(createBarCheckoutFingerprint(withRepeatedPeg)).toBe(createBarCheckoutFingerprint({
   ...withRepeatedPeg,lines:[...withRepeatedPeg.lines].reverse(),payments:[...withRepeatedPeg.payments].reverse()
  }));
 });
 it('changes when ticket number or peg bottle changes',()=>{
  expect(createBarCheckoutFingerprint(checkout)).not.toBe(createBarCheckoutFingerprint({...checkout,ticketNumber:'B-101'}));
  expect(createBarCheckoutFingerprint(checkout)).not.toBe(createBarCheckoutFingerprint({
   ...checkout,lines:checkout.lines.map((line)=>line.lineType==='PEG'?{...line,openBottleId:'55555555-5555-4555-8555-555555555555'}:line)
  }));
 });
 it('normalises UUID case and table whitespace',()=>{
  expect(createBarCheckoutFingerprint(checkout)).toBe(createBarCheckoutFingerprint({
   ...checkout,outletId:checkout.outletId.toUpperCase(),tableLabel:' T4 '
  }));
 });
});
