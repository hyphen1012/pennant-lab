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
function createServiceRuntime({environment='staging',dataDir,authenticate,verifyRecentReauth,verifyReceipt,verifyCurrent,verifyNotification,verifyEvent,verifyAction,verifyCompletion,storeConfig=null,canonicalEngine=null,units,origins=[],maxBytes=64*1024*1024,maxDecodedBytes=256*1024*1024,resolveKey=createAdMobKeyResolver(),now=Date.now,gameLimits={},projectionWorker=null}={}){
 if(environment!=='staging'||typeof dataDir!=='string'||!path.isAbsolute(dataDir)||[authenticate,verifyRecentReauth,verifyReceipt,verifyCurrent,verifyNotification,verifyEvent,verifyAction,verifyCompletion].some(x=>typeof x!=='function'))throw Error('staging and trusted adapters required');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>256*1024*1024)throw Error('invalid storage limit');
 // With the experimental worker, never overlap heavy canonical operations.
 // A soft RSS gate is required explicitly: it is not an OS memory ceiling.
 if(projectionWorker!==null&&(!canonicalEngine||!Number.isSafeInteger(gameLimits.rssLimitBytes)||gameLimits.rssLimitBytes<1||gameLimits.heavyLimit!==undefined&&gameLimits.heavyLimit!==1))throw Error('worker requires single heavy lane and explicit RSS admission threshold');
 const effectiveGameLimits=projectionWorker===null?gameLimits:{...gameLimits,heavyLimit:1};
 fs.mkdirSync(dataDir,{recursive:true,mode:0o700});const root=fs.realpathSync(dataDir);
 if((fs.statSync(root).mode&0o077)!==0&&process.platform!=='win32')throw Error('private database directory required');
 const dbs=[],file=n=>path.join(root,n+'.sqlite'),open=(factory,n,options)=>{const db=factory(file(n),options);dbs.push(db);return db;};
 try{
  const deletion=open(openDeletionRequests,'deletion',{now});
  // Block all regular API access to accounts with durable deletion requests.
  // An already in-flight request can still finish: deletion workers must drain
  // traffic and quiesce all writes before erasing data.
  const auth=async token=>{const a=await authenticate(token);return a?.authenticated===true&&!deletion.blocked(a.account)?a:{authenticated:false};};
  const ledger=open(openLedger,'account'),storage=open(openSaveTransfer,'saves',{maxBytes,now}),registry=open(openPurchaseRegistry,'purchases',{tokenKey:storeConfig?.tokenKey??null}),proofs=open(openAdProofRegistry,'ad-proofs',{now});
  const store=storeConfig?.create(registry)??{verifyReceipt,verifyCurrent,verifyNotification};
  const purchases=createPurchaseService({registry,authenticate:auth,...store,now});
  const deny=async()=>null;
  const gameAuthority=canonicalEngine?require('./game-authority.cjs').createGameAuthority({
   ledger,engine:canonicalEngine,authenticate:auth,
   verifyRights:async a=>{const r=require('./purchase-rights.cjs').normalizeRights(a,await purchases.verifyEntitlements(a),now());return {verified:true,vip:r.entitlements.vip.active,adSkip:r.entitlements.adSkip.active};},
   hasAdProof:x=>proofs.hasProof(x),now,projectionWorker
  }):null;
  // Once canonical authority is active, reference game mutations must not
  // run alongside it; wallet snapshots/exchange and verified purchases remain.
  const account=createAccountService({ledger,authenticate:auth,verifyEntitlements:purchases.verifyEntitlements,purchaseService:purchases,exchangeAvailable:key=>!gameAuthority||['ticket','frame','profile','hq','museum','uniform','emblem','deluxeCard','anniversary'].includes(key),verifyEvent:gameAuthority?deny:verifyEvent,verifyAction:gameAuthority?deny:verifyAction,verifyCompletion:async(a,p)=>{if(gameAuthority)return null;const v=await verifyCompletion(a,p);if(v?.verified===true&&v.mode==='ad'&&v.applied===true&&!proofs.hasProof({account:a,operationId:v.id,attempt:v.attempt}))return null;return v;},now});
  const saves=createSaveTransferService({storage,authenticate:auth,validateSave:createGameSaveValidator({maxBytes:maxDecodedBytes})});
  const adService=createAdSsvService({registry:proofs,authenticate:auth,readOrder:(a,o)=>deletion.blocked(a)?null:ledger.readOrder(a,o),verifyCallback:createAdMobVerifier({resolveKey,units:Object.values(units).map(u=>u.unit)}),units});
  const deletionService=createDeletionService({registry:deletion,authenticate,verifyRecentReauth});
  const allowRequest=createRateLimiter({now}),callbackLimit=createRateLimiter({now,ipLimit:600,tokenLimit:600,maxEntries:10000});
  const router=createServiceRouter({accountHttp:createAccountHttp({service:account,allowRequest}),saveHttp:createSaveHttp({service:saves,allowRequest,maxBytes,maxConcurrent:1}),adService,deletionService,gameAuthority,storeNotifications:storeConfig?{notification:purchases.notification,verifyGooglePush:storeConfig.verifyGooglePush}:null,allowRequest:x=>x.route==='ssv'?callbackLimit(x):allowRequest(x),origins,gameLimits:effectiveGameLimits});
  let closed=false;
  return {...router,close:async()=>{if(closed)return;closed=true;if(router.server.listening)await new Promise((ok,bad)=>router.server.close(e=>e?bad(e):ok()));for(const db of dbs.reverse())db.close();}};
 }catch(e){for(const db of dbs.reverse())db.close();throw e;}
}
module.exports={createServiceRuntime};
