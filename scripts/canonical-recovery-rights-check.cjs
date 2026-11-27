'use strict';
// Isolated synthetic provider rehearsal. No real receipts, ads or credentials.
const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {generateKeyPairSync,sign,randomBytes,randomUUID}=require('node:crypto');
const {createHeadlessEngine}=require('../server/headless-engine.cjs'),{createServiceRuntime}=require('../server/service-runtime.cjs'),{encryptOffline,decryptOffline}=require('../server/encrypted-backup-trial.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'pl-rights-restore-')),source=path.join(root,'source'),enc=path.join(root,'encrypted'),dest=path.join(root,'restored'),scratchRoot=path.join(root,'scratch');
const accounts={a:'a'.repeat(64),b:'b'.repeat(64),c:'c'.repeat(64)},clock=1700000000000;
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),key=randomBytes(32),backupId=randomUUID();
const opts={environment:'staging',confirmedOffline:true,scratchRoot,key,backupId};
const engine=createHeadlessEngine(),deny=async()=>null;
let runtime,revoked=false;
const trusted=({account,store,chain,product})=>({verified:true,verifiedAt:clock,revision:revoked?2:1,account,store,chain,product,status:revoked?'revoked':'active',expiresAt:product==='vip'?clock+86400000:null});
const verifyReceipt=async q=>q.account===accounts.b&&q.store==='apple'&&['vip-fixture','permanent-fixture'].includes(q.proof)?trusted({...q,chain:q.proof,product:q.proof==='vip-fixture'?'vip':'permanent'}):null;
const verifyCurrent=async q=>q.account===accounts.b&&q.store==='apple'&&['vip-fixture','permanent-fixture'].includes(q.chain)?trusted(q):null;
const fixtureEngine={...engine,newWorld(command){const w=engine.newWorld(command);const p=w.players.find(x=>x.teamId===w.selectedId&&!x.retired);a.ok(p);p.injury={date:w.year+'-03-01',daysLeft:8,label:'隔離試験用負傷'};return w;}};
async function open(dir){
 runtime=createServiceRuntime({dataDir:dir,now:()=>clock,authenticate:async t=>({authenticated:Object.hasOwn(accounts,t),account:accounts[t]}),verifyRecentReauth:async q=>({verified:q.account===accounts.c&&q.proof==='fixture-reauth',account:q.account}),verifyReceipt,verifyCurrent,verifyNotification:deny,verifyEvent:deny,verifyAction:deny,verifyCompletion:deny,canonicalEngine:fixtureEngine,resolveKey:async id=>id==='1'?publicKey:null,units:{android:{unit:'123',item:'ticket',amount:1}}});
 await new Promise((ok,bad)=>{runtime.server.once('error',bad);runtime.server.listen(0,'127.0.0.1',ok);});return 'http://127.0.0.1:'+runtime.server.address().port;
}
async function close(){if(runtime){await runtime.close();runtime=null;}}
async function post(base,route,body,token='a',status=200){
 const res=await fetch(base+'/v1/'+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});a.equal(res.status,status,route);return res.json();
}
function signedCallback(customData,tx='fixture-transaction'){
 const q='ad_unit=123&custom_data='+customData+'&reward_amount=1&reward_item=ticket&timestamp='+clock+'&transaction_id='+tx;
 return q+'&signature='+sign('sha256',Buffer.from(q),privateKey).toString('base64url')+'&key_id=1';
}
async function callback(base,q,status=200){const r=await fetch(base+'/v1/admob/ssv?'+q);a.equal(r.status,status);await r.json();}
(async()=>{
 try{
  fs.mkdirSync(scratchRoot,{mode:0o700});
  let base=await open(source);
  await post(base,'game/create',{slot:1,command:{team:0}});
  const before=await post(base,'game/read',{slot:1}),target=before.actions.find(x=>x.route==='medical');a.ok(target);
  const operationId=target.operationId,order=await post(base,'game/reserve',{slot:1,operationId,choice:'ad'});
  a.equal(order.mode,'ad');a.equal(order.status,'pending');
  const args={slot:1,operationId,attempt:order.attempt},ctx={operationId,attempt:order.attempt};
  a.equal((await post(base,'game/settle',args)).status,'awaiting_proof');
  const issued=await post(base,'ads/issue',{...ctx,platform:'android'});a.ok(/^[a-f0-9]{64}$/.test(issued.customData));
  const signed=signedCallback(issued.customData);
  await callback(base,signed.replace('reward_amount=1','reward_amount=2'),403);
  await callback(base,signed);a.equal((await post(base,'ads/status',ctx)).verified,true);
  a.equal((await post(base,'game/read',{slot:1})).revision,before.revision,'SSV is evidence, not settlement');
  // Independently exercise real HTTP purchase and account-deletion paths.
  for(const proof of ['vip-fixture','permanent-fixture'])await post(base,'restore',{store:'apple',proof},'b');
  const rights=await post(base,'entitlements',{},'b');a.equal(rights.entitlements.vip.active,true);a.equal(rights.entitlements.adSkip.active,true);
  await post(base,'game/create',{slot:1,command:{team:2}},'c');
  const deletion=await post(base,'deletion/request',{confirmed:true,reauthProof:'fixture-reauth'},'c');a.equal(deletion.request.status,'requested');
  await post(base,'game/read',{slot:1},'c',403);await close();
  encryptOffline({...opts,source,destination:enc});
  decryptOffline({...opts,source:enc,destination:dest});
  base=await open(dest);
  const restored=await post(base,'game/read',{slot:1});a.equal(restored.revision,before.revision);a.equal(restored.pending.length,1);a.equal(restored.pending[0].operationId,operationId);a.deepEqual(restored.wallet,before.wallet);
  a.equal((await post(base,'ads/status',ctx)).verified,true);
  await callback(base,signed); // identical signed transaction is a duplicate
  const settled=await post(base,'game/settle',args);a.equal(settled.status,'committed');a.equal(settled.replay,false);a.equal(settled.revision,before.revision+1);a.equal(settled.result.before,8);a.equal(settled.result.after,4);
  const after=await post(base,'game/read',{slot:1});a.equal(after.pending.length,0);a.equal(after.revision,before.revision+1);
  const replay=await post(base,'game/settle',args);a.equal(replay.replay,true);a.deepEqual(replay.result,settled.result);a.deepEqual(await post(base,'game/read',{slot:1}),after);
  a.equal((await post(base,'ads/status',ctx)).verified,false);
  const recoveredRights=await post(base,'entitlements',{},'b');a.equal(recoveredRights.entitlements.vip.active,true);a.equal(recoveredRights.entitlements.adSkip.active,true);
  revoked=true;const refund=await post(base,'entitlements',{},'b');a.equal(refund.entitlements.vip.active,false);a.equal(refund.entitlements.adSkip.active,false);
  const restoredDeletion=await post(base,'deletion/status',{},'c');a.deepEqual(restoredDeletion,deletion);
  await post(base,'game/read',{slot:1},'c',403);await post(base,'game/create',{slot:2,command:{team:3}},'c',403);
  a.equal(fs.readdirSync(scratchRoot).length,0);
  console.log('PASS encrypted restore preserves pending signed SSV evidence, exactly-once medical settlement, live provider recheck and revocation, deletion fence');
 }finally{await close();key.fill(0);fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
