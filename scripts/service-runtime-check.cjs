const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{generateKeyPairSync,sign}=require('node:crypto');
const {createServiceRuntime}=require('../server/service-runtime.cjs');
const {createOfflineBackup,verifyBackup,restoreToNewDirectory}=require('../server/backup.cjs');
const {createAdMobKeyResolver}=require('../server/admob-key-resolver.cjs');
const {openLedger}=require('../server/account-ledger.cjs');
const {openDeletionRequests}=require('../server/deletion-requests.cjs');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pl-services-')),data=path.join(root,'data'),archive=path.join(root,'backups'),restored=path.join(root,'restored');
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 let now=1700000000000,fetches=0;
 const resolveKey=createAdMobKeyResolver({now:()=>now,ttlMs:1000,fetcher:async(url,o)=>{assert.equal(url,'https://www.gstatic.com/admob/reward/verifier-keys.json');assert.equal(o.redirect,'error');fetches++;return new Response(JSON.stringify({keys:[{keyId:7,pem:publicKey.export({type:'spki',format:'pem'})}]}));}});
 assert.equal(await resolveKey('8'),null);assert.equal(fetches,1);assert.equal((await resolveKey('7')).asymmetricKeyType,'ec');assert.equal(fetches,1);
 now+=1001;await resolveKey('7');assert.equal(fetches,2);
 const owner='a'.repeat(64),other='b'.repeat(64),auth=async t=>t==='a'||t==='b'?{authenticated:true,account:t==='a'?owner:other}:{authenticated:false};
 const deny=async()=>null;
 const config={dataDir:data,authenticate:auth,verifyRecentReauth:async x=>({verified:x.proof==='fresh',account:x.account}),verifyReceipt:deny,verifyCurrent:deny,verifyNotification:deny,verifyEvent:deny,verifyAction:async(account,p)=>p==='fixture-action'?{verified:true,eligible:true,account,id:'op'}:null,verifyCompletion:deny,units:{android:{unit:'123',item:'ticket',amount:1}},origins:['https://fixture.invalid'],resolveKey,now:()=>now};
 let runtime;
 try{
  assert.throws(()=>createServiceRuntime({...config,environment:'production'}));
  runtime=createServiceRuntime(config);await new Promise(ok=>runtime.server.listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+runtime.server.address().port;
  const req=async(p,b={},token='a',origin='https://fixture.invalid')=>{const r=await fetch(url+p,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:origin},body:JSON.stringify(b)});return [r.status,await r.json(),r.headers.get('access-control-allow-origin')];};
  assert.equal((await req('/v1/identity'))[1].account,owner);assert.equal((await req('/v1/identity',{},'a','https://evil.invalid'))[0],403);
  const pre=await fetch(url+'/v1/saves/1',{method:'OPTIONS',headers:{Origin:'https://fixture.invalid','Access-Control-Request-Method':'PUT'}});assert.equal(pre.status,204);
  assert.equal((await req('/v1/ads/issue',{operationId:'op',attempt:1,platform:'android'}))[0],403);
  const reserve=await req('/v1/reserve',{actionProof:'fixture-action',choice:'ad'});assert.equal(reserve[1].mode,'ad');assert.equal(reserve[1].status,'pending');
  const issue=await req('/v1/ads/issue',{operationId:'op',attempt:1,platform:'android'});assert.equal(issue[0],200);const custom=issue[1].customData;assert.match(custom,/^[a-f0-9]{64}$/);
  const status=()=>req('/v1/ads/status',{operationId:'op',attempt:1});
  assert.equal((await status())[1].verified,false);
  const raw='ad_unit=123&custom_data='+custom+'&reward_amount=1&reward_item=ticket&timestamp='+now+'&transaction_id=tx123';
  const sig=sign('sha256',Buffer.from(raw),privateKey).toString('base64url');
  const cb=async s=>(await fetch(url+'/v1/admob/ssv?'+s)).status;
  assert.equal(await cb(raw.replace('reward_amount=1','reward_amount=2')+'&signature='+sig+'&key_id=7'),403);
  assert.equal(await cb(raw+'&signature='+sig+'&key_id=7'),200);assert.equal(await cb(raw+'&signature='+sig+'&key_id=7'),200);
  assert.equal((await status())[1].verified,true);assert.equal((await req('/v1/ads/status',{operationId:'op',attempt:1},'b'))[1].verified,false);
  assert.equal((await req('/v1/order',{id:'op'}))[1].order.status,'pending','SSV evidence must not grant a game reward');
  assert.equal((await req('/v1/deletion/request',{confirmed:true,reauthProof:'old'}))[0],403);
  const d=await req('/v1/deletion/request',{confirmed:true,reauthProof:'fresh'});assert.equal(d[1].request.status,'requested');assert.equal((await req('/v1/identity'))[0],403);
  assert.equal((await req('/v1/deletion/status'))[1].request.requestId,d[1].request.requestId);
  assert.equal((await req('/v1/identity',{},'b'))[0],200);
  await runtime.close();runtime=null;
  await assert.rejects(createOfflineBackup({dataDir:data,backupDir:archive}));
  const dir=await createOfflineBackup({dataDir:data,backupDir:archive,quiesced:true});assert.equal((await verifyBackup(dir)).files.length,5);
  const latestDeletionFile=path.join(data,'deletion.sqlite');
  // Account B is deleted after the historical snapshot. Recovery must not
  // expose B and must not claim its restored data is already erased.
  const latest=openDeletionRequests(latestDeletionFile,{now:()=>now+1000});
  try{latest.request(other);latest.advance(other,'requested','processing');latest.advance(other,'processing','completed');}finally{latest.close();}
  const opts={backupDir:dir,targetDir:restored,latestDeletionFile,quiesced:true};
  await assert.rejects(restoreToNewDirectory({backupDir:dir,targetDir:restored}));
  await assert.rejects(restoreToNewDirectory({...opts,latestDeletionFile:path.join(dir,'deletion.sqlite')}));
  await restoreToNewDirectory(opts);await assert.rejects(restoreToNewDirectory(opts));
  const recovered=openDeletionRequests(path.join(restored,'deletion.sqlite'));
  try{assert.equal(recovered.status(other).status,'processing');assert.equal(recovered.status(owner).status,'requested');}finally{recovered.close();}
  runtime=createServiceRuntime({...config,dataDir:restored});await new Promise(ok=>runtime.server.listen(0,'127.0.0.1',ok));
  const r=await fetch('http://127.0.0.1:'+runtime.server.address().port+'/v1/identity',{method:'POST',headers:{Authorization:'Bearer a','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);
  const blocked=await fetch('http://127.0.0.1:'+runtime.server.address().port+'/v1/identity',{method:'POST',headers:{Authorization:'Bearer b','Content-Type':'application/json'},body:'{}'});assert.equal(blocked.status,403);
  await runtime.close();runtime=null;fs.appendFileSync(path.join(dir,'account.sqlite'),'corrupt');await assert.rejects(verifyBackup(dir));
  console.log('PASS unified service, signed ad proof without grant, deletion quarantine, CORS and independent-target offline backup/restore');
 }finally{await runtime?.close();fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
