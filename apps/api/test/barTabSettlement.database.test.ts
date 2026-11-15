import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.BAR_TAB_TEST_DATABASE_URL;
const parsedTestDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
const databaseName = parsedTestDatabaseUrl?.pathname.replace(/^\/+/, '').toLowerCase() ?? '';
const isLoopbackHost = ['localhost','127.0.0.1','::1'].includes(parsedTestDatabaseUrl?.hostname ?? '');
if (databaseUrl && (
  !['postgres:','postgresql:'].includes(parsedTestDatabaseUrl?.protocol ?? '')
  || !isLoopbackHost
  || !/(^|_)test($|_)/.test(databaseName)
)) {
  throw new Error('BAR_TAB_TEST_DATABASE_URL must target a local PostgreSQL database whose name contains a test segment');
}
const organisationId = randomUUID();
const outletId = randomUUID();
const userId = randomUUID();
const sessionId = randomUUID();
const transferSessionId = randomUUID();
const mergeTargetSessionId = randomUUID();
const authSessionId = randomUUID();
const ticketId = randomUUID();
const kotId = randomUUID();
const transferTicketId = randomUUID();
const mergeTargetTicketId = randomUUID();
const transferKotId = randomUUID();
const mergeTargetKotId = randomUUID();
const roleCode = 'BAR_OWNER';
const jwtSecret = 'p586-bar-tab-integration-test-secret-0123456789';

let app: Express;
let pool: pg.Pool;
let token: string;

describe.skipIf(!parsedTestDatabaseUrl)('bar tab settlement database integration', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    process.env.JWT_SECRET = jwtSecret;

    const [api, database] = await Promise.all([
      import('../src/app.js'),
      import('../src/db/pool.js')
    ]);
    app = api.app;
    pool = database.pool;

    await pool.query(
      `INSERT INTO organisations(id,name,legal_name,display_name,organisation_type,status,organisation_profile)
       VALUES($1,'P586 test bar','P586 test bar','P586 test bar','BAR_OPERATOR','ACTIVE','BAR_ONLY')`,
      [organisationId]
    );
    await pool.query(
      `INSERT INTO users(id,email,display_name,password_hash,status)
       VALUES($1,$2,'P586 integration user','test-only-hash','ACTIVE')`,
      [userId,`p586-${userId}@integration.invalid`]
    );
    await pool.query(
      `INSERT INTO organisation_memberships(user_id,organisation_id,role_code,status)
       VALUES($1,$2,$3,'ACTIVE')`,
      [userId,organisationId,roleCode]
    );
    await pool.query(
      `INSERT INTO role_permissions(role_code,permission_code)
       VALUES($1,'bar:sell'),($1,'bar:read') ON CONFLICT DO NOTHING`,
      [roleCode]
    );
    await pool.query(
      `INSERT INTO outlets(id,organisation_id,outlet_code,name,operating_mode,state_code,status,outlet_type)
       VALUES($1,$2,$3,'P586 test outlet','BAR_ONLY','KA','ACTIVE','BAR')`,
      [outletId,organisationId,`P586-${userId.slice(0,8)}`]
    );
    await pool.query(
      `INSERT INTO outlet_licences(
         organisation_id,outlet_id,jurisdiction_code,licence_type,licence_number,
         status,verification_status,permitted_activities,permitted_capabilities
       ) VALUES($1,$2,'IN-KA','BAR','P586-TEST-LICENCE','VERIFIED','VERIFIED',ARRAY['BAR_SERVICE'],'[]'::jsonb)`,
      [organisationId,outletId]
    );
    await pool.query(
      `INSERT INTO bar_table_sessions(id,organisation_id,outlet_id,table_label,covers,opened_by)
       VALUES($1,$2,$3,$4,2,$5)`,
      [sessionId,organisationId,outletId,`T-${userId.slice(0,8)}`,userId]
    );
    await pool.query(
      `INSERT INTO bar_tickets(
         id,organisation_id,outlet_id,ticket_number,table_label,table_session_id,status,grand_total,opened_by
       ) VALUES($1,$2,$3,$4,$5,$6,'SENT',100,$7)`,
      [ticketId,organisationId,outletId,`B-${ticketId.slice(0,8)}`,`T-${userId.slice(0,8)}`,sessionId,userId]
    );
    await pool.query(
      `INSERT INTO bar_kot_orders(id,organisation_id,outlet_id,table_session_id,ticket_id,created_by)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [kotId,organisationId,outletId,sessionId,ticketId,userId]
    );
    await pool.query(
      `INSERT INTO bar_table_sessions(id,organisation_id,outlet_id,table_label,covers,opened_by)
       VALUES($1,$2,$3,'Transfer source',2,$5),($4,$2,$3,'Merge target',2,$5)`,
      [transferSessionId,organisationId,outletId,mergeTargetSessionId,userId]
    );
    await pool.query(
      `INSERT INTO bar_tickets(
         id,organisation_id,outlet_id,ticket_number,table_label,table_session_id,status,grand_total,opened_by
       ) VALUES
         ($1,$2,$3,'B-TRANSFER','Transfer source',$4,'SENT',30,$7),
         ($5,$2,$3,'B-MERGE-TARGET','Merge target',$6,'SENT',25,$7)`,
      [transferTicketId,organisationId,outletId,transferSessionId,mergeTargetTicketId,mergeTargetSessionId,userId]
    );
    await pool.query(
      `INSERT INTO bar_kot_orders(id,organisation_id,outlet_id,table_session_id,ticket_id,created_by)
       VALUES($1,$2,$3,$4,$5,$8),($6,$2,$3,$7,$9,$8)`,
      [transferKotId,organisationId,outletId,transferSessionId,transferTicketId,mergeTargetKotId,mergeTargetSessionId,userId,mergeTargetTicketId]
    );
    await pool.query(
      `INSERT INTO auth_sessions(id,token_id,user_id,expires_at)
       VALUES($1,$2,$3,NOW()+INTERVAL '1 hour')`,
      [authSessionId,authSessionId,userId]
    );
    token = jwt.sign({
      sub:userId,sid:authSessionId,email:`p586-${userId}@integration.invalid`,name:'P586 integration user',
      platformAdmin:false,organisationId,roleCode
    },jwtSecret,{expiresIn:'1h'});
  },60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM audit_events WHERE organisation_id=$1',[organisationId]);
    await pool.query('DELETE FROM bar_payment_requests WHERE organisation_id=$1',[organisationId]);
    await pool.query('DELETE FROM bar_payments WHERE organisation_id=$1',[organisationId]);
    await pool.query('DELETE FROM bar_kot_orders WHERE organisation_id=$1',[organisationId]);
    await pool.query('DELETE FROM bar_tickets WHERE organisation_id=$1',[organisationId]);
    await pool.query('DELETE FROM bar_table_sessions WHERE organisation_id=$1',[organisationId]);
    await pool.query('DELETE FROM outlet_licences WHERE organisation_id=$1',[organisationId]);
    await pool.query('DELETE FROM organisation_memberships WHERE organisation_id=$1',[organisationId]);
    await pool.query('DELETE FROM auth_sessions WHERE id=$1',[authSessionId]);
    await pool.query('DELETE FROM outlets WHERE id=$1',[outletId]);
    await pool.query('DELETE FROM organisations WHERE id=$1',[organisationId]);
    await pool.query('DELETE FROM users WHERE id=$1',[userId]);
    await pool.end();
  });

  it('persists partial mixed tenders once, replays idempotently, settles the balance, and closes the table', async () => {
    const authorization = `Bearer ${token}`;
    const pendingKotClose = await request(app)
      .post(`/api/v1/bar/table-sessions/${sessionId}/close`)
      .set('Authorization',authorization)
      .send({reason:'Try closing with an unfinished KOT'});
    expect(pendingKotClose.status).toBe(409);
    expect(pendingKotClose.body.error.code).toBe('KOT_NOT_COMPLETE');

    for (const status of ['ACCEPTED','PREPARING','READY','SERVED']) {
      const transition = await request(app)
        .post(`/api/v1/bar/kot/${kotId}/status`)
        .set('Authorization',authorization)
        .send({status});
      expect(transition.status,JSON.stringify(transition.body)).toBe(200);
      expect(transition.body.data.status).toBe(status);
    }
    const kotAudit = await pool.query(
      `SELECT COUNT(*)::int count FROM audit_events
        WHERE organisation_id=$1 AND entity_id=$2 AND event_type='BAR_KOT_STATUS_CHANGED'`,
      [organisationId,kotId]
    );
    expect(kotAudit.rows[0].count).toBe(4);

    const initialRequest = {
      idempotencyKey:'p586-partial-payment-request-0001',
      payments:[
        {method:'UPI',amount:20,reference:'upi-test-1'},
        {method:'CASH',amount:10}
      ]
    };
    const first = await request(app)
      .post(`/api/v1/bar/tickets/${ticketId}/payments`)
      .set('Authorization',authorization)
      .send(initialRequest);
    expect(first.status,JSON.stringify(first.body)).toBe(201);
    expect(first.body).toMatchObject({paidTotal:30,remainingDue:70,status:'PART_PAID',idempotentReplay:false});
    expect(first.body.data).toHaveLength(2);

    const paymentRows = await pool.query(
      'SELECT method,amount FROM bar_payments WHERE ticket_id=$1 ORDER BY method',
      [ticketId]
    );
    expect(paymentRows.rows).toEqual([
      {method:'CASH',amount:'10.00'},
      {method:'UPI',amount:'20.00'}
    ]);
    const auditRows = await pool.query(
      `SELECT COUNT(*)::int count FROM audit_events
        WHERE organisation_id=$1 AND entity_id=$2 AND event_type='BAR_TAB_PAYMENT_RECORDED'`,
      [organisationId,ticketId]
    );
    expect(auditRows.rows[0].count).toBe(1);

    const held = await request(app)
      .post(`/api/v1/bar/table-sessions/${sessionId}/status`)
      .set('Authorization',authorization)
      .send({status:'HELD',reason:'Customer stepped away temporarily'});
    expect(held.status).toBe(200);
    expect(held.body.data.status).toBe('HELD');
    const normalList = await request(app)
      .get(`/api/v1/bar/table-sessions?outletId=${outletId}`)
      .set('Authorization',authorization);
    expect(normalList.status).toBe(200);
    expect(normalList.body.data).not.toEqual(expect.arrayContaining([
      expect.objectContaining({id:sessionId})
    ]));
    const heldList = await request(app)
      .get(`/api/v1/bar/table-sessions?outletId=${outletId}&includeHeld=true`)
      .set('Authorization',authorization);
    expect(heldList.status).toBe(200);
    expect(heldList.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({id:sessionId,status:'HELD'})
    ]));
    const heldFields = await pool.query('SELECT held_at,held_by FROM bar_table_sessions WHERE id=$1',[sessionId]);
    expect(heldFields.rows[0].held_at).not.toBeNull();
    expect(heldFields.rows[0].held_by).toBe(userId);

    const reopened = await request(app)
      .post(`/api/v1/bar/table-sessions/${sessionId}/status`)
      .set('Authorization',authorization)
      .send({status:'OPEN',reason:'Customer returned to continue service'});
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.status).toBe('OPEN');
    const heldAgain = await request(app)
      .post(`/api/v1/bar/table-sessions/${sessionId}/status`)
      .set('Authorization',authorization)
      .send({status:'HELD',reason:'Pause service before settlement'});
    expect(heldAgain.status).toBe(200);
    const holdAudit = await pool.query(
      `SELECT event_type,COUNT(*)::int count FROM audit_events
        WHERE organisation_id=$1 AND entity_id=$2
          AND event_type IN ('BAR_TABLE_SESSION_HELD','BAR_TABLE_SESSION_REOPENED')
        GROUP BY event_type ORDER BY event_type`,
      [organisationId,sessionId]
    );
    expect(holdAudit.rows).toEqual([
      {event_type:'BAR_TABLE_SESSION_HELD',count:2},
      {event_type:'BAR_TABLE_SESSION_REOPENED',count:1}
    ]);

    const replay = await request(app)
      .post(`/api/v1/bar/tickets/${ticketId}/payments`)
      .set('Authorization',authorization)
      .send(initialRequest);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({paidTotal:30,remainingDue:70,status:'PART_PAID',idempotentReplay:true});
    const countAfterReplay = await pool.query('SELECT COUNT(*)::int count FROM bar_payments WHERE ticket_id=$1',[ticketId]);
    expect(countAfterReplay.rows[0].count).toBe(2);

    const changedReplay = await request(app)
      .post(`/api/v1/bar/tickets/${ticketId}/payments`)
      .set('Authorization',authorization)
      .send({...initialRequest,payments:[{method:'CASH',amount:30}]});
    expect(changedReplay.status).toBe(409);
    expect(changedReplay.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');

    const excessive = await request(app)
      .post(`/api/v1/bar/tickets/${ticketId}/payments`)
      .set('Authorization',authorization)
      .send({idempotencyKey:'p586-overpayment-request-0001',payments:[{method:'CASH',amount:70.01}]});
    expect(excessive.status).toBe(409);
    expect(excessive.body.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');

    const blockedClose = await request(app)
      .post(`/api/v1/bar/table-sessions/${sessionId}/close`)
      .set('Authorization',authorization)
      .send({reason:'Try closing with a balance due'});
    expect(blockedClose.status).toBe(409);
    expect(blockedClose.body.error.code).toBe('TAB_BALANCE_DUE');

    const finalPayment = await request(app)
      .post(`/api/v1/bar/tickets/${ticketId}/payments`)
      .set('Authorization',authorization)
      .send({idempotencyKey:'p586-final-payment-request-0001',payments:[{method:'CARD',amount:70,reference:'card-test-1'}]});
    expect(finalPayment.status).toBe(201);
    expect(finalPayment.body).toMatchObject({paidTotal:100,remainingDue:0,status:'PAID'});
    const settledTicket = await pool.query('SELECT status,closed_at FROM bar_tickets WHERE id=$1',[ticketId]);
    expect(settledTicket.rows[0].status).toBe('PAID');
    expect(settledTicket.rows[0].closed_at).not.toBeNull();

    const closed = await request(app)
      .post(`/api/v1/bar/table-sessions/${sessionId}/close`)
      .set('Authorization',authorization)
      .send({reason:'P586 integration settlement complete'});
    expect(closed.status).toBe(200);
    expect(closed.body.data.status).toBe('CLOSED');
    const closeAudit = await pool.query(
      `SELECT COUNT(*)::int count FROM audit_events
        WHERE organisation_id=$1 AND entity_id=$2 AND event_type='BAR_TABLE_SESSION_CLOSED'`,
      [organisationId,sessionId]
    );
    expect(closeAudit.rows[0].count).toBe(1);
    const finalSession = await pool.query('SELECT status,held_at,held_by,reopened_at,reopened_by FROM bar_table_sessions WHERE id=$1',[sessionId]);
    expect(finalSession.rows[0]).toMatchObject({status:'CLOSED',held_by:userId,reopened_by:userId});
    expect(finalSession.rows[0].reopened_at).not.toBeNull();
  },60_000);

  it('transfers and merges open table sessions with their tickets and KOTs', async () => {
    const authorization = `Bearer ${token}`;
    const transfer = await request(app)
      .post(`/api/v1/bar/table-sessions/${transferSessionId}/transfer`)
      .set('Authorization',authorization)
      .send({tableLabel:'Transfer destination',reason:'Guests moved to the patio'});
    expect(transfer.status,JSON.stringify(transfer.body)).toBe(200);
    expect(transfer.body.data.table_label).toBe('Transfer destination');
    const transferredTicket = await pool.query(
      'SELECT table_label,table_session_id FROM bar_tickets WHERE id=$1',
      [transferTicketId]
    );
    expect(transferredTicket.rows[0]).toMatchObject({
      table_label:'Transfer destination',
      table_session_id:transferSessionId
    });

    const merge = await request(app)
      .post(`/api/v1/bar/table-sessions/${transferSessionId}/merge`)
      .set('Authorization',authorization)
      .send({targetSessionId:mergeTargetSessionId,reason:'Combine the party at one table'});
    expect(merge.status,JSON.stringify(merge.body)).toBe(200);
    expect(merge.body.data).toMatchObject({
      mergedSessionId:transferSessionId,
      targetSessionId:mergeTargetSessionId,
      tableLabel:'Merge target'
    });

    const source = await pool.query('SELECT status FROM bar_table_sessions WHERE id=$1',[transferSessionId]);
    const target = await pool.query(
      `SELECT s.status,s.covers,
         COALESCE(SUM(t.grand_total),0) billed_total,
         COUNT(t.id)::int ticket_count
       FROM bar_table_sessions s
       LEFT JOIN bar_tickets t ON t.table_session_id=s.id AND t.status<>'VOIDED'
       WHERE s.id=$1 GROUP BY s.id`,
      [mergeTargetSessionId]
    );
    expect(source.rows[0].status).toBe('CLOSED');
    expect(target.rows[0]).toMatchObject({
      status:'OPEN',
      covers:4,
      billed_total:'55.00',
      ticket_count:2
    });

    const moved = await pool.query(
      `SELECT t.table_session_id,t.table_label,k.table_session_id AS kot_session_id
       FROM bar_tickets t JOIN bar_kot_orders k ON k.ticket_id=t.id
       WHERE t.id=$1`,
      [transferTicketId]
    );
    expect(moved.rows[0]).toMatchObject({
      table_session_id:mergeTargetSessionId,
      table_label:'Merge target',
      kot_session_id:mergeTargetSessionId
    });
    const mergeAudit = await pool.query(
      `SELECT COUNT(*)::int count FROM audit_events
       WHERE organisation_id=$1 AND entity_id=$2 AND event_type='BAR_TABLE_SESSIONS_MERGED'`,
      [organisationId,mergeTargetSessionId]
    );
    expect(mergeAudit.rows[0].count).toBe(1);
  });
});
