import type { PoolClient } from 'pg';
import { calculateTax, sha256 } from './taxEngine.js';

export type CheckoutTaxChannel = 'RETAIL' | 'BAR';
export type CheckoutTaxMeasure = 'UNIT' | 'PEG' | 'BOTTLE' | 'PACKAGED';
export type CheckoutTaxQuote = {
  unitPrice: number;
  baseAmount: number;
  taxAmount: number;
  lineTotal: number;
  snapshotId: string;
  snapshotHash: string;
  breakdown: unknown[];
};

/**
 * Resolve the P534 approved tax configuration and persist its immutable snapshot
 * on the caller's transaction. No legacy tax_rate fallback is permitted.
 */
export async function createCheckoutTaxQuote(client: PoolClient, input: {
  organisationId: string; outletId: string; productId: string; actorUserId: string;
  channel: CheckoutTaxChannel; measureType?: CheckoutTaxMeasure; quantity: number; packSizeMlOverride?: number;
  priceAdjustmentPerUnit?: number;
}): Promise<CheckoutTaxQuote> {
  const requestHash = sha256(input);
  const resolved = await client.query(`
    SELECT p.id AS price_id,p.profile_id,p.unit_price,p.mrp,p.menu_ceiling,p.measure_type,
           pr.product_class,pr.abv,pr.gst_exempt_for_alcohol,pr.jurisdiction_code,
           prod.pack_size_ml,o.state_code
      FROM outlet_tax_prices p
      JOIN tax_product_profiles pr ON pr.id=p.profile_id AND pr.organisation_id=p.organisation_id
      JOIN products prod ON prod.id=p.product_id AND prod.organisation_id=p.organisation_id
      JOIN outlets o ON o.id=p.outlet_id AND o.organisation_id=p.organisation_id AND o.state_code=pr.jurisdiction_code
     WHERE p.organisation_id=$1 AND p.outlet_id=$2 AND p.product_id=$3 AND p.channel=$4
       AND p.measure_type=$5 AND p.status='APPROVED' AND pr.status='VERIFIED'
       AND p.effective_from<=NOW() AND (p.effective_until IS NULL OR p.effective_until>NOW())
     ORDER BY p.effective_from DESC,p.created_at DESC LIMIT 1 FOR SHARE OF p,pr`,
    [input.organisationId,input.outletId,input.productId,input.channel,input.measureType??(input.channel==='RETAIL'?'UNIT':'BOTTLE')]);
  if (!resolved.rowCount) {
    await client.query(`INSERT INTO tax_calculation_attempts(organisation_id,outlet_id,actor_user_id,outcome,reason_code,request_hash)
      VALUES($1,$2,$3,'DENY','ACTIVE_PACK_PROFILE_OR_PRICE_MISSING',$4)`,
      [input.organisationId,input.outletId,input.actorUserId,requestHash]);
    throw Object.assign(new Error('TAX_CONFIGURATION_INCOMPLETE'),{code:'TAX_CONFIGURATION_INCOMPLETE'});
  }
  const p=resolved.rows[0];
  if (input.channel === 'BAR' && input.measureType === 'PEG') {
    if (!input.packSizeMlOverride || input.packSizeMlOverride <= 0 || input.packSizeMlOverride > Number(p.pack_size_ml)) {
      throw Object.assign(new Error('INVALID_PEG_VOLUME'), { code: 'INVALID_PEG_VOLUME' });
    }
  }
  const pack=await client.query(`SELECT id FROM tax_rule_packs
    WHERE jurisdiction_code=$1 AND status='ACTIVE' AND CURRENT_DATE BETWEEN effective_from AND COALESCE(effective_until,'9999-12-31')
    ORDER BY version_no DESC LIMIT 1 FOR SHARE`,[p.jurisdiction_code]);
  if(!pack.rowCount){
    await client.query(`INSERT INTO tax_calculation_attempts(organisation_id,outlet_id,actor_user_id,outcome,reason_code,request_hash)
      VALUES($1,$2,$3,'DENY','ACTIVE_RULE_PACK_MISSING',$4)`,
      [input.organisationId,input.outletId,input.actorUserId,requestHash]);
    throw Object.assign(new Error('TAX_CONFIGURATION_INCOMPLETE'),{code:'TAX_CONFIGURATION_INCOMPLETE'});
  }
  const components=await client.query(`SELECT component_code,calculation_basis,rate,slab_min,slab_max
    FROM tax_rule_components WHERE rule_pack_id=$1 ORDER BY component_code,calculation_basis`,[pack.rows[0].id]);
  const adjustment=input.priceAdjustmentPerUnit??0;
  if(!Number.isFinite(adjustment))throw new Error('Invalid menu modifier price adjustment');
  const unitPrice=Number(p.unit_price)+adjustment;
  if(unitPrice<0)throw new Error('Menu modifier price adjustment cannot reduce the item below zero');
  const result=calculateTax({unitPrice,quantity:input.quantity,mrp:p.mrp==null?null:Number(p.mrp),
    menuCeiling:p.menu_ceiling==null?null:Number(p.menu_ceiling),abv:Number(p.abv),
    packSizeMl:input.packSizeMlOverride??Number(p.pack_size_ml),productClass:p.product_class,
    gstExemptForAlcohol:Boolean(p.gst_exempt_for_alcohol),channel:input.channel,components:components.rows});
  const snapshot={request:{...input,measureType:input.measureType??(input.channel==='RETAIL'?'UNIT':'BOTTLE')},priceId:p.price_id,profileId:p.profile_id,rulePackId:pack.rows[0].id,result};
  const snapshotHash=sha256(snapshot);
  const saved=await client.query(`INSERT INTO tax_calculation_snapshots
    (organisation_id,outlet_id,product_id,profile_id,rule_pack_id,price_id,request_hash,snapshot,snapshot_hash)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING id,snapshot_hash`,
    [input.organisationId,input.outletId,input.productId,p.profile_id,pack.rows[0].id,p.price_id,requestHash,JSON.stringify(snapshot),snapshotHash]);
  await client.query(`INSERT INTO tax_calculation_attempts(organisation_id,outlet_id,actor_user_id,outcome,reason_code,request_hash)
    VALUES($1,$2,$3,'ALLOW','CALCULATED',$4)`,[input.organisationId,input.outletId,input.actorUserId,requestHash]);
  return {unitPrice,baseAmount:Math.round((result.baseAmount-result.inclusiveTax+Number.EPSILON)*100)/100,taxAmount:result.taxTotal,
    lineTotal:result.grandTotal,snapshotId:saved.rows[0].id,snapshotHash,breakdown:result.breakdown};
}
