// Original media end-to-end browser check. No fake video or test-only game state.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.PL_AUDIT_URL||'http://127.0.0.1:8765/';
const dir='test-results/browser';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chromium',args:['--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__startupAudit={events:[],plays:[]};for(const k of ['playing','ended','error'])document.addEventListener(k,e=>{if(e.target instanceof HTMLVideoElement&&e.target.classList.contains('official-startup-video')){const v=e.target;window.__startupAudit.events.push({k,t:v.currentTime,d:v.duration,w:v.videoWidth,h:v.videoHeight,muted:v.muted,controls:v.controls,rate:v.playbackRate,src:v.currentSrc,error:v.error?.code||null});}},true);});
  await page.goto(base);
  await page.waitForFunction(()=>window.__startupAudit.events.some(x=>x.k==='playing'||x.k==='error'),{},{timeout:20000});
  const video=page.locator('video.official-startup-video');
  await video.waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('video.official-startup-video')?.currentTime>0.4);
  assert.equal(await page.locator('.save-slot').count(),0);
  assert.equal(await page.locator('video[controls]').count(),0);
  await page.screenshot({path:dir+'/official-startup-playing.png'});
  // A tap during playback must not change the destination or end the clip.
  await page.touchscreen.tap(190,420);
  assert(await video.isVisible());
  await page.waitForFunction(()=>window.__startupAudit.events.some(x=>x.k==='ended'),{},{timeout:20000});
  await page.waitForFunction(()=>!document.body.classList.contains('official-startup-active'));
  const result=await page.evaluate(()=>window.__startupAudit.events);
  const end=result.find(x=>x.k==='ended');
  assert(end&&Math.abs(end.t-7)<.1&&Math.abs(end.d-7)<.1&&end.w===1080&&end.h===1920&&end.rate===1&&end.controls===false&&!end.muted,'native media ended at full length, original dimensions, sound not muted in permissive browser: '+JSON.stringify(result));
  assert(!result.some(x=>x.k==='error'));
  await page.waitForFunction(()=>{const im=document.querySelector('[data-official-title-image]');return im?.complete&&im.naturalWidth===864&&im.naturalHeight===1536;});
  assert.equal(await page.locator('.official-launch-prompt').count(),0,'embedded prompt not repeated');
  for(const [width,height] of [[320,600],[390,844],[430,932],[844,390]]){
   await page.setViewportSize({width,height});
   const rect=await page.locator('.official-launch-frame').boundingBox();
   assert(rect&&rect.x>=-1&&rect.y>=-1&&rect.x+rect.width<=width+1&&rect.y+rect.height<=height+1&&Math.abs(rect.width/rect.height-9/16)<.01,'title fits '+JSON.stringify({width,height,rect}));
   await page.screenshot({path:dir+'/official-title-'+width+'x'+height+'.png'});
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-action="launch-start"]').tap();
  await page.locator('.world-orb').first().waitFor({state:'visible'});
  assert.equal(await page.locator('.world-orb').count(),3);
  await page.locator('[data-action="new-slot"][data-slot="1"]').tap();
  await page.locator('.portal-transit').waitFor({state:'visible'});
  assert.equal(await page.locator('.portal-transit').getAttribute('data-portal-slot'),'1');
  await page.screenshot({path:dir+'/official-portal.png'});
  await page.locator('[data-action="pick-setup-team"]').first().waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  console.log('PASS original full-length media, title aspect/embedded text, tap and portal to setup',JSON.stringify(result));
  await page.close();
  // Emulate the first browser autoplay-policy rejection only. Subsequent
  // playback is the original MP4 through the real browser decoder.
  const gated=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await gated.addInitScript(()=>{
   const play=HTMLMediaElement.prototype.play;let denied=false;window.__audioAudit={attempts:[],ended:null,contexts:0};
   HTMLMediaElement.prototype.play=function(...args){
    if(this.classList.contains('official-startup-video')){
     window.__audioAudit.attempts.push({muted:this.muted,activated:navigator.userActivation?.isActive===true});
     if(!denied){denied=true;return Promise.reject(new DOMException('autoplay blocked','NotAllowedError'));}
    }
    return play.apply(this,args);
   };
   document.addEventListener('ended',e=>{if(e.target.classList?.contains('official-startup-video'))window.__audioAudit.ended={time:e.target.currentTime,muted:e.target.muted};},true);
   for(const key of ['AudioContext','webkitAudioContext'])if(window[key]){const Original=window[key];window[key]=new Proxy(Original,{construct(target,args,newTarget){window.__audioAudit.contexts++;return Reflect.construct(target,args,newTarget);}});}
  });
  await gated.goto(base);
  await gated.waitForFunction(()=>window.__audioAudit.ended,{},{timeout:20000});
  await gated.waitForFunction(()=>!document.body.classList.contains('official-startup-active'));
  const audit=await gated.evaluate(()=>window.__audioAudit);
  assert.deepEqual(audit.attempts.map(a=>a.muted),[false,true]);assert.equal(audit.ended.muted,true);assert(Math.abs(audit.ended.time-7)<.1);
  assert.equal(await gated.locator('.official-startup-consent,video,audio').count(),0,'no prompt or remaining media');
  await gated.locator('[data-action="launch-start"]').tap();
  await gated.locator('.world-orb').first().waitFor({state:'visible'});
  assert.equal(await gated.evaluate(()=>window.__audioAudit.contexts),0,'no title-tap AudioContext');
  assert.equal(await gated.locator('video,audio').count(),0,'no new media on title tap');
  await gated.close();
  console.log('PASS autoplay rejection, automatic muted original media and silent title transition');
  const fallback=await browser.newPage({viewport:{width:360,height:740},reducedMotion:'reduce'});
  await fallback.route('**/PARALAB_GAMES_startup_v8_SFX_reverb.mp4',route=>route.abort());
  await fallback.goto(base);
  await fallback.waitForFunction(()=>document.querySelector('[data-official-title-image]')?.complete&&!document.body.classList.contains('official-startup-active'));
  await fallback.locator('[data-action="launch-start"]').click();
  await fallback.locator('.world-orb').first().waitFor({state:'visible'});
  assert.equal(await fallback.locator('.world-orb').count(),3);
  console.log('PASS real network error fallback and reduced-motion title transition');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
