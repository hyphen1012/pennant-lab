const a=require('node:assert/strict'),{createHeadlessEngine}=require('../server/headless-engine.cjs');
const engine=createHeadlessEngine();
let w=engine.newWorld({team:0});
const clone=v=>JSON.parse(JSON.stringify(v)),club=()=>w.teams.find(t=>t.id===w.selectedId);
const go=(foreign,extra={})=>{w=engine.advance(w,{foreign,...extra});return engine.view(w).foreign;};
let v=engine.view(w).foreign;
if(!v.initialized)v=go('init');
a.equal(v.canOperate,true);a.equal(v.responsePending,false);a.deepEqual(v.supportOptions.map(x=>x.key).sort(),['housing','interpreter']);
for(const p of v.candidates.filter(p=>p.hidden)){a.equal(p.name,'????');a.equal(p.age,null);a.equal(p.appearanceSeed,null);a.equal(p.stats,null);a.ok(Object.values(p.abilities).every(x=>x===null));}
a.throws(()=>engine.advance(w,{foreign:'init'}));
a.throws(()=>engine.advance(w,{foreign:'begin',playerId:99999999}));
a.throws(()=>engine.advance(w,{foreign:'begin',playerId:v.candidates[0].id,seed:1}));
const hidden=w.foreignMarket.candidates.find(c=>c.scoutDiscovered===false);a.ok(hidden);a.ok(!v.candidates.some(c=>c.id===hidden.id));a.throws(()=>engine.advance(w,{foreign:'research',playerId:hidden.id,key:'field'}));
const c=v.candidates.find(c=>c.canBegin);a.ok(c);
const cash=club().cash;v=go('research',{playerId:c.id,key:'field'});a.ok(Math.abs(cash-club().cash-.05)<.001);a.throws(()=>engine.advance(w,{foreign:'research',playerId:c.id,key:'field'}));
v=go('begin',{playerId:c.id});a.equal(v.negotiation.status,'talk');
 // Fixture only: force a rare combined lineage on the existing generated candidate.
 // Restore its original identity before the ordinary recruitment simulation.
 const rareFixture=clone(w),rareCandidate=rareFixture.foreignMarket.candidates.find(x=>x.id===c.id);
 Object.assign(rareCandidate.player,{originCategory:'RINNE',specialCategory:'輪廻転生',pastLifeAppearance:{seed:99521,baseCategory:'IMMORTAL',privateFixture:'never export'}});
 const secret=engine.view(rareFixture).foreign.negotiation;
 a.equal(secret.interest,null);a.equal(secret.candidate.hidden,true);a.equal(secret.candidate.pastLifeAppearance,null);a.equal(secret.candidate.appearanceSeed,null);
a.equal(v.negotiation.candidate.id,c.id);a.throws(()=>engine.advance(w,{foreign:'submit'}));
const interpreterCash=club().cash;v=go('interpreter');a.ok(Math.abs(interpreterCash-club().cash-.02)<.001);a.throws(()=>engine.advance(w,{foreign:'interpreter'}));
for(let i=0;i<3;i++){a.ok(v.negotiation.question);a.throws(()=>engine.advance(w,{foreign:'reply',key:'INVALID'}));v=go('reply',{key:v.negotiation.question.options[0].key});}
a.equal(v.negotiation.answerCount,3);v=go('support',{key:'housing',enabled:true});a.equal(v.negotiation.support.housing,true);
v=go('offer',{level:1});a.equal(v.negotiation.offerLevel,1);
// Controlled fixture: ensure sufficient room and a deterministic signed outcome.
// All actions and money changes after this point use real game functions.
let conv=w.foreignMarket.negotiations[w.selectedId];conv.interest=86;conv.rivals=[];conv.overseas=false;club().cash=100;
v=go('offer',{level:0});const offer=v.negotiation.offers.find(o=>o.level===0);const before=club().cash;v=go('submit');
a.equal(v.negotiation.status,'waiting');a.equal(club().cash,before);a.throws(()=>engine.advance(w,{foreign:'submit'}));
conv=w.foreignMarket.negotiations[w.selectedId];
// If the original rules choose a non-immediate response, step to the actual due day.
if(conv.waitDays){a.throws(()=>engine.advance(w,{foreign:'open'}));for(let i=0;i<20;i++){let state=engine.view(w),x=state.foreign.negotiation;if(x.status!=='waiting')break;
 if(state.inbox.injury)w=engine.advance(w,{acknowledge:'injury',eventKey:state.inbox.injury.eventKey});
 else if(state.inbox.rare)w=engine.advance(w,{acknowledge:'rare',eventKey:state.inbox.rare.eventKey});
 else if(state.acknowledgements.month)w=engine.advance(w,{acknowledge:'month'});
 else if(state.acknowledgements.milestones)w=engine.advance(w,{acknowledge:'milestones'});
 else w=engine.advance(w,{step:1});
}}
v=engine.view(w).foreign;a.ok(['response','waiting'].includes(v.negotiation.status));a.equal(v.negotiation.result,null);a.equal(v.responsePending,true);
a.throws(()=>engine.advance(w,{foreign:'finish'}));a.throws(()=>engine.advance(w,{step:1}));
v=go('open');a.equal(v.negotiation.status,'signed');a.equal(v.negotiation.result.winner,w.selectedId);
a.equal(w.players.filter(p=>p.id===c.id).length,1);a.ok(w.players.find(p=>p.id===c.id).foreignContract);
a.throws(()=>engine.advance(w,{foreign:'finish'}));a.throws(()=>engine.advance(w,{foreign:'open'}));
// Clone actual signed response, then exercise staged disclosure with a rare fixture.
 const rareSigned=clone(w),rareSignedCandidate=rareSigned.foreignMarket.candidates.find(x=>x.id===c.id);
 Object.assign(rareSignedCandidate.player,{originCategory:'RINNE',specialCategory:'輪廻転生',pastLifeAppearance:{seed:99521,baseCategory:'IMMORTAL',privateFixture:'never export'}});
 const r0=engine.view(rareSigned).foreign.negotiation;a.equal(r0.candidate.hidden,true);a.equal(r0.candidate.pastLifeAppearance,null);a.equal(r0.interest,null);
 const r1=engine.advance(rareSigned,{foreign:'reveal'}),p1=engine.view(r1).foreign.negotiation;a.equal(p1.stage,1);a.equal(p1.candidate.pastLifeAppearance,null);a.equal(p1.candidate.appearanceSeed,null);
 const r2=engine.advance(r1,{foreign:'reveal'}),p2=engine.view(r2).foreign.negotiation;a.equal(p2.stage,2);a.equal(p2.candidate.hidden,false);a.deepEqual(p2.candidate.pastLifeAppearance,{seed:99521,baseCategory:'IMMORTAL'});
 v=go('reveal');a.equal(v.negotiation.stage,1);v=go('reveal');a.equal(v.negotiation.stage,2);a.ok(Object.values(v.negotiation.candidate.abilities).every(x=>Number.isFinite(x.value)));
a.throws(()=>engine.advance(w,{foreign:'reveal'}));v=go('finish');a.equal(v.negotiation,null);a.equal(v.responsePending,false);
a.equal(w.players.filter(p=>p.id===c.id).length,1);
a.ok(!v.candidates.some(x=>x.id===c.id));console.log('PASS actual foreign scouting, research and interpreter charges, dialogue, deferred response, one registration, reveal and duplicate guards');
