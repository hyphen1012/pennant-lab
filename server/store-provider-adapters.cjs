// Trusted store query adapters. Client proof is only a lookup input, never
// authority. The registry stores normalized results, not unsigned claims.
const {createHash}=require('node:crypto');
const accountId=a=>typeof a==='string'&&/^[a-f0-9]{64}$/.test(a);
const tokenId=t=>typeof t==='string'&&/^[A-Za-z0-9._~+\/=:-]{1,2048}$/.test(t);
const appleId=t=>typeof t==='string'&&/^\d{1,40}$/.test(t);
const timestamp=t=>Number.isSafeInteger(t)&&t>=0;
const hash=t=>createHash('sha256').update(t).digest('hex');
function appleAccountToken(a){if(!accountId(a))throw Error('invalid account');const h=a.slice(0,32);return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);}
function catalogMap(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>20)throw Error('invalid product catalog');
 const m=new Map();for(const r of rows){if(typeof r.id!=='string'||!r.id||r.id.length>200||!['permanent','vip'].includes(r.product)||m.has(r.id))throw Error('invalid product');m.set(r.id,r.product);}return m;
}
function makeClock(now){let last=-1;return ()=>{const t=now();if(!timestamp(t)||t<last)throw Error('server time regressed');last=t;return t;};}
function createAppleAdapter({api,verifier,bundleId,environment,catalog,lookup,now=Date.now}={}){
 if(!api||!verifier||typeof lookup!=='function'||!['Sandbox','Production'].includes(environment)||typeof bundleId!=='string'||!bundleId)throw Error('Apple configuration required');
 const products=catalogMap(catalog),clock=makeClock(now);
 async function decode(proof){if(typeof proof!=='string'||proof.length>65536||!proof)throw Error('invalid signed transaction');const v=await verifier.verifyAndDecodeTransaction(proof);
  if(v.bundleId!==bundleId||v.environment!==environment||!appleId(v.originalTransactionId)||!appleId(v.transactionId)||!products.has(v.productId)||v.inAppOwnershipType!=='PURCHASED')throw Error('unsupported Apple transaction');
  const product=products.get(v.productId);if(v.type!==(product==='permanent'?'Non-Consumable':'Auto-Renewable Subscription'))throw Error('Apple product type mismatch');return v;
 }
 function own(v,a){if(!accountId(a)||String(v.appAccountToken||'').toLowerCase()!==appleAccountToken(a))throw Error('Apple account binding mismatch');}
 async function current({account,chain,product}){
  const revision=clock();if(!appleId(chain)||!accountId(account))throw Error('invalid Apple chain');
  let v,status,expiresAt=null;
  if(product==='permanent'){
   const r=await api.getTransactionInfo(chain);v=await decode(r.signedTransactionInfo);own(v,account);
   if(v.originalTransactionId!==chain||products.get(v.productId)!==product)throw Error('Apple chain mismatch');
   status=v.revocationDate!==undefined?'revoked':'active';
  }else if(product==='vip'){
   const r=await api.getAllSubscriptionStatuses(chain);
   if(r.bundleId!==bundleId||r.environment!==environment||!Array.isArray(r.data)||r.data.length>100)throw Error('invalid Apple status');
   const matches=r.data.flatMap(g=>g.lastTransactions||[]).filter(x=>x.originalTransactionId===chain);
   if(matches.length!==1)throw Error('ambiguous Apple subscription');
   const x=matches[0];v=await decode(x.signedTransactionInfo);own(v,account);
   if(v.originalTransactionId!==chain||products.get(v.productId)!==product||!timestamp(v.expiresDate)||![1,2,3,4,5].includes(x.status))throw Error('invalid Apple subscription');
   expiresAt=v.expiresDate;
   if(x.status===4){const renewal=await verifier.verifyAndDecodeRenewalInfo(x.signedRenewalInfo);if(renewal.originalTransactionId!==chain||renewal.environment!==environment||!timestamp(renewal.gracePeriodExpiresDate))throw Error('invalid Apple grace period');expiresAt=renewal.gracePeriodExpiresDate;}
   status=v.revocationDate!==undefined||x.status===5?'revoked':[1,4].includes(x.status)&&expiresAt>clock()?'active':'expired';
  }else throw Error('unknown product');
  return {verified:true,verifiedAt:revision,revision,account,store:'apple',chain,product,status,expiresAt};
 }
 async function receipt({account,proof}){const v=await decode(proof);own(v,account);return current({account,chain:v.originalTransactionId,product:products.get(v.productId)});}
 async function notification(proof){
  const n=await verifier.verifyAndDecodeNotification(proof);
  if(n.notificationType==='TEST')return null;
  if(!n.data?.signedTransactionInfo||n.data.bundleId!==bundleId||n.data.environment!==environment)throw Error('invalid Apple notification');
  const v=await decode(n.data.signedTransactionInfo),row=lookup('apple',v.originalTransactionId);
  if(!row)return null;own(v,row.account);
  return current({account:row.account,chain:row.chain,product:row.product});
 }
 return {receipt,current,notification};
}
function createGoogleAdapter({query,packageName,catalog,vault,lookup,allowTest=false,now=Date.now}={}){
 if(typeof query!=='function'||typeof lookup!=='function'||!vault||typeof packageName!=='string'||!/^\w+(?:\.\w+)+$/.test(packageName))throw Error('Google configuration required');
 const products=catalogMap(catalog),clock=makeClock(now);
 const path=(kind,token)=>'/androidpublisher/v3/applications/'+encodeURIComponent(packageName)+'/purchases/'+kind+'/tokens/'+encodeURIComponent(token);
 async function read(token,kind,account){
  if(!tokenId(token)||!accountId(account))throw Error('invalid Google proof');
  const revision=clock(),r=await query(path(kind,token)),chain=hash(token);
  if(!r||typeof r!=='object')throw Error('invalid Google response');
  let product,status,expiresAt=null,linkedChain;
  if(kind==='productsv2'){
   const row=r.productLineItem;if(r.kind!=='androidpublisher#productPurchaseV2'||r.obfuscatedExternalAccountId!==account||!Array.isArray(row)||row.length!==1||products.get(row[0].productId)!=='permanent'||r.testPurchaseContext&&!allowTest)throw Error('Google one-time binding mismatch');
   product='permanent';const p=r.purchaseStateContext?.purchaseState,o=row[0].productOfferDetails;
   if(!['PURCHASED','CANCELLED','PENDING'].includes(p))throw Error('invalid Google purchase state');
   if(p==='PURCHASED'&&(!o||o.quantity!==1||!Number.isInteger(o.refundableQuantity)||o.refundableQuantity<0||o.refundableQuantity>1||o.consumptionState!=='CONSUMPTION_STATE_YET_TO_BE_CONSUMED'||o.rentOfferDetails))throw Error('unsupported Google purchase');
   status=p==='PENDING'?'pending':p==='CANCELLED'||o?.refundableQuantity===0?'revoked':'active';
  }else if(kind==='subscriptionsv2'){
   const rows=r.lineItems;if(r.kind!=='androidpublisher#subscriptionPurchaseV2'||r.externalAccountIdentifiers?.obfuscatedExternalAccountId!==account||!Array.isArray(rows)||rows.length!==1||products.get(rows[0].productId)!=='vip'||r.testPurchase&&!allowTest)throw Error('Google subscription binding mismatch');
   product='vip';const p=r.subscriptionState;
   if(!['PENDING','ACTIVE','PAUSED','IN_GRACE_PERIOD','ON_HOLD','CANCELED','EXPIRED','PENDING_PURCHASE_CANCELED'].map(s=>'SUBSCRIPTION_STATE_'+s).includes(p))throw Error('invalid Google subscription state');
   expiresAt=rows[0].expiryTime?Date.parse(rows[0].expiryTime):0;if(!timestamp(expiresAt))throw Error('invalid Google expiry');
   const eligible=['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED'].includes(p)&&expiresAt>clock();
   status=r.canceledStateContext?.replacementCancellation?'revoked':eligible?'active':p==='SUBSCRIPTION_STATE_PENDING'?'pending':'expired';
   // Immediate, single-line-item replacements only. A pending/deferred plan
   // must never revoke the old entitlement early. Ambiguous ownership fails.
   if(r.linkedPurchaseToken!==undefined&&status==='active'){
    if(rows[0].deferredItemReplacement||rows[0].deferredItemRemoval||rows[0].itemReplacement?.replacementMode==='DEFERRED')throw Error('deferred subscription requires reconciliation');
    if(!tokenId(r.linkedPurchaseToken)||r.linkedPurchaseToken===token)throw Error('invalid linked subscription');
    linkedChain=hash(r.linkedPurchaseToken);
    const old=lookup('google',linkedChain);
    if(!old||old.account!==account||old.product!=='vip')throw Error('linked subscription ownership unavailable');
   }
  }else throw Error('unknown Google query');
  return {verified:true,verifiedAt:revision,revision,account,store:'google',chain,product,status,expiresAt,...(linkedChain?{linkedChain}:{})};
 }
 async function current({account,chain,product,expiresAt:oldExpiry,status:oldStatus}){
  const token=vault.get(chain,account);if(!token||hash(token)!==chain)throw Error('Google token unavailable');
  try{return await read(token,product==='permanent'?'productsv2':'subscriptionsv2',account);}
  catch(e){if(product==='vip'&&e?.status===410&&timestamp(oldExpiry)&&oldExpiry<=clock()&&['expired','revoked'].includes(oldStatus)){const t=clock();return {verified:true,verifiedAt:t,revision:t,account,store:'google',chain,product,status:oldStatus,expiresAt:oldExpiry};}throw e;}
 }
 async function receipt({account,proof}){
  if(!tokenId(proof))throw Error('invalid Google token');
  let v;try{v=await read(proof,'productsv2',account);}catch(e){if(e?.status!==404&&e?.status!==400)throw e;v=await read(proof,'subscriptionsv2',account);}
  vault.put(v.chain,account,proof);return v;
 }
 async function notification({purchaseToken}){
  if(!tokenId(purchaseToken))throw Error('invalid Google notification');
  const row=lookup('google',hash(purchaseToken));if(!row)return null;
  if(vault.get(row.chain,row.account)!==purchaseToken)throw Error('Google notification binding mismatch');
  return current({account:row.account,chain:row.chain,product:row.product,expiresAt:row.expires,status:row.status});
 }
 return {receipt,current,notification};
}
module.exports={createAppleAdapter,createGoogleAdapter,appleAccountToken};
