// Desktop headless browser with mobile viewports: NOT a physical-device audit.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const base=process.env.PL_AUDIT_URL||'http://127.0.0.1:8765/';
const categories=['PARALLEL','STAR','LEGEND','IMMORTAL','再来','転生','輪廻転生','異界転生','星煌転生','伝説転生'];
const cases=['report-intro','report-self','report-draft','report-renewal','report-retirement','report-season','fa','reply','camp','facilities','sponsor','commerce','opening-promo'];
// Instrument only the test response. The shipping HTML and its save format stay untouched.
const source=fs.readFileSync('index.html','utf8');
const screenNames=[...new Set([...source.matchAll(/function\s+(\w+(?:Screen|View))\s*\(/g)].map(m=>m[1]))].sort();
const marker="  const appRoot=document.querySelector('#app');";
if(source.split(marker).length!==2||screenNames.length<60)throw Error('screen instrumentation anchors missing');
const instrumentation='window.__plPerformance={audit:async()=>{const slot=98,db=await openDatabase(),remove=()=>new Promise((ok,bad)=>{const tx=db.transaction(DB_STORE,\"readwrite\");tx.objectStore(DB_STORE).delete(slot);tx.oncomplete=ok;tx.onerror=()=>bad(tx.error);});const source=JSON.stringify({players:Array.from({length:50000},(_,i)=>({id:i,name:\"歴代選手\"+i,history:[{year:2027+i%50,stats:{h:i%1000,hr:i%100}}]}))});const codec=globalThis.CompressionStream,original=Storage.prototype.setItem;try{let start=performance.now();const packed=await encodeSaveSnapshot(source),compressMs=performance.now()-start;await writeDatabaseSlot(slot,source);start=performance.now();const restored=await readDatabaseSlot(slot),readMs=performance.now()-start;if(JSON.stringify(restored)!==source)throw Error(\"50k history roundtrip\");globalThis.CompressionStream=class{constructor(){throw Error(\"test compression failure\");}};const fallback=await encodeSaveSnapshot(source);if(JSON.stringify(fallback)!==source)throw Error(\"compression fallback\");globalThis.CompressionStream=codec;Storage.prototype.setItem=function(){throw Error(\"test preview quota\");};if(writeSlotPreview(slot,\"{}\")!==false)throw Error(\"preview failure not isolated\");writeActiveSlotHint(slot);if(JSON.stringify(await readDatabaseSlot(slot))!==source)throw Error(\"preview damaged database\");const saved=game.players,rows=restored.players;game.players=rows;try{getPlayer(0);let sum=0;start=performance.now();for(let i=0;i<2000;i++)sum+=getPlayer((i*7919)%50000).id;const indexMs=performance.now()-start;let baseline=0;start=performance.now();for(let i=0;i<2000;i++)baseline+=rows.find(p=>p.id===(i*7919)%50000).id;const linearMs=performance.now()-start;if(sum!==baseline)throw Error(\"lookup mismatch\");return {raw:new Blob([source]).size,packed:packed.bytes?.size??null,compressMs,readMs,indexMs,linearMs};}finally{game.players=saved;getPlayer(saved[0].id);}}finally{globalThis.CompressionStream=codec;Storage.prototype.setItem=original;await remove();}},pauseSkip:async()=>{if(scenarioLab||ui.page!==\"game\")throw Error(\"normal slot required\");game.pendingCeremonyIntro=null;game.ceremonyStage=null;game.calendarFlow=null;game.pendingRareIds=[];game.pendingMilestoneIds=[];game.pendingReview=null;game.pendingEvent=null;game.pendingMonth=null;game.playbackMode=\"skip\";ui.tab=\"hq\";const start=game.calendarIndex;let observed=false;const timer=setInterval(()=>{const btn=document.querySelector(\".long-skip-progress [data-action=pause-calendar]\");if(btn&&game.calendarIndex>start){observed=true;btn.click();}},0);try{await flowAdvanceBase(\"season\");await saveQueue;const end=game.calendarIndex;if(storageFailure||end<=start||end>=game.calendar.days.length)throw Error(\"skip pause checkpoint\");if(!observed&&end-start>=4)throw Error(\"skip did not yield\");const persisted=await readDatabaseSlot(activeSlot);if(persisted.calendarIndex!==end||persisted.day!==game.day)throw Error(\"skip checkpoint save mismatch\");return {start,end,observed,day:game.day};}finally{clearInterval(timer);game.playbackMode=\"normal\";game.advanceTarget=null;save();await saveQueue;}}};\nconst __plScreens=new Set();window.__plSlotAudit={state:()=>({slot:activeSlot,page:ui.page,started:game.started,id:game.selectedId,year:game.year,day:game.day,cash:myTeam().cash}),flush:async()=>{await saveQueue;if(storageFailure)throw Error("save failed");},race:async()=>{const p=openSlot(1,false),q=openSlot(2,false);await Promise.all([p,q]);return activeSlot;},playDay:async()=>{if(scenarioLab||ui.page!=="game")throw Error("normal game required");game.pendingCeremonyIntro=null;game.ceremonyStage=null;game.calendarFlow=null;while(game.day===0){const e=processCalendarDay();if(!e)throw Error("calendar stalled");}save();await saveQueue;if(storageFailure)throw Error("save failed");return {day:game.day,id:game.selectedId,cash:myTeam().cash};},clearPreview:slot=>localStorage.removeItem(SLOT_PREFIX+slot),readSlot:async slot=>{const d=await readDatabaseSlot(slot);return d?{started:d.started,day:d.day,id:d.selectedId,cash:d.teams.find(t=>t.id===d.selectedId)?.cash}:null;}};window.__plAudit={take:()=>{const a=[...__plScreens];__plScreens.clear();return a;},saveCodecAudit:async()=>{const slot=99,db=await openDatabase(),put=async data=>new Promise((ok,bad)=>{const tx=db.transaction(DB_STORE,"readwrite");tx.objectStore(DB_STORE).put({slot,data});tx.oncomplete=ok;tx.onerror=()=>bad(tx.error);}),remove=async()=>new Promise((ok,bad)=>{const tx=db.transaction(DB_STORE,"readwrite");tx.objectStore(DB_STORE).delete(slot);tx.oncomplete=ok;tx.onerror=()=>bad(tx.error);});try{const old={legacy:true,history:["輪廻転生",1]};await put(old);if(JSON.stringify(await readDatabaseSlot(slot))!==JSON.stringify(old))throw Error("legacy read");const snapshot=JSON.stringify({history:Array.from({length:12000},(_,i)=>({year:2027+i,name:"永久保存・輪廻転生",record:i%143}))});const packed=await encodeSaveSnapshot(snapshot);if(packed.encoding!==SAVE_CODEC||packed.bytes.size>=new Blob([snapshot]).size)throw Error("compression missing");await writeDatabaseSlot(slot,snapshot);if(JSON.stringify(await readDatabaseSlot(slot))!==snapshot)throw Error("save roundtrip");await new Promise((ok,bad)=>{const tx=db.transaction(DB_STORE,"readwrite");tx.onabort=ok;tx.oncomplete=()=>bad(Error("abort unexpectedly committed"));tx.onerror=()=>bad(tx.error);tx.objectStore(DB_STORE).put({slot,data:{interrupted:true}});tx.abort();});if(JSON.stringify(await readDatabaseSlot(slot))!==snapshot)throw Error("aborted overwrite lost previous checkpoint");await put({encoding:SAVE_CODEC,bytes:new Blob(["invalid gzip"])});let rejected=false;try{await readDatabaseSlot(slot);}catch(e){rejected=true;}if(!rejected)throw Error("corrupt save accepted");return {raw:new Blob([snapshot]).size,compressed:packed.bytes.size};}finally{await remove();}},seedSpring:()=>{if(!scenarioLab)throw Error("scenario only");buildFresh();ensureGameExtras();game.started=true;myTeam().cash=100;game.pendingCeremonyIntro=null;game.ceremonyStage=null;game.pendingRareIds=[];game.pendingMilestoneIds=[];game.day=0;game.calendarIndex=0;const f=game.calendarFlow={version:1,year:game.year,date:game.year+"-01-01",mode:"pre",jobs:flowJobs(FLOW_PRE,game.year),active:null};game.offseasonDesk=null;ui.tab="hq";ui.playerDetail=null;flowRefresh(f);render();},trainingState:()=>({year:game.year,date:flowGet()?.date,jobs:Object.fromEntries(Object.entries(flowGet()?.jobs||{}).map(([k,v])=>[k,v.status])),winter:Object.keys(winterPlan(myTeam())),camp:annualPlan(myTeam(),"camp").step||0,cash:myTeam().cash,exhibition:annualReport("exhibition")?.games?.length||0,policy:annualPlan(myTeam(),"exhibition").exhibition}),state:()=>({page:ui.page,tab:ui.tab,phase:game.ceremonyStage,active:flowGet()?.active,room:offdeskState()?.floorRoom,transit:ui.faTransit?.kind,open:offdeskState()?.open,intro:offdeskState()?.intro,safe:offdeskSafe(),busy:ui.busy,storageFailure:!!storageFailure}),seedNormalExhibition:()=>{if(scenarioLab||ui.page!=="game")throw Error("normal game required");game.pendingCeremonyIntro=null;game.ceremonyStage=null;game.pendingReview=null;game.pendingMonth=null;game.pendingEvent=null;game.day=0;game.calendarIndex=0;const f=game.calendarFlow={version:1,year:game.year,date:flowStart("exhibition",game.year),mode:"pre",jobs:flowJobs(FLOW_PRE,game.year),active:null};for(const j of Object.values(f.jobs))j.status="done";f.jobs.exhibition.status="scheduled";game.offseasonDesk=null;ui.tab="hq";ui.playerDetail=null;flowRefresh(f);render();},seedMemorial:()=>{const t=myTeam(),p=own(t)[0],cats=["LEGEND","IMMORTAL","輪廻転生"];game.memorialHistory={};for(const cat of cats){const fake={...p,specialCategory:cat,originCategory:cat};game.memorialHistory["audit-"+cat]={id:"audit-"+cat,year:game.year,teamId:t.id,category:cat,title:cat+" 達成記念",body:"ブラウザ試験専用データ",memorialPlayer:memorialPlayerSnapshot(fake)};}game.memorialHistory["audit-facility"]={id:"audit-facility",year:game.year,teamId:t.id,kind:"facility",level:20,title:"全8施設 Lv.20 達成",body:"試験用記念画像",facilityKey:"all",facilityLevels:Object.fromEntries(CLUB_CONDITION_KEYS.map(k=>[k,20]))};render();}};\n'+screenNames.map(n=>n+'=(fn=>function(...args){__plScreens.add('+JSON.stringify(n)+');return fn.apply(this,args);})('+n+');').join('\n')+'\n';
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
  const detail=async key=>{const el=page.locator('[data-normal-detail="'+key+'"],[data-normal-stage="'+key+'"]').first();await el.waitFor({state:'visible',timeout:5000});const safe=await el.evaluate(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=-2&&r.right<=innerWidth+2;});if(!safe)throw Error('normal detail overflow '+key);};
  const action=(a,v)=>'[data-action="'+a+'"]'+(v===undefined?'':'[data-value="'+v+'"]');
  const selectPolicy=async k=>{const sel=action('annual-exhibition-choice',k);await click(sel);if(await page.locator(sel).getAttribute('aria-pressed')!=='true'||await page.locator('.preseason-policy-option[aria-pressed="true"]').count()!==1)throw Error('policy selection UI '+k);const state=await page.evaluate(()=>window.__plAudit.trainingState());if(state.policy!==k)throw Error('policy not persisted in plan '+k);};
  const checkCampPicker=async()=>{await page.locator('.camp-compact-picker').waitFor({state:'visible'});const initial=await page.locator('[data-camp-selected]').getAttribute('data-camp-selected');for(const key of ['ishigaki','usa','club']){const b=page.locator(action('ref-site',key));if(await b.isEnabled()){await click(action('ref-site',key));if(await page.locator('[data-camp-selected]').getAttribute('data-camp-selected')!==key||await b.getAttribute('aria-pressed')!=='true')throw Error('camp selection mismatch '+key);}}const sizes=await page.locator('.camp-compact-picker').evaluate(e=>({height:e.getBoundingClientRect().height,viewport:innerHeight,detail:e.querySelector('.camp-compact-detail').getBoundingClientRect().height,map:e.querySelector('.dest-regional').getBoundingClientRect().height}));if(sizes.height>sizes.viewport-220||sizes.map>300||sizes.detail<60)throw Error('camp picker not compact '+JSON.stringify(sizes));await click(action('ref-site',initial));};
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
    await shot('normal-slot-restored');const skip=await page.evaluate(()=>window.__plPerformance.pauseSkip());console.log('SKIP_CHECKPOINT',JSON.stringify(skip));await page.evaluate(()=>window.__plAudit.seedNormalExhibition());await click('[data-action="flow-open"][data-job="exhibition"]');if(await page.locator(action('event-intro-continue')).first().isVisible())await click(action('event-intro-continue'));for(const k of ['first','youth','balanced'])await selectPolicy(k);await shot('normal-exhibition-policy');await title();
    current='slot-delete';const readSlot=slot=>page.evaluate(slot=>window.__plSlotAudit.readSlot(slot),slot);
    const keep=await readSlot(1),secondBefore=await readSlot(2);
    const askDelete=async slot=>{await click('[data-action="slot-delete"][data-slot="'+slot+'"]');await page.locator('.slot-delete-dialog').waitFor({state:'visible'});};
    await askDelete(2);if(!(await page.locator('.slot-delete-dialog').innerText()).includes('DATA 2'))throw Error('wrong delete target');await shot('slot-delete-confirm');await click('[data-slot-delete-cancel]');
    if(JSON.stringify(await readSlot(2))!==JSON.stringify(secondBefore))throw Error('cancel changed slot');
    await page.evaluate(()=>window.__plSlotAudit.clearPreview(2));await title();await askDelete(2);await click('[data-slot-delete-confirm]');
    await page.waitForFunction(async()=>await window.__plSlotAudit.readSlot(2)===null);await page.locator('[data-action="new-slot"][data-slot="2"]').waitFor({state:'visible'});
    if(JSON.stringify(await readSlot(1))!==JSON.stringify(keep))throw Error('delete affected other slot');
    await open(2,'new-slot');await choose(4);await title();
    await askDelete(2);await click('[data-slot-delete-confirm]');await page.locator('[data-action="new-slot"][data-slot="2"]').waitFor({state:'visible'});
    if(await readSlot(2)!==null||(await slotState()).started)throw Error('active slot deletion left stale data');
    await title();const afterDelete=await readSlot(2);if(afterDelete?.started)throw Error('deleted world revived on reload');
    if(JSON.stringify(await readSlot(1))!==JSON.stringify(keep))throw Error('active deletion affected other slot');
    await shot('slot-delete-complete');
   }
   if(width===360){current='save-codec';const codec=await page.evaluate(()=>window.__plAudit.saveCodecAudit());console.log('SAVE_CODEC',JSON.stringify(codec));const perf=await page.evaluate(()=>window.__plPerformance.audit());console.log('LONG_SAVE_PERFORMANCE',JSON.stringify(perf));}await shot('title');await click('[data-action="rare-preview-open"]');await shot('rare-gallery');
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
      await click(action('annual-run'));await detail('care');await shot('report-self-support');
      if(!(await page.locator('.report-support').isVisible()))throw Error('support missing after training choice');
      await click(action('report-self-back'));await click(action('annual-run'));await click(action('annual-run'));
     }else if(k==='report-draft'){
      await page.locator(action('draft-start')).first().waitFor({state:'visible',timeout:8000});await detail('scout');await shot('report-draft-ready');await click(action('draft-start'));await shot('report-draft-started');
     }else{
      const text=await page.locator('main').innerText();if(!/STAR|LEGEND/.test(text))throw Error('special renewal players missing');
      await detail('contract');await shot('report-renewal-ready');await click(action('renewal-submit-all'));await shot('report-renewal-bonus');await click(action('renewal-report-cancel'));
     }
    }
    if(k==='report-season'){
     const before=await page.evaluate(()=>window.__plSlotAudit.state());
     await click(action('advance-day'));
     const outcome=page.locator('.report-static-result');
     const skip=page.locator(action('watch-skip')).first();
     // Either a rest day or the actual game replay; no fabricated game state.
     await page.waitForFunction(()=>document.querySelector('[data-action="watch-skip"],.report-static-result')||!window.__plAudit.state().busy,{},{timeout:15000});
     if(await skip.isVisible())await skip.click();
     await page.waitForFunction(()=>!window.__plAudit.state().busy,{},{timeout:30000});
     const after=await page.evaluate(()=>window.__plSlotAudit.state());
     if(after.day<before.day||after.day>before.day+1)throw Error('one-day game processed more than once');
     if(await outcome.isVisible()){
      await shot('report-season-result');const score=await page.locator('.result-score-row').first().innerText();
      await page.waitForTimeout(900);if(score!==await page.locator('.result-score-row').first().innerText())throw Error('result unstable');
      await click(action('finish-review'));
     }
     await shot('report-season-hq');
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
     await click('[data-action="tab"][data-tab="business"]');await click('[data-action="business-sub"][data-sub="facilities"]');await detail('campus');await shot('parallel-facilities');
     await click('[data-action="tab"][data-tab="hq"]');await until('autumn');await enter('autumn');await shot('autumn-report');await click(action('ceremony-next'));
     await check(s=>s.jobs.autumn==='done','autumn complete');await until('booking');await enter('booking');await checkCampPicker();await shot('camp-booking');
     await click(action('ref-group','farm'));await shot('camp-farm-choice');await click(action('ref-camp-next'));await check(s=>s.jobs.booking==='done','booking complete');
     await page.evaluate(()=>window.__plAudit.seedSpring());await until('self');await enter('self');await shot('self-training');
     const intensity=page.locator('select[data-change="annual-intensity"]:not([disabled])').first();await intensity.selectOption('rest');await click(action('annual-run'));await shot('self-support');await click(action('annual-run'));await check(s=>s.jobs.self==='waiting','self scheduled');
     await until('self');await enter('self');await shot('self-report');await click(action('ceremony-next'));await until('camp');await enter('camp');await checkCampPicker();await shot('spring-sites');
     await click(action('ref-camp-next'));await shot('spring-kickoff');await click(action('ref-camp-next'));await check(s=>s.jobs.camp==='waiting'&&s.camp===2,'camp waits for first visit');
     await until('camp');await enter('camp');await shot('spring-visit-first');await click(action('ref-visit','rest'));await click(action('ref-visit-finish'));await check(s=>s.jobs.camp==='waiting'&&s.camp===3,'camp waits for second visit');
     await until('camp');await enter('camp');await shot('spring-visit-second');await click(action('annual-run'));await until('camp');await enter('camp');await page.locator('[data-training-result="camp"]').waitFor({state:'visible'});await shot('spring-report');
     for(const tab of ['INJURY','NEW','UP','STAY','DOWN']){await click(action('ref-report',tab));await shot('spring-report-'+tab);}
     await click(action('ceremony-next'));await until('exhibition');await enter('exhibition');await shot('exhibition-policy');for(const k of ['first','balanced','youth'])await selectPolicy(k);await click(action('annual-run'));if(!(await page.locator('main').innerText()).includes('若手育成'))throw Error('meeting policy mismatch');await click(action('annual-run'));await until('exhibition');await enter('exhibition');for(const key of ['pitch','bat','field']){await page.locator('[data-digest-cut="'+key+'"]').waitFor({state:'visible',timeout:6000});await shot('exhibition-digest-'+key);}await page.locator('.preseason-results').waitFor({state:'visible',timeout:8000});if(await page.locator('[data-preseason-result]').count()!==6)throw Error('preseason full results missing');await shot('exhibition-report');await check(s=>s.exhibition===36,'exhibition game count');await click(action('ceremony-next'));
    }
    if(k==='commerce'){
     await dayTo('commerce-open','fan-fest');await click(action('commerce-open','fan-fest'));await detail('fest');await shot('fest-brief');
     await click(action('commerce-start'));await detail('fest');await shot('fest-selection');await click(action('commerce-plan',2));await click(action('commerce-confirm'));await shot('fest-booking');
     await click(action('commerce-schedule-finish'));await dayTo('commerce-open','fan-fest');await click(action('commerce-open','fan-fest'));await shot('fest-live');
     await click(action('commerce-live-finish'));await detail('fest');await shot('fest-result');await click(action('commerce-finish'));
     await dayTo('commerce-open','fanclub');await click(action('commerce-open','fanclub'));await click(action('commerce-start'));await detail('fanclub');await shot('fanclub-selection');
     await page.locator('#commerce-fan-name').fill('PENNANT AUDIT');await click(action('commerce-fee',500));await click(action('commerce-perk','uniform'));await shot('fanclub-preview');
     await click(action('commerce-confirm'));await detail('fanclub');await shot('fanclub-result');await click(action('commerce-finish'));
     await click(action('commerce-open','tv'));await click(action('commerce-start'));await detail('tv');await shot('tv-selection');
     const guests=await page.locator(action('commerce-player')).evaluateAll(els=>els.slice(0,5).map(e=>e.dataset.value));
     if(guests.length!==5)throw Error('five TV guests required');for(const id of guests)await click(action('commerce-player',id));
     await click(action('commerce-confirm'));await shot('tv-booking');await click(action('commerce-schedule-finish'));
     await dayTo('commerce-open','tv');await click(action('commerce-open','tv'));await detail('tv');await shot('tv-live');await click(action('commerce-tv-finish'));await detail('tv');await shot('tv-result');await click(action('commerce-finish'));
     await dayTo('sponsor-open');await click(action('sponsor-open'));await click(action('sponsor-start'));await detail('sponsor');await shot('sponsor-selection');await click(action('sponsor-confirm'));await detail('sponsor');await shot('sponsor-result');await click(action('sponsor-finish'));
     await click(action('commerce-open','broadcast'));await click(action('commerce-start'));await click(action('commerce-delta',3));await detail('broadcast');await shot('broadcast-negotiation');await click(action('commerce-confirm'));await detail('broadcast');await shot('broadcast-result');await click(action('commerce-finish'));
     await click(action('commerce-open','naming'));await click(action('commerce-start'));await detail('naming');await shot('naming-selection');await click(action('commerce-confirm'));await detail('naming');await shot('naming-result');await click(action('commerce-finish'));
    }
    if(k==='opening-promo'){
     await dayTo('commerce-open','opening-promo');await click(action('commerce-open','opening-promo'));await click(action('commerce-start'));
     for(let i=0;i<3;i++){await click(action('commerce-plan',i));await shot('opening-promo-plan-'+i);}
     await click(action('commerce-confirm'));await click(action('commerce-schedule-finish'));await dayTo('commerce-open','opening-promo');await click(action('commerce-open','opening-promo'));await click(action('commerce-opening-live-finish'));await detail('stadium');await shot('opening-promo-result');await click(action('commerce-finish'));
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
     for(const t of business){current='business-'+t;
      if(t==='scout'||t==='foreign'){
       await click('[data-action="tab"][data-tab="hq"]');
       await click('[data-action="tab"][data-tab="business"][data-sub="'+t+'"]');
       await shot('business-'+t);
       await click(action('back-to-hq'));
       await click('[data-action="tab"][data-tab="business"]:not([data-sub])');
       // The general business tab may remember the previous scout subpage.
       if(await page.locator(action('back-to-hq')).first().isVisible()){
        await click(action('back-to-hq'));await click('[data-action="tab"][data-tab="business"][data-sub="finance"]');
       }
      }else{await click('[data-action="business-sub"][data-sub="'+t+'"]');await shot('business-'+t);}
     }
    }
   }
  }catch(e){const detail=await page.evaluate(()=>({state:window.__plAudit?.state(),clicks:window.__plAuditClicks,heading:document.querySelector('main h2')?.innerText,actions:[...document.querySelectorAll('main [data-action]')].slice(0,12).map(e=>({action:e.dataset.action,id:e.dataset.id}))})).catch(()=>null);errors.push({width,screen:current,error:e.message,detail});await page.screenshot({path:path.join('test-results/browser',width+'-failure.png')}).catch(()=>{});}
  await page.close();
 }}finally{await browser.close();const coverage=screenNames.map(name=>({name,capturedAt:rows.filter(r=>r.screens?.includes(name)).map(r=>({width:r.width,shot:r.name})),quality:'not visually adjudicated'}));
 fs.writeFileSync('test-results/browser/coverage.json',JSON.stringify({scope:'Functions called since prior screenshot; not proof that every branch or artistic quality was inspected',total:coverage.length,observed:coverage.filter(x=>x.capturedAt.length).length,coverage},null,2));
 fs.writeFileSync('test-results/browser/report.json',JSON.stringify({scope:'Headless Chromium, not physical devices; screenshots do not prove artistic quality',rows,errors},null,2));}
 console.log(JSON.stringify({screens:rows.length,errors},null,2));if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
