import { expect, test, type Page } from '@playwright/test';

const outletId = '00000000-0000-4000-8000-000000000101';
const productId = '00000000-0000-4000-8000-000000000102';
const ingredientId = '00000000-0000-4000-8000-000000000103';
const replacementId = '00000000-0000-4000-8000-000000000111';

const profile = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'inventory.manager@demo.acp.local',
  displayName: 'Inventory Manager',
  isPlatformAdmin: false,
  organisationId: '00000000-0000-4000-8000-000000000201',
  roleCode: 'BAR_MANAGER',
  sessionId: '00000000-0000-4000-8000-000000000202',
  permissions: ['inventory:read', 'inventory:receive', 'inventory:adjust', 'catalogue:read', 'catalogue:manage',
    'bar:billing', 'bar:sell', 'procurement:read', 'procurement:manage', 'procurement:approve']
};

async function authenticate(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('acp_access_token', 'phase2-inventory-test-token'));
  await page.route('**/api/health/live', route => route.fulfill({ json: { status: 'live', service: 'api' } }));
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { data: profile } }));
  await page.route('**/api/v1/outlets', route => route.fulfill({
    json: { data: [{ id: outletId, name: 'Test Bar', outlet_code: 'TB1' }] }
  }));
  await page.route('**/api/v1/catalogue/products**', route => route.fulfill({
    json: { data: [
      { id: productId, name: 'House cocktail', sku: 'COCKTAIL-1', status: 'ACTIVE' },
      { id: ingredientId, name: 'House spirit', sku: 'SPIRIT-1', status: 'ACTIVE' },
      { id: replacementId, name: 'Alternative spirit', sku: 'SPIRIT-2', status: 'ACTIVE' }
    ] }
  }));
  await page.route('**/api/v1/inventory/balances**', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/v1/inventory/batches**', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/v1/inventory/transfers', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/v1/inventory/stocktakes', route => route.fulfill({ json: { data: [] } }));
  await page.goto('/');
  await expect(page.getByText('Authenticated')).toBeVisible();
}

test('records wastage from inventory controls with an idempotency key', async ({ page }) => {
  await authenticate(page);
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/v1/inventory/wastage', async route => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    await route.fulfill({
      status: 201,
      json: { data: { id: 'movement-1' }, balance: '0.990', replayed: false }
    });
  });

  await page.getByRole('button', { name: 'Inventory Control' }).click();
  await page.getByLabel('Movement type').selectOption('WASTAGE');
  await page.getByLabel('Wasted quantity').fill('0.01');
  await page.getByLabel('Wastage category').selectOption('EXPIRED');
  await page.getByLabel('Reason / notes').fill('Expired bottle removed');
  await page.getByRole('button', { name: 'Record wastage' }).click();

  await expect(page.getByRole('status')).toContainText('Wastage recorded');
  expect(submitted).toMatchObject({
    outletId, productId, quantity: 0.01, category: 'EXPIRED', reason: 'Expired bottle removed'
  });
});

test('bar menu availability controls reflect the selected measure', async ({ page }) => {
  await authenticate(page);
  let recipePayload:Record<string,unknown>|undefined;
  await page.route('**/api/v1/bar/recipes', async route => {
    if(route.request().method()==='POST'){
      recipePayload=route.request().postDataJSON() as Record<string,unknown>;
      await route.fulfill({status:201,json:{data:{version_no:1}}});
      return;
    }
    await route.fulfill({ json: { data: [] } });
  });

  await page.route('**/api/v1/bar/modifiers?productId=*',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/menu?outletId=*', route => route.fulfill({
    json: { data: [{
      product_id: productId, name: 'House cocktail', sku: 'COCKTAIL-1',
      measure_type: 'PACKAGED', is_available: true, yield_quantity: null,
      estimated_cost: null, menu_prices: [{ measureType: 'PACKAGED', unitPrice: 12 }]
    }] }
  }));
  let availabilityUpdate: Record<string, unknown> | undefined;
  await page.route('**/api/v1/bar/menu/availability', async route => {
    availabilityUpdate = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: { data: {} } });
  });

  await page.getByRole('button', { name: 'Bar Menu & Recipes' }).click();
  await expect(page.getByRole('heading', { name: 'Bar menu & recipes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark unavailable' }).click();

  await expect(page.getByRole('status')).toContainText('marked unavailable');
  expect(availabilityUpdate).toMatchObject({
    outletId, productId, measureType: 'PACKAGED', isAvailable: false
  });
  await page.getByLabel('Menu product').first().selectOption(productId);
  await page.getByLabel('Recipe type').selectOption('COMBO');
  await page.getByLabel('Ingredient').first().selectOption(ingredientId);
  await page.getByRole('button',{name:'Save draft recipe'}).click();
  await expect(page.getByRole('status')).toContainText('Draft combo');
  expect(recipePayload).toMatchObject({productId,kind:'COMBO',lines:[{ingredientProductId:ingredientId,quantity:1}]});
});

test('configures a substitution group tied to an active recipe ingredient',async({page})=>{
  await authenticate(page);
  let submitted:Record<string,unknown>|undefined;
  await page.route('**/api/v1/bar/recipes',route=>route.fulfill({json:{data:[{
    id:'recipe-1',product_id:productId,product_name:'House cocktail',version_no:1,status:'ACTIVE',
    lines:[{ingredientProductId:ingredientId,ingredientName:'House spirit',quantity:1}]
  }]}}));
  await page.route('**/api/v1/bar/menu?outletId=*',route=>route.fulfill({json:{data:[{
    product_id:productId,name:'House cocktail',sku:'COCKTAIL-1',measure_type:'PACKAGED',is_available:true
  }]}}));
  await page.route('**/api/v1/bar/modifiers?productId=*',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/modifiers',async route=>{
    if(route.request().method()==='POST'){
      submitted=route.request().postDataJSON() as Record<string,unknown>;
      await route.fulfill({status:201,json:{data:{id:'substitution-group'}}});
      return;
    }
    await route.fulfill({json:{data:[]}});
  });
  await page.getByRole('button',{name:'Bar Menu & Recipes'}).click();
  await page.getByLabel('Menu product').last().selectOption(productId);
  await page.getByLabel('Group name').fill('Spirit choice');
  await page.getByLabel('Group type').selectOption('SUBSTITUTION');
  await page.getByLabel('Recipe ingredient to replace').selectOption(ingredientId);
  await page.getByLabel('Option').first().fill('Alternative spirit');
  await page.getByLabel(/Ingredient \(replacement required\)/).first().selectOption(replacementId);
  await page.getByRole('button',{name:'Remove option'}).last().click();
  await page.getByRole('button',{name:'Save modifier group'}).click();
  await expect(page.getByRole('status')).toContainText('Modifier group saved');
  expect(submitted).toMatchObject({
    productId,name:'Spirit choice',substitutesProductId:ingredientId,minSelections:1,maxSelections:1,
    options:[{name:'Alternative spirit',ingredientProductId:replacementId,ingredientQuantity:1}]
  });
});

test('POS prices and submits the selected menu modifier', async ({page})=>{
  await authenticate(page);
  const modifierId='00000000-0000-4000-8000-000000000104';
  const priceId='00000000-0000-4000-8000-000000000105';
  await page.route('**/api/v1/outlets/*/prices?channel=*',route=>{
    const channel=new URL(route.request().url()).searchParams.get('channel');
    return route.fulfill({json:{data:channel==='BAR_PACKAGED'?[{
      id:priceId,product_id:productId,name:'House cocktail',
      sku:'COCKTAIL-1',channel:'BAR_PACKAGED',volume_ml:null,unit_price:10,tax_rate:0
    }]:[]}});
  });
  await page.route('**/api/v1/bar/menu?outletId=*',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/open-bottles?outletId=*',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/table-sessions?outletId=*',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/bar/modifiers?productId=*',route=>route.fulfill({json:{data:[{
    id:'modifier-group',name:'Garnish',min_selections:1,max_selections:1,status:'ACTIVE',
    options:[{id:modifierId,name:'Extra lime',priceDelta:2,status:'ACTIVE'}]
  }]}}));
  let submitted:Record<string,unknown>|undefined;
  await page.route('**/api/v1/bar/checkout',async route=>{
    submitted=route.request().postDataJSON() as Record<string,unknown>;
    await route.fulfill({status:201,json:{data:{id:'ticket-modifier',ticket_number:'B-MOD',grand_total:12},totals:{grandTotal:12}}});
  });
  await page.getByRole('button',{name:'Bar POS'}).click();
  await page.getByLabel('Product / service').selectOption(priceId);
  await page.getByLabel(/Extra lime/).check();
  await page.getByRole('button',{name:'Add selected bar item to ticket'}).click();
  await page.getByPlaceholder('Amount').fill('12');
  await page.getByLabel(/checked acceptable proof of age/).check();
  await page.getByLabel(/Customer is not known or believed to be intoxicated/).check();
  await page.getByLabel(/Customer is not in another prohibited category/).check();
  await page.getByLabel(/Meals or eatables are being supplied/).check();
  await expect(page.locator('.pos-total strong')).toHaveText('₹12.00');
  await page.getByRole('button',{name:'Complete bar checkout'}).click();
  await expect(page.getByText(/Bar ticket completed/)).toBeVisible();
  expect(submitted).toMatchObject({
    lines:[{productId,lineType:'PACKAGED',quantity:1,modifierOptionIds:[modifierId]}]
  });
});

test('runs a stock reconciliation for multiple outlets without changing balances',async({page})=>{
  await authenticate(page);
  await page.route('**/api/v1/outlets',route=>route.fulfill({json:{data:[
    {id:outletId,name:'Test Bar',outlet_code:'TB1'},
    {id:'00000000-0000-4000-8000-000000000106',name:'Second Bar',outlet_code:'TB2'}
  ]}}));
  let submitted:Record<string,unknown>|undefined;
  await page.route('**/api/v1/inventory/reconciliation-runs',async route=>{
    if(route.request().method()==='POST'){
      submitted=route.request().postDataJSON() as Record<string,unknown>;
      await route.fulfill({status:201,json:{data:{runs:[
        {run:{id:'run-1',outlet_id:outletId,status:'COMPLETED',product_count:1,exception_count:0,completed_at:new Date().toISOString()},exceptions:[]},
        {run:{id:'run-2',outlet_id:'00000000-0000-4000-8000-000000000106',status:'COMPLETED',product_count:1,exception_count:0,completed_at:new Date().toISOString()},exceptions:[]}
      ],limitations:[]}}});
      return;
    }
    await route.fulfill({json:{data:[]}});
  });
  await page.getByRole('button',{name:'Inventory Control'}).click();
  await page.getByRole('checkbox',{name:'Test Bar · TB1'}).check();
  await page.getByRole('checkbox',{name:'Second Bar · TB2'}).check();
  await page.getByRole('button',{name:'Run reconciliation'}).click();
  await expect(page.getByRole('status')).toContainText('for 2 outlets');
  expect(submitted?.outletIds).toEqual([outletId,'00000000-0000-4000-8000-000000000106']);
});

test('records an invoice against an approved purchase order',async({page})=>{
  await authenticate(page);
  const poId='00000000-0000-4000-8000-000000000107';
  await page.route('**/api/v1/procurement/suppliers',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/procurement/purchase-orders',route=>route.fulfill({json:{data:[{
    id:poId,po_number:'PO-1',status:'RECEIVED',approval_status:'APPROVED',supplier_name:'Supplier One'
  }]}}));
  await page.route('**/api/v1/procurement/goods-receipts',route=>route.fulfill({json:{data:[]}}));
  await page.route(`**/api/v1/procurement/purchase-orders/${poId}`,route=>route.fulfill({json:{data:{
    id:poId,lines:[{product_id:productId,product_name:'House cocktail',ordered_units:2,received_units:1,unit_cost:10}]
  }}}));
  let submitted:Record<string,unknown>|undefined;
  await page.route('**/api/v1/procurement/supplier-invoices',async route=>{
    if(route.request().method()==='POST'){
      submitted=route.request().postDataJSON() as Record<string,unknown>;
      await route.fulfill({status:201,json:{data:{id:'invoice-1'}}});
      return;
    }
    await route.fulfill({json:{data:[]}});
  });
  await page.getByRole('button',{name:'Procurement'}).click();
  await page.getByLabel('Approved purchase order').selectOption(poId);
  await expect(page.getByLabel('Invoice quantity')).toBeVisible();
  await page.getByLabel('Supplier invoice number').fill('INV-001');
  await page.getByRole('button',{name:'Record invoice'}).click();
  await expect(page.getByRole('status')).toContainText('Supplier invoice recorded');
  expect(submitted).toMatchObject({
    purchaseOrderId:poId,invoiceNumber:'INV-001',
    lines:[{productId,quantityUnits:1,unitCost:10}]
  });
});

test('creates, approves, and receives a purchase order with batch and expiry evidence',async({page})=>{
  await authenticate(page);
  const supplierId='00000000-0000-4000-8000-000000000108';
  const poId='00000000-0000-4000-8000-000000000109';
  const poLineId='00000000-0000-4000-8000-000000000110';
  const po={id:poId,po_number:'PO-NEW',status:'DRAFT',approval_status:'PENDING',supplier_name:'Supplier One'};
  let order:Record<string,unknown>|null=null;
  await page.route('**/api/v1/procurement/suppliers',route=>route.fulfill({json:{data:[{
    id:supplierId,name:'Supplier One',supplier_code:'SUP-1',status:'ACTIVE'
  }]}}));
  await page.route('**/api/v1/procurement/purchase-orders',async route=>{
    if(route.request().method()==='POST'){
      const body=route.request().postDataJSON() as Record<string,unknown>;
      expect(body.lines).toEqual([{productId,orderedUnits:3,unitCost:10}]);
      order={...po,...body};
      await route.fulfill({status:201,json:{data:po}});
      return;
    }
    await route.fulfill({json:{data:order?[order]:[]}});
  });
  await page.route(`**/api/v1/procurement/purchase-orders/${poId}`,route=>route.fulfill({json:{data:{
    ...po,lines:[{id:poLineId,product_id:productId,product_name:'House cocktail',ordered_units:3,received_units:0,unit_cost:10}]
  }}}));
  await page.route(`**/api/v1/procurement/purchase-orders/${poId}/submit`,async route=>{
    order={...order,status:'SUBMITTED',approval_status:'PENDING'};
    await route.fulfill({json:{data:{status:'PENDING'}}});
  });
  await page.route(`**/api/v1/procurement/purchase-orders/${poId}/review`,async route=>{
    order={...order,status:'SUBMITTED',approval_status:'APPROVED'};
    await route.fulfill({json:{data:{status:'APPROVED'}}});
  });
  let receiptPayload:Record<string,unknown>|undefined;
  await page.route(`**/api/v1/procurement/purchase-orders/${poId}/receipts`,async route=>{
    receiptPayload=route.request().postDataJSON() as Record<string,unknown>;
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    await route.fulfill({status:201,json:{data:{receipt_number:'GRN-NEW',status:'POSTED'}}});
  });
  await page.route('**/api/v1/procurement/goods-receipts',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/v1/procurement/supplier-invoices',route=>route.fulfill({json:{data:[]}}));

  await page.getByRole('button',{name:'Procurement'}).click();
  await page.getByLabel('Outlet').selectOption(outletId);
  await page.getByRole('combobox',{name:'Supplier'}).selectOption(supplierId);
  await page.getByLabel('PO number').fill('PO-NEW');
  await page.getByLabel('Product').selectOption(productId);
  await page.getByLabel('Ordered units').fill('3');
  await page.getByLabel('Unit cost').fill('10');
  await page.getByRole('button',{name:'Create draft PO'}).click();
  await expect(page.getByRole('cell',{name:'PO-NEW'})).toBeVisible();
  await page.getByRole('button',{name:'Submit'}).click();
  await page.getByRole('button',{name:'Approve'}).click();
  await page.getByRole('button',{name:'Receive goods'}).click();
  await page.getByLabel('Supplier batch / lot').fill('LOT-001');
  await page.getByLabel('Expiry date').fill('2027-12-31');
  await page.getByRole('button',{name:'Post goods receipt'}).click();
  await expect(page.getByRole('status')).toContainText('Goods receipt GRN-NEW posted');
  expect(receiptPayload).toMatchObject({
    lines:[{purchaseOrderLineId:poLineId,receivedUnits:3,acceptedUnits:3,unitCost:10,batchNumber:'LOT-001',expiryDate:'2027-12-31'}]
  });
});
