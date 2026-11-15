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
const secondaryOutletId = randomUUID();
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
       VALUES($1,'bar:sell'),($1,'bar:read'),($1,'bar:refund'),($1,'shift:manage'),($1,'shift:read'),
             ($1,'inventory:read'),($1,'inventory:receive'),($1,'inventory:adjust'),
             ($1,'catalogue:read'),($1,'catalogue:manage'),($1,'peg:sell'),
             ($1,'procurement:read'),($1,'procurement:manage'),($1,'procurement:approve'),
             ('BAR_MANAGER','inventory:adjust'),('BAR_MANAGER','procurement:approve') ON CONFLICT DO NOTHING`,
      [roleCode]
    );
    await pool.query(
      `INSERT INTO outlets(id,organisation_id,outlet_code,name,operating_mode,state_code,status,outlet_type)
       VALUES($1,$2,$3,'P586 checkout test outlet','BAR_ONLY','KA','ACTIVE','BAR'),
             ($4,$2,$5,'P586 secondary test outlet','BAR_ONLY','KA','ACTIVE','BAR')`,
      [outletId,organisationId,`P586-CHECKOUT-${userId.slice(0,8)}`,secondaryOutletId,`P586-SECOND-${userId.slice(0,8)}`]
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

    const modifierGroup=await request(app).post('/api/v1/bar/modifiers')
      .set('Authorization',authorization)
      .send({
        productId:secondaryProductId,name:'P586 modifier',minSelections:1,maxSelections:1,
        options:[{name:'Extra garnish',priceDelta:2,ingredientProductId:productId,ingredientQuantity:0.1}]
      });
    expect(modifierGroup.status,JSON.stringify(modifierGroup.body)).toBe(201);
    const savedModifier=await pool.query(
      'SELECT id FROM bar_modifier_options WHERE group_id=$1 ORDER BY id LIMIT 1',[modifierGroup.body.data.id]
    );
    const productStockBeforeModifier=await pool.query(
      'SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',
      [organisationId,outletId,productId]
    );
    const modifierTicket=await request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send({
      outletId,idempotencyKey:`p596-modifier-${userId}`,
      ticketNumber:`P596-MODIFIER-${userId.slice(0,8)}`,tableSessionId:sessionId,
      lines:[{productId:secondaryProductId,lineType:'PACKAGED',quantity:1,modifierOptionIds:[savedModifier.rows[0].id]}],
      payments:[],complianceAttestations:attestations
    });
    expect(modifierTicket.status,JSON.stringify(modifierTicket.body)).toBe(201);
    expect(modifierTicket.body.data.grand_total).toBe('12.00');
    const modifierTicketRead=await request(app).get(`/api/v1/bar/tickets/${modifierTicket.body.data.id}`)
      .set('Authorization',authorization);
    expect(modifierTicketRead.status).toBe(200);
    expect(modifierTicketRead.body.data.lines[0].modifiers).toEqual([
      expect.objectContaining({
        optionId:savedModifier.rows[0].id,name:'Extra garnish',priceDelta:2,substitutesProductId:null
      })
    ]);
    const modifierApproval=await request(app).post(`/api/v1/bar/tickets/${modifierTicket.body.data.id}/approval-requests`)
      .set('Authorization',authorization)
      .send({type:'VOID',idempotencyKey:`p596-modifier-void-approval-${userId}`,reason:'Modifier ticket cancelled before preparation'});
    expect(modifierApproval.status,JSON.stringify(modifierApproval.body)).toBe(201);
    const modifierApprovalDecision=await request(app)
      .post(`/api/v1/bar/ticket-approval-requests/${modifierApproval.body.data.id}/decision`)
      .set('Authorization',`Bearer ${reviewerToken}`)
      .send({decision:'APPROVE',reason:'Approved before preparation'});
    expect(modifierApprovalDecision.status,JSON.stringify(modifierApprovalDecision.body)).toBe(200);
    const modifierVoid=await request(app).post(`/api/v1/bar/tickets/${modifierTicket.body.data.id}/void`)
      .set('Authorization',authorization)
      .send({approvalRequestId:modifierApproval.body.data.id,idempotencyKey:`p596-modifier-void-${userId}`});
    expect(modifierVoid.status,JSON.stringify(modifierVoid.body)).toBe(200);
    const [productStockAfterModifier,modifierConsumptionCount]=await Promise.all([
      pool.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',[organisationId,outletId,productId]),
      pool.query('SELECT COUNT(*)::int count FROM bar_ticket_modifier_consumptions WHERE modifier_id IN (SELECT id FROM bar_ticket_line_modifiers WHERE ticket_line_id IN (SELECT id FROM bar_ticket_lines WHERE ticket_id=$1))',[modifierTicket.body.data.id])
    ]);
    const modifierVoidMovements=await pool.query(
      'SELECT movement_type,reference_type,quantity_units FROM stock_movements WHERE reference_id=$1 AND product_id=$2 ORDER BY created_at,id',
      [modifierTicket.body.data.id,productId]
    );
    expect(productStockAfterModifier.rows[0].quantity_units).toBe(productStockBeforeModifier.rows[0].quantity_units);
    expect(modifierConsumptionCount.rows[0].count).toBe(1);
    expect(modifierVoidMovements.rows).toEqual([
      {movement_type:'SALE',reference_type:'BAR_MODIFIER',quantity_units:'0.100'},
      {movement_type:'RETURN',reference_type:'BAR_TICKET_VOID_MODIFIER',quantity_units:'0.100'}
    ]);
    const deactivateModifier=await request(app)
      .patch(`/api/v1/bar/modifier-groups/${modifierGroup.body.data.id}/status`)
      .set('Authorization',authorization).send({status:'INACTIVE'});
    expect(deactivateModifier.status,JSON.stringify(deactivateModifier.body)).toBe(200);

    const replacementProductId=randomUUID();
    const replacementCostLayerId=randomUUID();
    await pool.query(
      `INSERT INTO products(id,organisation_id,sku,name,product_type,pack_size_ml,abv,status)
       VALUES($1,$2,$3,'P597 replacement ingredient','OTHER',750,0,'ACTIVE')`,
      [replacementProductId,organisationId,`P597-${userId.slice(0,8)}`]
    );
    await pool.query(
      `INSERT INTO stock_balances(organisation_id,outlet_id,product_id,quantity_units)
       VALUES($1,$2,$3,5)`,
      [organisationId,outletId,replacementProductId]
    );
    await pool.query(
      `INSERT INTO inventory_batches(organisation_id,outlet_id,product_id,batch_number,received_units,remaining_units,created_by)
       VALUES($1,$2,$3,$4,5,5,$5)`,
      [organisationId,outletId,replacementProductId,`P597-BATCH-${userId.slice(0,8)}`,userId]
    );
    await pool.query(
      `INSERT INTO inventory_cost_layers(id,organisation_id,outlet_id,product_id,source_type,source_id,source_line_id,
         received_units,remaining_units,unit_cost)
       VALUES($1,$2,$3,$4,'OPENING',$5,$6,5,5,2)`,
      [replacementCostLayerId,organisationId,outletId,replacementProductId,randomUUID(),randomUUID()]
    );
    const substitutionRecipe=await request(app).post('/api/v1/bar/recipes')
      .set('Authorization',authorization)
      .send({productId:secondaryProductId,yieldQuantity:1,lines:[{ingredientProductId:productId,quantity:0.25}]});
    expect(substitutionRecipe.status,JSON.stringify(substitutionRecipe.body)).toBe(201);
    const substitutionRecipeActivation=await request(app)
      .post(`/api/v1/bar/recipes/${substitutionRecipe.body.data.id}/activate`)
      .set('Authorization',authorization).send({});
    expect(substitutionRecipeActivation.status,JSON.stringify(substitutionRecipeActivation.body)).toBe(200);
    const substitutionGroup=await request(app).post('/api/v1/bar/modifiers')
      .set('Authorization',authorization)
      .send({
        productId:secondaryProductId,name:'P597 spirit substitution',
        substitutesProductId:productId,minSelections:1,maxSelections:1,
        options:[{name:'Alternative spirit',priceDelta:0,ingredientProductId:replacementProductId,ingredientQuantity:0.25}]
      });
    expect(substitutionGroup.status,JSON.stringify(substitutionGroup.body)).toBe(201);
    const substitutionOption=await pool.query(
      'SELECT id FROM bar_modifier_options WHERE group_id=$1',[substitutionGroup.body.data.id]
    );
    const [baseIngredientBefore,replacementBefore]=await Promise.all([
      pool.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',[organisationId,outletId,productId]),
      pool.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',[organisationId,outletId,replacementProductId])
    ]);
    const substitutionTicket=await request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send({
      outletId,idempotencyKey:`p597-substitution-${userId}`,
      ticketNumber:`P597-SUB-${userId.slice(0,8)}`,tableSessionId:sessionId,
      lines:[{productId:secondaryProductId,lineType:'PACKAGED',quantity:1,modifierOptionIds:[substitutionOption.rows[0].id]}],
      payments:[],complianceAttestations:attestations
    });
    expect(substitutionTicket.status,JSON.stringify(substitutionTicket.body)).toBe(201);
    const [baseIngredientAfter,replacementAfter,substitutionSnapshot]=await Promise.all([
      pool.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',[organisationId,outletId,productId]),
      pool.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',[organisationId,outletId,replacementProductId]),
      pool.query('SELECT substitutes_product_id,ingredient_product_id,ingredient_quantity FROM bar_ticket_line_modifiers WHERE ticket_line_id IN (SELECT id FROM bar_ticket_lines WHERE ticket_id=$1)',[substitutionTicket.body.data.id])
    ]);
    expect(baseIngredientAfter.rows[0].quantity_units).toBe(baseIngredientBefore.rows[0].quantity_units);
    expect(Number(replacementAfter.rows[0].quantity_units)).toBe(Number(replacementBefore.rows[0].quantity_units)-0.25);
    expect(substitutionSnapshot.rows).toEqual([{
      substitutes_product_id:productId,ingredient_product_id:replacementProductId,ingredient_quantity:'0.250'
    }]);
    const substitutionApproval=await request(app).post(`/api/v1/bar/tickets/${substitutionTicket.body.data.id}/approval-requests`)
      .set('Authorization',authorization)
      .send({type:'VOID',idempotencyKey:`p597-sub-void-approval-${userId}`,reason:'Substitution ticket cancelled before preparation'});
    expect(substitutionApproval.status,JSON.stringify(substitutionApproval.body)).toBe(201);
    const substitutionApprovalDecision=await request(app)
      .post(`/api/v1/bar/ticket-approval-requests/${substitutionApproval.body.data.id}/decision`)
      .set('Authorization',`Bearer ${reviewerToken}`)
      .send({decision:'APPROVE',reason:'Approved before preparation'});
    expect(substitutionApprovalDecision.status,JSON.stringify(substitutionApprovalDecision.body)).toBe(200);
    const substitutionVoid=await request(app).post(`/api/v1/bar/tickets/${substitutionTicket.body.data.id}/void`)
      .set('Authorization',authorization)
      .send({approvalRequestId:substitutionApproval.body.data.id,idempotencyKey:`p597-sub-void-${userId}`});
    expect(substitutionVoid.status,JSON.stringify(substitutionVoid.body)).toBe(200);
    const replacementAfterVoid=await pool.query(
      'SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',
      [organisationId,outletId,replacementProductId]
    );
    expect(replacementAfterVoid.rows[0].quantity_units).toBe(replacementBefore.rows[0].quantity_units);
    const deactivateSubstitution=await request(app)
      .patch(`/api/v1/bar/modifier-groups/${substitutionGroup.body.data.id}/status`)
      .set('Authorization',authorization).send({status:'INACTIVE'});
    expect(deactivateSubstitution.status,JSON.stringify(deactivateSubstitution.body)).toBe(200);

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

    const wastageBottleId=randomUUID();
    await pool.query(
      `INSERT INTO open_bottles(id,organisation_id,outlet_id,product_id,bottle_volume_ml,remaining_ml,opened_by,status)
       VALUES($1,$2,$3,$4,750,60,$5,'OPEN')`,
      [wastageBottleId,organisationId,outletId,productId,userId]
    );
    const bottleWastage={
      outletId,openBottleId:wastageBottleId,volumeMl:10,type:'WASTAGE',
      notes:'Measured open bottle spillage'
    };
    const bottleWastageKey=`p596-bottle-waste-${userId}`;
    const bottleWastageFirst=await request(app).post('/api/v1/bar/peg-transactions')
      .set('Authorization',authorization).set('Idempotency-Key',bottleWastageKey).send(bottleWastage);
    expect(bottleWastageFirst.status,JSON.stringify(bottleWastageFirst.body)).toBe(201);
    const bottleWastageReplay=await request(app).post('/api/v1/bar/peg-transactions')
      .set('Authorization',authorization).set('Idempotency-Key',bottleWastageKey).send(bottleWastage);
    expect(bottleWastageReplay.status).toBe(200);
    expect(bottleWastageReplay.body).toMatchObject({remainingMl:50,replayed:true});
    const conflictingBottleWastage=await request(app).post('/api/v1/bar/peg-transactions')
      .set('Authorization',authorization).set('Idempotency-Key',bottleWastageKey)
      .send({...bottleWastage,volumeMl:20});
    expect(conflictingBottleWastage.status).toBe(409);
    expect(conflictingBottleWastage.body.error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');

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

    const recipeDraft=await request(app)
      .post('/api/v1/bar/recipes')
      .set('Authorization',authorization)
      .send({productId:secondaryProductId,yieldQuantity:1,lines:[{ingredientProductId:productId,quantity:0.25}]});
    expect(recipeDraft.status,JSON.stringify(recipeDraft.body)).toBe(201);
    const activatedRecipe=await request(app)
      .post(`/api/v1/bar/recipes/${recipeDraft.body.data.id}/activate`)
      .set('Authorization',authorization)
      .send({});
    expect(activatedRecipe.status,JSON.stringify(activatedRecipe.body)).toBe(200);
    const hiddenMenuItem=await request(app)
      .put('/api/v1/bar/menu/availability')
      .set('Authorization',authorization)
      .send({outletId,productId:secondaryProductId,measureType:'PACKAGED',isAvailable:false,reason:'Sold out for recipe verification'});
    expect(hiddenMenuItem.status,JSON.stringify(hiddenMenuItem.body)).toBe(200);
    await pool.query(
      'UPDATE stock_balances SET quantity_units=0.300 WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',
      [organisationId,outletId,productId]
    );
    const unavailableRecipeCheckout=await request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send({
      outletId,idempotencyKey:`p595-menu-unavailable-${userId}`,
      ticketNumber:`P595-MENU-HIDDEN-${userId.slice(0,8)}`,
      lines:[{productId:secondaryProductId,lineType:'PACKAGED',quantity:1}],
      payments:[{method:'CASH',amount:10}],complianceAttestations:attestations
    });
    expect(unavailableRecipeCheckout.status).toBe(409);
    expect(unavailableRecipeCheckout.body.error.code).toBe('MENU_ITEM_UNAVAILABLE');
    const menuEnabled=await request(app)
      .put('/api/v1/bar/menu/availability')
      .set('Authorization',authorization)
      .send({outletId,productId:secondaryProductId,measureType:'PACKAGED',isAvailable:true});
    expect(menuEnabled.status,JSON.stringify(menuEnabled.body)).toBe(200);
    const recipeCheckout=await request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send({
      outletId,idempotencyKey:`p595-recipe-checkout-${userId}`,
      ticketNumber:`P595-RECIPE-${userId.slice(0,8)}`,
      lines:[{productId:secondaryProductId,lineType:'PACKAGED',quantity:1}],
      payments:[{method:'CASH',amount:10}],complianceAttestations:attestations
    });
    expect(recipeCheckout.status,JSON.stringify(recipeCheckout.body)).toBe(201);
    const [recipeStock,recipeEvidence]=await Promise.all([
      pool.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',[organisationId,outletId,productId]),
      pool.query(
        `SELECT c.quantity_units,m.reference_type,m.movement_type
           FROM bar_ticket_recipe_consumptions c
           JOIN stock_movements m ON m.id=c.stock_movement_id
          WHERE c.ticket_line_id IN (SELECT id FROM bar_ticket_lines WHERE ticket_id=$1)`,
        [recipeCheckout.body.data.id]
      )
    ]);
    expect(recipeStock.rows[0].quantity_units).toBe('0.050');
    expect(recipeEvidence.rows).toEqual([{quantity_units:'0.250',reference_type:'BAR_RECIPE',movement_type:'SALE'}]);
    await pool.query(
      'UPDATE stock_balances SET quantity_units=0.300 WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',
      [organisationId,outletId,productId]
    );
    const recipeTab=await request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send({
      outletId,idempotencyKey:`p595-recipe-tab-${userId}`,
      ticketNumber:`P595-RECIPE-TAB-${userId.slice(0,8)}`,tableSessionId:sessionId,
      lines:[{productId:secondaryProductId,lineType:'PACKAGED',quantity:1}],
      payments:[],complianceAttestations:attestations
    });
    expect(recipeTab.status,JSON.stringify(recipeTab.body)).toBe(201);
    const recipeVoidRequest=await request(app)
      .post(`/api/v1/bar/tickets/${recipeTab.body.data.id}/approval-requests`)
      .set('Authorization',authorization)
      .send({type:'VOID',idempotencyKey:`p595-recipe-void-approval-${userId}`,reason:'Customer cancelled before preparation'});
    expect(recipeVoidRequest.status,JSON.stringify(recipeVoidRequest.body)).toBe(201);
    const recipeVoidApproved=await request(app)
      .post(`/api/v1/bar/ticket-approval-requests/${recipeVoidRequest.body.data.id}/decision`)
      .set('Authorization',`Bearer ${reviewerToken}`)
      .send({decision:'APPROVE',reason:'Approved by a separate manager'});
    expect(recipeVoidApproved.status,JSON.stringify(recipeVoidApproved.body)).toBe(200);
    const recipeTabVoid=await request(app)
      .post(`/api/v1/bar/tickets/${recipeTab.body.data.id}/void`)
      .set('Authorization',authorization)
      .send({approvalRequestId:recipeVoidRequest.body.data.id,idempotencyKey:`p595-recipe-void-${userId}`});
    expect(recipeTabVoid.status,JSON.stringify(recipeTabVoid.body)).toBe(200);
    const recipeStockAfterVoid=await pool.query(
      'SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',
      [organisationId,outletId,productId]
    );
    expect(recipeStockAfterVoid.rows[0].quantity_units).toBe('0.300');
    await pool.query(
      'UPDATE stock_balances SET quantity_units=1.000 WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',
      [organisationId,outletId,productId]
    );
    const expiredBatch=await pool.query(
      `INSERT INTO inventory_batches(organisation_id,outlet_id,product_id,batch_number,received_units,remaining_units,expiry_date,created_by)
       VALUES($1,$2,$3,$4,1.000,1.000,CURRENT_DATE-1,$5) RETURNING id`,
      [organisationId,outletId,productId,`P595-EXPIRED-${userId.slice(0,8)}`,userId]
    );
    const expiredBatchCheckout=await request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send({
      outletId,idempotencyKey:`p595-expired-batch-${userId}`,
      ticketNumber:`P595-EXPIRED-${userId.slice(0,8)}`,
      lines:[{productId,lineType:'PACKAGED',quantity:1}],
      payments:[{method:'CASH',amount:10}],complianceAttestations:attestations
    });
    expect(expiredBatchCheckout.status).toBe(409);
    expect(expiredBatchCheckout.body.error.code).toBe('INVENTORY_BATCH_INSUFFICIENT');
    await pool.query('UPDATE inventory_batches SET remaining_units=0 WHERE id=$1',[expiredBatch.rows[0].id]);
    const openingMovement=await pool.query(
      `INSERT INTO stock_movements(organisation_id,outlet_id,product_id,movement_type,quantity_units,reference_type,reference_id,created_by,idempotency_key,request_fingerprint)
       VALUES($1,$2,$3,'RECEIPT',1.000,'P595_TEST_OPENING',$4,$5,$6,NULL) RETURNING id`,
      [organisationId,outletId,productId,randomUUID(),userId,`p595-fefo-opening-${userId}`]
    );
    const freshBatch=await pool.query(
      `INSERT INTO inventory_batches(organisation_id,outlet_id,product_id,batch_number,received_units,remaining_units,expiry_date,created_by)
       VALUES($1,$2,$3,$4,1.000,1.000,CURRENT_DATE+30,$5) RETURNING id`,
      [organisationId,outletId,productId,`P595-FRESH-${userId.slice(0,8)}`,userId]
    );
    await pool.query(
      `INSERT INTO inventory_batch_movements(organisation_id,outlet_id,product_id,batch_id,stock_movement_id,movement_type,direction,quantity_units)
       VALUES($1,$2,$3,$4,$5,'RECEIPT','INCREASE',1.000)`,
      [organisationId,outletId,productId,freshBatch.rows[0].id,openingMovement.rows[0].id]
    );
    const freshBatchCheckout=await request(app).post('/api/v1/bar/checkout').set('Authorization',authorization).send({
      outletId,idempotencyKey:`p595-fefo-sale-${userId}`,
      ticketNumber:`P595-FEFO-${userId.slice(0,8)}`,
      lines:[{productId,lineType:'PACKAGED',quantity:1}],
      payments:[{method:'CASH',amount:10}],complianceAttestations:attestations
    });
    expect(freshBatchCheckout.status,JSON.stringify(freshBatchCheckout.body)).toBe(201);
    const fefoRemaining=await pool.query('SELECT remaining_units FROM inventory_batches WHERE id=$1',[freshBatch.rows[0].id]);
    expect(fefoRemaining.rows[0].remaining_units).toBe('0.000');
    const stocktake=await request(app).post('/api/v1/inventory/stocktakes')
      .set('Authorization',authorization).send({outletId,notes:'P595 batch count'});
    expect(stocktake.status,JSON.stringify(stocktake.body)).toBe(201);
    const countUpdate=await request(app)
      .put(`/api/v1/inventory/stocktakes/${stocktake.body.data.id}/batches/${freshBatch.rows[0].id}`)
      .set('Authorization',authorization).send({countedUnits:0.04});
    expect(countUpdate.status,JSON.stringify(countUpdate.body)).toBe(200);
    const countSubmit=await request(app)
      .post(`/api/v1/inventory/stocktakes/${stocktake.body.data.id}/submit`)
      .set('Authorization',authorization).send({});
    expect(countSubmit.status).toBe(200);
    const stocktakeSelfApproval=await request(app)
      .post(`/api/v1/inventory/stocktakes/${stocktake.body.data.id}/approve`)
      .set('Authorization',authorization).send({reason:'Count completed and reviewed'});
    expect(stocktakeSelfApproval.status).toBe(409);
    expect(stocktakeSelfApproval.body.error.code).toBe('STOCKTAKE_SELF_APPROVAL');
    const countApproval=await request(app)
      .post(`/api/v1/inventory/stocktakes/${stocktake.body.data.id}/approve`)
      .set('Authorization',`Bearer ${reviewerToken}`).send({reason:'Counted remaining lot stock'});
    expect(countApproval.status,JSON.stringify(countApproval.body)).toBe(200);
    const [countedBatch,countedBalance]=await Promise.all([
      pool.query('SELECT remaining_units FROM inventory_batches WHERE id=$1',[freshBatch.rows[0].id]),
      pool.query('SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',[organisationId,outletId,productId])
    ]);
    expect(countedBatch.rows[0].remaining_units).toBe('0.040');
    expect(countedBalance.rows[0].quantity_units).toBe('0.040');
    const expiredWastageBatch=await pool.query(
      `INSERT INTO inventory_batches(organisation_id,outlet_id,product_id,batch_number,received_units,remaining_units,expiry_date,created_by)
       VALUES($1,$2,$3,$4,0.010,0.010,CURRENT_DATE-1,$5) RETURNING id`,
      [organisationId,outletId,productId,`P595-WASTE-${userId.slice(0,8)}`,userId]
    );
    await pool.query(
      'UPDATE stock_balances SET quantity_units=quantity_units+0.010 WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',
      [organisationId,outletId,productId]
    );
    const wastageRequest=await request(app).post('/api/v1/inventory/wastage')
      .set('Authorization',authorization).set('Idempotency-Key',`p595-wastage-${userId}`)
      .send({outletId,productId,quantity:0.01,category:'EXPIRED',reason:'Expired stock removed during inventory control'});
    expect(wastageRequest.status,JSON.stringify(wastageRequest.body)).toBe(201);
    expect(wastageRequest.body).toMatchObject({balance:'0.040',replayed:false,data:{movement_type:'WASTAGE'}});
    const wastageReplay=await request(app).post('/api/v1/inventory/wastage')
      .set('Authorization',authorization).set('Idempotency-Key',`p595-wastage-${userId}`)
      .send({outletId,productId,quantity:0.01,category:'EXPIRED',reason:'Expired stock removed during inventory control'});
    expect(wastageReplay.status,JSON.stringify(wastageReplay.body)).toBe(200);
    expect(wastageReplay.body).toMatchObject({balance:'0.040',replayed:true});
    const conflictingWastageReplay=await request(app).post('/api/v1/inventory/wastage')
      .set('Authorization',authorization).set('Idempotency-Key',`p595-wastage-${userId}`)
      .send({outletId,productId,quantity:0.02,category:'EXPIRED',reason:'Expired stock removed during inventory control'});
    expect(conflictingWastageReplay.status).toBe(409);
    expect(conflictingWastageReplay.body.error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
    const [expiredWastageRemaining,wastageMovementCount]=await Promise.all([
      pool.query('SELECT remaining_units FROM inventory_batches WHERE id=$1',[expiredWastageBatch.rows[0].id]),
      pool.query(
        `SELECT COUNT(*)::int count FROM stock_movements
          WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 AND reference_type='INVENTORY_WASTAGE'`,
        [organisationId,outletId,productId]
      )
    ]);
    expect(expiredWastageRemaining.rows[0].remaining_units).toBe('0.000');
    expect(wastageMovementCount.rows[0].count).toBe(1);
    const secondaryBalanceBefore=await pool.query(
      'SELECT COALESCE(quantity_units,0) quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',
      [organisationId,outletId,secondaryProductId]
    );
    const batchReceipt={
      outletId,productId:secondaryProductId,batchNumber:`P595-API-BATCH-${userId.slice(0,8)}`,
      quantity:0.125,unitCost:1.75,expiryDate:'2099-12-31'
    };
    const batchReceiptFirst=await request(app).post('/api/v1/inventory/batches')
      .set('Authorization',authorization).set('Idempotency-Key',`p595-batch-receipt-${userId}`)
      .send(batchReceipt);
    expect(batchReceiptFirst.status,JSON.stringify(batchReceiptFirst.body)).toBe(201);
    expect(batchReceiptFirst.body.replayed).toBe(false);
    const batchReceiptReplay=await request(app).post('/api/v1/inventory/batches')
      .set('Authorization',authorization).set('Idempotency-Key',`p595-batch-receipt-${userId}`)
      .send(batchReceipt);
    expect(batchReceiptReplay.status,JSON.stringify(batchReceiptReplay.body)).toBe(200);
    expect(batchReceiptReplay.body.replayed).toBe(true);
    const conflictingBatchReceipt=await request(app).post('/api/v1/inventory/batches')
      .set('Authorization',authorization).set('Idempotency-Key',`p595-batch-receipt-${userId}`)
      .send({...batchReceipt,unitCost:1.9});
    expect(conflictingBatchReceipt.status).toBe(409);
    expect(conflictingBatchReceipt.body.error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
    const [secondaryBalanceAfter,batchReceiptCount]=await Promise.all([
      pool.query(
        'SELECT quantity_units FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3',
        [organisationId,outletId,secondaryProductId]
      ),
      pool.query(
        `SELECT COUNT(*)::int count FROM inventory_batch_movements
          WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 AND batch_id=$4 AND movement_type='RECEIPT'`,
        [organisationId,outletId,secondaryProductId,batchReceiptFirst.body.data.id]
      )
    ]);
    expect(Number(secondaryBalanceAfter.rows[0].quantity_units)-Number(secondaryBalanceBefore.rows[0]?.quantity_units??0)).toBeCloseTo(0.125);
    expect(batchReceiptCount.rows[0].count).toBe(1);

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

    const supplier=(await pool.query(
      `INSERT INTO suppliers(organisation_id,name,supplier_code)
       VALUES($1,'P596 test supplier',$2) RETURNING id`,
      [organisationId,`P596-${userId.slice(0,8)}`]
    )).rows[0];
    const purchaseOrder=(await pool.query(
      `INSERT INTO purchase_orders(organisation_id,outlet_id,supplier_id,po_number,status)
       VALUES($1,$2,$3,$4,'RECEIVED') RETURNING id`,
      [organisationId,outletId,supplier.id,`P596-PO-${userId.slice(0,8)}`]
    )).rows[0];
    const purchaseOrderLine=(await pool.query(
      `INSERT INTO purchase_order_lines(purchase_order_id,product_id,ordered_units,received_units,unit_cost)
       VALUES($1,$2,2,2,10) RETURNING id`,
      [purchaseOrder.id,secondaryProductId]
    )).rows[0];
    await pool.query(
      `INSERT INTO purchase_order_approvals(organisation_id,purchase_order_id,status,requested_by,reviewed_by,reviewed_at)
       VALUES($1,$2,'APPROVED',$3,$4,NOW())`,
      [organisationId,purchaseOrder.id,userId,reviewerId]
    );
    const goodsReceipt=(await pool.query(
      `INSERT INTO goods_receipts(organisation_id,outlet_id,purchase_order_id,receipt_number,status,posted_at,posted_by)
       VALUES($1,$2,$3,$4,'POSTED',NOW(),$5) RETURNING id`,
      [organisationId,outletId,purchaseOrder.id,`P596-GRN-${userId.slice(0,8)}`,reviewerId]
    )).rows[0];
    await pool.query(
      `INSERT INTO goods_receipt_lines(goods_receipt_id,purchase_order_line_id,product_id,received_units,accepted_units,rejected_units,unit_cost)
       VALUES($1,$2,$3,1,1,0,10)`,
      [goodsReceipt.id,purchaseOrderLine.id,secondaryProductId]
    );
    const secondGoodsReceipt=(await pool.query(
      `INSERT INTO goods_receipts(organisation_id,outlet_id,purchase_order_id,receipt_number,status,posted_at,posted_by)
       VALUES($1,$2,$3,$4,'POSTED',NOW(),$5) RETURNING id`,
      [organisationId,outletId,purchaseOrder.id,`P596-GRN2-${userId.slice(0,8)}`,reviewerId]
    )).rows[0];
    await pool.query(
      `INSERT INTO goods_receipt_lines(goods_receipt_id,purchase_order_line_id,product_id,received_units,accepted_units,rejected_units,unit_cost)
       VALUES($1,$2,$3,1,1,0,10)`,
      [secondGoodsReceipt.id,purchaseOrderLine.id,secondaryProductId]
    );
    const invoicePayload={
      purchaseOrderId:purchaseOrder.id,invoiceNumber:`P596-INV-${userId.slice(0,8)}`,
      invoiceDate:new Date().toISOString().slice(0,10),
      lines:[{productId:secondaryProductId,quantityUnits:2,unitCost:10}]
    };
    const supplierInvoice=await request(app).post('/api/v1/procurement/supplier-invoices')
      .set('Authorization',authorization).send(invoicePayload);
    expect(supplierInvoice.status,JSON.stringify(supplierInvoice.body)).toBe(201);
    const invoiceMatchKey=`p596-invoice-match-${userId}`;
    const invoiceMatch=await request(app).post(`/api/v1/procurement/supplier-invoices/${supplierInvoice.body.data.id}/match`)
      .set('Authorization',authorization).set('Idempotency-Key',invoiceMatchKey)
      .send({goodsReceiptIds:[goodsReceipt.id,secondGoodsReceipt.id],tolerancePercent:0});
    expect(invoiceMatch.status,JSON.stringify(invoiceMatch.body)).toBe(201);
    expect(invoiceMatch.body.data).toMatchObject({match_status:'MATCHED',quantity_variance:'0.000',value_variance:'0.00'});
    expect(invoiceMatch.body.data).toMatchObject({purchase_order_quantity_variance:'0.000',purchase_order_value_variance:'0.00'});
    const linkedReceipts=await pool.query(
      'SELECT goods_receipt_id FROM supplier_invoice_match_receipts WHERE match_run_id=$1 ORDER BY goods_receipt_id',
      [invoiceMatch.body.data.id]
    );
    expect(linkedReceipts.rows.map((row:{goods_receipt_id:string})=>row.goods_receipt_id).sort())
      .toEqual([goodsReceipt.id,secondGoodsReceipt.id].sort());
    const invoiceMatchReplay=await request(app).post(`/api/v1/procurement/supplier-invoices/${supplierInvoice.body.data.id}/match`)
      .set('Authorization',authorization).set('Idempotency-Key',invoiceMatchKey)
      .send({goodsReceiptIds:[goodsReceipt.id,secondGoodsReceipt.id],tolerancePercent:0});
    expect(invoiceMatchReplay.status).toBe(200);
    expect(invoiceMatchReplay.body.replayed).toBe(true);
    const invoiceMatchConflict=await request(app).post(`/api/v1/procurement/supplier-invoices/${supplierInvoice.body.data.id}/match`)
      .set('Authorization',authorization).set('Idempotency-Key',invoiceMatchKey)
      .send({goodsReceiptIds:[goodsReceipt.id,secondGoodsReceipt.id],tolerancePercent:1});
    expect(invoiceMatchConflict.status).toBe(409);

    const varianceInvoice=await request(app).post('/api/v1/procurement/supplier-invoices')
      .set('Authorization',authorization)
      .send({...invoicePayload,invoiceNumber:`P596-VAR-${userId.slice(0,8)}`,lines:[{productId:secondaryProductId,quantityUnits:1,unitCost:11}]});
    expect(varianceInvoice.status,JSON.stringify(varianceInvoice.body)).toBe(201);
    const varianceMatch=await request(app).post(`/api/v1/procurement/supplier-invoices/${varianceInvoice.body.data.id}/match`)
      .set('Authorization',authorization).set('Idempotency-Key',`p596-invoice-variance-${userId}`)
      .send({goodsReceiptIds:[goodsReceipt.id,secondGoodsReceipt.id],tolerancePercent:0});
    expect(varianceMatch.status,JSON.stringify(varianceMatch.body)).toBe(201);
    expect(varianceMatch.body.data.match_status).toBe('VARIANCE');
    const selfDecision=await request(app).post(`/api/v1/procurement/invoice-match-runs/${varianceMatch.body.data.id}/decision`)
      .set('Authorization',authorization).send({decision:'ACCEPTED',reason:'Self review is blocked'});
    expect(selfDecision.status).toBe(403);
    expect(selfDecision.body.error.code).toBe('MAKER_CHECKER_REQUIRED');
    const varianceDecision=await request(app).post(`/api/v1/procurement/invoice-match-runs/${varianceMatch.body.data.id}/decision`)
      .set('Authorization',`Bearer ${reviewerToken}`)
      .send({decision:'ACCEPTED',reason:'Supplier price variance approved'});
    expect(varianceDecision.status,JSON.stringify(varianceDecision.body)).toBe(200);
    expect(varianceDecision.body.status).toBe('MATCHED');

    const crossOutletReconciliation=await request(app).post('/api/v1/inventory/reconciliation-runs')
      .set('Authorization',authorization).send({outletIds:[outletId,secondaryOutletId],notes:'P596 multi-outlet acceptance'});
    expect(crossOutletReconciliation.status,JSON.stringify(crossOutletReconciliation.body)).toBe(201);
    expect(crossOutletReconciliation.body.data.runs).toHaveLength(2);
    expect(new Set(crossOutletReconciliation.body.data.runs.map((row:{run:{outlet_id:string}})=>row.run.outlet_id)))
      .toEqual(new Set([outletId,secondaryOutletId]));
  },60_000);
});
