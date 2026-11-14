import { createHash } from 'node:crypto';
export type ProviderKind='ACCOUNTING_EXPORT'|'ERP'|'DELIVERY'|'CRM'|'DATA_WAREHOUSE'|'CUSTOM';
export type AdapterInput={provider:ProviderKind;eventType:string;payload:Record<string,unknown>;idempotencyKey:string;endpointUrl:string};
export type AdapterAssessment={accepted:boolean;provider:ProviderKind;payloadHash:string;idempotencyKey:string;endpointHost:string;reasons:string[];dispatchAllowed:false};
const supported:Record<ProviderKind,string[]>={
 ACCOUNTING_EXPORT:['JOURNAL_POSTED','PERIOD_CLOSED'],ERP:['ORDER_CREATED','STOCK_UPDATED','GOODS_RECEIVED'],
 DELIVERY:['ORDER_READY','ORDER_DISPATCHED'],CRM:['CUSTOMER_UPDATED','LOYALTY_REDEEMED'],
 DATA_WAREHOUSE:['DAILY_SNAPSHOT'],CUSTOM:[]
};
export function assessProviderEvent(x:AdapterInput):AdapterAssessment {
 const reasons:string[]=[];let url:URL|undefined;
 try{url=new URL(x.endpointUrl);}catch{reasons.push('INVALID_ENDPOINT_URL');}
 if(url && url.protocol!=='https:')reasons.push('HTTPS_REQUIRED');
 if(url && (url.username||url.password))reasons.push('URL_CREDENTIALS_FORBIDDEN');
 if(url && (url.hostname==='localhost'||url.hostname.endsWith('.local')||url.hostname==='0.0.0.0'||url.hostname==='127.0.0.1'||url.hostname==='::1'))reasons.push('LOCAL_ENDPOINT_FORBIDDEN');
 if(!x.idempotencyKey||x.idempotencyKey.length>200)reasons.push('INVALID_IDEMPOTENCY_KEY');
 if(!x.eventType||x.eventType.length>100)reasons.push('INVALID_EVENT_TYPE');
 if(x.provider!=='CUSTOM'&&!supported[x.provider].includes(x.eventType))reasons.push('UNSUPPORTED_PROVIDER_EVENT');
 const payloadHash=createHash('sha256').update(JSON.stringify(x.payload)).digest('hex');
 return {accepted:reasons.length===0,provider:x.provider,payloadHash,idempotencyKey:x.idempotencyKey,endpointHost:url?.hostname??'',reasons,dispatchAllowed:false};
}
