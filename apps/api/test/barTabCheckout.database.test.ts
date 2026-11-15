import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.BAR_TAB_TEST_DATABASE_URL;
const parsedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
const databaseName = parsedDatabaseUrl?.pathname.replace(/^\/+/, '').toLowerCase() ?? '';
if (databaseUrl && (
  !['postgres:','postgresql:'].includes(parsedDatabaseUrl?.protocol ?? '')
  || !['localhost','127.0.0.1','::1'].includes(parsedDatabaseUrl?.hostname ?? '')
  || !/(^|_)test($|_)/.test(databaseName)
)) {
  throw new Error('BAR_TAB_TEST_DATABASE_URL must target a local PostgreSQL database whose name contains a test segment');
}

const organisationId = randomUUID();
const outletId = randomUUID();
const userId = randomUUID();
const reviewerId = randomUUID();
const sessionId = randomUUID();
const authSessionId = randomUUID();
const reviewerAuthSessionId = randomUUID();
const productId = randomUUID();
const secondaryProductId = randomUUID();
const costLayerId = randomUUID();
const secondaryCostLayerId = randomUUID();
const costLayerLineId = randomUUID();
const secondaryCostLayerLineId = randomUUID();
const jwtSecret = 'p586-bar-tab-checkout-integration-test-secret-0123456789';
const roleCode = 'BAR_OWNER';
const attestations = {
  ageVerified:true,
  notIntoxicated:true,
  noRestrictedCustomer:true,
  mealProvided:true
};

let app: Express;
let pool: pg.Pool;
let token: string;
let reviewerToken: string;
let taxPackId: string;

describe.skipIf(!parsedDatabaseUrl)('bar tab checkout database integration', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    process.env.JWT_SECRET = jwtSecret;
    const [api,database] = await Promise.all([
      import('../src/app.js'),
      import('../src/db/pool.js')
    ]);
    app = api.app;
    pool = database.pool;

    await pool.query(
      `INSERT INTO organisations(id,name,legal_name,display_name,organisation_type,status,organisation_profile)
       VALUES($1,'P586 checkout test bar','P586 checkout test bar','P586 checkout test bar','BAR_OPERATOR','ACTIVE','BAR_ONLY')`,
      [organisationId]
    );
    await pool.query(
      `INSERT INTO users(id,email,display_name,password_hash,status)
       VALUES($1,$2,'P586 checkout user','test-only-hash','ACTIVE'),($3,$4,'P586 checkout reviewer','test-only-hash','ACTIVE')`,
      [userId,`p586-checkout-${userId}@integration.invalid`,reviewerId,`p586-reviewer-${reviewerId}@integration.invalid`]
    );
    await pool.query(
      `INSERT INTO organisation_memberships(user_id,organisation_id,role_code,status)
       VALUES($1,$2,$3,'ACTIVE'),($4,$2,'BAR_MANAGER','ACTIVE')`,
      [userId,organisationId,roleCode,reviewerId]
    );
    await pool.query(
      `INSERT INTO role_permissions(role_code,permission_code)
       VALUES($1,'bar:sell'),($1,'bar:read'),($1,'bar:refund'),($1,'shift:manage'),($1,'shift:read') ON CONFLICT DO NOTHING`,
      [roleCode]
    );
    await pool.query(
      `INSERT INTO outlets(id,organisation_id,outlet_code,name,operating_mode,state_code,status,outlet_type)
       VALUES($1,$2,$3,'P586 checkout test outlet','BAR_ONLY','KA','ACTIVE','BAR')`,
      [outletId,organisationId,`P586-CHECKOUT-${userId.slice(0,8)}`]
    );
    const licence = await pool.query(
      `INSERT INTO outlet_licences(
         organisation_id,outlet_id,jurisdiction_code,licence_type,licence_number,
         status,verification_status,permitted_activities,permitted_capabilities,reviewed_by,reviewed_at
       ) VALUES($1,$2,'KA','CL9',$3,'VERIFIED','VERIFIED',ARRAY['BAR_SERVICE'],'[]'::jsonb,$4,NOW())
       RETURNING id`,
      [organisationId,outletId,`P586-CL9-${userId.slice(0,8)}`,reviewerId]
    );

    const excisePack = await pool.query(
      `UPDATE excise_rule_packs
       SET status='ACTIVE',reviewed_by=$1,reviewed_at=NOW(),activated_by=$2,activated_at=NOW()
       WHERE pack_code='KA-BASE-2025-12' AND status IN ('DRAFT','ACTIVE')
       RETURNING id`,
      [reviewerId,userId]
    );
    if (!excisePack.rowCount) throw new Error('Could not activate the seeded Karnataka excise pack for the isolated integration database');
    await pool.query(
      `INSERT INTO outlet_licence_excise_conditions(
         organisation_id,outlet_id,licence_id,weekly_hours,status,submitted_by,reviewed_by,reviewed_at
       ) VALUES($1,$2,$3,$4::jsonb,'VERIFIED',$5,$6,NOW())`,
      [organisationId,outletId,licence.rows[0].id,JSON.stringify(Object.fromEntries(
        ['mon','tue','wed','thu','fri','sat','sun'].map((day)=>[day,{open:'00:00',close:'23:59'}])
      )),userId,reviewerId]
    );

    await pool.query("UPDATE tax_rule_packs SET status='APPROVED' WHERE pack_code LIKE 'P586-%' AND status='ACTIVE'");
    const taxPack = await pool.query(
      `INSERT INTO tax_rule_packs(jurisdiction_code,pack_code,version_no,title,status,effective_from,created_by)
       VALUES('KA',$1,1,'P586 test tax pack','ACTIVE',CURRENT_DATE,$2)
       RETURNING id`,
      [`P586-${userId}`,userId]
    );
    taxPackId = taxPack.rows[0].id;
    await pool.query(
      `INSERT INTO products(id,organisation_id,sku,name,product_type,pack_size_ml,abv,status)
       VALUES($1,$2,$3,'P586 test spirit','SPIRIT',750,42.8,'ACTIVE'),
             ($4,$2,$5,'P586 second spirit','SPIRIT',750,42.8,'ACTIVE')`,
      [productId,organisationId,`P586-${userId.slice(0,8)}`,secondaryProductId,`P586B-${userId.slice(0,8)}`]
    );
    const profile = await pool.query(
      `INSERT INTO tax_product_profiles(
         organisation_id,product_id,jurisdiction_code,product_class,abv,hsn_code,
         gst_exempt_for_alcohol,status,created_by,reviewed_by,reviewed_at
       ) VALUES($1,$2,'KA','SPIRIT',42.8,'2208',TRUE,'VERIFIED',$3,$4,NOW())
       RETURNING id`,
      [organisationId,productId,userId,reviewerId]
    );
    const secondaryProfile=await pool.query(
      `INSERT INTO tax_product_profiles(
         organisation_id,product_id,jurisdiction_code,product_class,abv,hsn_code,
         gst_exempt_for_alcohol,status,created_by,reviewed_by,reviewed_at
       ) VALUES($1,$2,'KA','SPIRIT',42.8,'2208',TRUE,'VERIFIED',$3,$4,NOW())
       RETURNING id`,
      [organisationId,secondaryProductId,userId,reviewerId]
    );
    await pool.query(
      `INSERT INTO outlet_tax_prices(
         organisation_id,outlet_id,product_id,profile_id,channel,measure_type,
         unit_price,menu_ceiling,effective_from,status,created_by,reviewed_by,reviewed_at
       ) VALUES($1,$2,$3,$4,'BAR','PACKAGED',10,20,NOW()-INTERVAL '1 day','APPROVED',$5,$6,NOW())`,
      [organisationId,outletId,productId,profile.rows[0].id,userId,reviewerId]
    );
    await pool.query(
      `INSERT INTO outlet_tax_prices(
         organisation_id,outlet_id,product_id,profile_id,channel,measure_type,
         unit_price,menu_ceiling,effective_from,status,created_by,reviewed_by,reviewed_at
       ) VALUES($1,$2,$3,$4,'BAR','PACKAGED',10,20,NOW()-INTERVAL '1 day','APPROVED',$5,$6,NOW())`,
      [organisationId,outletId,secondaryProductId,secondaryProfile.rows[0].id,userId,reviewerId]
    );
    await pool.query(
      `INSERT INTO outlet_tax_prices(
         organisation_id,outlet_id,product_id,profile_id,channel,measure_type,
         unit_price,menu_ceiling,effective_from,status,created_by,reviewed_by,reviewed_at
       ) VALUES($1,$2,$3,$4,'BAR','PEG',1,20,NOW()-INTERVAL '1 day','APPROVED',$5,$6,NOW())`,
      [organisationId,outletId,productId,profile.rows[0].id,userId,reviewerId]
    );
    await pool.query(
      `INSERT INTO bar_table_sessions(id,organisation_id,outlet_id,table_label,covers,opened_by)
       VALUES($1,$2,$3,$4,3,$5)`,
      [sessionId,organisationId,outletId,`P586-${userId.slice(0,8)}`,userId]
    );
    await pool.query(
      `INSERT INTO stock_balances(organisation_id,outlet_id,product_id,quantity_units)
       VALUES($1,$2,$3,5),($1,$2,$4,5)`,
      [organisationId,outletId,productId,secondaryProductId]
    );
    await pool.query(
      `INSERT INTO inventory_cost_layers(
         id,organisation_id,outlet_id,product_id,source_type,source_id,source_line_id,
         received_units,remaining_units,unit_cost
       ) VALUES($1,$2,$3,$4,'OPENING',$5,$6,5,5,4.25)`,
      [costLayerId,organisationId,outletId,productId,randomUUID(),costLayerLineId]
    );
    await pool.query(
      `INSERT INTO inventory_cost_layers(
         id,organisation_id,outlet_id,product_id,source_type,source_id,source_line_id,
         received_units,remaining_units,unit_cost
       ) VALUES($1,$2,$3,$4,'OPENING',$5,$6,5,5,4.25)`,
      [secondaryCostLayerId,organisationId,outletId,secondaryProductId,randomUUID(),secondaryCostLayerLineId]
    );
    await pool.query(
      `INSERT INTO auth_sessions(id,token_id,user_id,expires_at)
       VALUES($1,$2,$3,NOW()+INTERVAL '1 hour'),($4,$5,$6,NOW()+INTERVAL '1 hour')`,
      [authSessionId,authSessionId,userId,reviewerAuthSessionId,reviewerAuthSessionId,reviewerId]
    );
    token = jwt.sign({
      sub:userId,sid:authSessionId,email:`p586-checkout-${userId}@integration.invalid`,
      name:'P586 checkout user',platformAdmin:false,organisationId,roleCode
    },jwtSecret,{expiresIn:'1h'});
    reviewerToken=jwt.sign({
      sub:reviewerId,sid:reviewerAuthSessionId,email:`p586-reviewer-${reviewerId}@integration.invalid`,
      name:'P586 reviewer',platformAdmin:false,organisationId,roleCode:'BAR_MANAGER'
    },jwtSecret,{expiresIn:'1h'});
  },60_000);

  afterAll(async () => {
    if (!pool) return;
    if (taxPackId) {
      await pool.query("UPDATE tax_rule_packs SET status='APPROVED' WHERE id=$1",[taxPackId]);
    }
    await pool.end();
  });

  it('creates durable unpaid rounds, KOTs, and exactly-once stock/cost movements', async () => {
    const authorization = `Bearer ${token}`;
    const stationResponse=await request(app)
      .post('/api/v1/bar/kot/stations')
      .set('Authorization',authorization)
      .send({outletId,stationCode:`GRILL-${userId.slice(0,6)}`,name:'Grill',isDefault:true});
    expect(stationResponse.status,JSON.stringify(stationResponse.body)).toBe(201);
    const stationId=stationResponse.body.data.id as string;
    const secondStationResponse=await request(app)
      .post('/api/v1/bar/kot/stations')
      .set('Authorization',authorization)
      .send({outletId,stationCode:`BAR-${userId.slice(0,6)}`,name:'Bar',isDefault:false});
    expect(secondStationResponse.status,JSON.stringify(secondStationResponse.body)).toBe(201);
    const secondStationId=secondStationResponse.body.data.id as string;
    const productAssignment=await request(app)
      .put(`/api/v1/bar/kot/stations/${stationId}/products/${productId}`)
      .set('Authorization',authorization)
      .send({outletId});
    expect(productAssignment.status,JSON.stringify(productAssignment.body)).toBe(200);
    const secondProductAssignment=await request(app)
      .put(`/api/v1/bar/kot/stations/${secondStationId}/products/${secondaryProductId}`)
      .set('Authorization',authorization)
      .send({outletId});
    expect(secondProductAssignment.status,JSON.stringify(secondProductAssignment.body)).toBe(200);
    const firstRound = {
      outletId,
      idempotencyKey:`p586-round-one-${userId}`,
      ticketNumber:`P586-R1-${userId.slice(0,8)}`,
      tableSessionId:sessionId,
      lines:[
        {productId,lineType:'PACKAGED',quantity:1},
        {productId:secondaryProductId,lineType:'PACKAGED',quantity:1}
      ],
      payments:[],
      complianceAttestations:attestations
    };
    const secondRound = {
      ...firstRound,
      idempotencyKey:`p586-round-two-${userId}`,
      ticketNumber:`P586-R2-${userId.slice(0,8)}`,
      lines:[{productId,lineType:'PACKAGED' as const,quantity:1}]
    };

    const first = await request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send(firstRound);
    expect(first.status,JSON.stringify(first.body)).toBe(201);
    expect(first.body.data).toMatchObject({status:'SENT',table_session_id:sessionId,grand_total:'20.00'});
    const second = await request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send(secondRound);
    expect(second.status,JSON.stringify(second.body)).toBe(201);
    expect(second.body.data).toMatchObject({status:'SENT',table_session_id:sessionId,grand_total:'10.00'});

    const replay = await request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send(firstRound);
    expect(replay.status,JSON.stringify(replay.body)).toBe(200);
    expect(replay.body.idempotentReplay).toBe(true);

    const firstKot = await pool.query('SELECT id,station_id FROM bar_kot_orders WHERE ticket_id=$1 ORDER BY station_id',[first.body.data.id]);
    expect(firstKot.rows).toHaveLength(2);
    expect(new Set(firstKot.rows.map((row)=>row.station_id))).toEqual(new Set([stationId,secondStationId]));
    const grillKot=firstKot.rows.find((row)=>row.station_id===stationId);
    expect(grillKot).toBeDefined();
    const stationQueue=await request(app)
      .get(`/api/v1/bar/kot?outletId=${outletId}&stationId=${stationId}`)
      .set('Authorization',authorization);
    expect(stationQueue.status,JSON.stringify(stationQueue.body)).toBe(200);
    expect(stationQueue.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({id:grillKot!.id,station_name:'Grill',station_code:`GRILL-${userId.slice(0,6)}`.toUpperCase()})
    ]));
    const routedLines=await pool.query(
      `SELECT k.station_id,kl.product_id
         FROM bar_kot_orders k JOIN bar_kot_lines kl ON kl.kot_order_id=k.id
        WHERE k.ticket_id=$1`,
      [first.body.data.id]
    );
    expect(routedLines.rows).toEqual(expect.arrayContaining([
      {station_id:stationId,product_id:productId},
      {station_id:secondStationId,product_id:secondaryProductId}
    ]));
    for (const kot of firstKot.rows) {
      for (const status of ['ACCEPTED','PREPARING','READY','SERVED']) {
        const transition = await request(app)
          .post(`/api/v1/bar/kot/${kot.id}/status`)
          .set('Authorization',authorization)
          .send({status});
        expect(transition.status,JSON.stringify(transition.body)).toBe(200);
      }
    }
    const voidServedTicket=await request(app)
      .post(`/api/v1/bar/tickets/${first.body.data.id}/approval-requests`)
      .set('Authorization',authorization)
      .send({type:'VOID',idempotencyKey:`p594-served-void-${userId}`,reason:'Served tickets must use the refund workflow'});
    expect(voidServedTicket.status).toBe(409);
    expect(voidServedTicket.body.error.code).toBe('KOT_NOT_VOIDABLE');
    const reprint=await request(app)
      .post(`/api/v1/bar/kot/${grillKot!.id}/reprints`)
      .set('Authorization',authorization)
      .send({reason:'Original kitchen chit was damaged'});
    expect(reprint.status,JSON.stringify(reprint.body)).toBe(201);
    expect(reprint.body.data).toMatchObject({
      ticketNumber:first.body.data.ticket_number,
      tableLabel:`P586-${userId.slice(0,8)}`,
      lines:[
        {product_name:'P586 test spirit',quantity:'1.000'}
      ]
    });
    const secondLine=(await pool.query(
      'SELECT id FROM bar_ticket_lines WHERE ticket_id=$1 AND quantity>0 ORDER BY id LIMIT 1',
      [second.body.data.id]
    )).rows[0];
    const increaseRequest={
      idempotencyKey:`p591-increase-${userId}`,
      quantity:2,
      reason:'Corrected an under-entered packaged bottle quantity'
    };
    const increased=await request(app)
      .post(`/api/v1/bar/tickets/${second.body.data.id}/lines/${secondLine.id}/quantity`)
      .set('Authorization',authorization)
      .send(increaseRequest);
    expect(increased.status,JSON.stringify(increased.body)).toBe(200);
    expect(increased.body.data.grand_total).toBe('20.00');
    const increasedReplay=await request(app)
      .post(`/api/v1/bar/tickets/${second.body.data.id}/lines/${secondLine.id}/quantity`)
      .set('Authorization',authorization)
      .send(increaseRequest);
    expect(increasedReplay.status).toBe(200);
    expect(increasedReplay.body.idempotentReplay).toBe(true);
    const decreased=await request(app)
      .post(`/api/v1/bar/tickets/${second.body.data.id}/lines/${secondLine.id}/quantity`)
      .set('Authorization',authorization)
      .send({
        idempotencyKey:`p591-decrease-${userId}`,
        quantity:1,
        reason:'Reconciled the customer request before preparation'
      });
    expect(decreased.status,JSON.stringify(decreased.body)).toBe(200);
    expect(decreased.body.data.grand_total).toBe('10.00');

    const firstLines=await pool.query('SELECT id FROM bar_ticket_lines WHERE ticket_id=$1 ORDER BY id',[first.body.data.id]);
    const splitRequest={
      idempotencyKey:`p588-split-${userId}`,
      lineIds:[firstLines.rows[0].id]
    };
    const split=await request(app)
      .post(`/api/v1/bar/tickets/${first.body.data.id}/split`)
      .set('Authorization',authorization)
      .send(splitRequest);
    expect(split.status,JSON.stringify(split.body)).toBe(201);
    expect(split.body.data).toMatchObject({
      status:'SENT',
      table_session_id:sessionId,
      grand_total:'10.00'
    });
    const splitReplay=await request(app)
      .post(`/api/v1/bar/tickets/${first.body.data.id}/split`)
      .set('Authorization',authorization)
      .send(splitRequest);
    expect(splitReplay.status).toBe(200);
    expect(splitReplay.body).toMatchObject({data:{id:split.body.data.id},idempotentReplay:true});
    const invalidSplit=await request(app)
      .post(`/api/v1/bar/tickets/${first.body.data.id}/split`)
      .set('Authorization',authorization)
      .send({idempotencyKey:`p588-invalid-split-${userId}`,lineIds:firstLines.rows.map((line)=>line.id)});
    expect(invalidSplit.status).toBe(400);
    expect(invalidSplit.body.error.code).toBe('INVALID_SPLIT_LINES');

    const discountRequest=await request(app)
      .post(`/api/v1/bar/tickets/${second.body.data.id}/approval-requests`)
      .set('Authorization',authorization)
      .send({
        type:'DISCOUNT',idempotencyKey:`p592-discount-${userId}`,amount:2,
        reason:'Manager-approved service recovery'
      });
    expect(discountRequest.status,JSON.stringify(discountRequest.body)).toBe(201);
    const selfApproval=await request(app)
      .post(`/api/v1/bar/ticket-approval-requests/${discountRequest.body.data.id}/decision`)
      .set('Authorization',authorization)
      .send({decision:'APPROVE',reason:'Requesting operator cannot approve own discount'});
    expect(selfApproval.status).toBe(409);
    expect(selfApproval.body.error.code).toBe('SELF_APPROVAL_FORBIDDEN');
    const discountApproved=await request(app)
      .post(`/api/v1/bar/ticket-approval-requests/${discountRequest.body.data.id}/decision`)
      .set('Authorization',`Bearer ${reviewerToken}`)
      .send({decision:'APPROVE',reason:'Approved by a separate manager'});
    expect(discountApproved.status,JSON.stringify(discountApproved.body)).toBe(200);
    const confirmedTip=await request(app)
      .post(`/api/v1/bar/tickets/${second.body.data.id}/approval-requests`)
      .set('Authorization',authorization)
      .send({
        type:'TIP',idempotencyKey:`p592-tip-${userId}`,amount:2,
        reason:'Customer added a tip',customerConfirmed:true
      });
    expect(confirmedTip.status).toBe(201);
    const noConsentServiceCharge=await request(app)
      .post(`/api/v1/bar/tickets/${second.body.data.id}/approval-requests`)
      .set('Authorization',authorization)
      .send({
        type:'SERVICE_CHARGE',idempotencyKey:`p592-no-consent-${userId}`,amount:1,
        reason:'Test required confirmation'
      });
    expect(noConsentServiceCharge.status).toBe(400);
    expect(noConsentServiceCharge.body.error.code).toBe('CUSTOMER_CONFIRMATION_REQUIRED');

    const voidRequest=await request(app)
      .post(`/api/v1/bar/tickets/${second.body.data.id}/approval-requests`)
      .set('Authorization',authorization)
      .send({
        type:'VOID',idempotencyKey:`p592-void-request-${userId}`,
        reason:'Customer cancelled before preparation'
      });
    expect(voidRequest.status,JSON.stringify(voidRequest.body)).toBe(201);
    const unsafeKotCancel=await request(app)
      .post(`/api/v1/bar/kot/${(await pool.query('SELECT id FROM bar_kot_orders WHERE ticket_id=$1',[second.body.data.id])).rows[0].id}/status`)
      .set('Authorization',authorization)
      .send({status:'CANCELLED',reason:'Attempt direct cancel'});
    expect(unsafeKotCancel.status).toBe(409);
    expect(unsafeKotCancel.body.error.code).toBe('USE_TICKET_VOID_WORKFLOW');
    const selfVoidApproval=await request(app)
      .post(`/api/v1/bar/ticket-approval-requests/${voidRequest.body.data.id}/decision`)
      .set('Authorization',authorization)
      .send({decision:'APPROVE',reason:'Self approval must not be possible'});
    expect(selfVoidApproval.status).toBe(409);
    const voidApproved=await request(app)
      .post(`/api/v1/bar/ticket-approval-requests/${voidRequest.body.data.id}/decision`)
      .set('Authorization',`Bearer ${reviewerToken}`)
      .send({decision:'APPROVE',reason:'Approved before kitchen preparation'});
    expect(voidApproved.status,JSON.stringify(voidApproved.body)).toBe(200);
    const voidRequestPayload={approvalRequestId:voidRequest.body.data.id,idempotencyKey:`p589-void-${userId}`};
    const voided=await request(app)
      .post(`/api/v1/bar/tickets/${second.body.data.id}/void`)
      .set('Authorization',authorization)
      .send(voidRequestPayload);
    expect(voided.status,JSON.stringify(voided.body)).toBe(200);
    expect(voided.body.data.status).toBe('VOIDED');
    const voidReplay=await request(app)
      .post(`/api/v1/bar/tickets/${second.body.data.id}/void`)
      .set('Authorization',authorization)
      .send(voidRequestPayload);
    expect(voidReplay.status).toBe(200);
    expect(voidReplay.body.idempotentReplay).toBe(true);
    const restoredDisposition=await pool.query(
      `SELECT v.inventory_disposition,d.disposition,d.quantity
         FROM bar_ticket_void_requests v
         JOIN bar_ticket_void_disposition_lines d ON d.void_request_id=v.id
        WHERE v.ticket_id=$1`,
      [second.body.data.id]
    );
    expect(restoredDisposition.rows).toEqual([
      {inventory_disposition:'RESTOCKED',disposition:'RESTOCKED',quantity:'1.000'}
    ]);

    const [stock,movements,returns,costLayer,returnCostLayers,costEvents,session,kots,payments,audits,splitRows,splitTickets,splitAudit,voidAudit,voidedKot,reprintAudit] = await Promise.all([
      pool.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',[organisationId,outletId,productId]),
      pool.query(`SELECT movement_type,quantity_units,reference_id FROM stock_movements
        WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 AND reference_type='BAR_TICKET'
        ORDER BY quantity_units`,[organisationId,outletId,productId]),
      pool.query(`SELECT movement_type,quantity_units FROM stock_movements
        WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 AND reference_type='BAR_TICKET_VOID'`,
        [organisationId,outletId,productId]),
      pool.query('SELECT received_units,remaining_units FROM inventory_cost_layers WHERE id=$1',[costLayerId]),
      pool.query(`SELECT received_units,remaining_units,unit_cost FROM inventory_cost_layers
        WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 AND source_type='RETURN'`,
        [organisationId,outletId,productId]),
      pool.query(`SELECT requested_units,covered_units,fully_costed FROM inventory_cost_consumption_events
        WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3`,[organisationId,outletId,productId]),
      pool.query(`SELECT COUNT(*)::int ticket_count,SUM(grand_total) FILTER (WHERE status<>'VOIDED') billed_total
        FROM bar_tickets WHERE table_session_id=$1`,[sessionId]),
      pool.query('SELECT COUNT(*)::int count FROM bar_kot_orders WHERE table_session_id=$1',[sessionId]),
      pool.query('SELECT COUNT(*)::int count FROM bar_payments WHERE ticket_id IN (SELECT id FROM bar_tickets WHERE table_session_id=$1)',[sessionId]),
      pool.query(`SELECT COUNT(*)::int count FROM audit_events
        WHERE organisation_id=$1 AND event_type='BAR_TAB_ROUND_ADDED'
          AND entity_id IN (SELECT id FROM bar_tickets WHERE table_session_id=$2)`,[organisationId,sessionId]),
      pool.query(`SELECT source_ticket_id,created_ticket_id FROM bar_ticket_split_requests
        WHERE organisation_id=$1 AND source_ticket_id=$2`,[organisationId,first.body.data.id]),
      pool.query(`SELECT t.id,t.grand_total,COUNT(l.id)::int line_count
        FROM bar_tickets t JOIN bar_ticket_lines l ON l.ticket_id=t.id
        WHERE t.id=ANY($1::uuid[]) GROUP BY t.id ORDER BY t.id`,[[first.body.data.id,split.body.data.id]]),
      pool.query(`SELECT COUNT(*)::int count FROM audit_events
        WHERE organisation_id=$1 AND event_type='BAR_TAB_ITEMS_SPLIT' AND entity_id=$2`,
        [organisationId,first.body.data.id]),
      pool.query(`SELECT COUNT(*)::int count FROM audit_events
        WHERE organisation_id=$1 AND event_type='BAR_TICKET_VOIDED' AND entity_id=$2`,
        [organisationId,second.body.data.id]),
      pool.query("SELECT status FROM bar_kot_orders WHERE ticket_id=$1",[second.body.data.id]),
      pool.query(`SELECT COUNT(*)::int count FROM audit_events
        WHERE organisation_id=$1 AND event_type='BAR_KOT_REPRINTED' AND entity_id=$2`,
        [organisationId,grillKot!.id])
    ]);
    expect(stock.rows[0].quantity_units).toBe('4.000');
    expect(movements.rows).toHaveLength(2);
    expect(movements.rows.map((row)=>row.quantity_units)).toEqual(['1.000','1.000']);
    expect(new Set(movements.rows.map((row)=>row.reference_id)).size).toBe(2);
    expect(returns.rows).toEqual([{movement_type:'RETURN',quantity_units:'1.000'}]);
    expect(costLayer.rows[0]).toMatchObject({received_units:'5.000',remaining_units:'2.000'});
    expect(returnCostLayers.rows).toHaveLength(2);
    expect(returnCostLayers.rows.every((row)=>
      row.received_units==='1.000'&&row.remaining_units==='1.000'&&row.unit_cost==='4.2500'
    )).toBe(true);
    expect(costEvents.rows).toHaveLength(3);
    expect(costEvents.rows.every((row)=>row.fully_costed&&row.covered_units===row.requested_units)).toBe(true);
    expect(session.rows[0]).toMatchObject({ticket_count:3,billed_total:'20.00'});
    expect(kots.rows[0].count).toBe(3);
    expect(payments.rows[0].count).toBe(0);
    expect(audits.rows[0].count).toBe(2);
    expect(splitRows.rows).toEqual([{
      source_ticket_id:first.body.data.id,
      created_ticket_id:split.body.data.id
    }]);
    expect(splitTickets.rows).toHaveLength(2);
    expect(splitTickets.rows.every((row)=>row.grand_total==='10.00'&&row.line_count===1)).toBe(true);
    expect(splitAudit.rows[0].count).toBe(1);
    expect(voidAudit.rows[0].count).toBe(1);
    expect(voidedKot.rows[0].status).toBe('CANCELLED');
    expect(reprintAudit.rows[0].count).toBe(1);

    const paidTicket=await request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send({
      ...firstRound,
      idempotencyKey:`p592-paid-${userId}`,
      ticketNumber:`P592-PAID-${userId.slice(0,8)}`,
      lines:[{productId,lineType:'PACKAGED',quantity:1}],
      payments:[{method:'CASH',amount:10}]
    });
    expect(paidTicket.status,JSON.stringify(paidTicket.body)).toBe(201);
    const refundKey=`p592-refund-${userId}`;
    const refundPayload={
      type:'REFUND',idempotencyKey:refundKey,amount:5,reason:'Customer returned an unopened packaged item',
      method:'CASH',pegRestorations:[]
    };
    const refundApproval=await request(app)
      .post(`/api/v1/bar/tickets/${paidTicket.body.data.id}/approval-requests`)
      .set('Authorization',authorization).send(refundPayload);
    expect(refundApproval.status,JSON.stringify(refundApproval.body)).toBe(201);
    const approveRefund=await request(app)
      .post(`/api/v1/bar/ticket-approval-requests/${refundApproval.body.data.id}/decision`)
      .set('Authorization',`Bearer ${reviewerToken}`)
      .send({decision:'APPROVE',reason:'Refund evidence reviewed'});
    expect(approveRefund.status,JSON.stringify(approveRefund.body)).toBe(200);
    const mismatchedRefund=await request(app)
      .post(`/api/v1/bar/tickets/${paidTicket.body.data.id}/refunds`)
      .set('Authorization',authorization)
      .set('Idempotency-Key',refundKey)
      .send({...refundPayload,approvalRequestId:refundApproval.body.data.id,amount:4});
    expect(mismatchedRefund.status).toBe(409);
    expect(mismatchedRefund.body.error.code).toBe('REFUND_APPROVAL_PAYLOAD_MISMATCH');
    const refund=await request(app)
      .post(`/api/v1/bar/tickets/${paidTicket.body.data.id}/refunds`)
      .set('Authorization',authorization)
      .set('Idempotency-Key',refundKey)
      .send({...refundPayload,approvalRequestId:refundApproval.body.data.id});
    expect(refund.status,JSON.stringify(refund.body)).toBe(201);
    expect(refund.body.remainingRefundable).toBe(5);

    const preparedTicket=await request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send({
      ...firstRound,
      idempotencyKey:`p594-prepared-void-${userId}`,
      ticketNumber:`P594-PREPARED-${userId.slice(0,8)}`,
      lines:[{productId,lineType:'PACKAGED',quantity:1}],
      payments:[]
    });
    expect(preparedTicket.status,JSON.stringify(preparedTicket.body)).toBe(201);
    const preparedKot=(await pool.query('SELECT id FROM bar_kot_orders WHERE ticket_id=$1',[preparedTicket.body.data.id])).rows[0];
    const acceptedKot=await request(app)
      .post(`/api/v1/bar/kot/${preparedKot.id}/status`)
      .set('Authorization',authorization)
      .send({status:'ACCEPTED'});
    expect(acceptedKot.status,JSON.stringify(acceptedKot.body)).toBe(200);
    const stockBeforeWastageVoid=await pool.query(
      'SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',
      [organisationId,outletId,productId]
    );
    const preparedVoidRequest=await request(app)
      .post(`/api/v1/bar/tickets/${preparedTicket.body.data.id}/approval-requests`)
      .set('Authorization',authorization)
      .send({type:'VOID',idempotencyKey:`p594-void-approval-${userId}`,reason:'Preparation was cancelled after the kitchen accepted it'});
    expect(preparedVoidRequest.status,JSON.stringify(preparedVoidRequest.body)).toBe(201);
    const duplicatePreparedVoid=await request(app)
      .post(`/api/v1/bar/tickets/${preparedTicket.body.data.id}/approval-requests`)
      .set('Authorization',authorization)
      .send({type:'VOID',idempotencyKey:`p594-void-approval-duplicate-${userId}`,reason:'Duplicate request must be blocked'});
    expect(duplicatePreparedVoid.status).toBe(409);
    expect(duplicatePreparedVoid.body.error.code).toBe('VOID_APPROVAL_ALREADY_ACTIVE');
    const approvedPreparedVoid=await request(app)
      .post(`/api/v1/bar/ticket-approval-requests/${preparedVoidRequest.body.data.id}/decision`)
      .set('Authorization',`Bearer ${reviewerToken}`)
      .send({decision:'APPROVE',reason:'Approved as preparation wastage'});
    expect(approvedPreparedVoid.status,JSON.stringify(approvedPreparedVoid.body)).toBe(200);
    const preparedVoid=await request(app)
      .post(`/api/v1/bar/tickets/${preparedTicket.body.data.id}/void`)
      .set('Authorization',authorization)
      .send({approvalRequestId:preparedVoidRequest.body.data.id,idempotencyKey:`p594-void-execute-${userId}`});
    expect(preparedVoid.status,JSON.stringify(preparedVoid.body)).toBe(200);
    expect(preparedVoid.body.data.inventoryDisposition).toBe('WASTAGE');
    const [stockAfterWastageVoid,disposition]=await Promise.all([
      pool.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',
        [organisationId,outletId,productId]),
      pool.query(
        `SELECT disposition,line_type,quantity,cost_amount
           FROM bar_ticket_void_disposition_lines
          WHERE void_request_id=(SELECT id FROM bar_ticket_void_requests WHERE ticket_id=$1)
          ORDER BY id`,
        [preparedTicket.body.data.id]
      )
    ]);
    expect(stockAfterWastageVoid.rows[0].quantity_units).toBe(stockBeforeWastageVoid.rows[0].quantity_units);
    expect(disposition.rows).toEqual([{disposition:'WASTAGE',line_type:'PACKAGED',quantity:'1.000',cost_amount:'4.25'}]);

    const openBottleId=randomUUID();
    await pool.query(
      `INSERT INTO open_bottles(id,organisation_id,outlet_id,product_id,bottle_volume_ml,remaining_ml,opened_by,status)
       VALUES($1,$2,$3,$4,750,30,$5,'OPEN')`,
      [openBottleId,organisationId,outletId,productId,userId]
    );
    const pegCheckout=(suffix:string)=>request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send({
      outletId,idempotencyKey:`p594-peg-race-${suffix}-${userId}`,
      ticketNumber:`P594-PEG-${suffix}-${userId.slice(0,8)}`,tableSessionId:sessionId,
      lines:[{productId,lineType:'PEG',quantity:1,volumeMl:30,openBottleId}],
      payments:[],complianceAttestations:attestations
    });
    const pegRace=await Promise.all([pegCheckout('one'),pegCheckout('two')]);
    expect(pegRace.map(result=>result.status).sort()).toEqual([201,409]);
    const bottleAfterRace=await pool.query(
      'SELECT remaining_ml,status FROM open_bottles WHERE id=$1',
      [openBottleId]
    );
    const pegSaleCount=await pool.query(
      `SELECT COUNT(*)::int count,COALESCE(SUM(volume_ml),0)::int volume
         FROM peg_transactions WHERE reference_id IN (
           SELECT id FROM bar_tickets WHERE ticket_number LIKE $1
         ) AND transaction_type='SALE'`,
      [`P594-PEG-%-${userId.slice(0,8)}`]
    );
    expect(bottleAfterRace.rows[0]).toMatchObject({remaining_ml:0,status:'EMPTY'});
    expect(pegSaleCount.rows[0]).toEqual({count:1,volume:30});

    await pool.query(
      'UPDATE stock_balances SET quantity_units=1 WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',
      [organisationId,outletId,productId]
    );
    const packagedCheckout=(suffix:string)=>request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send({
      outletId,idempotencyKey:`p594-stock-race-${suffix}-${userId}`,
      ticketNumber:`P594-STOCK-${suffix}-${userId.slice(0,8)}`,tableSessionId:sessionId,
      lines:[{productId,lineType:'PACKAGED',quantity:1}],
      payments:[],complianceAttestations:attestations
    });
    const stockRace=await Promise.all([packagedCheckout('one'),packagedCheckout('two')]);
    expect(stockRace.map(result=>result.status).sort()).toEqual([201,409]);
    const stockAfterRace=await pool.query(
      'SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',
      [organisationId,outletId,productId]
    );
    expect(stockAfterRace.rows[0].quantity_units).toBe('0.000');

    const shiftOpened=await request(app)
      .post('/api/v1/shifts/open')
      .set('Authorization',authorization)
      .send({outletId,shiftCode:`P594-${userId.slice(0,8)}`,openingCash:100});
    expect(shiftOpened.status,JSON.stringify(shiftOpened.body)).toBe(201);
    const shiftId=shiftOpened.body.data.id as string;
    const shiftPreview=await request(app)
      .get(`/api/v1/shifts/${shiftId}/preview`)
      .set('Authorization',authorization);
    expect(shiftPreview.status,JSON.stringify(shiftPreview.body)).toBe(200);
    expect(shiftPreview.body.data.expectedCash).toBe(100);
    const shiftClosed=await request(app)
      .post(`/api/v1/shifts/${shiftId}/close`)
      .set('Authorization',authorization)
      .send({declaredCash:98,notes:'Counted cash at bar close'});
    expect(shiftClosed.status,JSON.stringify(shiftClosed.body)).toBe(200);
    expect(shiftClosed.body.reconciliation).toEqual({expectedCash:100,declaredCash:98,variance:-2});
    const shiftEvent=await pool.query(
      `SELECT event_type,payload FROM shift_events WHERE shift_id=$1 AND event_type='CLOSED'`,
      [shiftId]
    );
    expect(shiftEvent.rows).toEqual([{
      event_type:'CLOSED',payload:{expectedCash:100,declaredCash:98,variance:-2}
    }]);
  },60_000);
});
