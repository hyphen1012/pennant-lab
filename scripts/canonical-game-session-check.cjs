const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServiceRuntime}=require('../server/service-runtime.cjs'),{createHeadlessEngine}=require('../server/headless-engine.cjs');
const {createAccountClient}=require('../mobile/src/account-client.cjs'),{createCanonicalGameSession}=require('../mobile/src/canonical-game-session.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pl-game-session-')),owner='a'.repeat(64),other='b'.repeat(64);
 const deny=async()=>null,auth=async t=>t==='a'||t==='b'?{authenticated:true,account:t==='a'?owner:other}:{authenticated:false};
 const runtime=createServiceRuntime({dataDir:dir,authenticate:auth,verifyRecentReauth:deny,verifyReceipt:deny,verifyCurrent:deny,verifyNotification:deny,verifyEvent:deny,verifyAction:deny,verifyCompletion:deny,canonicalEngine:createHeadlessEngine(),units:{android:{unit:'123',item:'ticket',amount:1}},origins:[]});
 let lost=false,advances=0,creates=0,online=true,delayRead=null;
 try{
  await new Promise(ok=>runtime.server.listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+runtime.server.address().port;
  const fetcher=async(url,options)=>{
   const route=new URL(url).pathname;
   if(route==='/v1/game/advance')advances++;
   if(route==='/v1/game/create')creates++;
   const res=await fetch(base+route,options);
   if(route==='/v1/game/advance'&&lost){lost=false;await res.text();throw Error('fixture lost committed response');}
   if(route==='/v1/game/read'&&delayRead){const d=delayRead;delayRead=null;await d;}
   return res;
  };
  const create=()=>createCanonicalGameSession({client:createAccountClient({baseUrl:'https://fixture.invalid',fetcher}),online:()=>online});
  const one=create(),two=create();one.setSession({account:owner,token:'a'});two.setSession({account:owner,token:'a'});one.select(1);two.select(1);
  a.deepEqual((await one.listSlots()).slots,[]);
  a.throws(()=>one.create({team:0},false));
  const first=await one.create({team:0},true);a.equal(first.status,'ready');a.equal(first.snapshot.revision,1);
  const listed=await one.listSlots();a.deepEqual(listed.slots,[{slot:1,world:first.snapshot.world,revision:1}]);
  a.equal((await two.create({team:1},true)).status,'refresh-required');a.equal(creates,1);
  const read=await two.refresh();a.equal(read.snapshot.world,first.snapshot.world);a.equal(read.snapshot.revision,1);
  const page=await one.freePage({offset:0,limit:40,query:''});a.equal(page.status,'ready');a.equal(page.page.offset,0);a.ok(page.page.items.length<=40);
  const updated=await one.advance({club:'travel',value:1});a.equal(updated.snapshot.revision,2);a.equal(updated.snapshot.game.club.travel,1);
  const stalePage=await two.freePage({offset:0,limit:40,query:''});a.equal(stalePage.status,'refresh-required');a.equal(two.inspect().snapshot,null);
  // A separate stale read must still be rejected by the mutation CAS.
  const three=create();three.setSession({account:owner,token:'a'});three.select(1);await three.refresh();
  const changed=await one.advance({club:'travel',value:1});a.equal(changed.snapshot.revision,3);
  const stale=await three.advance({club:'travel',value:3});a.equal(stale.status,'refresh-required');a.equal(three.inspect().snapshot,null);a.throws(()=>three.advance({club:'travel',value:3}));
  const after=await two.refresh();a.equal(after.snapshot.revision,3);a.equal(after.snapshot.game.club.travel,1);
  const n=advances;lost=true;const uncertain=await one.advance({club:'travel',value:2});a.equal(uncertain.status,'refresh-required');a.equal(uncertain.uncertain,true);a.equal(advances,n+1);
  a.throws(()=>one.advance({club:'travel',value:2}));
  const recovered=await one.refresh();a.equal(recovered.snapshot.revision,4);a.equal(recovered.snapshot.game.club.travel,2);a.equal(advances,n+1);
  const copy=one.inspect();copy.snapshot.game.club.travel=99;a.equal(one.inspect().snapshot.game.club.travel,2);
  online=false;const offline=await one.advance({club:'travel',value:0});a.equal(offline.status,'refresh-required');a.equal(advances,n+1);online=true;
  const reload=await one.refresh();a.equal(reload.snapshot.revision,4);
  // Session change while a read is outstanding: never expose account A's data
  // under account B. A separate authenticated account has no slot yet.
  let release;delayRead=new Promise(ok=>release=ok);const old=one.refresh();
  one.setSession({account:other,token:'b'});one.select(1);release();a.equal((await old).status,'stale');a.equal(one.inspect().snapshot,null);
  const absent=await one.refresh();a.equal(absent.status,'refresh-required');
  a.deepEqual((await one.listSlots()).slots,[]);
  const b=await one.create({team:1,identity:{gmName:'B',name:'新球団',short:'NEW',letter:'N',color:'#123456',accent:'#ffffff',shape:'circle',pattern:'solid',font:'bold',motif:'letter'}},true);a.equal(b.status,'ready');a.notEqual(b.snapshot.world,first.snapshot.world);a.equal(b.snapshot.game.team.name,'新球団');a.equal(b.snapshot.game.gmName,'B');
  a.equal((await two.refresh()).snapshot.game.club.travel,2);
  one.suspend();a.equal(one.inspect().snapshot,null);a.throws(()=>one.advance({step:1}));a.equal((await one.refresh()).snapshot.world,b.snapshot.world);
  console.log('PASS real engine HTTP session, explicit create, revision conflict, committed response loss, no replay, offline and identity isolation');
 }finally{await runtime.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
