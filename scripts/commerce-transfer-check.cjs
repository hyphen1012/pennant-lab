const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openPurchaseRegistry,createPurchaseService}=require('../server/purchase-registry.cjs');
const {openSaveTransfer,createSaveTransferService,digest}=require('../server/save-transfer.cjs');
const {openLedger,createAccountService}=require('../server/account-ledger.cjs');
const {createAccountHttp}=require('../server/account-http.cjs');
const {createRewardCoordinator}=require('../mobile/src/reward-coordinator.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pl-stage8-'));
const auth=async token=>['a','b'].includes(token)?{authenticated:true,account:token}:null;
(async()=>{
 let now=1700000000000,reg=openPurchaseRegistry(path.join(dir,'purchases.db')),storage,ledger,http;
 try{
  const rows=new Map();
  const key=(store,chain)=>store+':'+chain;
  const row=(account,store,chain,product,revision,status='active',expiresAt=product==='vip'?now+10000:null)=>({verified:true,verifiedAt:now,account,store,chain,product,revision,status,expiresAt});
  const adapters={authenticate:auth,now:()=>now,verifyReceipt:async({account,store,proof})=>{const v=rows.get(key(store,proof));return v?{...v,account}:null;},verifyCurrent:async({store,chain})=>rows.get(key(store,chain)),verifyNotification:async({store,proof})=>rows.get(key(store,proof))};
  const make=()=>createPurchaseService({registry:reg,...adapters});let purchases=make();
  rows.set(key('apple','perm'),row('a','apple','perm','permanent',1));
  a.equal((await purchases.restore('a','apple','perm')).recorded,true);
  a.equal((await purchases.restore('a','apple','perm')).recorded,false);
  await a.rejects(purchases.restore('b','apple','perm'),/binding conflict/);
  await a.rejects(purchases.restore('a','apple','unknown'));
  await a.rejects(purchases.restore('bad','apple','perm'));
  rows.set(key('google','vip'),row('a','google','vip','vip',1));
  await purchases.restore('a','google','vip');
  a.equal((await purchases.verifyEntitlements('a')).entitlements.adSkip.active,true);
  a.equal((await purchases.verifyEntitlements('a')).entitlements.vip.active,true);
  a.equal((await purchases.verifyEntitlements('b')).entitlements.adSkip.active,false);
  const old=rows.get(key('apple','perm'));rows.set(key('apple','perm'),row('a','apple','perm','permanent',2,'revoked'));
  a.equal((await purchases.notification('apple','perm')).recorded,true);
  a.equal((await purchases.notification('apple','perm')).recorded,false);
  a.equal((await purchases.verifyEntitlements('a')).entitlements.adSkip.active,false);
  rows.set(key('apple','perm'),old);await a.rejects(purchases.restore('a','apple','perm'),/stale purchase revision/);
  rows.set(key('apple','perm'),row('a','apple','perm','permanent',2,'revoked'));
  reg.close();reg=openPurchaseRegistry(path.join(dir,'purchases.db'));purchases=make();
  a.equal((await purchases.verifyEntitlements('a')).entitlements.adSkip.active,false);
  now+=10001; a.equal((await purchases.verifyEntitlements('a')).entitlements.vip.active,false);
  // A cached verification timestamp cannot be renewed by the registry.
  a.equal((await purchases.verifyEntitlements('a')).verifiedAt,now-10001);
  rows.set(key('google','vip'),{...rows.get(key('google','vip')),verifiedAt:now-300000});
  await a.rejects(purchases.verifyEntitlements('a'),/stale/);
  rows.set(key('google','vip'),row('a','google','vip','vip',2,'expired',now-1));
  // Actual HTTP restoration boundary and absence of client-supplied owner.
  ledger=openLedger(':memory:');
  const svc=createAccountService({ledger,authenticate:auth,verifyEvent:async()=>null,verifyAction:async()=>null,verifyCompletion:async()=>null,verifyEntitlements:purchases.verifyEntitlements,purchaseService:purchases,now:()=>now});
  http=createAccountHttp({service:svc,allowRequest:async()=>true});await new Promise(ok=>http.listen(0,'127.0.0.1',ok));
  const req=async(body,token='a')=>{const res=await fetch('http://127.0.0.1:'+http.address().port+'/v1/restore',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});return [res.status,await res.json()];};
  a.deepEqual(await req({store:'apple',proof:'perm'}),[200,{recorded:false}]);
  a.equal((await req({store:'apple',proof:'perm'},'b'))[0],403);
  a.equal((await req({store:'apple',proof:'perm',account:'b'}))[0],400);
  console.log('PASS purchase restoration, store chain dedup, account binding, revocation replay, expiry, restart and authenticated HTTP');
  // Reward coordinator is tested with simulated independently verified adapters.
  let mode='ad',replay=false,adCalls=0,applyCalls=0,finishCalls=0,attempt=1,online=true,adProof='verified-ad',finishOK=true;
  const client={reserve:async()=>({operationId:'op',attempt,mode,status:'pending',replay}),finish:async()=>{finishCalls++;return {ok:finishOK};},orderStatus:async()=>({order:{operationId:'op',attempt,mode,status:finishOK?'committed':'pending'},wallet:{tickets:2}})};
  const coord=createRewardCoordinator({client,online:async()=>online,requestAdProof:async()=>{adCalls++;return adProof;},applyVerified:async x=>{applyCalls++;a.equal(x.mode,mode);a.equal(x.adProof,mode==='ad'?'verified-ad':null);return 'verified-completion';}});
  a.equal((await coord.run({actionProof:'proof'})).status,'committed');a.equal(adCalls,1);
  for(const m of ['ticket','entitlement']){mode=m;a.equal((await coord.run({actionProof:'proof',choice:'ticket'})).status,'committed');}
  a.equal(adCalls,1);a.equal(applyCalls,3);a.equal(finishCalls,3);
  replay=true;a.equal((await coord.run({actionProof:'proof'})).status,'reconcile_required');a.equal(applyCalls,3);
  a.equal((await coord.recover('op')).order.status,'committed');a.equal(applyCalls,3);replay=false;
  mode='ad';adProof=null;a.equal((await coord.run({actionProof:'proof'})).status,'reconcile_required');a.equal(applyCalls,3);
  adProof='verified-ad';online=false;a.equal((await coord.run({actionProof:'proof'})).status,'unavailable');online=true;
  let release;const switched=createRewardCoordinator({client,online:async()=>true,requestAdProof:()=>new Promise(ok=>release=ok),applyVerified:async()=>{throw Error('must not apply after switch');}});
  const pending=switched.run({actionProof:'proof'});while(!release)await Promise.resolve();a.equal((await switched.run({actionProof:'proof'})).status,'busy');switched.invalidate();release('verified-ad');a.equal((await pending).status,'reconcile_required');a.equal(finishCalls,3);
  finishOK=false;a.equal((await coord.run({actionProof:'proof'})).status,'reconcile_required');a.equal((await coord.recover('op')).order.status,'pending');
  console.log('PASS optional ad/ticket/entitlement coordination, replay, cancellation ambiguity, concurrent use and session invalidation');
  const file=path.join(dir,'transfer.db');storage=openSaveTransfer(file,{maxBytes:128});const makeTransfer=()=>createSaveTransferService({storage,authenticate:auth,validateSave:async bytes=>{try{return JSON.parse(bytes).year>=2027;}catch{return false;}}});let transfers=makeTransfer();
  const bytes=Buffer.from('{"year":2027,"vip":true}'),sha=digest(bytes);
  const input={slot:1,expectedRevision:0,payload:bytes,sha,confirmed:true};
  await a.rejects(transfers.importSave('a',{...input,confirmed:false}));await a.rejects(transfers.importSave('a',{...input,sha:'bad'}));await a.rejects(transfers.importSave('bad',input));
  const [x,y]=await Promise.allSettled([transfers.importSave('a',input),transfers.importSave('a',input)]);a.equal([x,y].filter(z=>z.status==='fulfilled').length,1);
  a.deepEqual((await transfers.download('a',1)).payload,bytes);a.equal(await transfers.download('b',1),null);a.equal((await transfers.list('b')).length,0);
  a.equal((await transfers.importSave('a',{...input,expectedRevision:1})).unchanged,true);
  const next=Buffer.from('{"year":2028}');a.equal((await transfers.importSave('a',{...input,expectedRevision:1,payload:next,sha:digest(next)})).revision,2);
  await a.rejects(transfers.importSave('a',{...input,expectedRevision:1}),/revision conflict/);
  const invalid=Buffer.from('not json');await a.rejects(transfers.importSave('a',{...input,expectedRevision:2,payload:invalid,sha:digest(invalid)}));
  const big=Buffer.alloc(129);await a.rejects(transfers.importSave('a',{...input,expectedRevision:2,payload:big,sha:digest(big)}));
  storage.close();storage=openSaveTransfer(file,{maxBytes:128});transfers=makeTransfer();a.deepEqual((await transfers.download('a',1)).payload,next);
  a.equal((await transfers.list('a'))[0].revision,2);
  // Save data cannot alter the independent purchase or reward ledger.
  a.equal((await svc.entitlementSnapshot('a')).entitlements.adSkip.active,false);a.equal((await svc.snapshot('a')).tickets,0);
  console.log('PASS explicit account-scoped save migration, hash/size/format checks, CAS conflict, restart and payment isolation');
 }finally{if(http)await new Promise(ok=>http.close(ok));ledger?.close();storage?.close();reg.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
