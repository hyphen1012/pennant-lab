'use strict';
const a=require('node:assert/strict'),{performance}=require('node:perf_hooks'),{createHash}=require('node:crypto');
const {createHeadlessEngine}=require('../server/headless-engine.cjs'),{openLedger}=require('../server/account-ledger.cjs'),{createGameAuthority}=require('../server/game-authority.cjs');
(async()=>{
 const engine=createHeadlessEngine(),world=engine.newWorld({team:0}),owner='a'.repeat(64);
 const p=world.players.find(x=>x.teamId===world.selectedId&&!x.retired);a.ok(p);p.injury={date:'2027-03-01',daysLeft:8,label:'fixture'};
 const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),original=hash(world);
 const start=performance.now(),expected={game:engine.view(world),actions:engine.actions(world)},separateMs=performance.now()-start;
 let calls=0;Object.defineProperty(world,'toJSON',{configurable:true,value(){calls++;const copy={...this};return copy;}});
 const next=performance.now(),observed=engine.readProjection(world),combinedMs=performance.now()-next;
 a.equal(calls,1);delete world.toJSON;a.deepEqual(observed,expected);a.equal(hash(world),original);a.ok(observed.actions.some(x=>x.route==='medical'));
 const ledger=openLedger(':memory:');let paired=0;
 try{
  const service=createGameAuthority({ledger,engine:{...engine,newWorld:()=>world,readProjection(s){paired++;return engine.readProjection(s);},actions(){throw Error('separate actions called');}},authenticate:async()=>({authenticated:true,account:owner}),verifyRights:async()=>({verified:true,vip:false,adSkip:false}),hasAdProof:()=>false});
  const created=await service.create('a',1,{}),read=await service.read('a',1);a.equal(paired,1);a.equal(read.world,created.world);a.equal(read.revision,1);a.deepEqual(read.game,expected.game);a.equal(read.actions.length,expected.actions.length);a.ok(read.actions.some(x=>x.route==='medical'));
  const again=await service.read('a',1);a.deepEqual(again,read);a.equal(paired,2);
 }finally{ledger.close();}
 console.log(JSON.stringify({result:'PASS read projection equality, one world serialization, unchanged state, actual authority read',separateMs,combinedMs}));
})().catch(e=>{console.error(e);process.exitCode=1;});
