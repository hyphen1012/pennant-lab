'use strict';
const a=require('node:assert/strict'),{createAudio,sceneFor,tracks}=require('../mobile/src/scene-audio.js');
(async()=>{
 const cases=[
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
 for(const [name,t] of Object.entries(tracks)){a.equal(t.chords.length,4,name);a.equal(t.melody.length,32,name);a.ok(t.bpm>0);a.ok(t.melody.every(Number.isFinite));}
 let made=0,resumes=0,starts=0,stops=0,stored=null,serial=0;const timers=new Map();
 const gain=()=>({gain:{cancelScheduledValues(){},setTargetAtTime(){},setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}});
 class Context{constructor(){made++;this.state='suspended';this.currentTime=1;this.destination={};}createGain(){return gain();}createOscillator(){return {frequency:{},connect(){},disconnect(){},start(){starts++;},stop(){stops++;}};}async resume(){resumes++;this.state='running';}async suspend(){this.state='suspended';}}
 const host={AudioContext:Context,document:{hidden:false},localStorage:{getItem:()=>stored,setItem:(_,v)=>{stored=v;}},setInterval:f=>{timers.set(++serial,f);return serial;},clearInterval:i=>timers.delete(i)};
 const audio=createAudio({host});audio.setScene('title');a.equal(made,0);a.equal(timers.size,0);a.equal(await audio.unlock(),true);a.equal(made,1);a.equal(resumes,1);a.equal(timers.size,1);a.ok(starts>0);
 const before=starts;audio.setScene('title');a.equal(starts,before);a.equal(timers.size,1);audio.setScene('worlds');a.equal(timers.size,1);a.ok(starts>before);
 audio.cue('tap');a.ok(starts>before);audio.setScene(null);a.equal(timers.size,0);a.equal(audio.inspect().voices,0);
 audio.setScene('hq');audio.settings({enabled:false,bgm:0,sfx:.2});a.equal(timers.size,0);a.equal(audio.inspect().prefs.bgm,0);a.equal(createAudio({host}).inspect().prefs.enabled,false);
 audio.settings({enabled:true});a.equal(timers.size,1);audio.visibility(false);a.equal(timers.size,0);a.equal(audio.inspect().voices,0);audio.visibility(true);await new Promise(r=>setImmediate(r));a.equal(timers.size,1);
 audio.setScene(null);a.equal(timers.size,0);a.ok(stops>0);
 a.equal(await createAudio({host:{...host,AudioContext:undefined}}).unlock(),false);
 console.log('PASS scene mapping, hidden category guard, no autoplay before unlock, one loop, mute, separate volumes, persistence, background stop and unsupported browser');
})().catch(e=>{console.error(e);process.exitCode=1;});
