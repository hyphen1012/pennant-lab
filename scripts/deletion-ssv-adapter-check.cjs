const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{DatabaseSync,}=require('node:sqlite');
const {createServiceRuntime}=require('../server/service-runtime.cjs');
const {openDeletionRequests}=require('../server/deletion-requests.cjs');
const {executeOfflineDeletion}=require('../server/deletion-executor.cjs');
const {createRecentReauthVerifier}=require('../server/auth-introspection.cjs');
const {createSsvAdAdapter}=require('../mobile/src/ssv-adapter.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pl-deletion-')),a='a'.repeat(64),b='b'.repeat(64);
 const auth=async token=>({authenticated:true,account:token==='other'?b:a,authTime:token==='old'?700:1000});
 const verify=createRecentReauthVerifier({authenticate:auth,now:()=>1000000});
 assert.equal(await verify({token:'same',proof:'same',account:a}),null);assert.equal(await verify({token:'main',proof:'old',account:a}),null);assert.equal(await verify({token:'main',proof:'other',account:a}),null);
 assert.deepEqual(await verify({token:'main',proof:'fresh',account:a}),{verified:true,account:a});
 const deny=async()=>null;
 try{
  const runtime=createServiceRuntime({dataDir:dir,authenticate:auth,verifyRecentReauth:verify,verifyReceipt:deny,verifyCurrent:deny,verifyNotification:deny,verifyEvent:deny,verifyAction:deny,verifyCompletion:deny,units:{ios:{unit:'123',item:'ticket',amount:1}},origins:[]});await runtime.close();
  const sql=(name,fn)=>{const db=new DatabaseSync(path.join(dir,name+'.sqlite'));try{return fn(db);}finally{db.close();}};
  sql('account',db=>{const s=db.prepare('INSERT INTO account_ledger(id,payload) VALUES(?,?)');s.run(a,'{}');s.run(b,'{}');});
  const registry=openDeletionRequests(path.join(dir,'deletion.sqlite'));const req=registry.request(a);registry.close();
  const base={dataDir:dir,account:a,requestId:req.requestId,writersStopped:true,revokeIdentity:async()=>true,applyPurchaseRetention:async()=>true,reconcileBackups:async()=>false};
  await assert.rejects(executeOfflineDeletion({...base,writersStopped:false}));await assert.rejects(executeOfflineDeletion({...base,requestId:'wrong'}));
  await assert.rejects(executeOfflineDeletion(base),/backup deletion unresolved/);
  assert.equal(sql('account',db=>db.prepare('SELECT COUNT(*) AS n FROM account_ledger WHERE id=?').get(a).n),0);
  assert.equal(sql('account',db=>db.prepare('SELECT COUNT(*) AS n FROM account_ledger WHERE id=?').get(b).n),1);
  const completed=await executeOfflineDeletion({...base,reconcileBackups:async()=>true});assert.equal(completed.status,'completed');
  assert.equal((await executeOfflineDeletion({...base,reconcileBackups:async()=>true})).status,'completed');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
 let reads=0,shows=0,issue=0,prepared,valid=false;const customData='e'.repeat(64);
 const client={issueAd:async()=>{issue++;return {customData};},adStatus:async()=>{reads++;return {verified:valid};}};
 const sdk={initialize:async()=>{},prepareRewardVideoAd:async o=>{prepared=o;},showRewardVideoAd:async()=>{shows++;return {amount:1,type:'ticket'};}};
 const adapter=createSsvAdAdapter({client,sdk,platform:'ios',adId:'ca-app-pub-123/456',online:async()=>true,consent:async()=>true,delay:async()=>{},polls:3});
 assert.equal(await adapter.requestAdProof({operationId:'op',attempt:1}),null);assert.equal(shows,1);assert.equal(reads,3);assert.equal(issue,1);assert.deepEqual(prepared.ssv,{customData});
 valid=true;assert.equal(await adapter.requestAdProof({operationId:'op2',attempt:1}),customData);
 const interrupted=createSsvAdAdapter({client,sdk:{...sdk,showRewardVideoAd:async()=>{interrupted.invalidate();}},platform:'ios',adId:'ca-app-pub-123/456',online:async()=>true,consent:async()=>true,delay:async()=>{}});
 assert.equal(await interrupted.requestAdProof({operationId:'op3',attempt:1}),null);
 console.log('PASS same-account fresh reauth, scoped offline deletion/restart, native SSV proof-only path');
})().catch(e=>{console.error(e);process.exitCode=1;});
