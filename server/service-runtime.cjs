// Composition root for a single-process HTTPS-ingress staging service.
// Production remains blocked. Provider-specific reward and deletion authority
// are mandatory injected adapters, not local save or client assertion.
const fs=require('node:fs'),path=require('node:path');
const {openLedger,createAccountService}=require('./account-ledger.cjs');
const {openSaveTransfer,createSaveTransferService}=require('./save-transfer.cjs');
const {createGameSaveValidator}=require('./save-game-codec.cjs');
const {openPurchaseRegistry,createPurchaseService}=require('./purchase-registry.cjs');
const {openAdProofRegistry}=require('./ad-proof-registry.cjs');
const {createAdMobVerifier}=require('./admob-ssv.cjs');
const {createAdMobKeyResolver}=require('./admob-key-resolver.cjs');
const {createAdSsvService}=require('./ad-ssv-service.cjs');
const {openDeletionRequests,createDeletionService}=require('./deletion-requests.cjs');
const {createAccountHttp}=require('./account-http.cjs'),{createSaveHttp}=require('./save-http.cjs');
const {createRateLimiter}=require('./rate-limit.cjs'),{createServiceRouter}=require('./service-router.cjs');
function createServiceRuntime({environment='staging',dataDir,authenticate,verifyRecentReauth,verifyReceipt,verifyCurrent,verifyNotification,verifyEvent,verifyAction,verifyCompletion,units,origins=[],maxBytes=64*1024*1024,maxDecodedBytes=256*1024*1024,resolveKey=createAdMobKeyResolver(),now=Date.now}={}){
 if(environment!=='staging'||typeof dataDir!=='string'||!path.isAbsolute(dataDir)||[authenticate,verifyRecentReauth,verifyReceipt,verifyCurrent,verifyNotification,verifyEvent,verifyAction,verifyCompletion].some(x=>typeof x!=='function'))throw Error('staging and trusted adapters required');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>256*1024*1024)throw Error('invalid storage limit');
 fs.mkdirSync(dataDir,{recursive:true,mode:0o700});const root=fs.realpathSync(dataDir);
 if((fs.statSync(root).mode&0o077)!==0&&process.platform!=='win32')throw Error('private database directory required');
 const dbs=[],file=n=>path.join(root,n+'.sqlite'),open=(factory,n,options)=>{const db=factory(file(n),options);dbs.push(db);return db;};
 try{
  const deletion=open(openDeletionRequests,'deletion',{now});
  // Block all regular API access to accounts with durable deletion requests.
  // An already in-flight request can still finish: deletion workers must drain
  // traffic and quiesce all writes before erasing data.
  const auth=async token=>{const a=await authenticate(token);return a?.authenticated===true&&!deletion.blocked(a.account)?a:{authenticated:false};};
  const ledger=open(openLedger,'account'),storage=open(openSaveTransfer,'saves',{maxBytes,now}),registry=open(openPurchaseRegistry,'purchases'),proofs=open(openAdProofRegistry,'ad-proofs',{now});
  const purchases=createPurchaseService({registry,authenticate:auth,verifyReceipt,verifyCurrent,verifyNotification,now});
  const account=createAccountService({ledger,authenticate:auth,verifyEntitlements:purchases.verifyEntitlements,purchaseService:purchases,verifyEvent,verifyAction,verifyCompletion:async(a,p)=>{const v=await verifyCompletion(a,p);if(v?.verified===true&&v.mode==='ad'&&v.applied===true&&!proofs.hasProof({account:a,operationId:v.id,attempt:v.attempt}))return null;return v;},now});
  const saves=createSaveTransferService({storage,authenticate:auth,validateSave:createGameSaveValidator({maxBytes:maxDecodedBytes})});
  const adService=createAdSsvService({registry:proofs,authenticate:auth,readOrder:(a,o)=>deletion.blocked(a)?null:ledger.readOrder(a,o),verifyCallback:createAdMobVerifier({resolveKey,units:Object.values(units).map(u=>u.unit)}),units});
  const deletionService=createDeletionService({registry:deletion,authenticate,verifyRecentReauth});
  const allowRequest=createRateLimiter({now}),callbackLimit=createRateLimiter({now,ipLimit:600,tokenLimit:600,maxEntries:10000});
  const router=createServiceRouter({accountHttp:createAccountHttp({service:account,allowRequest}),saveHttp:createSaveHttp({service:saves,allowRequest,maxBytes,maxConcurrent:1}),adService,deletionService,allowRequest:x=>x.route==='ssv'?callbackLimit(x):allowRequest(x),origins});
  let closed=false;
  return {...router,close:async()=>{if(closed)return;closed=true;if(router.server.listening)await new Promise((ok,bad)=>router.server.close(e=>e?bad(e):ok()));for(const db of dbs.reverse())db.close();}};
 }catch(e){for(const db of dbs.reverse())db.close();throw e;}
}
module.exports={createServiceRuntime};
