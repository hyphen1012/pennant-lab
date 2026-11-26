'use strict';
const a=require('node:assert/strict'),{createHeadlessEngine}=require('../server/headless-engine.cjs'),{decadeFixture}=require('./decade-fixture.cjs'),{createGameAuthority}=require('../server/game-authority.cjs'),{openLedger}=require('../server/account-ledger.cjs');
(async()=>{
 const engine=createHeadlessEngine(),state=decadeFixture(engine.newWorld({team:0}),{partial:true}),cmd={kind:'decades',year:0,offset:0,limit:1};
 const before=JSON.stringify(state),p=engine.reportPage(state,cmd);a.equal(p.total,2);a.equal(p.items[0].end,2046);a.equal(p.items[0].count,1);a.equal(p.items[0].complete,false);a.equal(p.nextOffset,1);
 const q=engine.reportPage(state,{...cmd,offset:1}),r=q.items[0];a.equal(q.nextOffset,null);a.equal(r.start,2027);a.equal(r.end,2036);a.equal(r.count,10);a.equal(r.complete,true);a.equal(r.timeline.length,10);a.equal(r.own.length,10);a.equal(r.teams.length,12);a.equal(r.teams.find(t=>t.id===0).championships,10);a.equal(r.teams.find(t=>t.id===0).leagueTitles,10);a.equal(r.teams.find(t=>t.id===0).wins,800);a.equal(r.timeline[0].champion.id,0);a.ok(r.awards.some(x=>x.mvp===10));a.ok(r.leaders.bat.some(x=>x.metric==='hr'&&x.value==='30'));
 a.deepEqual(engine.reportPage(state,{...cmd,year:2036}).items[0],r);a.deepEqual(engine.reportPage(state,{...cmd,year:2035}).items,[]);a.equal(JSON.stringify(state),before);
 a.throws(()=>engine.reportPage(state,{...cmd,limit:2}));a.throws(()=>engine.reportPage(state,{...cmd,offset:3}));a.throws(()=>engine.reportPage({...state,pendingDraftReveal:{year:2037,entries:[]}},cmd),/decade archive unavailable/);
 const ledger=openLedger(':memory:'),owner='a'.repeat(64);
 try{
 const service=createGameAuthority({ledger,engine:{...engine,newWorld:()=>state},authenticate:async()=>({authenticated:true,account:owner}),verifyRights:async()=>({verified:true,vip:false,adSkip:false}),hasAdProof:()=>false});
 const w=await service.create('a',1,{}),page=await service.reportPage('a',1,w.world,1,{...cmd,year:2036});a.deepEqual(page.page.items[0],r);a.equal((await service.read('a',1)).revision,1);await a.rejects(service.reportPage('a',1,w.world,2,cmd),/revision conflict/);
 }finally{ledger.close();}
 const event=decadeFixture(engine.newWorld({team:0})),v=engine.view(event);a.equal(v.inbox.decade,2036);const eventPage=engine.reportPage(event,{...cmd,year:2036});a.equal(eventPage.items[0].count,10);const next=engine.advance(event,{acknowledge:'decade',eventKey:'2036'});a.equal(next.pendingDecade,null);a.equal(next.seasonArchive.length,10);a.equal(engine.reportPage(next,{...cmd,year:2036}).items[0].count,10);
 console.log('PASS decade archive complete/partial, actual aggregate helpers, bounded page, confidentiality, revision and optional acknowledgment');
})().catch(e=>{console.error(e);process.exitCode=1;});
