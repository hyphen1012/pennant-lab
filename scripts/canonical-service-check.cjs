const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{generateKeyPairSync,sign}=require('node:crypto');
const {createServiceRuntime}=require('../server/service-runtime.cjs'),{rosterTreatment}=require('../server/canonical-care.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pl-canonical-http-')),a='a'.repeat(64),b='b'.repeat(64),now=1700000000000;
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const deny=async()=>null,auth=async t=>['a','b'].includes(t)?{authenticated:true,account:t==='a'?a:b}:{authenticated:false};
 const engine={
  newWorld(cmd){if(Object.keys(cmd).length!==1||cmd.team!==0)throw Error('invalid command');return {year:2027,selectedId:0,players:[{id:1,teamId:0,injury:{date:'2027-05-01',daysLeft:9}}],tick:0};},
  actions(s){return s.players[0].injury.specialTreatment?[]:[{route:'medical',year:s.year,eventKey:'1:2027-05-01',label:'治療'}];},
  achievements(s){return s.tick?[{key:'win:1',label:'win',eligible:true}]:[];},
  applyAction(s){const result=rosterTreatment(s,1,'2027-05-01');if(!result)throw Error('ineligible');return {state:s,result};},
  advance(s,cmd){if(Object.keys(cmd).length!==1||cmd.step!==1)throw Error('invalid command');s.tick++;return s;},
  view(s){return {tick:s.tick,days:s.players[0].injury.daysLeft};}
 };
 const cfg={dataDir:dir,authenticate:auth,verifyRecentReauth:async x=>({verified:x.proof==='fresh',account:x.account}),verifyReceipt:deny,verifyCurrent:deny,verifyNotification:deny,verifyEvent:async account=>({verified:true,eligible:true,account,id:'legacy-win'}),verifyAction:async account=>({verified:true,eligible:true,account,id:'legacy-op'}),verifyCompletion:deny,units:{android:{unit:'123',item:'ticket',amount:1}},origins:['https://fixture.invalid'],resolveKey:async()=>publicKey,now:()=>now};
 let runtime,base;
 const start=async config=>{runtime=createServiceRuntime(config);await new Promise(ok=>runtime.server.listen(0,'127.0.0.1',ok));base='http://127.0.0.1:'+runtime.server.address().port;};
 const req=async(p,body,token='a')=>{const r=await fetch(base+p,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:'https://fixture.invalid'},body:JSON.stringify(body)});return [r.status,await r.json()];};
 try{
  await start(cfg);assert.equal((await req('/v1/game/read',{slot:1}))[0],503);await runtime.close();runtime=null;
  await start({...cfg,canonicalEngine:engine});
  const pre=await fetch(base+'/v1/purchase-finish',{method:'OPTIONS',headers:{Origin:'https://fixture.invalid','Access-Control-Request-Method':'POST'}});assert.equal(pre.status,204);
  assert.equal((await req('/v1/game/create',{slot:1,command:{team:0,state:{}}}))[0],403);
  assert.equal((await req('/v1/game/create',{slot:1,command:{team:0},seed:42}))[0],400);
  assert.equal((await req('/v1/game/create',{slot:1,command:{team:0}},'bad'))[0],403);
  assert.equal((await req('/v1/game/create',{slot:1,command:{team:0}}))[0],200);
  assert.equal((await req('/v1/game/read',{slot:1},'b'))[0],403);
  assert.equal((await req('/v1/reserve',{actionProof:'legacy-op',choice:'ad'}))[0],403);
  assert.equal((await req('/v1/claim',{eventProof:'legacy-win',choice:'ticket'}))[0],403);
  assert.equal((await req('/v1/game/advance',{slot:1,revision:1,command:{step:1}}))[0],200);
  assert.equal((await req('/v1/game/advance',{slot:1,revision:1,command:{step:1}}))[0],403);
  const event=(await req('/v1/game/achievements',{slot:1}))[1][0];
  assert.equal((await req('/v1/game/claim',{slot:1,eventId:event.eventId,choice:'ticket'}))[1].result.ok,true);
  assert.equal((await req('/v1/game/claim',{slot:1,eventId:event.eventId,choice:'ticket'}))[1].result.reason,'duplicate');
  const op=(await req('/v1/game/read',{slot:1}))[1].actions[0].operationId;
  const reserve=(await req('/v1/game/reserve',{slot:1,operationId:op,choice:'ad'}))[1];
  assert.equal(reserve.status,'pending');const attempt=reserve.attempt;
  assert.equal((await req('/v1/game/order',{slot:1,operationId:op}))[1].order.attempt,attempt);
  assert.equal((await req('/v1/game/read',{slot:1}))[1].pending[0].operationId,op);
  assert.equal((await req('/v1/game/settle',{slot:1,operationId:op,attempt}))[1].status,'awaiting_proof');
  assert.equal((await req('/v1/game/advance',{slot:1,revision:2,command:{step:1}}))[0],403);
  const issue=(await req('/v1/ads/issue',{operationId:op,attempt,platform:'android'}))[1];
  const raw='ad_unit=123&custom_data='+issue.customData+'&reward_amount=1&reward_item=ticket&timestamp='+now+'&transaction_id=canonical-test';
  const sig=sign('sha256',Buffer.from(raw),privateKey).toString('base64url');
  assert.equal((await fetch(base+'/v1/admob/ssv?'+raw+'&signature='+sig+'&key_id=7')).status,200);
  assert.equal((await req('/v1/game/read',{slot:1}))[1].game.days,9);
  const done=(await req('/v1/game/settle',{slot:1,operationId:op,attempt}))[1];assert.equal(done.result.after,5);assert.equal(done.wallet.tickets,1);
  const recovered=(await req('/v1/game/order',{slot:1,operationId:op}))[1];assert.equal(recovered.order.status,'committed');assert.equal(recovered.order.result.after,5);
  assert.equal((await req('/v1/game/read',{slot:1}))[1].pending.length,0);
  assert.equal((await req('/v1/game/settle',{slot:1,operationId:op,attempt}))[1].replay,true);
  assert.equal((await req('/v1/deletion/request',{confirmed:true,reauthProof:'fresh'}))[0],200);
  assert.equal((await req('/v1/game/read',{slot:1}))[0],403);
  console.log('PASS canonical HTTP boundary, disabled default, SSV separation, revision CAS, replay, deletion quarantine and legacy isolation (fixture engine)');
 }finally{await runtime?.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
