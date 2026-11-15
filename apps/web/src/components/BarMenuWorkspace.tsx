import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ActionGuard } from '../ActionGuard';

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
type Row = Record<string, any>;
type IngredientDraft = { ingredientProductId: string; quantity: string };
type ModifierOptionDraft={name:string;priceDelta:string;ingredientProductId:string;ingredientQuantity:string};
const measures = ['PEG','BOTTLE','PACKAGED'] as const;

export default function BarMenuWorkspace({ token }: { token: string }) {
  const [outlets,setOutlets]=useState<Row[]>([]);
  const [products,setProducts]=useState<Row[]>([]);
  const [menuRows,setMenuRows]=useState<Row[]>([]);
  const [recipes,setRecipes]=useState<Row[]>([]);
  const [modifierGroups,setModifierGroups]=useState<Row[]>([]);
  const [outletId,setOutletId]=useState('');
  const [measureType,setMeasureType]=useState<(typeof measures)[number]>('PACKAGED');
  const [productId,setProductId]=useState('');
  const [yieldQuantity,setYieldQuantity]=useState('1');
  const [recipeKind,setRecipeKind]=useState<'RECIPE'|'COMBO'>('RECIPE');
  const [ingredientRows,setIngredientRows]=useState<IngredientDraft[]>([{ingredientProductId:'',quantity:'1'}]);
  const [modifierName,setModifierName]=useState('');
  const [modifierGroupType,setModifierGroupType]=useState<'ADD_ON'|'SUBSTITUTION'>('ADD_ON');
  const [modifierSubstitutionProductId,setModifierSubstitutionProductId]=useState('');
  const [modifierMin,setModifierMin]=useState('0');
  const [modifierMax,setModifierMax]=useState('1');
  const [modifierOptions,setModifierOptions]=useState<ModifierOptionDraft[]>([
    {name:'',priceDelta:'0',ingredientProductId:'',ingredientQuantity:'0'},
    {name:'',priceDelta:'0',ingredientProductId:'',ingredientQuantity:'0'}
  ]);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  async function request(path:string,init:RequestInit={}) {
    const response=await fetch(`${API}/api/v1${path}`,{
      ...init,
      headers:{Authorization:`******`,'Content-Type':'application/json',...(init.headers||{})}
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body.error?.message||body.error?.code||`Request failed (${response.status})`);
    return body;
  }
  async function loadMenu(selectedOutlet=outletId) {
    if(!selectedOutlet)return;
    const [menu,recipeRows]=await Promise.all([
      request(`/bar/menu?outletId=${selectedOutlet}`),
      request('/bar/recipes')
    ]);
    setMenuRows(menu.data);
    setRecipes(recipeRows.data);
  }
  useEffect(()=>{
    let active=true;
    setBusy(true);
    Promise.all([request('/outlets'),request('/catalogue/products?status=ACTIVE'),request('/bar/recipes')])
      .then(([outletRows,productRows,recipeRows])=>{
        if(!active)return;
        const availableOutlets=outletRows.data??[];
        setOutlets(availableOutlets);
        setProducts(productRows.data??[]);
        setRecipes(recipeRows.data??[]);
        if(availableOutlets.length)setOutletId(availableOutlets[0].id);
      })
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load menu setup');})
      .finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{void loadMenu().catch(e=>setError(e instanceof Error?e.message:'Unable to load bar menu'));},[outletId]);
  useEffect(()=>{
    if(!productId){setModifierGroups([]);return;}
    request(`/bar/modifiers?productId=${productId}`)
      .then(result=>setModifierGroups(result.data??[]))
      .catch(e=>setError(e instanceof Error?e.message:'Unable to load modifier groups'));
  },[productId]);
  useEffect(()=>{
    if(!modifierSubstitutionProductId)return;
    const active=recipes.find(recipe=>recipe.product_id===productId&&recipe.status==='ACTIVE');
    if(!(active?.lines??[]).some((line:Row)=>line.ingredientProductId===modifierSubstitutionProductId)){
      setModifierSubstitutionProductId('');
    }
  },[productId,recipes,modifierSubstitutionProductId]);

  const uniqueProducts=useMemo(()=>Array.from(new Map(menuRows.map(row=>[row.product_id,row])).values()),[menuRows]);
  async function saveAvailability(product:Row,isAvailable:boolean) {
    setError('');setMessage('');
    try {
      await request('/bar/menu/availability',{method:'PUT',body:JSON.stringify({
        outletId,productId:product.product_id,measureType,isAvailable,
        reason:isAvailable?undefined:'Temporarily unavailable'
      })});
      setMessage(`${product.name} ${isAvailable?'enabled':'marked unavailable'} for ${measureType.toLowerCase()} service.`);
      await loadMenu();
    } catch(e) { setError(e instanceof Error?e.message:'Unable to update menu availability'); }
  }
  function addIngredient() {
    setIngredientRows(rows=>[...rows,{ingredientProductId:'',quantity:'1'}]);
  }
  function updateIngredient(index:number,patch:Partial<IngredientDraft>) {
    setIngredientRows(rows=>rows.map((row,i)=>i===index?{...row,...patch}:row));
  }
  async function createRecipe(event:FormEvent) {
    event.preventDefault();setError('');setMessage('');
    try {
      const saved=await request('/bar/recipes',{method:'POST',body:JSON.stringify({
        productId,kind:recipeKind,yieldQuantity:Number(yieldQuantity),
        lines:ingredientRows.map(row=>({ingredientProductId:row.ingredientProductId,quantity:Number(row.quantity)}))
      })});
      setMessage(`Draft ${recipeKind.toLowerCase()} v${saved.data.version_no} created. Activate it when the ingredients and yield are confirmed.`);
      setIngredientRows([{ingredientProductId:'',quantity:'1'}]);
      await loadMenu();
    } catch(e) { setError(e instanceof Error?e.message:'Unable to create recipe'); }
  }
  async function activateRecipe(recipe:Row) {
    setError('');setMessage('');
    try {
      await request(`/bar/recipes/${recipe.id}/activate`,{method:'POST',body:'{}'});
      setMessage(`Recipe v${recipe.version_no} for ${recipe.product_name} is now active.`);
      await loadMenu();
    } catch(e) { setError(e instanceof Error?e.message:'Unable to activate recipe'); }
  }
  async function saveModifierGroup(event:FormEvent){
    event.preventDefault();setError('');setMessage('');setBusy(true);
    const options=modifierOptions.filter(row=>row.name.trim()).map(row=>({
      name:row.name,priceDelta:Number(row.priceDelta),
      ...(row.ingredientProductId?{ingredientProductId:row.ingredientProductId,ingredientQuantity:Number(row.ingredientQuantity)}:{ingredientQuantity:0})
    }));
    try{
      await request('/bar/modifiers',{method:'POST',body:JSON.stringify({
        productId,name:modifierName,minSelections:Number(modifierMin),maxSelections:Number(modifierMax),
        ...(modifierSubstitutionProductId?{substitutesProductId:modifierSubstitutionProductId}:{}),options
      })});
      setModifierName('');
      setModifierGroupType('ADD_ON');
      setModifierSubstitutionProductId('');
      setModifierMin('0');setModifierMax('1');
      setModifierOptions([{name:'',priceDelta:'0',ingredientProductId:'',ingredientQuantity:'0'},{name:'',priceDelta:'0',ingredientProductId:'',ingredientQuantity:'0'}]);
      setMessage('Modifier group saved.'); 
      const groups=await request(`/bar/modifiers?productId=${productId}`);
      setModifierGroups(groups.data??[]);
    }catch(e){setError(e instanceof Error?e.message:'Unable to save modifier group');}
    finally{setBusy(false);}
  }
  async function setModifierStatus(group:Row){
    setBusy(true);
    try{
      await request(`/bar/modifier-groups/${group.id}/status`,{method:'PATCH',body:JSON.stringify({status:group.status==='ACTIVE'?'INACTIVE':'ACTIVE'})});
      const groups=await request(`/bar/modifiers?productId=${productId}`);
      setModifierGroups(groups.data??[]);
    }catch(e){setError(e instanceof Error?e.message:'Unable to update modifier group');}
    finally{setBusy(false);}
  }

  return <section className="panel" style={{padding:22}}>
    <div className="panel-head"><div><h2>Bar menu & recipes</h2><p>Control outlet/measure availability and versioned ingredient recipes. Stock changes are posted with the bar ticket.</p></div><button className="secondary-button" onClick={()=>void loadMenu()}>Refresh</button></div>
    {message&&<p role="status" style={{color:'green'}}>{message}</p>}
    {error&&<p role="alert" style={{color:'#b42318'}}>{error}</p>}
    <div style={{display:'flex',gap:10,margin:'14px 0',flexWrap:'wrap'}}>
      <label>Outlet <select value={outletId} onChange={e=>setOutletId(e.target.value)}><option value="">Select outlet</option>{outlets.map(outlet=><option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></label>
      <label>Measure <select value={measureType} onChange={e=>setMeasureType(e.target.value as (typeof measures)[number])}>{measures.map(measure=><option key={measure}>{measure}</option>)}</select></label>
    </div>
    <div style={{overflowX:'auto',marginBottom:24}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr>{['SKU','Menu item','Availability','Recipe cost / margin','Action'].map(label=><th key={label} style={{textAlign:'left',padding:9,borderBottom:'1px solid #ddd'}}>{label}</th>)}</tr></thead>
        <tbody>{uniqueProducts.map(product=>{
          const availability=menuRows.find(row=>row.product_id===product.product_id&&row.measure_type===measureType);
          const isAvailable=availability?.is_available!==false;
          const cost=availability?.estimated_cost==null||!Number(availability.yield_quantity)
            ?null:Number(availability.estimated_cost)/Number(availability.yield_quantity);
          const price=(availability?.menu_prices??[]).find((row:Row)=>row.measureType===measureType);
          return <tr key={product.product_id}>
            <td style={{padding:9,borderBottom:'1px solid #eee'}}>{product.sku}</td>
            <td style={{padding:9,borderBottom:'1px solid #eee'}}>{product.name}</td>
            <td style={{padding:9,borderBottom:'1px solid #eee'}}>{isAvailable?'Available':availability?.availability_reason||'Unavailable'}</td>
            <td style={{padding:9,borderBottom:'1px solid #eee'}}>{cost==null?'Cost unavailable':`₹${cost.toFixed(2)} / portion${price?` · margin ₹${(Number(price.unitPrice)-cost).toFixed(2)}`:''}`}</td>
            <td style={{padding:9,borderBottom:'1px solid #eee'}}><ActionGuard action="catalogue.manage"><button className="secondary-button" disabled={!outletId} onClick={()=>void saveAvailability(product,!isAvailable)}>{isAvailable?'Mark unavailable':'Enable'}</button></ActionGuard></td>
          </tr>;
        })}{!uniqueProducts.length&&<tr><td colSpan={5} style={{padding:16}}>No active products are available.</td></tr>}</tbody>
      </table>
    </div>
    <h3>Recipe versions</h3>
    <div style={{display:'grid',gap:8,marginBottom:16}}>
      {recipes.map(recipe=><div key={recipe.id} style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',padding:10,border:'1px solid #eee',borderRadius:8}}>
        <div><strong>{recipe.product_name}</strong> · {recipe.recipe_kind==='COMBO'?'Combo':'Recipe'} · v{recipe.version_no} · {recipe.status} · yield {recipe.yield_quantity}<div><small>{(recipe.lines??[]).map((line:Row)=>`${line.ingredientName}: ${line.quantity}`).join(' · ')||'No ingredients'}</small></div></div>
        {recipe.status==='DRAFT'&&<ActionGuard action="catalogue.manage"><button className="primary-button" onClick={()=>void activateRecipe(recipe)}>Activate</button></ActionGuard>}
      </div>)}
      {!recipes.length&&<p>No recipes configured.</p>}
    </div>
    <ActionGuard action="catalogue.manage">
      <form onSubmit={createRecipe} style={{display:'grid',gap:10,padding:14,border:'1px solid #eee',borderRadius:8}}>
        <h3 style={{margin:0}}>Create a draft recipe</h3>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <label>Menu product <select required value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Select product</option>{products.map(product=><option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}</select></label>
          <label>Recipe type <select value={recipeKind} onChange={e=>setRecipeKind(e.target.value as 'RECIPE'|'COMBO')}><option value="RECIPE">Recipe</option><option value="COMBO">Combo</option></select></label>
          <label>Yield portions <input type="number" min="0.001" step="0.001" required value={yieldQuantity} onChange={e=>setYieldQuantity(e.target.value)}/></label>
        </div>
        {ingredientRows.map((ingredient,index)=><div key={index} style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <label>Ingredient <select required value={ingredient.ingredientProductId} onChange={e=>updateIngredient(index,{ingredientProductId:e.target.value})}><option value="">Select ingredient</option>{products.filter(product=>product.id!==productId).map(product=><option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}</select></label>
          <label>Stock units <input type="number" min="0.001" step="0.001" required value={ingredient.quantity} onChange={e=>updateIngredient(index,{quantity:e.target.value})}/></label>
          {ingredientRows.length>1&&<button type="button" className="secondary-button" onClick={()=>setIngredientRows(rows=>rows.filter((_,i)=>i!==index))}>Remove</button>}
        </div>)}
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" className="secondary-button" onClick={addIngredient}>Add ingredient</button><button className="primary-button" disabled={busy}>Save draft recipe</button></div>
      </form>
    </ActionGuard>
    <h3>Menu modifiers</h3>
    <p className="muted">Add-ons optionally consume stock. Substitution groups replace a specific active recipe ingredient and require exactly one stock-consuming option at checkout.</p>
    <div style={{display:'grid',gap:8,marginBottom:14}}>
      {modifierGroups.map(group=><div key={group.id} style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',padding:10,border:'1px solid #eee',borderRadius:8}}>
        <span><strong>{group.name}</strong> · {group.status} · select {group.min_selections}-{group.max_selections}{group.substitutes_product_name?` · replaces ${group.substitutes_product_name}`:''}<br/><small>{(group.options??[]).map((option:Row)=>`${option.name}${Number(option.priceDelta)?` (+₹${Number(option.priceDelta).toFixed(2)})`:''}${option.ingredientName?` · uses ${option.ingredientName} ${option.ingredientQuantity}`:''}`).join(' · ')}</small></span>
        <ActionGuard action="catalogue.manage"><button className="secondary-button" disabled={!productId} onClick={()=>void setModifierStatus(group)}>{group.status==='ACTIVE'?'Deactivate':'Activate'}</button></ActionGuard>
      </div>)}
      {!modifierGroups.length&&productId&&<small>No modifier groups configured for this product.</small>}
    </div>
    <ActionGuard action="catalogue.manage">
      <form onSubmit={saveModifierGroup} style={{display:'grid',gap:10,padding:14,border:'1px solid #eee',borderRadius:8}}>
        <h3 style={{margin:0}}>Create modifier group</h3>
        <label>Menu product<select required value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Select product</option>{products.map(product=><option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}</select></label>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <label>Group name<input required maxLength={100} value={modifierName} onChange={e=>setModifierName(e.target.value)} placeholder="Choose a side"/></label>
          <label>Group type<select value={modifierGroupType} onChange={e=>{
            const type=e.target.value as 'ADD_ON'|'SUBSTITUTION';
            setModifierGroupType(type);
            if(type==='SUBSTITUTION'){setModifierMin('1');setModifierMax('1');}
            else{setModifierSubstitutionProductId('');setModifierMin('0');setModifierMax('1');}
          }}><option value="ADD_ON">Add-on</option><option value="SUBSTITUTION">Ingredient substitution</option></select></label>
          {modifierGroupType==='SUBSTITUTION'&&<label>Recipe ingredient to replace<select required value={modifierSubstitutionProductId} onChange={e=>setModifierSubstitutionProductId(e.target.value)}><option value="">Select recipe ingredient</option>{(recipes.find(recipe=>recipe.product_id===productId&&recipe.status==='ACTIVE')?.lines??[]).map((line:Row)=><option key={line.ingredientProductId} value={line.ingredientProductId}>{line.ingredientName}</option>)}</select></label>}
          <label>Minimum selections<input type="number" min="0" max="20" disabled={modifierGroupType==='SUBSTITUTION'} value={modifierMin} onChange={e=>setModifierMin(e.target.value)}/></label>
          <label>Maximum selections<input type="number" min="1" max="20" disabled={modifierGroupType==='SUBSTITUTION'} value={modifierMax} onChange={e=>setModifierMax(e.target.value)}/></label>
        </div>
        {modifierOptions.map((option,index)=><div key={index} style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <label>Option<input required={index===0} value={option.name} onChange={e=>setModifierOptions(rows=>rows.map((row,i)=>i===index?{...row,name:e.target.value}:row))}/></label>
          <label>Price delta<input type="number" step="0.01" value={option.priceDelta} onChange={e=>setModifierOptions(rows=>rows.map((row,i)=>i===index?{...row,priceDelta:e.target.value}:row))}/></label>
          <label>Ingredient {modifierGroupType==='SUBSTITUTION'?'(replacement required)':'(optional)'}<select required={Boolean(modifierGroupType==='SUBSTITUTION'&&option.name.trim())} value={option.ingredientProductId} onChange={e=>setModifierOptions(rows=>rows.map((row,i)=>i===index?{...row,ingredientProductId:e.target.value,ingredientQuantity:e.target.value?'1':'0'}:row))}><option value="">No stock consumption</option>{products.filter(product=>product.id!==productId&&product.id!==modifierSubstitutionProductId).map(product=><option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}</select></label>
          {option.ingredientProductId&&<label>Stock units<input type="number" min="0.001" step="0.001" value={option.ingredientQuantity} onChange={e=>setModifierOptions(rows=>rows.map((row,i)=>i===index?{...row,ingredientQuantity:e.target.value}:row))}/></label>}
          {modifierOptions.length>1&&<button type="button" className="secondary-button" onClick={()=>setModifierOptions(rows=>rows.filter((_,i)=>i!==index))}>Remove option</button>}
        </div>)}
        {modifierGroupType==='SUBSTITUTION'&&<small>Substitution applies only when this menu product has an active recipe containing the selected ingredient. Every replacement option must consume stock.</small>}
        <div style={{display:'flex',gap:8}}><button type="button" className="secondary-button" onClick={()=>setModifierOptions(rows=>[...rows,{name:'',priceDelta:'0',ingredientProductId:'',ingredientQuantity:'0'}])}>Add option</button><button className="primary-button" disabled={busy||!productId||!modifierName.trim()||(modifierGroupType==='SUBSTITUTION'&&(!modifierSubstitutionProductId||!modifierOptions.every(option=>option.name.trim()&&option.ingredientProductId&&Number(option.ingredientQuantity)>0)))}>Save modifier group</button></div>
      </form>
    </ActionGuard>
  </section>;
}
