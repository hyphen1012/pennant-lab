'use strict';
const a=require('node:assert/strict'),{createAudio,sceneFor,replayCue,tracks}=require('../mobile/src/scene-audio.js');
(async()=>{
 const cases=[
 ...[['fan-fest','festival'],['tv','festival'],['opening-promo','opening'],['offdesk-opening','opening'],['settlement','finance']].map(([annual,name])=>[{page:'canonical-events',annual},name]),
 [{page:'canonical-events',inbox:{opening:true}},'opening'],[{page:'canonical-events',inbox:{monthly:{}}},'finance'],[{page:'canonical-events',inbox:{decade:2036}},'archive'],[{page:'canonical-events',inbox:{milestones:[{}]}},'archive'],[{page:'canonical-achievements'},'archive'],[{page:'canonical-reports'},'archive'],
 [{page:'title',launchTitle:true},'title'],[{page:'title'},'worlds'],[{page:'setup'},'worlds'],
 [{page:'canonical-hq'},'hq'],[{page:'canonical-roster'},'roster'],[{page:'canonical-manager'},'manager'],[{page:'canonical-facilities'},'finance'],
 [{page:'canonical-hq',replay:'watch'},'match'],[{page:'canonical-hq',skip:true},null],
 ...[['draft','draft'],['movement-market','negotiation'],['camp','training'],['awards-all','awards']].map(([annual,name])=>[{page:'canonical-events',annual},name]),
 [{page:'canonical-events',foreign:true},'foreign'],[{page:'canonical-events',inbox:{finance:{}}},'crisis'],[{page:'canonical-events',inbox:{career:{}}},'farewell'],
 [{page:'canonical-events',inbox:{rare:{category:'IMMORTAL輪廻転生',hidden:true}}},'mystery'],
 [{page:'canonical-events',inbox:{rare:{category:'IMMORTAL輪廻転生',hidden:false}}},'transcendent'],
 [{page:'canonical-events',inbox:{rare:{category:'IMMORTAL',hidden:false}}},'immortal'],
 [{page:'canonical-events',inbox:{rare:{category:'輪廻転生',hidden:false}}},'rebirth'],
 [{page:'canonical-events',inbox:{rare:{category:'LEGEND',hidden:false}}},'legend'],
 [{page:'canonical-events',inbox:{rookie:{entries:[{stage:1,specialCategory:'IMMORTAL'}]}}},'draft'],
 [{page:'canonical-events',inbox:{rookie:{entries:[{stage:2,specialCategory:'IMMORTAL'}]}}},'immortal'],
 [{page:'title',startup:true},null],[{page:'title',portal:true},null],[{page:'canonical-hq',available:false},null]
 ];for(const [input,want] of cases)a.equal(sceneFor(input),want,JSON.stringify(input));
 for(const [category,scene] of [['PARALLEL','parallel'],['STAR','star'],['LEGEND','legend'],['IMMORTAL','immortal'],['輪廻転生','rebirth'],['IMMORTAL輪廻転生','transcendent']]){
  a.equal(sceneFor({page:'canonical-events',inbox:{rare:{category,hidden:true}}}),'mystery');
  a.equal(sceneFor({page:'canonical-events',inbox:{rare:{category}}}),'mystery');
  a.equal(sceneFor({page:'canonical-events',inbox:{rare:{category,hidden:false}}}),scene);
  a.equal(sceneFor({page:'canonical-events',foreign:true,foreignCandidate:{category,hidden:true}}),'foreign');
  a.equal(sceneFor({page:'canonical-events',foreign:true,foreignCandidate:{category,hidden:false}}),scene);
  a.equal(sceneFor({page:'canonical-events',inbox:{rookie:{entries:[{stage:1,specialCategory:category,pastLifeAppearance:{baseCategory:'IMMORTAL'}}]}}}),'draft');
 }
 a.equal(sceneFor({page:'canonical-events',foreign:true,foreignCandidate:{category:'輪廻転生',hidden:false,pastLifeAppearance:{baseCategory:'IMMORTAL'}}}),'transcendent');
 a.equal(sceneFor({page:'canonical-events',inbox:{rookie:{entries:[{stage:2,hidden:true,specialCategory:'IMMORTAL'}]}}}),'draft');
 const report={year:2027,day:2,home:{id:0},away:{id:1},homeScore:5,awayScore:2,replay:[{phase:'score',play:{kind:'hr'}},{phase:'strike',play:{kind:'strike'}},{phase:'end'}]};
 a.equal(replayCue({phase:'date',report},0),null);a.equal(replayCue({phase:'watch',step:0,report},0),null);
 a.deepEqual(replayCue({phase:'watch',step:1,report},0),{key:'2027:2:1',kind:'homer'});
 a.equal(replayCue({phase:'watch',step:2,report},0).kind,'strike');a.equal(replayCue({phase:'watch',step:3,report},0),null);a.equal(replayCue({phase:'watch',step:4,report},0),null);
 a.equal(replayCue({phase:'final',report},0).kind,'win');a.equal(replayCue({phase:'final',report},1).kind,'loss');a.equal(replayCue({phase:'final',report:{...report,homeScore:2}},1).kind,'draw');a.equal(replayCue({phase:'final',report},2),null);
 a.equal(sceneFor({page:'canonical-hq',replay:'final',skip:true}),null);
 a.equal(new Set(['parallel','star','legend','immortal','rebirth','transcendent'].map(k=>JSON.stringify(tracks[k]))).size,6);
 for(const [name,t] of Object.entries(tracks)){a.equal(t.chords.length,4,name);a.equal(t.melody.length,32,name);a.ok(t.bpm>0);a.ok(t.melody.every(Number.isFinite));}
 let made=0,resumes=0,starts=0,stops=0,stored=null,serial=0;const timers=new Map(),timeouts=new Map();
 const gain=()=>({gain:{cancelScheduledValues(){},setTargetAtTime(){},setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}});
 class Context{constructor(){made++;this.state='suspended';this.currentTime=1;this.destination={};}createGain(){return gain();}createOscillator(){return {frequency:{},connect(){},disconnect(){},start(){starts++;},stop(){stops++;}};}async resume(){resumes++;this.state='running';}async suspend(){this.state='suspended';}}
 const host={AudioContext:Context,document:{hidden:false},localStorage:{getItem:()=>stored,setItem:(_,v)=>{stored=v;}},setInterval:f=>{timers.set(++serial,f);return serial;},clearInterval:i=>timers.delete(i),setTimeout:f=>{timeouts.set(++serial,f);return serial;},clearTimeout:i=>timeouts.delete(i)};
 const audio=createAudio({host});audio.setScene('title');a.equal(made,0);a.equal(timers.size,0);a.equal(await audio.unlock(),true);a.equal(made,1);a.equal(resumes,1);a.equal(timers.size,1);a.ok(starts>0);
 const before=starts;audio.setScene('title');a.equal(starts,before);a.equal(timers.size,1);audio.setScene('worlds');a.equal(timers.size,1);a.ok(starts>before);a.equal(audio.inspect().fading,true);a.equal(timeouts.size,1);
 audio.setScene('hq');a.equal(timers.size,1);a.equal(timeouts.size,1);a.ok(audio.inspect().voices<=32);const [fadeId,finishFade]=[...timeouts][0];timeouts.delete(fadeId);finishFade();a.equal(audio.inspect().fading,false);
 audio.setScene('roster');a.equal(audio.inspect().fading,true);audio.setScene('mystery');a.equal(timeouts.size,0);a.equal(audio.inspect().fading,false);audio.setScene('immortal');a.equal(audio.inspect().fading,false);audio.setScene('hq');a.equal(audio.inspect().fading,false);
 audio.setScene('roster');a.equal(timeouts.size,1);audio.visibility(false);a.equal(timeouts.size,0);a.equal(audio.inspect().voices,0);audio.visibility(true);await new Promise(r=>setImmediate(r));a.equal(timers.size,1);
 audio.cue('tap');a.ok(starts>before);audio.setScene(null);a.equal(timers.size,0);a.equal(timeouts.size,0);a.equal(audio.inspect().voices,0);
 audio.setScene('hq');audio.settings({enabled:false,bgm:0,sfx:.2});a.equal(timers.size,0);a.equal(audio.inspect().prefs.bgm,0);a.equal(createAudio({host}).inspect().prefs.enabled,false);
 audio.settings({enabled:true});await new Promise(r=>setImmediate(r));a.equal(timers.size,1);audio.visibility(false);a.equal(timers.size,0);a.equal(audio.inspect().voices,0);audio.visibility(true);await new Promise(r=>setImmediate(r));a.equal(timers.size,1);
 audio.setScene(null);a.equal(timers.size,0);a.ok(stops>0);
 a.equal(await createAudio({host:{...host,AudioContext:undefined}}).unlock(),false);
 // A pending resume must not restart sound after hide; rapid show during suspend must recover.
 let finishResume,finishSuspend,instance;
 class Delayed extends Context{constructor(){super();instance=this;}resume(){return new Promise(r=>{finishResume=()=>{this.state='running';r();};});}suspend(){return new Promise(r=>{finishSuspend=()=>{this.state='suspended';r();};});}}
 const race=createAudio({host:{...host,AudioContext:Delayed,localStorage:null}});race.setScene('hq');
 const first=race.unlock();race.visibility(false);finishResume();await new Promise(r=>setImmediate(r));a.equal(race.inspect().active,false);a.equal(typeof finishSuspend,'function');
 finishSuspend();a.equal(await first,false);a.equal(instance.state,'suspended');a.equal(race.inspect().voices,0);
 race.visibility(true);finishResume();await new Promise(r=>setImmediate(r));a.equal(race.inspect().active,true);
 race.visibility(false);race.visibility(true);finishSuspend();await new Promise(r=>setImmediate(r));finishResume();await new Promise(r=>setImmediate(r));a.equal(race.inspect().active,true);
 race.settings({enabled:false});finishSuspend();await new Promise(r=>setImmediate(r));a.equal(race.inspect().active,false);a.equal(instance.state,'suspended');
 console.log('PASS distinct rare themes, committed replay cues, queued resume/suspend races');
 console.log('PASS scene mapping, hidden category guard, no autoplay before unlock, one loop, mute, separate volumes, persistence, background stop and unsupported browser');
})().catch(e=>{console.error(e);process.exitCode=1;});
