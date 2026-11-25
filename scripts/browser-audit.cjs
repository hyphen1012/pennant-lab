// Desktop headless browser with mobile viewports: NOT a physical-device audit.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const base=process.env.PL_AUDIT_URL||'http://127.0.0.1:8765/';
const categories=['PARALLEL','STAR','LEGEND','IMMORTAL','再来','転生','輪廻転生','異界転生','星煌転生','伝説転生'];
const cases=['report-intro','report-self','report-draft','report-renewal','report-retirement','fa','reply','camp','facilities','sponsor','commerce','opening-promo'];
// Instrument only the test response. The shipping HTML and its save format stay untouched.
const source=fs.readFileSync('index.html','utf8');
const screenNames=[...new Set([...source.matchAll(/function\s+(\w+(?:Screen|View))\s*\(/g)].map(m=>m[1]))].sort();
const marker="  const appRoot=document.querySelector('#app');";
if(source.split(marker).length!==2||screenNames.length<60)throw Error('screen instrumentation anchors missing');
const instrumentation='const __plScreens=new Set();window.__plSlotAudit={state:()=>({slot:activeSlot,page:ui.page,started:game.started,id:game.selectedId,year:game.year,day:game.day,cash:myTeam().cash}),flush:async()=>{await saveQueue;if(storageFailure)throw Error("save failed");},race:async()=>{const p=openSlot(1,false),q=openSlot(2,false);await Promise.all([p,q]);return activeSlot;},playDay:async()=>{if(scenarioLab||ui.page!=="game")throw Error("normal game required");game.pendingCeremonyIntro=null;game.ceremonyStage=null;game.calendarFlow=null;while(game.day===0){const e=processCalendarDay();if(!e)throw Error("calendar stalled");}save();await saveQueue;if(storageFailure)throw Error("save failed");return {day:game.day,id:game.selectedId,cash:myTeam().cash};},clearPreview:slot=>localStorage.removeItem(SLOT_PREFIX+slot)};window.__plAudit={take:()=>{const a=[...__plScreens];__plScreens.clear();return a;},saveCodecAudit:async()=>{const slot=99,db=await openDatabase(),put=async data=>new Promise((ok,bad)=>{const tx=db.transaction(DB_STORE,"readwrite");tx.objectStore(DB_STORE).put({slot,data});tx.oncomplete=ok;tx.onerror=()=>bad(tx.error);}),remove=async()=>new Promise((ok,bad)=>{const tx=db.transaction(DB_STORE,"readwrite");tx.objectStore(DB_STORE).delete(slot);tx.oncomplete=ok;tx.onerror=()=>bad(tx.error);});try{const old={legacy:true,history:["輪廻転生",1]};await put(old);if(JSON.stringify(await readDatabaseSlot(slot))!==JSON.stringify(old))throw Error("legacy read");const snapshot=JSON.stringify({history:Array.from({length:12000},(_,i)=>({year:2027+i,name:"永久保存・輪廻転生",record:i%143}))});const packed=await encodeSaveSnapshot(snapshot);if(packed.encoding!==SAVE_CODEC||packed.bytes.size>=new Blob([snapshot]).size)throw Error("compression missing");await writeDatabaseSlot(slot,snapshot);if(JSON.stringify(await readDatabaseSlot(slot))!==snapshot)throw Error("save roundtrip");await put({encoding:SAVE_CODEC,bytes:new Blob(["invalid gzip"])});let rejected=false;try{await readDatabaseSlot(slot);}catch(e){rejected=true;}if(!rejected)throw Error("corrupt save accepted");return {raw:new Blob([snapshot]).size,compressed:packed.bytes.size};}finally{await remove();}},seedSpring:()=>{if(!scenarioLab)throw Error("scenario only");buildFresh();ensureGameExtras();game.started=true;myTeam().cash=100;game.pendingCeremonyIntro=null;game.ceremonyStage=null;game.pendingRareIds=[];game.pendingMilestoneIds=[];game.day=0;game.calendarIndex=0;const f=game.calendarFlow={version:1,year:game.year,date:game.year+"-01-01",mode:"pre",jobs:flowJobs(FLOW_PRE,game.year),active:null};game.offseasonDesk=null;ui.tab="hq";ui.playerDetail=null;flowRefresh(f);render();},trainingState:()=>({year:game.year,date:flowGet()?.date,jobs:Object.fromEntries(Object.entries(flowGet()?.jobs||{}).map(([k,v])=>[k,v.status])),winter:Object.keys(winterPlan(myTeam())),camp:annualPlan(myTeam(),"camp").step||0,cash:myTeam().cash,exhibition:annualReport("exhibition")?.games?.length||0}),state:()=>({page:ui.page,tab:ui.tab,phase:game.ceremonyStage,active:flowGet()?.active,room:offdeskState()?.floorRoom,transit:ui.faTransit?.kind,open:offdeskState()?.open,intro:offdeskState()?.intro,safe:offdeskSafe(),busy:ui.busy,storageFailure:!!storageFailure}),seedMemorial:()=>{const t=myTeam(),p=own(t)[0],cats=["LEGEND","IMMORTAL","輪廻転生"];game.memorialHistory={};for(const cat of cats){const fake={...p,specialCategory:cat,originCategory:cat};game.memorialHistory["audit-"+cat]={id:"audit-"+cat,year:game.year,teamId:t.id,category:cat,title:cat+" 達成記念",body:"ブラウザ試験専用データ",memorialPlayer:memorialPlayerSnapshot(fake)};}game.memorialHistory["audit-facility"]={id:"audit-facility",year:game.year,teamId:t.id,kind:"facility",level:20,title:"全8施設 Lv.20 達成",body:"試験用記念画像",facilityKey:"all",facilityLevels:Object.fromEntries(CLUB_CONDITION_KEYS.map(k=>[k,20]))};render();}};\n'+screenNames.map(n=>n+'=(fn=>function(...args){__plScreens.add('+JSON.stringify(n)+');return fn.apply(this,args);})('+n+');').join('\n')+'\n';
const tabs=['team','roster','hq','business','records'];
const business=['finance','stadium','facilities','market','scout','foreign','manager','care','staff','club','vip'];
(async()=>{
 const browser=await chromium.launch({headless:true});const rows=[],errors=[];
 fs.mkdirSync('test-results/browser',{recursive:true});
 try{for(const width of [320,360,430]){
  const page=await browser.newPage({viewport:{width,height:850},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:width===320?'reduce':'no-preference'});
  await page.addInitScript(()=>{window.__plAuditClicks=[];window.addEventListener('click',e=>{const el=e.target.closest?.('[data-action]');window.__plAuditClicks.push({action:el?.dataset.action,id:el?.dataset.id,tag:e.target.tagName});if(window.__plAuditClicks.length>12)window.__plAuditClicks.shift();},true);});
  await page.route(base,async route=>{
   const res=await route.fetch(),html=await res.text();
   if(html.split(marker).length!==2)throw Error('served game audit anchor missing');
   await route.fulfill({response:res,body:html.replace(marker,instrumentation+marker)});
  });
  let current='startup';page.on('pageerror',e=>errors.push({width,screen:current,error:e.message}));
  const click=async selector=>{const b=page.locator(selector).first();await b.click({timeout:8000});await page.waitForTimeout(180);};
  const shot=async name=>{current=name;await page.waitForTimeout(100);const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,text:document.querySelector('#app')?.innerText?.length||0,screens:window.__plAudit?.take()||[],smallControls:[...document.querySelectorAll('#app button:not([disabled])')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<24||r.height<24)}).map(e=>({action:e.dataset.action||'',label:e.innerText.slice(0,50)}))}));rows.push({width,name,...metrics});await page.screenshot({path:path.join('test-results/browser',width+'-'+name+'.png')});if(!metrics.text||metrics.scroll>metrics.width+2)errors.push({width,screen:name,error:'blank or document horizontal overflow '+JSON.stringify(metrics)});};
  const action=(a,v)=>'[data-action="'+a+'"]'+(v===undefined?'':'[data-value="'+v+'"]');
  const dayTo=async(a,v)=>{const target=page.locator(action(a,v)).first();for(let i=0;i<40&&!(await target.isVisible());i++){await click(action('flow-day'));await page.waitForTimeout(1250);}await target.waitFor({state:'visible',timeout:5000});};
  const title=async()=>{await page.goto(base);await page.locator('[data-action="rare-preview-open"]').waitFor({timeout:20000});};
  try{
   await title();
   if(width===360){
    current='normal-slot-save';
    const slotState=()=>page.evaluate(()=>window.__plSlotAudit.state());
    const flush=()=>page.evaluate(()=>window.__plSlotAudit.flush());
    const open=async (slot,kind)=>{await click('[data-action="'+kind+'"][data-slot="'+slot+'"]');await page.waitForFunction(()=>window.__plSlotAudit.state().page!=='title');};
    const choose=async id=>{await click('[data-action="pick-setup-team"][data-id="'+id+'"]');await click(action('finish-setup'));await click(action('report-intro-skip'));await page.waitForFunction(()=>window.__plSlotAudit.state().started);await flush();};
    await open(1,'new-slot');await choose(2);
    const first=await page.evaluate(()=>window.__plSlotAudit.playDay());
    if(first.day!==1||first.id!==2)throw Error('normal slot first day');
    await title();await open(1,'continue-slot');
    const restored=await slotState();if(restored.day!==first.day||restored.id!==first.id||restored.cash!==first.cash)throw Error('normal slot restore');
    await title();await open(2,'new-slot');await flush();await choose(3);
    const second=await slotState();if(second.slot!==2||second.day!==0||second.id!==3)throw Error('second slot isolation');
    await title();const winner=await page.evaluate(()=>window.__plSlotAudit.race());if(winner!==1||(await slotState()).day!==1)throw Error('overlapping slot opens');
    await title();await page.evaluate(()=>window.__plSlotAudit.clearPreview(1));await title();
    await open(1,'new-slot');const protectedSave=await slotState();if(protectedSave.day!==1||protectedSave.id!==2||!protectedSave.started)throw Error('missing preview must not overwrite save');
    await shot('normal-slot-restored');await title();
   }
   if(width===360){current='save-codec';const codec=await page.evaluate(()=>window.__plAudit.saveCodecAudit());console.log('SAVE_CODEC',JSON.stringify(codec));}await shot('title');await click('[data-action="rare-preview-open"]');await shot('rare-gallery');
   for(let i=0;i<categories.length;i++){
    current='rare-'+i;await click('[data-action="rare-preview-category"][data-value="'+categories[i]+'"]');
    await click('[data-action="rare-preview-start"]');await shot('rare-'+i);
    // Reopen the preview through the title for an isolated replay.
    await title();await click('[data-action="rare-preview-open"]');
   }
   for(const k of cases){
    current='scenario-'+k;await title();await click('[data-action="scenario-start"][data-value="'+k+'"]');await shot('scenario-'+k);
    if(k==='report-intro'){
     await click(action('report-intro-next'));await shot('report-intro-office');await click(action('report-intro-next'));await shot('report-intro-final');await click(action('report-intro-next'));
    }
    if(['report-self','report-draft','report-renewal'].includes(k)){
     const id={'report-self':'self','report-draft':'draft','report-renewal':'renewal1'}[k];
     await click('[data-action="flow-open"][data-job="'+id+'"]');
     if(await page.locator(action('event-intro-continue')).first().isVisible())await click(action('event-intro-continue'));
     if(k==='report-self'){
      if(await page.locator('.report-support').count())throw Error('support appeared before training choice');
      await click(action('annual-run'));await shot('report-self-support');
      if(!(await page.locator('.report-support').isVisible()))throw Error('support missing after training choice');
      await click(action('report-self-back'));await click(action('annual-run'));await click(action('annual-run'));
     }else if(k==='report-draft'){
      await page.locator(action('draft-start')).first().waitFor({state:'visible',timeout:8000});await shot('report-draft-ready');await click(action('draft-start'));await shot('report-draft-started');
     }else{
      const text=await page.locator('main').innerText();if(!/STAR|LEGEND/.test(text))throw Error('special renewal players missing');
      await shot('report-renewal-ready');await click(action('renewal-submit-all'));await shot('report-renewal-bonus');await click(action('renewal-report-cancel'));
     }
    }
    if(k==='report-retirement'){
     await click(action('flow-inbox'));await click(action('career-event-accept'));await click(action('career-event-confirm'));
     const next=page.locator(action('career-event-dismiss'));if(!(await next.innerText()).includes('次の去就相談'))throw Error('next retirement consultation missing');
     await click(action('career-event-dismiss'));await page.locator(action('career-event-accept')).waitFor({state:'visible'});await shot('report-retirement-next');
    }
    if(k==='fa'||k==='reply'){
     if(k==='fa'){
      await click('[data-action="flow-open"][data-value="news"]');await shot('fa-eve-news');
      await click(action('offdesk-news-eve'));await dayTo('flow-open','news');await click('[data-action="flow-open"][data-value="news"]');await shot('fa-opening-news');
      await click(action('offdesk-news-open'));
     }
     await click('[data-action="flow-open"][data-value="fa"]');await shot(k+'-intro');
     await click(action('offdesk-enter'));
     if(await page.locator(action('fa-floor-transit-skip')).first().isVisible()){await shot(k+'-hall');await click(action('fa-floor-transit-skip'));}
     await page.locator(action('fa-floor-room')).first().waitFor({timeout:8000});await shot(k+'-floor');
     const ids=await page.locator(action('fa-floor-room')).evaluateAll(els=>els.map(e=>e.dataset.id));
     for(const [i,id] of ids.slice(0,10).entries()){
      current=k+'-room-entry-'+i;
      const tile=page.locator('[data-action="fa-floor-room"][data-id="'+id+'"]').first();
      await tile.scrollIntoViewIfNeeded();await tile.tap({timeout:8000});
      await page.locator('.fa-transit,.fa-room').first().waitFor({timeout:8000});
      const skip=page.locator(action('fa-floor-transit-skip')).first();
      if(await skip.isVisible()){await shot(k+'-door-'+i);if(await skip.isVisible())await skip.click({timeout:8000}).catch(async err=>{if(!(await page.locator('.fa-room').isVisible()))throw err;});}
      await page.locator('.fa-room').waitFor({timeout:8000});await shot(k+'-room-'+i);
      await click(action('fa-floor-list'));
     }
     await click(action('fa-floor-home'));
    }
    if(k==='camp'){
     const job=k=>'[data-action="flow-open"][data-job="'+k+'"]';
     const check=async (fn,msg)=>{const state=await page.evaluate(()=>window.__plAudit.trainingState());if(!fn(state))throw Error(msg+' '+JSON.stringify(state));};
     const enter=async id=>{await click(job(id));if(await page.locator(action('event-intro-continue')).first().isVisible())await click(action('event-intro-continue'));};
     const until=async id=>{for(let i=0;i<12&&!(await page.locator(job(id)).first().isVisible());i++){await click(action('flow-day'));await page.waitForTimeout(1250);}await page.locator(job(id)).first().waitFor({state:'visible',timeout:5000});};
     await check(s=>s.jobs.autumn==='waiting'&&s.jobs.winter==='ready','parallel jobs before winter');
     await enter('winter');await shot('winter-map');
     await click(action('ref-winter-place','taiwan'));await shot('winter-player-selection');
     const candidates=page.locator('.dest-player '+action('ref-winter','taiwan'));
     await candidates.first().waitFor({state:'visible',timeout:5000});await candidates.first().click();await page.waitForTimeout(180);
     await check(s=>s.winter.length===1,'winter assignment');
     await shot('winter-assigned');await click(action('annual-run'));await click(action('ceremony-next'));
     await check(s=>s.jobs.winter==='done'&&s.jobs.autumn==='waiting','winter complete while autumn waits');
     await click('[data-action="tab"][data-tab="business"]');await click('[data-action="business-sub"][data-sub="facilities"]');await shot('parallel-facilities');
     await click('[data-action="tab"][data-tab="hq"]');await until('autumn');await enter('autumn');await shot('autumn-report');await click(action('ceremony-next'));
     await check(s=>s.jobs.autumn==='done','autumn complete');await until('booking');await enter('booking');await shot('camp-booking');
     await click(action('ref-group','farm'));await shot('camp-farm-choice');await click(action('ref-camp-next'));await check(s=>s.jobs.booking==='done','booking complete');
     await page.evaluate(()=>window.__plAudit.seedSpring());await until('self');await enter('self');await shot('self-training');
     const intensity=page.locator('select[data-change="annual-intensity"]:not([disabled])').first();await intensity.selectOption('rest');await click(action('annual-run'));await shot('self-support');await click(action('annual-run'));await check(s=>s.jobs.self==='waiting','self scheduled');
     await until('self');await enter('self');await shot('self-report');await click(action('ceremony-next'));await until('camp');await enter('camp');await shot('spring-sites');
     await click(action('ref-camp-next'));await shot('spring-kickoff');await click(action('ref-camp-next'));await check(s=>s.jobs.camp==='waiting'&&s.camp===2,'camp waits for first visit');
     await until('camp');await enter('camp');await shot('spring-visit-first');await click(action('ref-visit','rest'));await click(action('ref-visit-finish'));await check(s=>s.jobs.camp==='waiting'&&s.camp===3,'camp waits for second visit');
     await until('camp');await enter('camp');await shot('spring-visit-second');await click(action('annual-run'));await until('camp');await enter('camp');await shot('spring-report');
     for(const tab of ['INJURY','NEW','UP','STAY','DOWN']){await click(action('ref-report',tab));await shot('spring-report-'+tab);}
     await click(action('ceremony-next'));await until('exhibition');await enter('exhibition');await shot('exhibition-policy');await click(action('annual-exhibition-choice','youth'));await click(action('annual-run'));await click(action('annual-run'));await until('exhibition');await enter('exhibition');await shot('exhibition-digest');for(let i=0;i<12&&await page.locator(action('report-digest-next')).first().isVisible();i++)await click(action('report-digest-next'));await shot('exhibition-report');await check(s=>s.exhibition===36,'exhibition game count');await click(action('ceremony-next'));
    }
    if(k==='commerce'){
     await dayTo('commerce-open','fan-fest');await click(action('commerce-open','fan-fest'));await shot('fest-brief');
     await click(action('commerce-start'));await shot('fest-selection');await click(action('commerce-plan',2));await click(action('commerce-confirm'));await shot('fest-booking');
     await click(action('commerce-schedule-finish'));await dayTo('commerce-open','fan-fest');await click(action('commerce-open','fan-fest'));await shot('fest-live');
     await click(action('commerce-live-finish'));await shot('fest-result');await click(action('commerce-finish'));
     await dayTo('commerce-open','fanclub');await click(action('commerce-open','fanclub'));await click(action('commerce-start'));await shot('fanclub-selection');
     await page.locator('#commerce-fan-name').fill('PENNANT AUDIT');await click(action('commerce-fee',500));await click(action('commerce-perk','uniform'));await shot('fanclub-preview');
     await click(action('commerce-confirm'));await shot('fanclub-result');await click(action('commerce-finish'));
     await click(action('commerce-open','tv'));await click(action('commerce-start'));await shot('tv-selection');
     const guests=await page.locator(action('commerce-player')).evaluateAll(els=>els.slice(0,5).map(e=>e.dataset.value));
     if(guests.length!==5)throw Error('five TV guests required');for(const id of guests)await click(action('commerce-player',id));
     await click(action('commerce-confirm'));await shot('tv-booking');await click(action('commerce-schedule-finish'));
     await dayTo('commerce-open','tv');await click(action('commerce-open','tv'));await shot('tv-live');await click(action('commerce-tv-finish'));await shot('tv-result');await click(action('commerce-finish'));
     await dayTo('sponsor-open');await click(action('sponsor-open'));await click(action('sponsor-start'));await shot('sponsor-selection');await click(action('sponsor-confirm'));await shot('sponsor-result');await click(action('sponsor-finish'));
     await click(action('commerce-open','broadcast'));await click(action('commerce-start'));await click(action('commerce-delta',3));await shot('broadcast-negotiation');await click(action('commerce-confirm'));await shot('broadcast-result');await click(action('commerce-finish'));
     await click(action('commerce-open','naming'));await click(action('commerce-start'));await shot('naming-selection');await click(action('commerce-confirm'));await shot('naming-result');await click(action('commerce-finish'));
    }
    if(k==='opening-promo'){
     await dayTo('commerce-open','opening-promo');await click(action('commerce-open','opening-promo'));await click(action('commerce-start'));
     for(let i=0;i<3;i++){await click(action('commerce-plan',i));await shot('opening-promo-plan-'+i);}
     await click(action('commerce-confirm'));await click(action('commerce-schedule-finish'));await dayTo('commerce-open','opening-promo');await click(action('commerce-open','opening-promo'));await click(action('commerce-opening-live-finish'));await shot('opening-promo-result');await click(action('commerce-finish'));
    }
    if(k==='facilities'){
     for(const t of tabs){current='tab-'+t;await click('[data-action="tab"][data-tab="'+t+'"]');await shot('tab-'+t);}
     await click('[data-action="record-sub"][data-sub="memorial"]');await shot('memorial-empty');
     await page.evaluate(()=>window.__plAudit.seedMemorial());
     await shot('memorial-populated');await click('[data-memorial-filter="unmeasurable"]');await shot('memorial-unmeasurable');if(await page.locator('[data-memorial-id]').count()!==2)throw Error('memorial filter count');await click('[data-memorial-filter="all"]');
     for(const [idx,key] of ['LEGEND','IMMORTAL','輪廻転生','facility'].entries()){
      current='memorial-png-'+idx;
      await click('[data-memorial-id="audit-'+key+'"]');
      const saveButton=page.locator('[data-memorial-save]');
      await saveButton.waitFor({state:'visible',timeout:8000});
      await page.waitForFunction(()=>!document.querySelector('[data-memorial-save]')?.disabled,{},{timeout:15000});
      const dimensions=await page.locator('.memorial-dialog canvas').evaluate(c=>[c.width,c.height,c.toDataURL('image/png').length]);
      if(dimensions[0]!==1080||dimensions[1]!==1350||dimensions[2]<10000)throw Error('invalid memorial PNG '+dimensions);
      await shot('memorial-image-'+idx);
      const downloaded=page.waitForEvent('download',{timeout:10000});await saveButton.click();
      const file=await downloaded,bytes=fs.readFileSync(await file.path());
      if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==1080||bytes.readUInt32BE(20)!==1350)throw Error('invalid downloaded PNG');
      await file.saveAs(path.join('test-results/browser',width+'-memorial-'+idx+'.png'));
      await click('[data-memorial-close]');
     }
     await click('[data-action="tab"][data-tab="business"]');
     for(const t of business){current='business-'+t;await click('[data-action="business-sub"][data-sub="'+t+'"]');await shot('business-'+t);}
    }
   }
  }catch(e){const detail=await page.evaluate(()=>({state:window.__plAudit?.state(),clicks:window.__plAuditClicks,heading:document.querySelector('main h2')?.innerText,actions:[...document.querySelectorAll('main [data-action]')].slice(0,12).map(e=>({action:e.dataset.action,id:e.dataset.id}))})).catch(()=>null);errors.push({width,screen:current,error:e.message,detail});await page.screenshot({path:path.join('test-results/browser',width+'-failure.png')}).catch(()=>{});}
  await page.close();
 }}finally{await browser.close();const coverage=screenNames.map(name=>({name,capturedAt:rows.filter(r=>r.screens?.includes(name)).map(r=>({width:r.width,shot:r.name})),quality:'not visually adjudicated'}));
 fs.writeFileSync('test-results/browser/coverage.json',JSON.stringify({scope:'Functions called since prior screenshot; not proof that every branch or artistic quality was inspected',total:coverage.length,observed:coverage.filter(x=>x.capturedAt.length).length,coverage},null,2));
 fs.writeFileSync('test-results/browser/report.json',JSON.stringify({scope:'Headless Chromium, not physical devices; screenshots do not prove artistic quality',rows,errors},null,2));}
 console.log(JSON.stringify({screens:rows.length,errors},null,2));if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
