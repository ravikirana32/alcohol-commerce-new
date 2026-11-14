import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Building2, Plus, RefreshCw, Users, MapPin, ShieldCheck, Copy, AlertCircle } from 'lucide-react';
import { ActionGuard } from '../ActionGuard';

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
type Outlet = { id:string; outlet_code:string; name:string; outlet_type:string; operating_mode:string; state_code:string; status:string };
type Member = { id:string; email:string; display_name:string; status:string; role_code:string; membership_status:string; outlet_ids:string[] };
type Organisation = { id:string; name:string; legal_name:string; organisation_type:string; organisation_profile:string; gstin:string|null; status:string };
type Licence = { id:string; outlet_id:string; licence_type:string; licence_number:string; status:string; valid_until:string|null; issuing_authority:string|null };

export default function OrganisationWorkspace({ token }: { token:string }) {
  const [organisation,setOrganisation]=useState<Organisation|null>(null);
  const [outlets,setOutlets]=useState<Outlet[]>([]);
  const [members,setMembers]=useState<Member[]>([]);
  const [licences,setLicences]=useState<Licence[]>([]);
  const [licenceForm,setLicenceForm]=useState({outletId:'',licenceType:'',licenceNumber:'',authority:'',validFrom:'',validUntil:'',activities:'RETAIL_SALE'});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [outletForm,setOutletForm]=useState({code:'',name:'',type:'RETAIL',operatingMode:'RETAIL_ONLY',stateCode:'KA'});
  const [inviteForm,setInviteForm]=useState({email:'',displayName:'',roleCode:'CASHIER'});
  const [inviteToken,setInviteToken]=useState('');
  const [profileForm,setProfileForm]=useState({name:'',legalName:'',gstin:'',profile:'RETAIL_ONLY'});
  const request=useCallback(async(path:string,init:RequestInit={})=>{
    const response=await fetch(`${API}/api/v1${path}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init.headers}});
    const body=response.status===204?null:await response.json();
    if(!response.ok)throw new Error(body?.error?.message??body?.error?.code??`Request failed (${response.status})`);
    return body;
  },[token]);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const [org,outletData,memberData]=await Promise.all([request('/organisation/current'),request('/outlets'),request('/organisation/members')]);
      const licenceData=await Promise.all((outletData.data as Outlet[]).map(o=>request(`/outlets/${o.id}/licences`).then(r=>r.data as Licence[])));
      setOrganisation(org.data);setProfileForm({name:org.data.name,legalName:org.data.legal_name??'',gstin:org.data.gstin??'',profile:org.data.organisation_profile??'RETAIL_ONLY'});setOutlets(outletData.data);setMembers(memberData.data);setLicences(licenceData.flat());
      if(!licenceForm.outletId&&outletData.data[0])setLicenceForm(v=>({...v,outletId:outletData.data[0].id}));
    }catch(e){setError(e instanceof Error?e.message:'Unable to load organisation workspace');}
    finally{setLoading(false);}
  },[request]);
  useEffect(()=>{void load();},[load]);
  async function saveProfile(e:FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{await request('/organisation/current',{method:'PATCH',body:JSON.stringify({name:profileForm.name,legalName:profileForm.legalName,gstin:profileForm.gstin||null,profile:profileForm.profile})});setMessage('Organisation profile updated.');await load();}catch(e){setError(e instanceof Error?e.message:'Profile update failed');}finally{setBusy(false);}}
  async function createOutlet(e:FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{await request('/outlets',{method:'POST',body:JSON.stringify(outletForm)});setOutletForm({code:'',name:'',type:'RETAIL',operatingMode:'RETAIL_ONLY',stateCode:'KA'});setMessage('Outlet created. It remains pending until platform review/activation.');await load();}catch(e){setError(e instanceof Error?e.message:'Outlet creation failed');}finally{setBusy(false);}}
  async function addLicence(e:FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{await request(`/outlets/${licenceForm.outletId}/licences`,{method:'POST',body:JSON.stringify({licenceType:licenceForm.licenceType,licenceNumber:licenceForm.licenceNumber,authority:licenceForm.authority||undefined,validFrom:licenceForm.validFrom||undefined,validUntil:licenceForm.validUntil||undefined,activities:[licenceForm.activities]})});setMessage('Licence record submitted. It cannot enable transactions until platform verification and outlet activation.');setLicenceForm(v=>({...v,licenceType:'',licenceNumber:'',authority:'',validFrom:'',validUntil:''}));await load();}catch(e){setError(e instanceof Error?e.message:'Licence submission failed');}finally{setBusy(false);}}
  async function invite(e:FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');setInviteToken('');try{const result=await request('/organisation/invitations',{method:'POST',body:JSON.stringify(inviteForm)});setInviteToken(result.data.invitationToken);setMessage('Invitation created. Copy the token and deliver it through your approved email channel.');}catch(e){setError(e instanceof Error?e.message:'Invitation failed');}finally{setBusy(false);}}
  async function assignOutlets(userId:string,outletIds:string[]){setBusy(true);try{await request(`/organisation/members/${userId}/outlets`,{method:'PUT',body:JSON.stringify({outletIds})});setMessage('Outlet access updated.');await load();}catch(e){setError(e instanceof Error?e.message:'Outlet access update failed');}finally{setBusy(false);}}
  async function updateMember(userId:string,status:'ACTIVE'|'SUSPENDED'|'REVOKED'){setBusy(true);try{await request(`/organisation/members/${userId}`,{method:'PATCH',body:JSON.stringify({status})});await load();}catch(e){setError(e instanceof Error?e.message:'Membership update failed');}finally{setBusy(false);}}
  const copyToken=()=>{void navigator.clipboard.writeText(inviteToken).then(()=>setMessage('Invitation token copied.')).catch(()=>setError('Clipboard access unavailable; select and copy the token manually.'));};
  if(loading)return <div className="panel" style={{padding:24}}>Loading organisation settings…</div>;
  return <div style={{display:'grid',gap:20}}>
    {error&&<div className="notice" role="alert"><AlertCircle size={17}/><div><strong>Action could not be completed</strong><span>{error}</span></div></div>}
    {message&&<div className="notice"><ShieldCheck size={17}/><div><strong>Update</strong><span>{message}</span></div></div>}
    <section className="panel" style={{padding:22}}>
      <div className="panel-head"><div><h2>Organisation profile</h2><p>Identity, business profile and registration status</p></div><Building2 size={20}/></div>
      {organisation?<>
        <div className="stats" style={{gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))'}}>
          <div className="stat-card"><small>Organisation</small><strong>{organisation.name}</strong><small>{organisation.legal_name}</small></div>
          <div className="stat-card"><small>Business type</small><strong>{organisation.organisation_type}</strong><small>{organisation.organisation_profile}</small></div>
          <div className="stat-card"><small>Registration status</small><strong>{organisation.status}</strong><small>{organisation.gstin??'GSTIN not provided'}</small></div>
        </div>
        <ActionGuard action="organisation.manage"><form onSubmit={saveProfile} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginTop:18}}>
          <input required placeholder="Display name" value={profileForm.name} onChange={e=>setProfileForm({...profileForm,name:e.target.value})}/><input required placeholder="Legal name" value={profileForm.legalName} onChange={e=>setProfileForm({...profileForm,legalName:e.target.value})}/><input placeholder="GSTIN" value={profileForm.gstin} onChange={e=>setProfileForm({...profileForm,gstin:e.target.value})}/>
          <select value={profileForm.profile} onChange={e=>setProfileForm({...profileForm,profile:e.target.value})}><option value="RETAIL_ONLY">Retail only</option><option value="BAR_ONLY">Bar only</option><option value="HYBRID">Hybrid</option></select><button className="primary-button" disabled={busy}>Save organisation profile</button>
        </form></ActionGuard>
      </>:<p>No organisation context is selected for this account.</p>}
    </section>
    <section className="panel" style={{padding:22}}>
      <div className="panel-head"><div><h2>Outlets</h2><p>Manage locations within this organisation</p></div><MapPin size={20}/></div>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}><thead><tr>{['Code','Outlet','Type','State','Status'].map(x=><th key={x} style={{padding:10,borderBottom:'1px solid #e5e7eb'}}>{x}</th>)}</tr></thead><tbody>{outlets.map(o=><tr key={o.id}>{[o.outlet_code,o.name,o.outlet_type,o.state_code,o.status].map((x,i)=><td key={i} style={{padding:10,borderBottom:'1px solid #eef0f2'}}>{x}</td>)}</tr>)}{!outlets.length&&<tr><td colSpan={5} style={{padding:14}}>No outlets created yet.</td></tr>}</tbody></table></div>
      <ActionGuard action="outlet.manage"><form onSubmit={createOutlet} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginTop:18}}>
        <input required placeholder="Outlet code" value={outletForm.code} onChange={e=>setOutletForm({...outletForm,code:e.target.value})}/><input required placeholder="Outlet name" value={outletForm.name} onChange={e=>setOutletForm({...outletForm,name:e.target.value})}/>
        <select value={outletForm.type} onChange={e=>setOutletForm({...outletForm,type:e.target.value,operatingMode:e.target.value==='BAR'?'BAR_ONLY':e.target.value==='HYBRID'?'HYBRID':'RETAIL_ONLY'})}><option value="RETAIL">Retail</option><option value="BAR">Bar</option><option value="HYBRID">Hybrid</option></select>
        <input required maxLength={2} placeholder="State code" value={outletForm.stateCode} onChange={e=>setOutletForm({...outletForm,stateCode:e.target.value.toUpperCase()})}/>
        <button className="primary-button" disabled={busy}><Plus size={15}/> Create outlet</button>
      </form></ActionGuard>
    </section>
    <section className="panel" style={{padding:22}}>
      <div className="panel-head"><div><h2>Outlet licences</h2><p>Maintain licence references and review status for each outlet</p></div><ShieldCheck size={20}/></div>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}><thead><tr>{['Outlet','Licence type','Licence reference','Valid until','Review status'].map(x=><th key={x} style={{padding:10,borderBottom:'1px solid #e5e7eb'}}>{x}</th>)}</tr></thead><tbody>{licences.map(l=><tr key={l.id}><td style={{padding:10}}>{outlets.find(o=>o.id===l.outlet_id)?.name??l.outlet_id}</td><td style={{padding:10}}>{l.licence_type}</td><td style={{padding:10}}>{l.licence_number}</td><td style={{padding:10}}>{l.valid_until??'Not specified'}</td><td style={{padding:10}}>{l.status}</td></tr>)}{!licences.length&&<tr><td colSpan={5} style={{padding:14}}>No licence records submitted.</td></tr>}</tbody></table></div>
      <ActionGuard action="compliance.manage"><form onSubmit={addLicence} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginTop:18}}>
        <select required value={licenceForm.outletId} onChange={e=>setLicenceForm({...licenceForm,outletId:e.target.value})}><option value="">Select outlet</option>{outlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <input required placeholder="Licence type" value={licenceForm.licenceType} onChange={e=>setLicenceForm({...licenceForm,licenceType:e.target.value})}/><input required placeholder="Licence number" value={licenceForm.licenceNumber} onChange={e=>setLicenceForm({...licenceForm,licenceNumber:e.target.value})}/>
        <input placeholder="Issuing authority" value={licenceForm.authority} onChange={e=>setLicenceForm({...licenceForm,authority:e.target.value})}/><input type="date" value={licenceForm.validFrom} onChange={e=>setLicenceForm({...licenceForm,validFrom:e.target.value})}/><input type="date" value={licenceForm.validUntil} onChange={e=>setLicenceForm({...licenceForm,validUntil:e.target.value})}/>
        <select value={licenceForm.activities} onChange={e=>setLicenceForm({...licenceForm,activities:e.target.value})}><option value="RETAIL_SALE">Retail sale</option><option value="BAR_SERVICE">Bar service</option></select>
        <button className="primary-button" disabled={busy||!licenceForm.outletId}><Plus size={15}/> Submit licence record</button>
      </form></ActionGuard>
    </section>
    <section className="panel" style={{padding:22}}>
      <div className="panel-head"><div><h2>Team and access</h2><p>Invite team members and suspend or revoke organisation access</p></div><Users size={20}/></div>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}><thead><tr>{['Name','Email','Role','Account','Membership','Outlet access','Action'].map(x=><th key={x} style={{padding:10,borderBottom:'1px solid #e5e7eb'}}>{x}</th>)}</tr></thead><tbody>{members.map(m=><tr key={m.id}><td style={{padding:10}}>{m.display_name}</td><td style={{padding:10}}>{m.email}</td><td style={{padding:10}}>{m.role_code}</td><td style={{padding:10}}>{m.status}</td><td style={{padding:10}}>{m.membership_status}</td><td style={{padding:10}}><ActionGuard action="outlet.manage"><select multiple disabled={busy||m.membership_status!=='ACTIVE'} value={m.outlet_ids??[]} onChange={e=>void assignOutlets(m.id,Array.from(e.target.selectedOptions).map(o=>o.value))} style={{minWidth:130,minHeight:54}}>{outlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></ActionGuard></td><td style={{padding:10}}>{m.membership_status==='ACTIVE'?<ActionGuard action="users.manage"><button className="secondary-button" disabled={busy} onClick={()=>void updateMember(m.id,'SUSPENDED')}>Suspend</button></ActionGuard>:m.membership_status==='SUSPENDED'?<ActionGuard action="users.manage"><button className="secondary-button" disabled={busy} onClick={()=>void updateMember(m.id,'ACTIVE')}>Reactivate</button></ActionGuard>:<span>—</span>}</td></tr>)}{!members.length&&<tr><td colSpan={7} style={{padding:14}}>No team members found.</td></tr>}</tbody></table></div>
      <ActionGuard action="users.manage"><form onSubmit={invite} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10,marginTop:18}}>
        <input required type="email" placeholder="Team member email" value={inviteForm.email} onChange={e=>setInviteForm({...inviteForm,email:e.target.value})}/><input required placeholder="Display name" value={inviteForm.displayName} onChange={e=>setInviteForm({...inviteForm,displayName:e.target.value})}/>
        <select value={inviteForm.roleCode} onChange={e=>setInviteForm({...inviteForm,roleCode:e.target.value})}>{['CASHIER','RETAIL_MANAGER','BAR_MANAGER','BARTENDER','BRAND_ANALYST','SALES_REP','AUDITOR'].map(role=><option key={role}>{role}</option>)}</select>
        <button className="primary-button" disabled={busy}><Plus size={15}/> Create invitation</button>
      </form></ActionGuard>
      {inviteToken&&<div style={{marginTop:14,padding:14,background:'#f7f8fa',borderRadius:8}}><strong>One-time invitation token</strong><p style={{overflowWrap:'anywhere',fontFamily:'monospace'}}>{inviteToken}</p><button className="secondary-button" onClick={copyToken}><Copy size={14}/> Copy token</button></div>}
    </section>
    <div style={{display:'flex',justifyContent:'flex-end'}}><button className="secondary-button" onClick={()=>void load()}><RefreshCw size={14}/> Refresh</button></div>
  </div>;
}
