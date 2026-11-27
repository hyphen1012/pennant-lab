'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createHash,randomBytes,randomUUID}=require('node:crypto');
const {backupOffline,restoreOffline,FILES}=require('../server/offline-backup-trial.cjs'),{createServiceRuntime}=require('../server/service-runtime.cjs'),{createHeadlessEngine}=require('../server/headless-engine.cjs'),{openLedger}=require('../server/account-ledger.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'pl-offline-')),source=path.join(root,'source'),backup=path.join(root,'backup'),restored=path.join(root,'restored'),owner='a'.repeat(64),deny=async()=>null;
const opts={environment:'staging',confirmedOffline:true};
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hashes=d=>FILES.map(n=>hash(path.join(d,n)));
let runtime;
async function open(dir){runtime=createServiceRuntime({dataDir:dir,authenticate:async t=>t==='a'?{authenticated:true,account:owner}:{authenticated:false},verifyRecentReauth:deny,verifyReceipt:deny,verifyCurrent:deny,verifyNotification:deny,verifyEvent:deny,verifyAction:deny,verifyCompletion:deny,canonicalEngine:createHeadlessEngine(),units:{android:{unit:'123',item:'ticket',amount:1}}});await new Promise((ok,bad)=>{runtime.server.once('error',bad);runtime.server.listen(0,'127.0.0.1',ok);});return 'http://127.0.0.1:'+runtime.server.address().port;}
async function close(){if(runtime){await runtime.close();runtime=null;}}
async function post(base,route,body){const res=await fetch(base+'/v1/game/'+route,{method:'POST',headers:{Authorization:'Bearer a','Content-Type':'application/json'},body:JSON.stringify(body)});a.equal(res.status,200);return res.json();}
(async()=>{
 try{
  let base=await open(source);const created=await post(base,'create',{slot:1,command:{team:0}});a.equal(created.revision,1);await close();
  // Test-only wallet and second-world fixture uses the existing ledger, never a public import endpoint.
  const ledger=openLedger(path.join(source,'account.sqlite'));try{ledger.transact(owner,s=>{s.points=23;s.tickets=4;});}finally{ledger.close();}
  base=await open(source);await post(base,'create',{slot:2,command:{team:1}});
  const before=await post(base,'read',{slot:1}),before2=await post(base,'read',{slot:2}),slots=await post(base,'slots',{});a.equal(before.wallet.points,23);a.equal(before.wallet.tickets,4);await close();
  const originals=hashes(source);
  a.throws(()=>backupOffline({...opts,confirmedOffline:false,source,destination:backup}),/confirmation/);
  a.throws(()=>backupOffline({...opts,environment:'production',source,destination:backup}),/confirmation/);
  const sidecar=path.join(source,'account.sqlite-wal');fs.writeFileSync(sidecar,'fixture');a.throws(()=>backupOffline({...opts,source,destination:backup}),/sidecar/);fs.unlinkSync(sidecar);
  const unexpected=path.join(source,'future.sqlite');fs.writeFileSync(unexpected,'fixture');a.throws(()=>backupOffline({...opts,source,destination:backup}),/unexpected/);fs.unlinkSync(unexpected);
  const manifest=backupOffline({...opts,source,destination:backup});a.equal(manifest.files.length,5);a.deepEqual(hashes(source),originals);a.deepEqual(hashes(backup),originals);
  a.throws(()=>backupOffline({...opts,source,destination:backup}));a.deepEqual(hashes(backup),originals);
  a.throws(()=>restoreOffline({...opts,source:backup,destination:source}));a.deepEqual(hashes(source),originals);
  const mf=path.join(backup,'manifest.json'),originalManifest=fs.readFileSync(mf,'utf8'),bad=JSON.parse(originalManifest);
  bad.files[0].name='../account.sqlite';fs.writeFileSync(mf,JSON.stringify(bad));a.throws(()=>restoreOffline({...opts,source:backup,destination:restored}),/manifest/);a.equal(fs.existsSync(restored),false);fs.writeFileSync(mf,originalManifest);
  const target=path.join(backup,'account.sqlite'),saved=fs.readFileSync(target);fs.appendFileSync(target,'x');a.throws(()=>restoreOffline({...opts,source:backup,destination:restored}),/hash mismatch/);a.equal(fs.existsSync(restored),false);fs.writeFileSync(target,saved);
  const result=restoreOffline({...opts,source:backup,destination:restored});a.deepEqual(result,manifest);a.deepEqual(hashes(restored),originals);
  base=await open(restored);a.deepEqual(await post(base,'slots',{}),slots);a.deepEqual(await post(base,'read',{slot:1}),before);a.deepEqual(await post(base,'read',{slot:2}),before2);await close();
  a.deepEqual(hashes(source),originals);a.deepEqual(hashes(backup),originals);
  const auth={key:randomBytes(32),backupId:randomUUID()},secure=path.join(root,'secure'),secureRestore=path.join(root,'secure-restore');
  a.throws(()=>backupOffline({...opts,source,destination:secure,authentication:{...auth,key:Buffer.alloc(31)}}),/authentication options/);
  const signed=backupOffline({...opts,source,destination:secure,authentication:auth});a.equal(signed.version,2);a.equal(signed.backupId,auth.backupId);a.ok(/^[a-f0-9]{64}$/.test(signed.mac));
  a.throws(()=>restoreOffline({...opts,source:secure,destination:secureRestore}),/manifest/);
  a.throws(()=>restoreOffline({...opts,source:backup,destination:secureRestore,authentication:auth}),/manifest/);
  a.throws(()=>restoreOffline({...opts,source:secure,destination:secureRestore,authentication:{...auth,key:randomBytes(32)}}),/authentication failed/);
  a.throws(()=>restoreOffline({...opts,source:secure,destination:secureRestore,authentication:{...auth,backupId:randomUUID()}}),/authenticated backup manifest/);
  const sm=path.join(secure,'manifest.json'),orig=fs.readFileSync(sm,'utf8'),tampered=JSON.parse(orig),sf=path.join(secure,'account.sqlite'),oldBytes=fs.readFileSync(sf);
  fs.appendFileSync(sf,'tamper');const row=tampered.files.find(x=>x.name==='account.sqlite');row.bytes=fs.statSync(sf).size;row.sha256=hash(sf);fs.writeFileSync(sm,JSON.stringify(tampered));
  a.throws(()=>restoreOffline({...opts,source:secure,destination:secureRestore,authentication:auth}),/authentication failed/);a.equal(fs.existsSync(secureRestore),false);fs.writeFileSync(sf,oldBytes);fs.writeFileSync(sm,orig);
  const sr=restoreOffline({...opts,source:secure,destination:secureRestore,authentication:auth});a.deepEqual(sr,signed);a.deepEqual(hashes(secureRestore),originals);
  base=await open(secureRestore);a.deepEqual(await post(base,'read',{slot:1}),before);a.deepEqual(await post(base,'read',{slot:2}),before2);await close();a.deepEqual(hashes(source),originals);
  auth.key.fill(0);
  console.log('PASS authenticated backup manifest, wrong key/identity, downgrade, recomputed hash tamper refusal, real HTTP recovery');
  console.log('PASS offline five-database backup, explicit staging confirmation, sidecar/unknown DB refusal, non-overwrite, manifest/hash rejection, real HTTP world/wallet recovery');
 }finally{await close();fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
