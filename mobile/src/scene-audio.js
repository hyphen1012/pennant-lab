// Original synthesized guide tracks. No external music, network or game-state writes.
// Staging evaluation only; replace/arrange guide tracks after listening approval.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PennantAudio=Object.assign(api.createAudio({host:root}),{sceneFor:api.sceneFor});})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const track=(bpm,chords,melody,wave='sine')=>({bpm,chords,melody,wave});
// Four-bar loops, each row is an original chord and eight half-beat melody slots.
const tracks={
 title:track(84,[[48,55,60,64],[45,52,57,60],[41,48,53,57],[43,50,55,62]],[72,0,76,79,0,76,74,0,69,0,72,76,0,72,71,0,69,72,77,0,76,0,72,0,71,0,74,79,77,74,0,0],'triangle'),
 worlds:track(60,[[45,52,59,64],[41,48,55,60],[48,55,62,67],[43,50,57,62]],[76,0,0,83,0,79,0,0,72,0,0,79,0,76,0,0,74,0,0,81,0,79,0,0,74,0,0,81,0,74,0,0]),
 hq:track(82,[[48,55,60,64],[45,52,57,60],[50,57,60,65],[43,50,59,62]],[64,0,67,0,69,67,0,64,60,0,64,0,67,64,0,0,65,0,69,72,0,69,65,0,62,0,65,67,0,62,60,0],'triangle'),
 roster:track(92,[[50,57,60,65],[55,62,65,71],[48,55,60,64],[45,52,57,60]],[65,0,69,65,0,67,0,69,71,67,0,65,62,0,65,0,64,0,67,72,0,67,0,64,60,64,0,69,67,0,64,0],'triangle'),
 manager:track(72,[[48,55,59,64],[45,52,55,60],[50,57,60,65],[43,50,53,59]],[64,0,67,71,0,69,0,67,60,0,64,67,0,64,0,0,65,0,69,72,0,69,0,65,59,0,62,65,0,62,60,0]),
 finance:track(86,[[48,55,60,64],[52,59,64,67],[45,52,57,60],[43,50,55,62]],[60,64,67,0,72,0,67,0,64,67,71,0,76,0,71,0,60,64,69,0,72,0,69,0,62,67,74,0,71,0,67,0],'triangle'),
 training:track(108,[[50,57,62,66],[47,54,59,62],[43,50,55,59],[45,52,57,61]],[66,69,0,74,0,69,66,0,62,66,71,0,74,0,71,0,59,62,67,0,71,67,0,0,61,64,69,0,73,69,0,0],'triangle'),
 match:track(132,[[45,52,57,60],[41,48,53,57],[48,55,60,64],[43,50,55,62]],[69,69,72,0,76,0,72,67,65,65,69,0,72,0,69,65,67,67,72,0,76,0,79,76,74,74,71,0,67,0,74,0],'triangle'),
 draft:track(94,[[45,52,57,60],[46,53,58,62],[41,48,53,57],[40,47,52,56]],[69,0,0,72,0,76,0,0,70,0,0,74,0,77,0,0,69,0,0,72,0,77,0,0,68,0,0,71,0,76,0,0],'triangle'),
 negotiation:track(76,[[45,52,55,60],[50,57,60,65],[43,50,53,58],[40,47,52,56]],[64,0,60,0,67,0,0,0,65,0,60,0,69,0,0,0,62,0,58,0,65,0,0,0,64,0,56,0,59,0,0,0]),
 foreign:track(96,[[50,57,62,65],[48,55,60,64],[43,50,55,58],[45,52,57,60]],[74,0,77,79,0,77,72,0,72,0,76,79,0,76,67,0,70,0,74,77,0,74,67,0,69,0,72,76,0,72,69,0],'triangle'),
 awards:track(104,[[48,55,60,64],[53,60,65,69],[45,52,57,60],[43,50,55,59]],[72,76,79,0,84,0,79,76,77,81,84,0,81,0,77,0,76,72,69,0,76,79,0,0,74,71,67,0,74,79,0,0],'triangle'),
 farewell:track(64,[[48,55,59,64],[45,52,57,60],[41,48,53,57],[43,50,55,62]],[76,0,0,74,72,0,0,0,72,0,0,69,67,0,0,0,69,0,0,72,77,0,0,0,74,0,0,71,72,0,0,0]),
 crisis:track(56,[[41,48,53,56],[40,47,52,55],[42,49,54,57],[40,47,52,56]],[56,0,0,0,60,0,0,0,55,0,0,0,59,0,0,0,57,0,0,0,61,0,0,0,56,0,0,0,59,0,0,0]),
 mystery:track(58,[[45,52,58,64],[44,51,57,63],[41,48,54,60],[40,47,53,59]],[76,0,0,0,70,0,0,0,75,0,0,0,69,0,0,0,72,0,0,0,66,0,0,0,71,0,0,0,65,0,0,0]),
 legend:track(92,[[45,52,57,64],[41,48,53,60],[48,55,60,67],[43,50,55,62]],[76,79,84,0,81,0,76,0,77,81,84,0,89,0,84,0,79,84,88,0,91,0,88,0,86,83,79,0,84,0,79,0],'triangle'),
 immortal:track(46,[[33,45,52,58],[32,44,51,57],[35,47,54,60],[34,46,53,59]],[81,0,0,0,70,0,0,0,80,0,0,0,69,0,0,0,83,0,0,0,72,0,0,0,82,0,0,0,71,0,0,0]),
 rebirth:track(52,[[45,52,60,64],[41,48,57,60],[44,51,57,63],[40,47,56,59]],[84,79,76,0,0,0,0,0,81,77,72,0,0,0,0,0,80,75,69,0,0,0,0,0,83,76,68,0,0,0,0,0]),
 transcendent:track(42,[[29,41,48,54],[32,44,51,57],[28,40,47,53],[33,45,52,58]],[89,0,0,78,0,0,66,0,92,0,0,81,0,0,69,0,88,0,0,77,0,0,65,0,93,0,0,82,0,0,70,0])
};
const rareScene=(category,hidden)=>hidden?'mystery':category==='IMMORTAL輪廻転生'?'transcendent':category==='IMMORTAL'?'immortal':category==='輪廻転生'||category==='転生'?'rebirth':category==='LEGEND'||category==='STAR'||category==='PARALLEL'?'legend':'mystery';
function sceneFor({page,launchTitle,annual,inbox,foreign,replay,skip,portal,startup,available=true}={}){
 if(startup||portal||!available||skip)return null;
 if(page==='title')return launchTitle?'title':'worlds';
 if(page==='setup')return 'worlds';
 if(page==='canonical-hq'&&replay==='watch')return 'match';
 if(page==='canonical-events'){
  if(inbox?.finance)return 'crisis';
  if(inbox?.rare)return rareScene(inbox.rare.category,inbox.rare.hidden!==false);
  if(inbox?.career)return 'farewell';
  if(inbox?.rookie){const shown=inbox.rookie.entries?.find(x=>x.stage===2&&x.specialCategory);return shown?rareScene(shown.specialCategory,false):'draft';}
  if(inbox?.injury)return 'crisis';
  if(foreign)return 'foreign';
  if(annual==='draft')return 'draft';
  if(['movement-declarations','movement-market','renewal1','renewal2','roster-cut'].includes(annual))return 'negotiation';
  if(['autumn','winter','self','booking','winter-return','camp','exhibition','opening-promo','offdesk-opening'].includes(annual))return 'training';
  if(annual==='awards-all')return 'awards';
  if(['settlement','sponsor','broadcast','naming','fanclub'].includes(annual))return 'finance';
 }
 if(page==='canonical-manager')return 'manager';
 if(page==='canonical-facilities')return 'finance';
 if(page==='canonical-trade'||page==='canonical-free')return 'negotiation';
 if(['canonical-roster','canonical-rotation','canonical-farm','canonical-players','canonical-player','canonical-standings'].includes(page))return 'roster';
 return 'hq';
}
function createAudio({host}){
 const key='pl-scene-audio-v1',clamp=v=>Math.min(1,Math.max(0,v)),defaults={enabled:true,bgm:.45,sfx:.35};
 let prefs={...defaults};try{const p=JSON.parse(host.localStorage?.getItem(key)||'null');if(p&&typeof p.enabled==='boolean'&&Number.isFinite(p.bgm)&&Number.isFinite(p.sfx))prefs={enabled:p.enabled,bgm:clamp(p.bgm),sfx:clamp(p.sfx)};}catch{}
 let ctx=null,bgm=null,sfx=null,scene=null,timer=null,step=0,busy=false,visible=!host.document?.hidden,unlocked=false,voices=new Set();
 const stop=()=>{if(timer!==null){host.clearInterval(timer);timer=null;}for(const n of voices){try{n.stop();}catch{}}voices.clear();};
 function volume(){if(!ctx)return;for(const [node,value] of [[bgm,prefs.bgm],[sfx,prefs.sfx]]){const now=ctx.currentTime;node.gain.cancelScheduledValues(now);node.gain.setTargetAtTime(prefs.enabled&&visible?value:0,now,.06);}}
 function note(m,when,len,amp,wave,bus){if(!m||!ctx||ctx.state!=='running'||voices.size>=32)return;const o=ctx.createOscillator(),g=ctx.createGain();o.type=wave;o.frequency.value=440*Math.pow(2,(m-69)/12);g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(Math.max(.0002,amp),when+.025);g.gain.exponentialRampToValueAtTime(.0001,when+len);o.connect(g);g.connect(bus);voices.add(o);o.onended=()=>{voices.delete(o);o.disconnect();g.disconnect();};o.start(when);o.stop(when+len+.02);}
 function tick(){if(!prefs.enabled||!visible||!scene||!ctx||ctx.state!=='running')return;const t=tracks[scene],d=30/t.bpm,now=ctx.currentTime+.025,i=step%32,ch=t.chords[Math.floor(i/8)];if(i%8===0){note(ch[0]-12,now,d*6,.055,'sine',bgm);for(const m of ch.slice(1))note(m,now,d*6,.026,'sine',bgm);}if(i%2===0)note(ch[(i/2)%ch.length|0],now,d*1.4,.035,'triangle',bgm);note(t.melody[i],now,d*1.8,.06,t.wave,bgm);step++;}
 function start(){if(timer!==null||!scene||!prefs.enabled||!visible||!unlocked||ctx?.state!=='running')return;tick();timer=host.setInterval(tick,30000/tracks[scene].bpm);}
 async function unlock(){if(!prefs.enabled||!visible||busy)return false;busy=true;try{if(!ctx){const C=host.AudioContext||host.webkitAudioContext;if(!C)return false;ctx=new C();bgm=ctx.createGain();sfx=ctx.createGain();bgm.connect(ctx.destination);sfx.connect(ctx.destination);volume();}if(ctx.state!=='running')await ctx.resume();unlocked=ctx.state==='running';start();return unlocked;}catch{return false;}finally{busy=false;}}
 function setScene(next){if(next!==null&&!Object.hasOwn(tracks,next))next=null;if(next===scene)return;stop();scene=next;step=0;start();}
 const cues={tap:[72],open:[67,72],alert:[52,49],rare:[76,83,88],immortal:[45,46,69],rebirth:[84,76,72],transcendent:[36,42,81,90],awards:[72,76,79,84]};
 function cue(kind){if(!prefs.enabled||!visible||!unlocked||!scene||!ctx||ctx.state!=='running'||!Object.hasOwn(cues,kind))return;const now=ctx.currentTime+.01;cues[kind].forEach((m,i)=>note(m,now+i*.13,kind==='tap'?.075:.38,kind==='tap'?.05:.09,'sine',sfx));}
 function settings(next){prefs={enabled:typeof next.enabled==='boolean'?next.enabled:prefs.enabled,bgm:Number.isFinite(next.bgm)?clamp(next.bgm):prefs.bgm,sfx:Number.isFinite(next.sfx)?clamp(next.sfx):prefs.sfx};try{host.localStorage?.setItem(key,JSON.stringify(prefs));}catch{}volume();if(!prefs.enabled)stop();else start();return {...prefs};}
 function visibility(v){visible=!!v;volume();if(!visible){stop();if(ctx?.state==='running')void ctx.suspend().catch(()=>{});}else if(unlocked&&prefs.enabled)void unlock();}
 return {unlock,setScene,cue,settings,visibility,inspect:()=>({scene,prefs:{...prefs},unlocked,active:timer!==null,voices:voices.size})};
}
return {createAudio,sceneFor,tracks};
});
