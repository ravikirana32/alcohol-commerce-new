import { createHash } from 'node:crypto';

type Queryable = { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
type Channel = 'RETAIL' | 'BAR';
type SourceType = 'ONLINE_RETAIL' | 'ONLINE_BAR' | 'OFFLINE_RETAIL' | 'OFFLINE_BAR' | 'PREVIEW';
export type ExciseAttestations = { ageVerified?: boolean; notIntoxicated?: boolean; noRestrictedCustomer?: boolean; mealProvided?: boolean; consumptionOnPremises?: boolean };
export type ExciseEvaluationInput = {
  organisationId: string; outletId: string; channel: Channel; occurredAt?: string | Date;
  attestations?: ExciseAttestations; sourceType: SourceType; sourceReference?: string; actorUserId?: string;
};
export type ExciseEvaluation = { allowed: boolean; decisionId: string | null; reasonCodes: string[]; evidence: Record<string, unknown>; rulePackId: string | null; licenceId: string | null };

function localParts(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const dayMap: Record<string, string> = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' };
  return { date: `${map.year}-${map.month}-${map.day}`, weekday: dayMap[map.weekday] ?? 'mon', time: `${map.hour}:${map.minute}`, month: Number(map.month), day: Number(map.day) };
}
export function normaliseLicenceClass(value: string): string { return value.toUpperCase().replace(/[^A-Z0-9]/g, ''); }
export function hoursAllow(schedule: any, weekday: string, time: string): boolean {
  const order = ['mon','tue','wed','thu','fri','sat','sun'];
  const row = schedule?.[weekday];
  const valid = (v: unknown) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  if (row && valid(row.open) && valid(row.close) && row.open !== row.close) {
    if (row.open < row.close && time >= row.open && time < row.close) return true;
    if (row.open > row.close && time >= row.open) return true;
  }
  const index = order.indexOf(weekday);
  const previousDay = order[(index + 6) % 7];
  const previous = schedule?.[previousDay];
  return !!previous && valid(previous.open) && valid(previous.close) && previous.open > previous.close && time < previous.close;
}

export async function evaluateExciseSale(db: Queryable, input: ExciseEvaluationInput): Promise<ExciseEvaluation> {
  const requestedAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  const validDate = Number.isFinite(requestedAt.getTime());
  const occurredAt = validDate ? requestedAt : new Date();
  const local = localParts(occurredAt);
  const reasons: string[] = [];
  const evidence: Record<string, unknown> = { jurisdiction: 'KA', localDate: local.date, localTime: local.time, timezone: 'Asia/Kolkata', channel: input.channel };
  const outletResult = await db.query(`SELECT o.id,o.state_code,o.district,o.status,org.status AS organisation_status
    FROM outlets o JOIN organisations org ON org.id=o.organisation_id WHERE o.id=$1 AND o.organisation_id=$2 FOR SHARE OF o,org`, [input.outletId, input.organisationId]);
  const outlet = outletResult.rows[0];
  if (!outlet) return { allowed: false, decisionId: null, reasonCodes: ['OUTLET_NOT_FOUND'], evidence, rulePackId: null, licenceId: null };
  if (outlet.state_code !== 'KA' || outlet.status !== 'ACTIVE' || outlet.organisation_status !== 'ACTIVE') reasons.push('OUTLET_OR_JURISDICTION_NOT_ACTIVE');
  const packResult = outlet ? await db.query(`SELECT * FROM excise_rule_packs WHERE jurisdiction_code=$1 AND status='ACTIVE'
    AND effective_from<=$2::date AND (effective_until IS NULL OR effective_until>=$2::date) ORDER BY version_no DESC LIMIT 1 FOR SHARE`, [outlet.state_code, local.date]) : { rows: [] as any[] };
  const pack = packResult.rows[0];
  if (!pack) reasons.push('NO_ACTIVE_APPROVED_RULE_PACK');
  evidence.rulePackCode = pack?.pack_code ?? null;
  const rulesResult = pack ? await db.query('SELECT rule_key,rule_value,source_reference FROM excise_rule_pack_rules WHERE rule_pack_id=$1', [pack.id]) : { rows: [] as any[] };
  const rules = new Map<string, any>(rulesResult.rows.map((r: any) => [r.rule_key, r.rule_value]));
  const licenceResult = outlet ? await db.query(`SELECT * FROM outlet_licences WHERE organisation_id=$1 AND outlet_id=$2 AND status='VERIFIED'
    AND (valid_from IS NULL OR valid_from<=$3::date) AND (valid_until IS NULL OR valid_until>=$3::date)
    AND jurisdiction_code IN ('KA','KARNATAKA') AND permitted_activities @> ARRAY[$4]::text[] ORDER BY reviewed_at DESC NULLS LAST LIMIT 1 FOR SHARE`,
    [input.organisationId, input.outletId, local.date, input.channel === 'BAR' ? 'BAR_SERVICE' : 'RETAIL_SALE']) : { rows: [] as any[] };
  const licence = licenceResult.rows[0];
  if (!licence) reasons.push('NO_CURRENT_VERIFIED_LICENCE');
  const licenceClass = licence ? normaliseLicenceClass(licence.licence_type) : '';
  const offShopClasses = ['CL2','CL2A'];
  const barClasses = ['CL9','CL9A'];
  if (licence && input.channel === 'RETAIL' && !offShopClasses.includes(licenceClass)) reasons.push('LICENCE_CLASS_NOT_PERMITTED_FOR_RETAIL');
  if (licence && input.channel === 'BAR' && !barClasses.includes(licenceClass)) reasons.push('LICENCE_CLASS_NOT_PERMITTED_FOR_BAR');
  evidence.licence = licence ? { id: licence.id, class: licence.licence_type, validFrom: licence.valid_from, validUntil: licence.valid_until, activities: licence.permitted_activities } : null;

  if (!validDate) reasons.push('INVALID_TRANSACTION_TIMESTAMP');
  const att = input.attestations ?? {};
  const minimumAge = Number(rules.get('MINIMUM_CUSTOMER_AGE')?.years ?? 0);
  if (!minimumAge || att.ageVerified !== true) reasons.push('CUSTOMER_AGE_NOT_VERIFIED');
  if (rules.get('REFUSE_IF_INTOXICATED')?.enabled !== false && att.notIntoxicated !== true) reasons.push('CUSTOMER_INTOXICATION_NOT_CLEARED');
  if (rules.get('REFUSE_RESTRICTED_CUSTOMERS')?.enabled !== false && att.noRestrictedCustomer !== true) reasons.push('RESTRICTED_CUSTOMER_SCREEN_NOT_CONFIRMED');
  if (input.channel === 'RETAIL' && rules.get('OFFSHOP_NO_ON_PREMISES_CONSUMPTION')?.enabled !== false && att.consumptionOnPremises === true) reasons.push('OFFSHOP_ON_PREMISES_CONSUMPTION_PROHIBITED');
  if (input.channel === 'BAR' && rules.get('BAR_MEALS_OR_EATABLES_REQUIRED')?.enabled !== false && att.mealProvided !== true) reasons.push('BAR_MEALS_OR_EATABLES_NOT_CONFIRMED');

  const hoursResult = licence ? await db.query(`SELECT weekly_hours FROM outlet_licence_excise_conditions
    WHERE organisation_id=$1 AND outlet_id=$2 AND licence_id=$3 AND status='VERIFIED' ORDER BY reviewed_at DESC NULLS LAST LIMIT 1 FOR SHARE`,
    [input.organisationId, input.outletId, licence.id]) : { rows: [] as any[] };
  const hours = hoursResult.rows[0]?.weekly_hours;
  if (!hours || !hoursAllow(hours, local.weekday, local.time)) reasons.push('OUTSIDE_OR_UNCONFIGURED_LICENCE_HOURS');
  evidence.operatingHoursConfigured = !!hours;

  const gandhi = rules.get('GANDHI_JAYANTI_DRY_DAY');
  if (gandhi?.enabled !== false && local.month === Number(gandhi?.month ?? 10) && local.day === Number(gandhi?.day ?? 2)) reasons.push('STATUTORY_DRY_DAY_GANDHI_JAYANTI');
  if (outlet) {
    const dry = await db.query(`SELECT id,order_reference,reason FROM excise_dry_day_orders WHERE jurisdiction_code=$1 AND dry_day_date=$2::date AND status='ACTIVE'
      AND (district IS NULL OR lower(district)=lower($3)) LIMIT 1`, [outlet.state_code, local.date, outlet.district ?? '']);
    if (dry.rowCount) { reasons.push('OFFICIAL_DRY_DAY_ORDER'); evidence.dryDayOrder = dry.rows[0]; }
  }
  evidence.attestations = { ageVerified: att.ageVerified === true, notIntoxicated: att.notIntoxicated === true, noRestrictedCustomer: att.noRestrictedCustomer === true, mealProvided: att.mealProvided === true, consumptionOnPremises: att.consumptionOnPremises === true };
  evidence.ruleSources = rulesResult.rows.map((r: any) => ({ key: r.rule_key, source: r.source_reference }));
  const requestHash = createHash('sha256').update(JSON.stringify({ ...input, occurredAt: occurredAt.toISOString(), attestations: att })).digest('hex');
  const outcome = reasons.length ? 'DENY' : 'ALLOW';
  const inserted = await db.query(`INSERT INTO excise_compliance_decisions(organisation_id,outlet_id,licence_id,rule_pack_id,channel,outcome,reason_codes,transaction_occurred_at,source_type,source_reference,request_hash,evidence,actor_user_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13) RETURNING id`,
    [input.organisationId,input.outletId,licence?.id ?? null,pack?.id ?? null,input.channel,outcome,reasons,occurredAt,input.sourceType,input.sourceReference ?? null,requestHash,JSON.stringify(evidence),input.actorUserId ?? null]);
  return { allowed: outcome === 'ALLOW', decisionId: inserted.rows[0].id, reasonCodes: reasons, evidence, rulePackId: pack?.id ?? null, licenceId: licence?.id ?? null };
}
