const assert=require('node:assert/strict'),{createAccountClient}=require('../mobile/src/account-client.cjs'),{createCanonicalRewardFlow}=require('../mobile/src/canonical-reward-flow.cjs');
(async()=>{
 const op='a'.repeat(64),world='00000000-0000-4000-8000-000000000001',wallet={tickets:2,points:0,owned:[],claimCount:2,nextAt:null};
 let order=null,ads=0,settles=0,lost=false,verified=false,invalid=false;
 const client=createAccountClient({baseUrl:'https://fixture.invalid',fetcher:async(url,o)=>{
  const body=JSON.parse(o.body),route=url.split('/v1/')[1];assert.equal(o.headers.Authorization,'Bearer fixture');
  const reply=v=>({status:200,json:async()=>v});
  if(route==='game/read')return reply({world,revision:1,game:{days:9},actions:[],pending:[],wallet});
  if(route==='game/order')return reply({world,revision:1,order:invalid?{...order,operationId:'b'.repeat(64)}:order,wallet});
  if(route==='game/reserve'){const replay=!!order&&order.status!=='cancelled';if(!replay)order={operationId:op,mode:body.choice,attempt:(order?.attempt||0)+1,status:'pending',result:null};return reply({...order,replay,wallet});}
  if(route==='game/settle'){settles++;if(!verified&&order.mode==='ad')return reply({status:'awaiting_proof'});order={...order,status:'committed',result:{after:5}};if(lost){lost=false;throw Error('response lost');}return reply({status:'committed',replay:false,revision:2,wallet,result:order.result});}
  if(route==='game/cancel'){if(verified)return reply({status:'settlement_required'});order={...order,status:'cancelled'};return reply({status:'cancelled',wallet});}
  throw Error('unexpected request');
 }});client.setSession({account:'fixture',token:'fixture'});
 const flow=createCanonicalRewardFlow({client,online:async()=>true,requestAdProof:async()=>{ads++;return verified?'opaque':null;}});
 assert.equal((await client.gameRead(1)).game.days,9);
 assert.equal((await flow.run(1,op,'ad')).status,'reconcile_required');assert.equal(ads,1);assert.equal(settles,0);
 assert.equal((await flow.run(1,op,'ad')).status,'pending');assert.equal(ads,1);
 assert.equal((await flow.reconcile(1,op)).status,'awaiting_proof');
 verified=true;lost=true;assert.equal((await flow.reconcile(1,op)).status,'reconcile_required');
 assert.equal((await flow.recover(1,op)).observation.order.result.after,5);assert.equal(ads,1);
 const count=settles;assert.equal((await flow.reconcile(1,op)).status,'committed');assert.equal(settles,count);
 invalid=true;assert.equal((await flow.recover(1,op)).status,'reconcile_required');invalid=false;
 order=null;verified=false;assert.equal((await flow.run(1,op,'ad')).status,'reconcile_required');
 await assert.rejects(flow.cancel(1,op,false));assert.equal((await flow.cancel(1,op,true)).status,'cancelled');
 order=null;verified=true;let unblock;const interrupted=createCanonicalRewardFlow({client,online:async()=>true,requestAdProof:()=>new Promise(r=>{unblock=r;})});
 const p=interrupted.run(1,op,'ad');while(!unblock)await new Promise(r=>setImmediate(r));interrupted.invalidate();client.setSession(null);unblock('opaque');assert.equal((await p).status,'reconcile_required');
 assert.equal(settles,count);
 console.log('PASS canonical client recovery, no duplicate ads, uncertain commit, account switch and explicit cancel');
})().catch(e=>{console.error(e);process.exitCode=1;});
