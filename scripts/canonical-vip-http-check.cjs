'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServiceRuntime}=require('../server/service-runtime.cjs'),{createHeadlessEngine}=require('../server/headless-engine.cjs'),{openPurchaseRegistry}=require('../server/purchase-registry.cjs');
const engine=createHeadlessEngine(),normal={verified:true,vip:false},vip={verified:true,vip:true};
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
// Find two adjacent actual monthly settlement transitions from one world.
// The world comes from the checked-in engine, not fabricated revenue or imported client data.
function settlementFixtures(){
 for(let seed=0;seed<8;seed++){
  let w=engine.newWorld({team:seed}),found=[];
  for(let i=0;i<150;i++){
   const v=engine.view(w);if(v.acknowledgements.month){w=engine.advance(w,{acknowledge:'month'});continue;}
   if(v.acknowledgements.milestones){w=engine.advance(w,{acknowledge:'milestones'});continue;}
   if(v.blocked)break;
   const n=engine.advance(w,{step:1},normal);
   if((n.financeLedger?.periods?.length||0)>(w.financeLedger?.periods?.length||0)){
    found.push(w);if(found.length===2)return found;
   }
   w=n;
  }
 }
 throw Error('two actual settlements unavailable');
}
(async()=>{
 const [preFirst,preSecond]=settlementFixtures(),owner='a'.repeat(64),other='b'.repeat(64),dir=fs.mkdtempSync(path.join(os.tmpdir(),'pl-vip-http-'));
 let clock=1700000000000,expiry=clock+120000,version=1,status='active',stale=false,foreign=false,fixture=preFirst;
 const deny=async()=>null,provider=async q=>({verified:true,verifiedAt:clock-(stale?300000:0),revision:version,account:foreign?other:q.account,store:q.store,chain:q.chain,product:q.product,status,expiresAt:expiry});
 const registry=openPurchaseRegistry(path.join(dir,'purchases.sqlite'));try{registry.record({verified:true,account:owner,store:'apple',chain:'fixture-vip',product:'vip',revision:version,status,expiresAt:expiry},owner);}finally{registry.close();}
 const runtime=createServiceRuntime({dataDir:dir,now:()=>clock,authenticate:async t=>({authenticated:['a','b'].includes(t),account:t==='a'?owner:other}),verifyRecentReauth:deny,verifyReceipt:deny,verifyCurrent:provider,verifyNotification:deny,verifyEvent:deny,verifyAction:deny,verifyCompletion:deny,canonicalEngine:{...engine,newWorld:()=>structuredClone(fixture)},units:{android:{unit:'123',item:'ticket',amount:1}}});
 try{
  await new Promise(r=>runtime.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+runtime.server.address().port;
  const post=async(route,body,token='a')=>{const res=await fetch(base+'/v1/'+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,body:await res.json()};};
  const call=async(route,body,token='a')=>{const r=await post(route,body,token);a.equal(r.status,200,JSON.stringify(r.body));return r.body;};
  const create=(slot,token='a')=>call('game/create',{slot,command:{}},token);
  const read=(slot,token='a')=>call('game/read',{slot},token);
  const advance=(slot,s,token='a')=>call('game/advance',{slot,world:s.world,revision:s.revision,command:{step:1}},token);
  const A=await create(1),B=await create(1,'b'),normalNext=engine.advance(preFirst,{step:1},normal),vipNext=engine.advance(preFirst,{step:1},vip),nv=engine.view(normalNext),vv=engine.view(vipNext);
  a.equal(nv.vipIncome,0);a.ok(vv.vipIncome>0);a.equal(round(vv.team.cash-nv.team.cash),vv.vipIncome);
  const period=vipNext.financeLedger.periods.at(-1).clubs[preFirst.selectedId];
  a.equal(period.vipIncome,round(round(period.sponsorship+period.commerce.income+period.stadium.gross)*.2));
  for(const t of vipNext.teams.filter(t=>t.id!==preFirst.selectedId))a.equal(t.cash,normalNext.teams.find(x=>x.id===t.id).cash);
  let x=await advance(1,A),y=await advance(1,B,'b');a.deepEqual(x.game,vv);a.deepEqual(y.game,nv);
  a.equal((await post('game/advance',{slot:1,world:A.world,revision:A.revision,command:{step:1}})).status,403);a.equal((await read(1)).game.vipIncome,vv.vipIncome);
  a.equal((await post('game/advance',{slot:1,world:x.world,revision:x.revision,command:{step:1,vip:true}})).status,403);
  // Preserve real earned assets, and exercise a later actual settlement with
  // a test-only historical carry-forward. No fabricated VIP income.
  fixture=structuredClone(preSecond);
  const actualFirst=vipNext.financeLedger.periods.at(-1).clubs[preFirst.selectedId];
  const carried=fixture.financeLedger.clubs[fixture.selectedId];
  carried.vipIncome=actualFirst.vipIncome;carried.revenue=round(carried.revenue+actualFirst.vipIncome);
  fixture.teams.find(t=>t.id===fixture.selectedId).cash=round(fixture.teams.find(t=>t.id===fixture.selectedId).cash+actualFirst.vipIncome);
  const C=await create(2);clock=expiry;const rights=await call('entitlements',{});a.equal(rights.entitlements.vip.active,false);
  const expected=engine.view(engine.advance(fixture,{step:1},normal));const expired=await advance(2,C);a.deepEqual(expired.game,expected);a.equal(expired.game.vipIncome,actualFirst.vipIncome);
  // Freshly renewed, then revoked, wrong-account or stale provider results.
  version++;expiry=clock+120000;status='active';const D=await create(3);
  stale=true;a.equal((await post('game/advance',{slot:3,world:D.world,revision:D.revision,command:{step:1}})).status,403);stale=false;
  foreign=true;a.equal((await post('game/advance',{slot:3,world:D.world,revision:D.revision,command:{step:1}})).status,403);foreign=false;
  a.equal((await read(3)).revision,D.revision);version++;status='revoked';
  const revoked=await advance(3,D);a.deepEqual(revoked.game,expected);a.equal(revoked.game.vipIncome,actualFirst.vipIncome);
  console.log('PASS real HTTP monthly VIP income 20%, ordinary account/CPU isolation, expiry/revocation, retained prior income, stale/wrong account and duplicate rejection');
 }finally{await runtime.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
