import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { requirePermission } from '../middleware/requirePermission.js';

export const barMenuRouter = Router();
barMenuRouter.use(authenticate, requireOrgScope);

const uuid = z.string().uuid();
const org = (req: any) => req.auth.organisationId;
const fail = (res: any, code: string, message: string, status = 400) => res.status(status).json({ error: { code, message } });
const recipeLine = z.object({ ingredientProductId: uuid, quantity: z.number().positive().max(999999) });
const recipePayload = z.object({
  productId: uuid,
  kind: z.enum(['RECIPE','COMBO']).default('RECIPE'),
  yieldQuantity: z.number().positive().max(999999).refine(value => Math.round(value * 1000) === value * 1000).default(1),
  lines: z.array(recipeLine).min(1).max(100)
}).superRefine((value, ctx) => {
  if (new Set(value.lines.map(line => line.ingredientProductId)).size !== value.lines.length) {
    ctx.addIssue({ code: 'custom', message: 'A recipe can contain an ingredient only once', path: ['lines'] });
  }
  if (value.lines.some(line => Math.round(line.quantity * 1000) !== line.quantity * 1000)) {
    ctx.addIssue({ code: 'custom', message: 'Ingredient quantities support at most three decimal places', path: ['lines'] });
  }
  if (value.lines.some(line => line.ingredientProductId === value.productId)) {
    ctx.addIssue({ code: 'custom', message: 'A menu product cannot be its own recipe ingredient', path: ['lines'] });
  }
  if (value.lines.some(line => Math.round(line.quantity / value.yieldQuantity * 1000) < 1)) {
    ctx.addIssue({ code: 'custom', message: 'Each ingredient must consume at least 0.001 stock units per portion', path: ['lines'] });
  }
});

barMenuRouter.get('/bar/menu', requirePermission('catalogue:read'), async (req, res) => {
  const outletId = uuid.safeParse(req.query.outletId);
  if (!outletId.success) return fail(res, 'OUTLET_REQUIRED', 'A valid outletId is required');
  const outlet = await pool.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2', [outletId.data, org(req)]);
  if (!outlet.rowCount) return fail(res, 'OUTLET_NOT_FOUND', 'Outlet not found', 404);
  const result = await pool.query(
    `SELECT p.id AS product_id,p.sku,p.name,p.product_type,
       a.measure_type,a.is_available,a.reason AS availability_reason,
       r.id AS recipe_id,r.version_no AS recipe_version,r.yield_quantity,
       COALESCE(rl.lines,'[]'::json) AS recipe_lines,rl.estimated_cost,
       COALESCE(prices.menu_prices,'[]'::json) AS menu_prices
     FROM products p
     LEFT JOIN bar_menu_availability a
       ON a.organisation_id=p.organisation_id AND a.product_id=p.id AND a.outlet_id=$2
     LEFT JOIN bar_product_recipes r
       ON r.organisation_id=p.organisation_id AND r.product_id=p.id AND r.status='ACTIVE'
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
                'id',l.id,'ingredientProductId',l.ingredient_product_id,
                'ingredientName',ingredient.name,'quantity',l.quantity
              ) ORDER BY ingredient.name) AS lines,
              CASE WHEN BOOL_AND(cost.unit_cost IS NOT NULL)
                THEN SUM(l.quantity*cost.unit_cost) ELSE NULL END AS estimated_cost
       FROM bar_product_recipe_lines l
       JOIN products ingredient ON ingredient.id=l.ingredient_product_id
         AND ingredient.organisation_id=l.organisation_id
       LEFT JOIN LATERAL (
         SELECT unit_cost FROM inventory_cost_layers c
          WHERE c.organisation_id=l.organisation_id AND c.product_id=l.ingredient_product_id
            AND c.outlet_id=$2 AND c.remaining_units>0
          ORDER BY c.received_at DESC,c.id DESC LIMIT 1
       ) cost ON TRUE
       WHERE l.recipe_id=r.id AND l.organisation_id=p.organisation_id
     ) rl ON TRUE
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object('measureType',price.measure_type,'unitPrice',price.unit_price)
                       ORDER BY price.measure_type) AS menu_prices
         FROM outlet_tax_prices price
        WHERE price.organisation_id=p.organisation_id
          AND price.organisation_id=$1 AND price.outlet_id=$2 AND price.product_id=p.id
          AND price.channel='BAR' AND price.status='APPROVED'
          AND price.effective_from<=NOW() AND (price.effective_until IS NULL OR price.effective_until>NOW())
     ) prices ON TRUE
     WHERE p.organisation_id=$1 AND p.status='ACTIVE'
     ORDER BY p.name,a.measure_type`,
    [org(req), outletId.data]
  );
  res.json({ data: result.rows });
});

barMenuRouter.put('/bar/menu/availability', requirePermission('catalogue:manage'), async (req, res) => {
  const parsed = z.object({
    outletId: uuid, productId: uuid, measureType: z.enum(['PEG','BOTTLE','PACKAGED']),
    isAvailable: z.boolean(), reason: z.string().trim().max(500).optional()
  }).superRefine((value, ctx) => {
    if (!value.isAvailable && !value.reason) ctx.addIssue({ code: 'custom', message: 'A reason is required when an item is unavailable', path: ['reason'] });
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  const { outletId, productId, measureType, isAvailable, reason } = parsed.data;
  const [outlet, product] = await Promise.all([
    pool.query('SELECT id FROM outlets WHERE id=$1 AND organisation_id=$2', [outletId, org(req)]),
    pool.query("SELECT id FROM products WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE'", [productId, org(req)])
  ]);
  if (!outlet.rowCount) return fail(res, 'OUTLET_NOT_FOUND', 'Outlet not found', 404);
  if (!product.rowCount) return fail(res, 'PRODUCT_NOT_FOUND', 'Active product not found', 404);
  const saved = await pool.query(
    `INSERT INTO bar_menu_availability(organisation_id,outlet_id,product_id,measure_type,is_available,reason,updated_by)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(organisation_id,outlet_id,product_id,measure_type) DO UPDATE SET
       is_available=EXCLUDED.is_available,reason=EXCLUDED.reason,updated_by=EXCLUDED.updated_by,updated_at=NOW()
     RETURNING *`,
    [org(req), outletId, productId, measureType, isAvailable, reason ?? null, req.auth!.userId]
  );
  res.json({ data: saved.rows[0] });
});

barMenuRouter.get('/bar/modifiers', requirePermission('catalogue:read'), async (req, res) => {
  const productId = uuid.safeParse(req.query.productId);
  if (!productId.success) return fail(res, 'PRODUCT_REQUIRED', 'A valid productId is required');
  const product = await pool.query(
    "SELECT id FROM products WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE'",
    [productId.data, org(req)]
  );
  if (!product.rowCount) return fail(res, 'PRODUCT_NOT_FOUND', 'Active product not found', 404);
  const result = await pool.query(
    `SELECT g.id,g.product_id,g.name,g.min_selections,g.max_selections,g.status,
       g.substitutes_product_id,substituted.name AS substitutes_product_name,
       COALESCE(json_agg(json_build_object(
         'id',o.id,'name',o.name,'priceDelta',o.price_delta,
         'ingredientProductId',o.ingredient_product_id,'ingredientName',ingredient.name,
         'ingredientQuantity',o.ingredient_quantity,'status',o.status
       ) ORDER BY o.name) FILTER (WHERE o.id IS NOT NULL),'[]'::json) AS options
     FROM bar_modifier_groups g
     LEFT JOIN bar_modifier_options o
       ON o.group_id=g.id AND o.organisation_id=g.organisation_id AND o.product_id=g.product_id
     LEFT JOIN products ingredient
       ON ingredient.id=o.ingredient_product_id AND ingredient.organisation_id=g.organisation_id
     LEFT JOIN products substituted
       ON substituted.id=g.substitutes_product_id AND substituted.organisation_id=g.organisation_id
     WHERE g.organisation_id=$1 AND g.product_id=$2
     GROUP BY g.id ORDER BY g.created_at,g.name`,
    [org(req), productId.data]
  );
  return res.json({ data: result.rows });
});

barMenuRouter.post('/bar/modifiers', requirePermission('catalogue:manage'), async (req, res) => {
  const option = z.object({
    name: z.string().trim().min(1).max(100),
    priceDelta: z.number().finite().min(-999999).max(999999).default(0),
    ingredientProductId: uuid.optional(),
    ingredientQuantity: z.number().min(0).max(999999).default(0)
  }).superRefine((value, ctx) => {
    if (Boolean(value.ingredientProductId) !== (value.ingredientQuantity > 0)) {
      ctx.addIssue({ code: 'custom', message: 'Select an ingredient product and positive quantity together', path: ['ingredientQuantity'] });
    }
    if (Math.round(value.ingredientQuantity * 1000) !== value.ingredientQuantity * 1000) {
      ctx.addIssue({ code: 'custom', message: 'Ingredient quantities support at most three decimal places', path: ['ingredientQuantity'] });
    }
  });
  const parsed = z.object({
    productId: uuid,
    name: z.string().trim().min(1).max(100),
    substitutesProductId: uuid.optional(),
    minSelections: z.number().int().min(0).max(20).default(0),
    maxSelections: z.number().int().min(1).max(20).default(1),
    options: z.array(option).min(1).max(50)
  }).superRefine((value, ctx) => {
    if (value.minSelections > value.maxSelections || value.maxSelections > value.options.length) {
      ctx.addIssue({ code: 'custom', message: 'Selection limits must fit the number of options', path: ['maxSelections'] });
    }
    if(value.substitutesProductId){
      if(value.minSelections!==1||value.maxSelections!==1){
        ctx.addIssue({code:'custom',message:'Substitution groups require exactly one selection',path:['minSelections']});
      }
      if(value.options.some(row=>!row.ingredientProductId||row.ingredientQuantity<=0)){
        ctx.addIssue({code:'custom',message:'Every substitution option must consume a replacement ingredient',path:['options']});
      }
      if(value.options.some(row=>row.ingredientProductId===value.substitutesProductId)){
        ctx.addIssue({code:'custom',message:'Replacement ingredients must differ from the recipe ingredient being replaced',path:['options']});
      }
    }
    if (new Set(value.options.map(row => row.name.toLowerCase())).size !== value.options.length) {
      ctx.addIssue({ code: 'custom', message: 'Modifier option names must be unique within a group', path: ['options'] });
    }
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const product = await client.query(
      "SELECT id FROM products WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE' FOR SHARE",
      [parsed.data.productId, org(req)]
    );
    if (!product.rowCount) { await client.query('ROLLBACK'); return fail(res, 'PRODUCT_NOT_FOUND', 'Active menu product not found', 404); }
    const ingredientIds = [...new Set(parsed.data.options.flatMap(row => row.ingredientProductId ? [row.ingredientProductId] : []))];
    if (ingredientIds.includes(parsed.data.productId)||parsed.data.substitutesProductId===parsed.data.productId) {
      await client.query('ROLLBACK');
      return fail(res, 'MODIFIER_SELF_INGREDIENT', 'A menu product cannot be its own modifier ingredient');
    }
    if (ingredientIds.length) {
      const ingredients = await client.query(
        "SELECT id FROM products WHERE organisation_id=$1 AND status='ACTIVE' AND id=ANY($2::uuid[]) FOR SHARE",
        [org(req), ingredientIds]
      );
      if (ingredients.rowCount !== ingredientIds.length) {
        await client.query('ROLLBACK');
        return fail(res, 'INVALID_INGREDIENT', 'Every modifier ingredient must be an active product in this organisation', 400);
      }
    }
    if(parsed.data.substitutesProductId){
      const baseIngredient=await client.query(
        `SELECT ingredient.id FROM bar_product_recipes recipe
           JOIN bar_product_recipe_lines line ON line.recipe_id=recipe.id AND line.organisation_id=recipe.organisation_id
           JOIN products ingredient ON ingredient.id=line.ingredient_product_id AND ingredient.organisation_id=recipe.organisation_id
          WHERE recipe.organisation_id=$1 AND recipe.product_id=$2 AND recipe.status='ACTIVE'
            AND line.ingredient_product_id=$3 AND ingredient.status='ACTIVE'
          FOR SHARE OF recipe,line,ingredient`,
        [org(req),parsed.data.productId,parsed.data.substitutesProductId]
      );
      if(!baseIngredient.rowCount){
        await client.query('ROLLBACK');
        return fail(res,'INVALID_SUBSTITUTION_INGREDIENT','Replacement target must be an active ingredient in the menu item recipe',400);
      }
    }
    const group = await client.query(
      `INSERT INTO bar_modifier_groups(
         organisation_id,product_id,name,min_selections,max_selections,substitutes_product_id,created_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [org(req), parsed.data.productId, parsed.data.name, parsed.data.minSelections, parsed.data.maxSelections,
        parsed.data.substitutesProductId??null,req.auth!.userId]
    );
    for (const row of parsed.data.options) await client.query(
      `INSERT INTO bar_modifier_options(
         organisation_id,group_id,product_id,name,price_delta,ingredient_product_id,ingredient_quantity
       ) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [org(req), group.rows[0].id, parsed.data.productId, row.name, row.priceDelta,
        row.ingredientProductId ?? null, row.ingredientQuantity]
    );
    await client.query('COMMIT');
    return res.status(201).json({ data: group.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') return fail(res, 'MODIFIER_GROUP_EXISTS', 'Modifier group or option already exists', 409);
    throw error;
  } finally {
    client.release();
  }
});

barMenuRouter.patch('/bar/modifier-groups/:groupId/status', requirePermission('catalogue:manage'), async (req, res) => {
  const parsed = z.object({ status: z.enum(['ACTIVE','INACTIVE']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  const updated = await pool.query(
    'UPDATE bar_modifier_groups SET status=$1 WHERE id=$2 AND organisation_id=$3 RETURNING *',
    [parsed.data.status, req.params.groupId, org(req)]
  );
  if (!updated.rowCount) return fail(res, 'MODIFIER_GROUP_NOT_FOUND', 'Modifier group not found', 404);
  return res.json({ data: updated.rows[0] });
});

barMenuRouter.get('/bar/recipes', requirePermission('catalogue:read'), async (req, res) => {
  const result = await pool.query(
    `SELECT r.*,p.name AS product_name,
       COALESCE(json_agg(json_build_object(
         'id',l.id,'ingredientProductId',l.ingredient_product_id,
         'ingredientName',ingredient.name,'quantity',l.quantity
       ) ORDER BY ingredient.name) FILTER (WHERE l.id IS NOT NULL),'[]'::json) AS lines
     FROM bar_product_recipes r
     JOIN products p ON p.id=r.product_id AND p.organisation_id=r.organisation_id
     LEFT JOIN bar_product_recipe_lines l ON l.recipe_id=r.id AND l.organisation_id=r.organisation_id
     LEFT JOIN products ingredient ON ingredient.id=l.ingredient_product_id AND ingredient.organisation_id=r.organisation_id
     WHERE r.organisation_id=$1
     GROUP BY r.id,p.name
     ORDER BY p.name,r.version_no DESC LIMIT 500`,
    [org(req)]
  );
  res.json({ data: result.rows });
});

barMenuRouter.post('/bar/recipes', requirePermission('catalogue:manage'), async (req, res) => {
  const parsed = recipePayload.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  const data = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const product = await client.query("SELECT id FROM products WHERE id=$1 AND organisation_id=$2 AND status='ACTIVE' FOR UPDATE", [data.productId, org(req)]);
    if (!product.rowCount) { await client.query('ROLLBACK'); return fail(res, 'PRODUCT_NOT_FOUND', 'Active menu product not found', 404); }
    const ingredientIds = data.lines.map(line => line.ingredientProductId);
    const ingredients = await client.query(
      "SELECT id FROM products WHERE organisation_id=$1 AND status='ACTIVE' AND id=ANY($2::uuid[]) FOR SHARE",
      [org(req), ingredientIds]
    );
    if (ingredients.rowCount !== ingredientIds.length) { await client.query('ROLLBACK'); return fail(res, 'INVALID_INGREDIENT', 'Every recipe ingredient must be an active product in this organisation', 400); }
    const version = await client.query('SELECT COALESCE(MAX(version_no),0)+1 AS next_version FROM bar_product_recipes WHERE organisation_id=$1 AND product_id=$2', [org(req), data.productId]);
    const recipe = await client.query(
      `INSERT INTO bar_product_recipes(organisation_id,product_id,version_no,yield_quantity,recipe_kind,created_by)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [org(req), data.productId, version.rows[0].next_version, data.yieldQuantity, data.kind, req.auth!.userId]
    );
    for (const line of data.lines) await client.query(
      'INSERT INTO bar_product_recipe_lines(organisation_id,recipe_id,product_id,ingredient_product_id,quantity) VALUES($1,$2,$3,$4,$5)',
      [org(req), recipe.rows[0].id, data.productId, line.ingredientProductId, line.quantity]
    );
    await client.query('COMMIT');
    return res.status(201).json({ data: recipe.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

barMenuRouter.patch('/bar/recipes/:recipeId/lines', requirePermission('catalogue:manage'), async (req, res) => {
  const parsed = z.object({
    yieldQuantity: z.number().positive().max(999999).refine(value => Math.round(value * 1000) === value * 1000),
    lines: z.array(recipeLine).min(1).max(100)
  }).superRefine((value, ctx) => {
    if (new Set(value.lines.map(line => line.ingredientProductId)).size !== value.lines.length) {
      ctx.addIssue({ code: 'custom', message: 'A recipe can contain an ingredient only once', path: ['lines'] });
    }
    if (value.lines.some(line => Math.round(line.quantity * 1000) !== line.quantity * 1000)) {
      ctx.addIssue({ code: 'custom', message: 'Ingredient quantities support at most three decimal places', path: ['lines'] });
    }
    if (value.lines.some(line => Math.round(line.quantity / value.yieldQuantity * 1000) < 1)) {
      ctx.addIssue({ code: 'custom', message: 'Each ingredient must consume at least 0.001 stock units per portion', path: ['lines'] });
    }
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const recipe = await client.query("SELECT * FROM bar_product_recipes WHERE id=$1 AND organisation_id=$2 FOR UPDATE", [req.params.recipeId, org(req)]);
    if (!recipe.rowCount) { await client.query('ROLLBACK'); return fail(res, 'RECIPE_NOT_FOUND', 'Recipe not found', 404); }
    if (recipe.rows[0].status !== 'DRAFT') { await client.query('ROLLBACK'); return fail(res, 'RECIPE_NOT_EDITABLE', 'Only draft recipes can be edited', 409); }
    if (parsed.data.lines.some(line => line.ingredientProductId === recipe.rows[0].product_id)) {
      await client.query('ROLLBACK');
      return fail(res, 'RECIPE_SELF_REFERENCE', 'A menu product cannot be its own recipe ingredient');
    }
    const ingredientIds = parsed.data.lines.map(line => line.ingredientProductId);
    const ingredients = await client.query(
      "SELECT id FROM products WHERE organisation_id=$1 AND status='ACTIVE' AND id=ANY($2::uuid[]) FOR SHARE",
      [org(req), ingredientIds]
    );
    if (ingredients.rowCount !== ingredientIds.length) { await client.query('ROLLBACK'); return fail(res, 'INVALID_INGREDIENT', 'Every recipe ingredient must be an active product in this organisation', 400); }
    await client.query('DELETE FROM bar_product_recipe_lines WHERE recipe_id=$1 AND organisation_id=$2', [req.params.recipeId, org(req)]);
    for (const line of parsed.data.lines) await client.query(
      'INSERT INTO bar_product_recipe_lines(organisation_id,recipe_id,product_id,ingredient_product_id,quantity) VALUES($1,$2,$3,$4,$5)',
      [org(req), req.params.recipeId, recipe.rows[0].product_id, line.ingredientProductId, line.quantity]
    );
    const updated = await client.query('UPDATE bar_product_recipes SET yield_quantity=$1 WHERE id=$2 RETURNING *', [parsed.data.yieldQuantity, req.params.recipeId]);
    await client.query('COMMIT');
    return res.json({ data: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

barMenuRouter.post('/bar/recipes/:recipeId/activate', requirePermission('catalogue:manage'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const recipe = await client.query('SELECT * FROM bar_product_recipes WHERE id=$1 AND organisation_id=$2 FOR UPDATE', [req.params.recipeId, org(req)]);
    if (!recipe.rowCount) { await client.query('ROLLBACK'); return fail(res, 'RECIPE_NOT_FOUND', 'Recipe not found', 404); }
    if (recipe.rows[0].status !== 'DRAFT') { await client.query('ROLLBACK'); return fail(res, 'RECIPE_NOT_DRAFT', 'Only a draft recipe can be activated', 409); }
    const lines = await client.query('SELECT 1 FROM bar_product_recipe_lines WHERE recipe_id=$1 AND organisation_id=$2 LIMIT 1', [req.params.recipeId, org(req)]);
    if (!lines.rowCount) { await client.query('ROLLBACK'); return fail(res, 'EMPTY_RECIPE', 'Add at least one ingredient before activation', 409); }
    await client.query("UPDATE bar_product_recipes SET status='ARCHIVED' WHERE organisation_id=$1 AND product_id=$2 AND status='ACTIVE'", [org(req), recipe.rows[0].product_id]);
    const active = await client.query(
      "UPDATE bar_product_recipes SET status='ACTIVE',activated_by=$1,activated_at=NOW() WHERE id=$2 AND organisation_id=$3 RETURNING *",
      [req.auth!.userId, req.params.recipeId, org(req)]
    );
    await client.query('COMMIT');
    return res.json({ data: active.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
