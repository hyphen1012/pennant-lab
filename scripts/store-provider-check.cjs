const a=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),{createHash}=require('node:crypto');
const {createAppleAdapter,createGoogleAdapter,appleAccountToken}=require('../server/store-provider-adapters.cjs');
const {openPurchaseRegistry,createPurchaseService}=require('../server/purchase-registry.cjs');
(async()=>{
 let t=1700000000000;const now=()=>t,owner='a'.repeat(64),other='b'.repeat(64),bundleId='jp.pennantlab.game',environment='Sandbox';
 const registry=openPurchaseRegistry(':memory:',{tokenKey:Buffer.alloc(32,42)});
 const lookup=(s,c)=>registry.find(s,c),catalog=[{id:'perm',product:'permanent'},{id:'vip',product:'vip'}];
 let appleTx={bundleId,environment,originalTransactionId:'100',transactionId:'100',productId:'perm',type:'Non-Consumable',inAppOwnershipType:'PURCHASED',appAccountToken:appleAccountToken(owner)};
 let vip={...appleTx,originalTransactionId:'200',transactionId:'201',productId:'vip',type:'Auto-Renewable Subscription',expiresDate:t+100000},subStatus=1;
 const verifier={verifyAndDecodeTransaction:async s=>{if(s==='perm')return appleTx;if(s==='vip')return vip;throw Error('bad signature');},verifyAndDecodeRenewalInfo:async()=>({originalTransactionId:'200',environment,gracePeriodExpiresDate:t+10000}),verifyAndDecodeNotification:async s=>{if(s==='test')return {notificationType:'TEST'};if(s==='notify')return {data:{bundleId,environment,signedTransactionInfo:'perm'}};throw Error('bad notification');}};
 const api={getTransactionInfo:async()=>({signedTransactionInfo:'perm'}),getAllSubscriptionStatuses:async()=>({bundleId,environment,data:[{lastTransactions:[{originalTransactionId:'200',status:subStatus,signedTransactionInfo:'vip',signedRenewalInfo:'renew'}]}]})};
 const apple=createAppleAdapter({api,verifier,bundleId,environment,catalog,lookup,now});
 let gp={kind:'androidpublisher#productPurchaseV2',obfuscatedExternalAccountId:owner,productLineItem:[{productId:'perm',productOfferDetails:{quantity:1,refundableQuantity:1,consumptionState:'CONSUMPTION_STATE_YET_TO_BE_CONSUMED'}}],purchaseStateContext:{purchaseState:'PURCHASED'}};
 let gs={kind:'androidpublisher#subscriptionPurchaseV2',externalAccountIdentifiers:{obfuscatedExternalAccountId:owner},lineItems:[{productId:'vip',expiryTime:new Date(t+200000).toISOString()}],subscriptionState:'SUBSCRIPTION_STATE_ACTIVE'};
 const google=createGoogleAdapter({query:async p=>{if(p.endsWith('/tokens/one')&&p.includes('/productsv2/'))return gp;if(p.endsWith('/tokens/sub')&&p.includes('/subscriptionsv2/'))return gs;throw Object.assign(Error('not found'),{status:404});},packageName:bundleId,catalog,vault:registry.vault,lookup,now});
 const choose=s=>s==='apple'?apple:google,service=createPurchaseService({registry,authenticate:async token=>({authenticated:true,account:token==='owner'?owner:other}),verifyReceipt:x=>choose(x.store).receipt(x),verifyCurrent:x=>choose(x.store).current(x),verifyNotification:async({store,proof})=>await choose(store).notification(store==='google'?JSON.parse(proof):proof)||{verified:true,ignored:true},now});
 try{
  await a.rejects(service.restore('other','apple','perm'));await a.rejects(service.restore('owner','apple','forged'));
  a.equal((await service.restore('owner','apple','perm')).recorded,true);
  a.equal((await service.authorizeFinish('owner','apple','perm')).authorized,true);
  a.equal((await service.restore('owner','apple','vip')).recorded,true);
  a.equal((await service.verifyEntitlements(owner)).entitlements.vip.active,true);
  t++;subStatus=4;a.equal((await apple.current({account:owner,chain:'200',product:'vip'})).expiresAt,t+10000);
  t++;subStatus=3;appleTx={...appleTx,revocationDate:t};await service.notification('apple','notify');
  const ar=await service.verifyEntitlements(owner);a.equal(ar.entitlements.adSkip.active,false);a.equal(ar.entitlements.vip.active,false);
  await a.rejects(service.authorizeFinish('owner','apple','perm'));await a.rejects(service.notification('apple','forged'));
  a.equal((await service.notification('apple','test')).ignored,true);
  t++;await a.rejects(service.restore('other','google','one'));await service.restore('owner','google','one');await service.restore('owner','google','sub');
  const chain=createHash('sha256').update('one').digest('hex');a.equal(registry.vault.get(chain,owner),'one');a.throws(()=>registry.vault.get(chain,other));
  const gr=await service.verifyEntitlements(owner);a.equal(gr.entitlements.adSkip.active,true);a.equal(gr.entitlements.vip.active,true);
  t++;gp.productLineItem[0].productOfferDetails.refundableQuantity=0;gs.subscriptionState='SUBSCRIPTION_STATE_ON_HOLD';
  await service.notification('google',JSON.stringify({purchaseToken:'one'}));const revoked=await service.verifyEntitlements(owner);a.equal(revoked.entitlements.adSkip.active,false);a.equal(revoked.entitlements.vip.active,false);
  t++;gs.subscriptionState='SUBSCRIPTION_STATE_CANCELED';a.equal((await google.receipt({account:owner,proof:'sub'})).status,'active');
  gs.linkedPurchaseToken='previous';await a.rejects(google.receipt({account:owner,proof:'sub'}),/linked subscription/);
  gp.testPurchaseContext={fopType:'TEST'};await a.rejects(google.receipt({account:owner,proof:'one'}));
  a.equal((await service.notification('google',JSON.stringify({purchaseToken:'unknown'}))).ignored,true);
  console.log('PASS current Apple/Google queries, account binding, grace/expiry/refund, encrypted token vault and notification requery');
 }finally{registry.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
