// Exercises startup lifecycle with synthetic media events; not real decoder/audio QA.
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('  const STARTUP_MEDIA='),end=html.indexOf('  const WORLD_TONES=',start);
assert(start>=0&&end>start,'launch source anchors');
const source=html.slice(start,end);
function harness({video='assets/startup/test.mp4',title='assets/startup/test.png',hasStartText=true,reject=0,muted=false,reduced=false,online=true}={}){
  const timers=new Map();let seq=0,renders=0,attached=0,attempts=[],paused=0,removed=0,classes=new Set(),audioContexts=0;const nodes=[];
  const listeners=new Map(),winListeners=new Map(),mediaListeners=new Map();
  const media={currentTime:0,muted:false,controls:true,setAttribute(){},removeAttribute(){},load(){},pause(){paused++},remove(){removed++},addEventListener(k,v){mediaListeners.set(k,v)},async play(){attempts.push(this.muted);if(attempts.length<=reject)throw Object.assign(Error('autoplay rejected'),{name:'NotAllowedError'})}};
  const doc={hidden:false,body:{appendChild(){attached++}},createElement(tag){if(tag==='video')return media;const handlers=new Map();const node={tag,className:'',disabled:false,textContent:'',children:[],setAttribute(){},appendChild(el){this.children.push(el)},remove(){this.removed=true},addEventListener(k,fn){handlers.set(k,fn)},click(){if(!this.disabled)return handlers.get('click')?.()}};nodes.push(node);return node},addEventListener(k,v){listeners.set(k,v)},removeEventListener(k){listeners.delete(k)},querySelector(){return {classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}}}};
  const win={AudioContext:function(){audioContexts++;throw Error('unexpected title audio')},scrollTo(){},matchMedia:()=>({matches:reduced}),PennantNative:{check:async()=>online,ready:()=>online},addEventListener(k,v){winListeners.set(k,v)},removeEventListener(k){winListeners.delete(k)}};
  const ui={page:'title',launchTitle:true,rarePreview:null};
  const config='const STARTUP_MEDIA=Object.freeze('+JSON.stringify({video,title,hasStartText})+');';
  const code=source.replace(/^  const STARTUP_MEDIA=.*;$/m,config);
  const make=new Function('document','window','localStorage','ui','render','setTimeout','clearTimeout','h','slotOpening','slotDeleteDialog',code+'\nreturn {showStartupVideo,launchTitleScreen,startOfficialTitleTransition,playing:()=>startupPlaying};');
  const api=make(doc,win,{getItem:()=>muted?'1':null},ui,()=>renders++,(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id},id=>timers.delete(id),String,false,null);
  return {api,doc,ui,media,attempts,timers,classes,nodes,button:k=>nodes.find(n=>n.className==='official-startup-'+k),stats:()=>({renders,attached,paused,removed,audioContexts}),emit:k=>mediaListeners.get(k)?.(),suspend:()=>winListeners.get('pl-native-suspend')?.(),expire:()=>{const t=[...timers.values()][0];if(t)t.fn();}};
}
(async()=>{
  const a=harness();await a.api.showStartupVideo();assert.deepEqual(a.attempts,[false]);assert.equal(a.media.controls,false);assert.equal(a.media.playsInline,true);
  assert(a.api.playing());a.api.startOfficialTitleTransition();assert(a.ui.launchTitle,'startup prevents title tap');a.media.currentTime=6.9;a.emit('timeupdate');assert(a.api.playing(),'not cut off at 7 seconds by fixed timer');a.emit('ended');assert(!a.api.playing());assert.equal(a.stats().removed,1);a.emit('ended');assert.equal(a.stats().removed,1);await a.api.showStartupVideo();assert.equal(a.attempts.length,1,'only once per launch');
  const b=harness({reject:1});await b.api.showStartupVideo();assert.deepEqual(b.attempts,[false],'no automatic silent fallback');assert.equal(b.timers.size,0,'no timeout while awaiting a tap');assert(b.api.playing());b.button('audio').click();await Promise.resolve();assert.deepEqual(b.attempts,[false,false]);b.emit('ended');assert(!b.api.playing());assert(b.nodes.find(n=>n.className==='official-startup-consent').removed);
  const c=harness({reject:2});await c.api.showStartupVideo();c.button('audio').click();await Promise.resolve();assert(c.api.playing());assert.equal(c.button('audio').disabled,false);c.button('silent').click();await Promise.resolve();assert.deepEqual(c.attempts,[false,false,true]);c.emit('ended');assert(!c.api.playing());assert.equal(c.stats().removed,1);const s=harness({reject:1});await s.api.showStartupVideo();s.suspend();assert(!s.api.playing());assert(s.nodes.find(n=>n.className==='official-startup-consent').removed);
  const d=harness({muted:true});await d.api.showStartupVideo();assert.deepEqual(d.attempts,[true]);d.expire();assert(!d.api.playing(),'stall fallback');
  const e=harness();await e.api.showStartupVideo();e.suspend();assert(!e.api.playing(),'native suspension cleanup');
  const f=harness({video:'',title:''});await f.api.showStartupVideo();assert.equal(f.stats().attached,0);f.api.startOfficialTitleTransition();assert(!f.ui.launchTitle,'unconfigured title still works');
  const g=harness();assert(!g.api.launchTitleScreen().includes('official-launch-prompt'),'embedded prompt is not duplicated');g.api.startOfficialTitleTransition();g.api.startOfficialTitleTransition();assert.equal(g.timers.size,1,'single transition');g.expire();assert(!g.ui.launchTitle);assert.equal(g.stats().renders,1);assert.equal(g.stats().audioContexts,0,'no synthetic title tap audio');
  const i=harness({hasStartText:false,reduced:true});assert(i.api.launchTitleScreen().includes('official-launch-prompt'));i.api.startOfficialTitleTransition();assert(!i.ui.launchTitle);assert.equal(i.timers.size,0);
  const j=harness({online:false});await j.api.showStartupVideo();assert.equal(j.stats().attached,0);assert(!j.api.playing());j.api.startOfficialTitleTransition();assert(j.ui.launchTitle,'offline gate retained');
  const k=harness();await k.api.showStartupVideo();k.emit('error');assert(!k.api.playing(),'media failure fallback');
  console.log('PASS startup lifecycle, autoplay, fallbacks, title transition');
})().catch(e=>{console.error(e);process.exitCode=1});
