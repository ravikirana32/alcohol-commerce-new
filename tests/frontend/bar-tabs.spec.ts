import { expect, test, type Page } from '@playwright/test';

const outletId = '00000000-0000-4000-8000-000000000101';
const sessionId = '00000000-0000-4000-8000-000000000102';
const ticketId = '00000000-0000-4000-8000-000000000103';
const productId = '00000000-0000-4000-8000-000000000104';
const bottleId = '00000000-0000-4000-8000-000000000105';

const profile = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'bar.manager@demo.acp.local',
  displayName: 'Bar Manager',
  isPlatformAdmin: false,
  organisationId: '00000000-0000-4000-8000-000000000201',
  roleCode: 'BAR_MANAGER',
  sessionId: '00000000-0000-4000-8000-000000000202',
  permissions: ['bar:read', 'bar:sell', 'bar:manage', 'bar:billing', 'bar:refund', 'bar:approve']
};

async function authenticate(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('acp_access_token', 'bar-tabs-test-token'));
  await page.route('**/api/health/live', (route) =>
    route.fulfill({ json: { status: 'live', service: 'api' } })
  );
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { data: profile } })
  );
  await page.route('**/api/v1/outlets', (route) =>
    route.fulfill({ json: { data: [{ id: outletId, name: 'Test Bar', outlet_code: 'TB1' }] } })
  );
  await page.route('**/api/v1/bar/menu?outletId=*', route =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route('**/api/v1/bar/ticket-approval-requests?outletId=*',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/kot/stations?outletId=*',route=>route.fulfill({json:{data:[]}}));
  await page.goto('/');
  await expect(page.getByText('Authenticated')).toBeVisible();
}

test('sends an unpaid order round to a table and creates a KOT checkout request', async ({ page }) => {
  await authenticate(page);
  await page.route('**/api/v1/bar/table-sessions?outletId=*', (route) =>
    route.fulfill({ json: { data: [{ id: sessionId, table_label: 'T-04', covers: 2 }] } })
  );
  await page.route('**/api/v1/bar/ticket-approval-requests?outletId=*', route => route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/open-bottles?outletId=*', (route) =>
    route.fulfill({ json: { data: [{
      id: bottleId, product_id: productId, name: 'Test bottle', sku: 'TEST-1',
      remaining_ml: 600, bottle_volume_ml: 750
    }] } })
  );
  await page.route('**/api/v1/outlets/*/prices?channel=*', (route) => {
    const url = new URL(route.request().url());
    const data = url.searchParams.get('channel') === 'BAR_PEG' ? [{
      id: '00000000-0000-4000-8000-000000000106',
      product_id: productId, name: 'Test whisky', sku: 'WHISKY-30',
      channel: 'BAR_PEG', volume_ml: 30, unit_price: 60, tax_rate: 0
    }] : [];
    return route.fulfill({ json: { data } });
  });
  const submitted: Array<Record<string, unknown>> = [];
  await page.route('**/api/v1/bar/checkout', async (route) => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, json: {
      data: { id: ticketId, ticket_number: `B-ROUND-${submitted.length}`, status: 'SENT', grand_total: 60 },
      totals: { grandTotal: 60 }
    } });
  });

  await page.getByRole('button', { name: 'Bar POS' }).click();
  await page.getByLabel('Open table session').selectOption(sessionId);
  await page.getByLabel('Add this order as an unpaid tab round').check();
  await page.getByLabel('Product / service').selectOption('00000000-0000-4000-8000-000000000106');
  await page.getByLabel('Open bottle').selectOption(bottleId);
  await page.getByRole('button', { name: 'Add selected bar item to ticket' }).click();
  await page.getByLabel(/checked acceptable proof of age/).check();
  await page.getByLabel(/Customer is not known or believed to be intoxicated/).check();
  await page.getByLabel(/Customer is not in another prohibited category/).check();
  await page.getByLabel(/Meals or eatables are being supplied/).check();
  await page.getByRole('button', { name: 'Send round to table tab' }).click();

  await expect(page.getByText(/Round added to T-04/)).toBeVisible();
  await page.getByLabel('Open bottle').selectOption(bottleId);
  await page.getByRole('button', { name: 'Add selected bar item to ticket' }).click();
  await page.getByLabel(/checked acceptable proof of age/).check();
  await page.getByLabel(/Customer is not known or believed to be intoxicated/).check();
  await page.getByLabel(/Customer is not in another prohibited category/).check();
  await page.getByLabel(/Meals or eatables are being supplied/).check();
  await page.getByRole('button', { name: 'Send round to table tab' }).click();
  await expect(page.getByText(/Round added to T-04/)).toBeVisible();

  expect(submitted).toHaveLength(2);
  expect(submitted[0]).toMatchObject({
    tableSessionId: sessionId,
    payments: [],
    lines: [{ productId, lineType: 'PEG', quantity: 1, volumeMl: 30, openBottleId: bottleId }],
    complianceAttestations: { ageVerified: true, notIntoxicated: true, noRestrictedCustomer: true, mealProvided: true }
  });
  expect(submitted[1]).toMatchObject({ tableSessionId: sessionId, payments: [], lines: submitted[0].lines });
  expect(submitted[1].idempotencyKey).not.toBe(submitted[0].idempotencyKey);
});

test('retries a partial tab payment with the same idempotency key and preserves the due balance', async ({ page }) => {
  await authenticate(page);
  let session = {
    id: sessionId, table_label: 'T-04', covers: 2, opened_at: new Date().toISOString(),
    ticket_count: 1, billed_total: 40, paid_total: 0, outstanding_total: 40, pending_kot_count: 0,
    tickets: [{
      id: ticketId, ticket_number: 'B-ROUND-1', status: 'SENT',
      grand_total: 40, paid_total: 0, balance_due: 40
    }]
  };
  let closed = false;
  await page.route('**/api/v1/bar/table-sessions?outletId=*', (route) =>
    route.fulfill({ json: { data: closed ? [] : [session] } })
  );
  await page.route('**/api/v1/bar/ticket-approval-requests?outletId=*', route => route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/kot?outletId=*', (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route('**/api/v1/bar/open-bottles?outletId=*', (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route('**/api/v1/bar/bottle-reservations?outletId=*', (route) =>
    route.fulfill({ json: { data: [] } })
  );
  const paymentRequests: Array<Record<string, unknown>> = [];
  await page.route(`**/api/v1/bar/tickets/${ticketId}/payments`, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    paymentRequests.push(body);
    if (paymentRequests.length === 1) {
      await route.fulfill({ status: 503, json: { error: { code: 'TEMPORARY_FAILURE', message: 'Temporary payment error' } } });
      return;
    }
    const paidTotal = paymentRequests.length === 2 ? 10 : 40;
    const remainingDue = 40 - paidTotal;
    session = {
      ...session, paid_total: paidTotal, outstanding_total: remainingDue,
      tickets: [{ ...session.tickets[0], status: remainingDue ? 'PART_PAID' : 'PAID', paid_total: paidTotal, balance_due: remainingDue }]
    };
    await route.fulfill({ status: 201, json: {
      data: [], paidTotal, remainingDue, status: remainingDue ? 'PART_PAID' : 'PAID'
    } });
  });
  await page.route(`**/api/v1/bar/table-sessions/${sessionId}/close`, async (route) => {
    closed = true;
    await route.fulfill({ json: { data: { id: sessionId, status: 'CLOSED' } } });
  });
  page.on('dialog', (dialog) => dialog.accept());

  await page.getByRole('button', { name: 'Tables & KOT' }).click();
  const amount = page.getByLabel(`Payment amount 1 for B-ROUND-1`);
  await amount.fill('10.00');
  await page.getByLabel('Payment method 1 for B-ROUND-1').selectOption('UPI');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByRole('alert')).toContainText('Temporary payment error');
  await page.getByRole('button', { name: 'Retry payment' }).click();

  await expect(page.getByText('Paid ₹10.00 · Due ₹30.00', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close table' })).toBeDisabled();
  await page.getByLabel('Payment amount 1 for B-ROUND-1').fill('20.00');
  await page.getByLabel('Payment method 1 for B-ROUND-1').selectOption('CASH');
  await page.getByRole('button', { name: 'Add tender' }).click();
  await page.getByLabel('Payment amount 2 for B-ROUND-1').fill('10.00');
  await page.getByLabel('Payment method 2 for B-ROUND-1').selectOption('CARD');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByRole('button', { name: 'Close table' })).toBeEnabled();
  await page.getByRole('button', { name: 'Close table' }).click();
  await expect(page.getByText('No open or held table sessions for this outlet.')).toBeVisible();
  expect(closed).toBe(true);
  expect(paymentRequests).toHaveLength(3);
  expect(paymentRequests[0]).toEqual(paymentRequests[1]);
  expect(paymentRequests[0]).toMatchObject({
    payments: [{ method: 'UPI', amount: 10 }]
  });
  expect(String(paymentRequests[0].idempotencyKey)).toHaveLength(36);
  expect(paymentRequests[2]).toMatchObject({
    payments: [{ method: 'CASH', amount: 20 }, { method: 'CARD', amount: 10 }]
  });
});

test('confirms a captured Razorpay tab payment through the server verifier', async ({ page }) => {
  await page.addInitScript(() => {
    type CheckoutOptions = {
      order_id: string;
      handler: (result: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
    };
    type CheckoutWindow = Window & {
      Razorpay?: new (options: CheckoutOptions) => { open: () => void };
    };
    (window as CheckoutWindow).Razorpay = class {
      constructor(private readonly options: CheckoutOptions) {}
      open() {
        this.options.handler({
          razorpay_order_id: this.options.order_id,
          razorpay_payment_id: 'pay_test123',
          razorpay_signature: 'a'.repeat(64)
        });
      }
    };
  });
  await authenticate(page);
  let session = {
    id: sessionId, table_label: 'T-09', covers: 2, opened_at: new Date().toISOString(),
    ticket_count: 1, billed_total: 25.5, paid_total: 0, outstanding_total: 25.5, pending_kot_count: 0,
    tickets: [{
      id: ticketId, ticket_number: 'B-RAZORPAY', status: 'SENT',
      grand_total: 25.5, paid_total: 0, balance_due: 25.5
    }]
  };
  await page.route('**/api/v1/bar/table-sessions?outletId=*', route =>
    route.fulfill({ json: { data: [session] } })
  );
  await page.route('**/api/v1/bar/kot?outletId=*', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/v1/bar/open-bottles?outletId=*', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/v1/bar/bottle-reservations?outletId=*', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/v1/bar/kot/stations?outletId=*', route => route.fulfill({ json: { data: [] } }));
  const createdOrders: Array<Record<string, unknown>> = [];
  await page.route(`**/api/v1/bar/tickets/${ticketId}/razorpay-order`, async route => {
    createdOrders.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, json: { data: {
      localOrderId: '00000000-0000-4000-8000-000000000301',
      orderId: 'order_test123', amount: 2550, currency: 'INR', keyId: 'rzp_test_public'
    } } });
  });
  const verifications: Array<Record<string, unknown>> = [];
  await page.route(`**/api/v1/bar/tickets/${ticketId}/razorpay-verify`, async route => {
    verifications.push(route.request().postDataJSON());
    session = {
      ...session, paid_total: 25.5, outstanding_total: 0,
      tickets: [{ ...session.tickets[0], status: 'PAID', paid_total: 25.5, balance_due: 0 }]
    };
    await route.fulfill({ json: { data: { ticketId, status: 'PAID', paidTotal: 25.5, remainingDue: 0 } } });
  });

  await page.getByRole('button', { name: 'Tables & KOT' }).click();
  await page.getByRole('button', { name: 'Pay via Razorpay' }).click();
  await expect(page.getByText('Razorpay payment verified for B-RAZORPAY. Remaining balance ₹0.00.')).toBeVisible();
  expect(createdOrders).toHaveLength(1);
  expect(createdOrders[0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
  expect(verifications).toEqual([{
    localOrderId: '00000000-0000-4000-8000-000000000301',
    razorpayOrderId: 'order_test123',
    razorpayPaymentId: 'pay_test123',
    razorpaySignature: 'a'.repeat(64)
  }]);
});

test('splits the remaining amount evenly to the cent', async ({ page }) => {
  await authenticate(page);
  const session = {
    id: sessionId, table_label: 'T-05', covers: 3, opened_at: new Date().toISOString(),
    ticket_count: 1, billed_total: 10, paid_total: 0, outstanding_total: 10, pending_kot_count: 0,
    tickets: [{
      id: ticketId, ticket_number: 'B-EQUAL-1', status: 'SENT',
      grand_total: 10, paid_total: 0, balance_due: 10
    }]
  };
  await page.route('**/api/v1/bar/table-sessions?outletId=*', (route) =>
    route.fulfill({ json: { data: [session] } })
  );
  await page.route('**/api/v1/bar/ticket-approval-requests?outletId=*', route => route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/kot?outletId=*', (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route('**/api/v1/bar/open-bottles?outletId=*', (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route('**/api/v1/bar/bottle-reservations?outletId=*', (route) =>
    route.fulfill({ json: { data: [] } })
  );
  let recordedPayments: Array<{ method: string; amount: number }> = [];
  await page.route(`**/api/v1/bar/tickets/${ticketId}/payments`, async (route) => {
    const body = route.request().postDataJSON() as { payments: Array<{ method: string; amount: number }> };
    recordedPayments = body.payments;
    await route.fulfill({ status: 201, json: { data: [], paidTotal: 10, remainingDue: 0, status: 'PAID' } });
  });
  await page.getByRole('button', { name: 'Tables & KOT' }).click();
  await page.getByLabel('Equal shares for B-EQUAL-1').fill('3');
  await page.getByRole('button', { name: 'Split due evenly' }).click();

  await expect(page.getByLabel('Payment amount 1 for B-EQUAL-1')).toHaveValue('3.34');
  await expect(page.getByLabel('Payment amount 2 for B-EQUAL-1')).toHaveValue('3.33');
  await expect(page.getByLabel('Payment amount 3 for B-EQUAL-1')).toHaveValue('3.33');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByText('Payment recorded for B-EQUAL-1. Remaining balance ₹0.00.')).toBeVisible();
  expect(recordedPayments).toEqual([
    { method: 'CASH', amount: 3.34 },
    { method: 'CASH', amount: 3.33 },
    { method: 'CASH', amount: 3.33 }
  ]);
});

test('holds a table tab and reopens it with audited reasons', async ({ page }) => {
  await authenticate(page);
  let status: 'OPEN' | 'HELD' = 'OPEN';
  const session = {
    id: sessionId, table_label: 'T-06', covers: 2, opened_at: new Date().toISOString(),
    ticket_count: 0, billed_total: 0, paid_total: 0, outstanding_total: 0,
    pending_kot_count: 0, tickets: []
  };
  await page.route('**/api/v1/bar/table-sessions?outletId=*', (route) =>
    route.fulfill({ json: { data: status === 'OPEN' || new URL(route.request().url()).searchParams.get('includeHeld') === 'true'
      ? [{ ...session, status }] : [] } })
  );
  await page.route('**/api/v1/bar/ticket-approval-requests?outletId=*', route => route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/kot?outletId=*', (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route('**/api/v1/bar/open-bottles?outletId=*', (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route('**/api/v1/bar/bottle-reservations?outletId=*', (route) =>
    route.fulfill({ json: { data: [] } })
  );
  const transitions: Array<{status:string;reason:string}> = [];
  await page.route(`**/api/v1/bar/table-sessions/${sessionId}/status`, async (route) => {
    const body = route.request().postDataJSON() as {status:'OPEN'|'HELD';reason:string};
    status = body.status;
    transitions.push(body);
    await route.fulfill({ json: { data: { ...session, status } } });
  });
  page.on('dialog', async (dialog) => {
    await dialog.accept(status==='OPEN'?'Customer paused service':'Customer returned');
  });

  await page.getByRole('button', { name: 'Tables & KOT' }).click();
  await page.getByRole('button', { name: 'Hold tab' }).click();
  await expect(page.getByText('T-06 · HELD')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reopen tab' })).toBeVisible();
  await page.getByRole('button', { name: 'Reopen tab' }).click();
  await expect(page.getByText('T-06 · OPEN')).toBeVisible();
  expect(transitions).toEqual([
    {status:'HELD',reason:'Customer paused service'},
    {status:'OPEN',reason:'Customer returned'}
  ]);
});

test('splits selected unpaid ticket items into a retry-safe separate bill', async ({ page }) => {
  await authenticate(page);
  const firstLineId = '11111111-1111-4111-8111-111111111301';
  const secondLineId = '22222222-2222-4222-8222-222222222302';
  const detail = {
    id:ticketId,ticket_number:'B-SPLIT-1',outlet_id:outletId,status:'SENT',
    grand_total:20,refunded_total:0,
    lines:[
      {id:firstLineId,product_id:productId,line_type:'PACKAGED',quantity:1,volume_ml:null,line_total:10},
      {id:secondLineId,product_id:productId,line_type:'PACKAGED',quantity:1,volume_ml:null,line_total:10}
    ],
    payments:[],refunds:[]
  };
  await page.route('**/api/v1/bar/tickets?outletId=*&limit=100', (route) =>
    route.fulfill({json:{data:[detail]}})
  );
  await page.route(`**/api/v1/bar/tickets/${ticketId}`, (route) =>
    route.fulfill({json:{data:detail}})
  );
  await page.route('**/api/v1/bar/peg-quarantine', (route) =>
    route.fulfill({json:{data:[]}})
  );
  let splitRequest: {idempotencyKey:string;lineIds:string[]}|null=null;
  await page.route(`**/api/v1/bar/tickets/${ticketId}/split`, async (route) => {
    splitRequest=route.request().postDataJSON() as {idempotencyKey:string;lineIds:string[]};
    await route.fulfill({status:201,json:{
      data:{id:'00000000-0000-4000-8000-000000000303',ticket_number:'B-SPLIT-1-S-001',grand_total:10}
    }});
  });
  page.on('dialog',(dialog)=>dialog.accept());

  await page.getByRole('button',{name:'Bar Tickets & Refunds'}).click();
  await page.getByRole('button',{name:/B-SPLIT-1/}).click();
  await page.getByLabel(`Select item line ${firstLineId.slice(0,8)} for bill split`).check();
  await page.getByRole('button',{name:'Split selected items into new bill'}).click();

  await expect(page.getByText('Items split into bill B-SPLIT-1-S-001.')).toBeVisible();
  expect(splitRequest).toMatchObject({lineIds:[firstLineId]});
  expect(splitRequest?.idempotencyKey).toHaveLength(36);
});

test('edits an unpaid packaged line with a reason and retry-safe request key', async ({ page }) => {
  await authenticate(page);
  const lineId='66666666-6666-4666-8666-666666666606';
  const detail={
    id:ticketId,ticket_number:'B-EDIT-1',outlet_id:outletId,status:'SENT',
    grand_total:20,refunded_total:0,
    lines:[
      {id:lineId,product_id:productId,line_type:'PACKAGED',quantity:1,volume_ml:null,line_total:10},
      {id:'77777777-7777-4777-8777-777777777707',product_id:productId,line_type:'PACKAGED',quantity:1,volume_ml:null,line_total:10}
    ],
    payments:[],refunds:[]
  };
  await page.route('**/api/v1/bar/tickets?outletId=*&limit=100',route=>route.fulfill({json:{data:[detail]}}));
  await page.route(`**/api/v1/bar/tickets/${ticketId}`,route=>route.fulfill({json:{data:detail}}));
  await page.route('**/api/v1/bar/peg-quarantine',route=>route.fulfill({json:{data:[]}}));
  let editBody:{idempotencyKey:string;quantity:number;reason:string}|null=null;
  await page.route(`**/api/v1/bar/tickets/${ticketId}/lines/${lineId}/quantity`,async route=>{
    editBody=route.request().postDataJSON() as typeof editBody;
    await route.fulfill({status:200,json:{data:{id:ticketId,grand_total:30}}});
  });
  page.on('dialog',dialog=>dialog.accept('Customer requested one more bottle'));
  await page.getByRole('button',{name:'Bar Tickets & Refunds'}).click();
  await page.getByRole('button',{name:/B-EDIT-1/}).click();
  await page.getByLabel(`Quantity for ticket line ${lineId.slice(0,8)}`).fill('2');
  await page.getByRole('button',{name:'Update item'}).first().click();
  await expect(page.getByText('Ticket item quantity updated.')).toBeVisible();
  expect(editBody).toMatchObject({quantity:2,reason:'Customer requested one more bottle'});
  expect(editBody?.idempotencyKey).toHaveLength(36);
});

test('requires a separate manager approval for ticket discounts', async ({ page }) => {
  await authenticate(page);
  const detail={
    id:ticketId,ticket_number:'B-DISCOUNT-1',outlet_id:outletId,status:'SENT',
    grand_total:20,refunded_total:0,lines:[],payments:[],refunds:[]
  };
  let requests: Array<Record<string,unknown>>=[];
  await page.route('**/api/v1/bar/tickets?outletId=*&limit=100',route=>route.fulfill({json:{data:[detail]}}));
  await page.route(`**/api/v1/bar/tickets/${ticketId}`,route=>route.fulfill({json:{data:detail}}));
  await page.route('**/api/v1/bar/peg-quarantine',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/ticket-approval-requests?outletId=*',route=>route.fulfill({json:{data:requests}}));
  let submitted:Record<string,unknown>|null=null;
  await page.route(`**/api/v1/bar/tickets/${ticketId}/approval-requests`,async route=>{
    submitted=route.request().postDataJSON() as Record<string,unknown>;
    const approval={id:'88888888-8888-4888-8888-888888888808',ticket_id:ticketId,ticket_number:detail.ticket_number,
      request_type:'DISCOUNT',status:'PENDING',requested_by:profile.userId,created_at:new Date().toISOString(),
      request_payload:submitted};
    requests=[approval];
    await route.fulfill({status:201,json:{data:approval}});
  });
  let decisionBody:Record<string,unknown>|null=null;
  await page.route('**/api/v1/bar/ticket-approval-requests/*/decision',async route=>{
    decisionBody=route.request().postDataJSON() as Record<string,unknown>;
    requests=requests.map(item=>({...item,status:'APPROVED'}));
    await route.fulfill({json:{data:requests[0]}});
  });
  page.on('dialog',dialog=>dialog.accept('Reviewed guest-service issue'));
  await page.getByRole('button',{name:'Bar Tickets & Refunds'}).click();
  await page.getByRole('button',{name:/B-DISCOUNT-1/}).click();
  await page.getByLabel('Amount').last().fill('2');
  await page.getByLabel('Reason').last().fill('Guest-service recovery');
  await page.getByRole('button',{name:'Submit adjustment'}).click();
  await expect(page.getByText('DISCOUNT request', {exact:false})).toBeVisible();
  expect(submitted).toMatchObject({type:'DISCOUNT',amount:2,reason:'Guest-service recovery'});
  await page.getByRole('button',{name:'Approve discount'}).click();
  await expect(page.getByText('DISCOUNT request approved.')).toBeVisible();
  expect(decisionBody).toMatchObject({decision:'APPROVE',reason:'Reviewed guest-service issue'});
});

test('records and prints a KOT reprint with an operator reason', async ({ page }) => {
  await page.addInitScript(() => {
    window.print=()=>{document.documentElement.dataset.printRequested='true';};
  });
  await authenticate(page);
  const kotId='33333333-3333-4333-8333-333333333303';
  const kot={
    id:kotId,ticket_id:ticketId,ticket_number:'B-REPRINT-1',status:'PREPARING',
    table_label:'T-07',session_table_label:'T-07',created_at:new Date().toISOString(),
    lines:[{id:'44444444-4444-4444-8444-444444444404',productName:'Test whisky',quantity:1}]
  };
  await page.route('**/api/v1/bar/table-sessions?outletId=*',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/ticket-approval-requests?outletId=*',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/kot?outletId=*',route=>route.fulfill({json:{data:[kot]}}));
  await page.route('**/api/v1/bar/open-bottles?outletId=*',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/bottle-reservations?outletId=*',route=>route.fulfill({json:{data:[]}}));
  let reprintReason='';
  let voidRequest: Record<string,unknown> | null = null;
  await page.route(`**/api/v1/bar/tickets/${ticketId}/approval-requests`,async route=>{
    voidRequest=route.request().postDataJSON() as Record<string,unknown>;
    await route.fulfill({status:201,json:{data:{id:'77777777-7777-4777-8777-777777777707',status:'PENDING'}}});
  });
  await page.route(`**/api/v1/bar/kot/${kotId}/reprints`,async route=>{
    reprintReason=(route.request().postDataJSON() as {reason:string}).reason;
    await route.fulfill({status:201,json:{data:{
      reprintId:'55555555-5555-4555-8555-555555555505',
      printedAt:new Date().toISOString(),ticketNumber:kot.ticket_number,
      tableLabel:'T-07',status:'PREPARING',
      lines:[{product_name:'Test whisky',quantity:1}]
    }}});
  });
  page.on('dialog',dialog=>dialog.accept('Printer paper jam recovery'));

  await page.getByRole('button',{name:'Tables & KOT'}).click();
  await page.getByRole('button',{name:'Reprint KOT'}).click();
  await expect(page.getByText('KOT B-REPRINT-1 reprint recorded.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-print-requested','true');
  await page.emulateMedia({media:'print'});
  const printPreview=page.getByLabel('KOT reprint preview');
  await expect(printPreview.getByText('Test whisky × 1')).toBeAttached();
  expect(await printPreview.evaluate(element=>getComputedStyle(element).display)).toBe('block');
  expect(await printPreview.evaluate(element=>getComputedStyle(element).visibility)).toBe('visible');
  expect(reprintReason).toBe('Printer paper jam recovery');
  await page.emulateMedia({media:'screen'});
  await page.getByRole('button',{name:'Request manager void'}).click();
  await expect(page.getByText('Void request for B-REPRINT-1 submitted for separate manager approval.')).toBeVisible();
  expect(voidRequest).toMatchObject({type:'VOID',reason:'Printer paper jam recovery'});
});

test('configures preparation stations and assigns products', async ({ page }) => {
  await authenticate(page);
  const stationId='66666666-6666-4666-8666-666666666606';
  let stations: Array<{id:string;station_code:string;name:string;is_default:boolean;status:string}> = [];
  let assignment: Record<string,string> | null = null;
  await page.route('**/api/v1/bar/table-sessions?outletId=*',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/kot?outletId=*',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/open-bottles?outletId=*',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/bottle-reservations?outletId=*',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/kot/stations?outletId=*',route=>route.fulfill({json:{data:stations}}));
  await page.route('**/api/v1/bar/kot/stations',async route=>{
    const body=route.request().postDataJSON() as {stationCode:string;name:string;isDefault:boolean};
    stations=[{id:stationId,station_code:body.stationCode,name:body.name,is_default:body.isDefault,status:'ACTIVE'}];
    await route.fulfill({status:201,json:{data:stations[0]}});
  });
  await page.route(`**/api/v1/bar/kot/stations/${stationId}/products/${productId}`,async route=>{
    assignment=route.request().postDataJSON() as Record<string,string>;
    await route.fulfill({json:{data:{productId,stationId}}});
  });

  await page.getByRole('button',{name:'Tables & KOT'}).click();
  await page.getByLabel('Station code').fill('GRILL');
  await page.getByLabel('Station name').fill('Grill');
  await page.getByLabel('Default for unassigned products').check();
  await page.getByRole('button',{name:'Add preparation station'}).click();
  await expect(page.getByText('Preparation station Grill created.')).toBeVisible();
  await page.getByLabel('Product ID').fill(productId);
  await page.getByRole('button',{name:'Route product'}).click();
  await expect(page.getByText('Product assigned to Grill.')).toBeVisible();
  expect(assignment).toEqual({outletId});
});
