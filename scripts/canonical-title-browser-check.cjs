// Browser integration: real packaged title/portal/setup, real engine + HTTP,
// test-only native auth bridge. No provider credentials or production service.
const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright'),esbuild=require('esbuild');
const {createServiceRuntime}=require('../server/service-runtime.cjs'),{createHeadlessEngine}=require('../server/headless-engine.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pl-title-browser-')),owner='a'.repeat(64),deny=async()=>null;
 let clockOffset=0,fixtureRookie=false,fixtureDecade=false;
 const engine=createHeadlessEngine();
 // Isolated third-slot fixture, persisted through the real HTTP authority.
 const fixtureEngine={...engine,newWorld(command){const w=engine.newWorld(command);if(fixtureDecade)return require('./decade-fixture.cjs').decadeFixture(w);if(fixtureRookie){const p=w.players.find(p=>p.teamId===w.selectedId&&!p.retired);a.ok(p);Object.assign(p,{originCategory:'RINNE',specialCategory:'輪廻転生',pastLifeAppearance:{seed:99521,baseCategory:'IMMORTAL'}});w.pendingDraftReveal={year:w.year-1,entries:[{id:p.id,revealStage:0}]};const injured=w.players.find(q=>q.id!==p.id&&q.teamId===w.selectedId&&!q.retired);a.ok(injured);injured.injury={date:w.year+'-03-01',daysLeft:8,label:'試験用負傷'};w.memorialHistory={...(w.memorialHistory||{}),'fixture:facility':{id:'fixture:facility',year:w.year,teamId:w.selectedId,kind:'facility',title:'試験用施設実績',body:'隔離試験用'},'fixture:private':{id:'fixture:private',year:w.year,teamId:w.selectedId,kind:'facility',title:'IMMORTAL輪廻転生 隔離試験',body:'隔離試験用'}};}return w;}};
 const runtime=createServiceRuntime({now:()=>Date.now()+clockOffset,dataDir:dir,authenticate:async t=>t==='a'?{authenticated:true,account:owner}:{authenticated:false},verifyRecentReauth:deny,verifyReceipt:deny,verifyCurrent:deny,verifyNotification:deny,verifyEvent:deny,verifyAction:deny,verifyCompletion:deny,canonicalEngine:fixtureEngine,units:{android:{unit:'123',item:'ticket',amount:1}},origins:[]});
 let browser;
 try{
  await new Promise(ok=>runtime.server.listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+runtime.server.address().port;
  const post=async(route,body)=>{const r=await fetch(base+'/v1/game/'+route,{method:'POST',headers:{Authorization:'Bearer a','Content-Type':'application/json'},body:JSON.stringify(body)});a.equal(r.status,200);return r.json();};
  const seeded=await post('create',{slot:2,command:{team:1}});
  const fixture=esbuild.buildSync({stdin:{contents:[
   "const {createAccountClient}=require('./mobile/src/account-client.cjs');",
   "const {createCanonicalGameSession}=require('./mobile/src/canonical-game-session.cjs');",
   "const owner='a'.repeat(64);let ctx=null,online=true;",
   "const client=createAccountClient({baseUrl:'https://fixture.invalid',fetcher:(u,o)=>fetch('/canonical-fixture'+new URL(u).pathname,o)});",
   "const session=createCanonicalGameSession({client,online:()=>online});",
   "localStorage.setItem('pennant_lab_v04_slot_1','guest-sentinel');",
   "localStorage.setItem('pennant_lab_account_v1_'+owner+'_slot_1','account-sentinel');",
   "window.PennantNative={accountRequired:true,ready:()=>online,check:async()=>online,canonicalGame:session,get accountContext(){return ctx;},accountReady:async()=>{ctx={account:owner,isCurrent:()=>true,openCloud:async()=>{throw Error('legacy cloud forbidden');}};session.setSession({account:owner,token:'a'});},logoutAccount:()=>{throw Error('not in fixture');}};",
   "window.fixtureShares=[];window.PennantNative.shareImage=async(data,name)=>{window.fixtureShares.push({data,name});};",
   "window.fixtureOnline=on=>{online=on;if(!on){session.suspend();window.dispatchEvent(new Event('pl-native-suspend'));}};"
  ].join('\n'),resolveDir:process.cwd()},bundle:true,write:false,platform:'browser'}).outputFiles[0].text;
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/native-runtime.js',r=>r.fulfill({contentType:'application/javascript',body:fixture}));
  await page.route('**/*.mp4',r=>r.abort()); // startup video has its own independent audit
  let creates=0,lost=false,failSlots=false,lostAdvance=false,advances=0,freeReads=0,failFree=false,lostSettle=false,settles=0,reserves=0;
  await page.route('**/canonical-fixture/v1/**',async r=>{
   const q=r.request(),p=new URL(q.url()).pathname.replace('/canonical-fixture','');
   if(p.endsWith('/slots')&&failSlots){await r.abort();return;}
   if(p.endsWith('/free-page')){freeReads++;if(failFree){await r.abort();return;}}
   const response=await fetch(base+p,{method:'POST',headers:{Authorization:q.headers().authorization,'Content-Type':'application/json'},body:q.postData()});
   const body=await response.text();
   if(p.endsWith('/create')){creates++;if(lost){lost=false;a.equal(response.status,200);await r.abort();return;}}
   if(p.endsWith('/advance')){advances++;if(lostAdvance){lostAdvance=false;a.equal(response.status,200);await r.abort();return;}}
   if(p.endsWith('/game/reserve'))reserves++;
   if(p.endsWith('/game/settle')){settles++;if(lostSettle){lostSettle=false;a.equal(response.status,200);await r.abort();return;}}
   if(response.status===429)throw Error('Unexpected fixture rate limit: '+p);
   await r.fulfill({status:response.status,contentType:'application/json',body});
  });
  await page.goto('http://127.0.0.1:8765/mobile/www/');
  const start=page.locator('[data-action="launch-start"]');await start.waitFor();
  await page.waitForFunction(()=>!document.body.classList.contains('official-startup-active'));
  a.equal(await page.evaluate(()=>window.PennantAudio.inspect().active),false);
  await start.click();
  const slot=n=>page.locator('button.save-slot[data-slot="'+n+'"]');
  await slot(2).waitFor();a.equal(await page.locator('button.save-slot').count(),3);
  a.equal(await page.evaluate(()=>window.PennantAudio.inspect().scene),'worlds');
  await page.waitForFunction(()=>window.PennantAudio.inspect().active);
  await page.evaluate(()=>{const root=document.querySelector('#app');root.inert=true;window.dispatchEvent(new Event('pl-native-suspend'));window.dispatchEvent(new Event('focus'));});
  a.equal(await page.evaluate(()=>window.PennantAudio.inspect().active),false);
  await page.evaluate(()=>{document.querySelector('#app').inert=false;window.dispatchEvent(new Event('focus'));});
  a.equal(await page.evaluate(()=>window.PennantAudio.inspect().active),false);
  await page.evaluate(()=>window.dispatchEvent(new Event('pl-native-ready')));
  await page.waitForFunction(()=>window.PennantAudio.inspect().active);
  console.log('PASS audio remains suspended through focus until explicit native readiness');
  // Native suspension intentionally invalidates the previous slots snapshot.
  await page.locator('[data-action="canonical-retry"]').click();await slot(2).waitFor();a.equal(await slot(2).getAttribute('data-action'),'continue-slot');
  const soundPanel=page.locator('[data-pl-audio]');await soundPanel.locator('summary').click();
  await soundPanel.locator('[data-pl-audio-enabled]').uncheck();
  a.equal(await page.evaluate(()=>window.PennantAudio.inspect().prefs.enabled),false);
  a.equal(await page.evaluate(()=>window.PennantAudio.inspect().active),false);
  await soundPanel.locator('[data-pl-bgm]').fill('25');await soundPanel.locator('[data-pl-sfx]').fill('60');
  a.deepEqual(await page.evaluate(()=>window.PennantAudio.inspect().prefs),{enabled:false,bgm:.25,sfx:.6});
  await soundPanel.locator('summary').click();
  a.equal(await slot(1).getAttribute('data-action'),'new-slot');
  a.equal(await slot(2).getAttribute('data-action'),'continue-slot');
  await slot(1).click();await page.locator('.portal-transit').waitFor();
  const finish=page.locator('[data-action="finish-setup"]');await finish.waitFor();
  await page.locator('[data-action="pick-setup-team"][data-id="0"]').click();
  await page.locator('input[data-field="gmName"]').fill('試験GM');
  await page.locator('input[data-field="name"]').fill('試験球団');
  await finish.click();await page.getByText('サーバー保存の確認画面（開発試験）').waitFor();
  const one=await post('read',{slot:1});a.equal(one.game.team.name,'試験球団');a.equal(one.game.gmName,'試験GM');a.equal(one.revision,1);a.equal(creates,1);
  await page.locator('[data-action="canonical-roster-open"]').click();await page.locator('.order190 .order-field').waitFor();a.equal(await page.locator('.order190 .order-node').count(),9);
  await page.locator('[data-action="order190-mode"][data-mode="order"]').click();
  await page.locator('[data-action="order190-order"][data-index="0"]').click();await page.locator('[data-action="order190-order"][data-index="1"]').click();await page.getByText('サーバーに編成を保存しました。').waitFor();
  let roster=await post('read',{slot:1});a.equal(roster.revision,2);a.equal(roster.game.club.lineup[0],one.game.club.lineup[1]);a.equal(advances,1);
  lostAdvance=true;await page.locator('[data-action="order190-undo"]').click();await page.getByText('編成の確定状態を取得してください。自動再送は行いません。').waitFor();a.equal(await page.locator('.order190').count(),0);a.equal(advances,2);
  await page.locator('[data-action="canonical-roster-refresh"]').click();await page.getByText('最新の編成を取得しました。').waitFor();roster=await post('read',{slot:1});a.equal(roster.revision,3);a.deepEqual(roster.game.club.lineup,one.game.club.lineup);a.equal(advances,2);
  await page.locator('[data-action="canonical-roster-back"]').click();await page.getByText('サーバー保存の確認画面（開発試験）').waitFor();
  await page.locator('[data-action="canonical-hq-open"]').click();await page.locator('.hero-stadium').waitFor();a.equal(await page.locator('.hero-team h2').textContent(),'試験球団');
  a.equal(await page.evaluate(()=>window.PennantAudio.inspect().scene),'hq');
  a.deepEqual(await page.evaluate(()=>window.PennantAudio.inspect().prefs),{enabled:false,bgm:.25,sfx:.6});
  const beforeDay=await post('read',{slot:1});a.equal(beforeDay.game.headquarters.canStep,true);
  await page.locator('[data-action="canonical-events-open"]').click();await page.getByText('現在対応する年間業務はありません。').waitFor();a.equal(await page.locator('[data-action="canonical-event-command"]').count(),0);await page.locator('[data-action="canonical-events-back"]').click();a.equal((await post('read',{slot:1})).revision,beforeDay.revision);
  await page.locator('[data-action="canonical-players"]').click();a.equal(await page.locator('.player-card').count(),beforeDay.game.club.roster.length);
  await page.locator('.player-row').first().click();await page.locator('.player-upper-portrait').waitFor();a.equal(await page.locator('.player-stat-grid').count(),1);
  await page.locator('[data-action="canonical-info-back"]').click();await page.locator('.player-card').first().waitFor();await page.locator('[data-action="canonical-info-back"]').click();
  await page.locator('[data-action="canonical-standings"]').click();a.equal(await page.locator('tbody tr').count(),6);await page.locator('[data-action="canonical-league"][data-league="W"]').click();a.equal(await page.locator('.league-west tbody tr').count(),6);await page.locator('[data-action="canonical-info-back"]').click();
  await page.locator('[data-action="canonical-ops-open"][data-kind="free"]').click();
  await page.locator('[data-action="canonical-free-next"]').waitFor();
  a.equal(freeReads,1);a.ok(await page.locator('.player-card').count()<=30);
  const freeFirst=await post('free-page',{slot:1,world:beforeDay.world,revision:beforeDay.revision,command:{offset:0,limit:30,query:''}});
  a.equal(await page.locator('.player-card').count(),freeFirst.page.items.length);
  if(freeFirst.page.nextOffset!==null){await page.locator('[data-action="canonical-free-next"]').click();await page.locator('[data-action="canonical-free-prev"]:enabled').waitFor();a.ok(await page.locator('.player-card').count()<=30);await page.locator('[data-action="canonical-free-prev"]').click();await page.locator('[data-action="canonical-free-prev"]:disabled').waitFor();}
  await page.locator('#canonical-free-query').fill('zzzz無一致候補zzz');await page.locator('[data-action="canonical-free-search"]').click();await page.getByText('該当する選手はいません。').waitFor();
  failFree=true;await page.locator('[data-action="canonical-free-search"]').click();await page.locator('[data-action="canonical-ops-refresh"]').waitFor();a.equal(await page.locator('.player-card').count(),0);failFree=false;
  await page.locator('[data-action="canonical-ops-back"]').click();await page.locator('[data-action="canonical-hq-refresh"]').click();await page.locator('.hero-stadium').waitFor();
  a.equal((await post('read',{slot:1})).revision,beforeDay.revision);a.equal(advances,2);
  lostAdvance=true;await page.locator('[data-action="canonical-hq-step"]').click();await page.getByText('確定した日程を取得してください。自動再送は行いません。').waitFor();a.equal(await page.locator('.hero-stadium').count(),0);a.equal(advances,3);
  await page.locator('[data-action="canonical-hq-refresh"]').click();await page.locator('.hero-stadium').waitFor();
  const afterDay=await post('read',{slot:1});a.equal(afterDay.revision,beforeDay.revision+1);a.equal(afterDay.game.calendarIndex,beforeDay.game.calendarIndex+1);a.equal(advances,3);
  await page.locator('[data-action="canonical-hq-mode"][data-mode="skip"]').click();const beforeWeekly=await post('read',{slot:1});
  if(beforeWeekly.game.headquarters.canCalendar){await page.locator('[data-action="canonical-hq-run"][data-kind="weekly"]').click();await page.waitForFunction(()=>!document.querySelector('[data-action="canonical-hq-pause"]'),null,{timeout:30000});const afterWeekly=await post('read',{slot:1});a.ok(afterWeekly.game.calendarIndex>beforeWeekly.game.calendarIndex);a.ok(afterWeekly.game.calendarIndex<=beforeWeekly.game.headquarters.goals.weekly);a.ok(afterWeekly.game.calendarIndex===beforeWeekly.game.headquarters.goals.weekly||!afterWeekly.game.headquarters.canCalendar);a.equal(afterWeekly.revision-beforeWeekly.revision,afterWeekly.game.calendarIndex-beforeWeekly.game.calendarIndex);}
  const beforePresentation=await post('read',{slot:1});
  if(beforePresentation.game.headquarters.canCalendar){await page.locator('[data-action="canonical-hq-mode"][data-mode="normal"]').click();await page.locator('[data-action="canonical-hq-step"]').click();await page.locator('[data-action="canonical-replay-skip"]').waitFor({timeout:15000});await page.locator('[data-action="canonical-replay-skip"]').click();await page.locator('.hero-stadium').waitFor();const afterPresentation=await post('read',{slot:1});a.equal(afterPresentation.revision,beforePresentation.revision+1);a.equal(afterPresentation.game.calendarIndex,beforePresentation.game.calendarIndex+1);}
  // Exercise nonempty serialized archive records, not merely an empty page.
  clockOffset+=61000;
  const archived=await post('read',{slot:1});
  // Actual persisted match, no client-side re-simulation or fabricated identity.
  const hq=archived.game.headquarters,confirmed=hq.lastReport;
  a.ok(hq.last&&confirmed?.home&&confirmed?.away,'expected actual persisted match for headquarters score');
  const score=page.locator('[data-hq-score="confirmed"]');await score.waitFor();
  for(const [team,n] of [[confirmed.away,confirmed.awayScore],[confirmed.home,confirmed.homeScore]]){
    const side=score.locator('[data-hq-score-team="'+team.id+'"]');
    a.equal(await side.locator('strong').textContent(),team.short||team.name);
    a.equal(await side.locator('b').textContent(),String(n));
    a.ok(await side.evaluate(el=>el.style.getPropertyValue('--match-club').length>0));
    a.ok(await side.locator('.mini-logo').count()>0);
  }
  a.ok(await score.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'HQ score overflows');
  a.equal((await post('read',{slot:1})).revision,archived.revision);

  if(archived.game.headquarters.archiveAvailable){
   await page.locator('[data-action="canonical-reports-open"]').click();
   await page.locator('[data-action="canonical-archive-search"]').click();await page.locator('[data-action="canonical-archive-next"]').waitFor();
   const matches=await post('report-page',{slot:1,world:archived.world,revision:archived.revision,command:{kind:'matches',year:0,offset:0,limit:1}});
   if(archived.game.headquarters.lastReport){a.ok(matches.page.total>0);a.equal(matches.page.items[0].gameId,archived.game.headquarters.lastReport.gameId);}
   await page.locator('[data-action="canonical-archive-kind"][data-kind="papers"]').click();await page.locator('[data-action="canonical-archive-next"]').waitFor();
   const papers=await post('report-page',{slot:1,world:archived.world,revision:archived.revision,command:{kind:'papers',year:0,offset:0,limit:3}});
   if(archived.game.headquarters.latestPaper){a.ok(papers.page.total>0);a.equal(papers.page.items[0].date,archived.game.headquarters.latestPaper.date);}
   a.equal((await post('read',{slot:1})).revision,archived.revision);
   await page.locator('[data-action="canonical-reports-back"]').click();
  }
  await page.locator('[data-action="canonical-return"]').first().click();await slot(1).waitFor();
  a.equal(await slot(1).getAttribute('data-action'),'continue-slot');
  // Separate the two long integration scenarios by a real limiter window in the fixture clock.
  // Do not change production rate limits or bypass individual request accounting.
  clockOffset+=61000;
  await slot(2).click();await page.getByText('サーバー保存の確認画面（開発試験）').waitFor();
  a.equal((await post('read',{slot:2})).world,seeded.world);
  await page.locator('[data-action="canonical-hq-open"]').click();await page.locator('.hero-stadium').waitFor();
  const beforeOps=await post('read',{slot:2});
  await page.locator('[data-action="canonical-ops-open"][data-kind="rotation"]').click();
  await page.locator('[data-action="canonical-rotation-slot"][data-slot="0"]').click();
  const rotation=beforeOps.game.club.rotation,eligible=beforeOps.game.club.rotationCandidates;
  const swapId=rotation.slice(1).find(id=>eligible.includes(id));a.ok(swapId!==undefined);
  await page.locator('[data-action="canonical-rotation-pick"][data-id="'+swapId+'"]').click();await page.getByText('サーバーに変更を保存しました。').waitFor();
  let afterOps=await post('read',{slot:2});a.equal(afterOps.revision,beforeOps.revision+1);a.equal(afterOps.game.club.rotation[0],swapId);a.equal(afterOps.game.club.rotation[rotation.indexOf(swapId)],rotation[0]);
  await page.locator('[data-action="canonical-ops-back"]').click();
  await page.locator('[data-action="canonical-ops-open"][data-kind="farm"]').click();
  a.equal(await page.locator('.player-card').count(),afterOps.game.club.roster.length);
  const targetMode=afterOps.game.club.farmMode==='manual'?'auto':'manual';
  page.once('dialog',d=>d.accept());await page.locator('[data-action="canonical-farm-mode"][data-mode="'+targetMode+'"]').click();await page.getByText('サーバーに変更を保存しました。').waitFor();
  let afterFarm=await post('read',{slot:2});a.equal(afterFarm.revision,afterOps.revision+1);a.equal(afterFarm.game.club.farmMode,targetMode);
  if(afterFarm.game.club.farmMode!=='manual'){
    page.once('dialog',d=>d.accept());await page.locator('[data-action="canonical-farm-mode"][data-mode="manual"]').click();await page.getByText('サーバーに変更を保存しました。').waitFor();afterFarm=await post('read',{slot:2});
  }
  const farm=afterFarm.game.club,bench=farm.roster.find(p=>p.tier===2&&!p.injured);
  if(bench&&farm.roster.filter(p=>p.tier===1).length<farm.farmLimit){
    page.once('dialog',d=>d.accept());await page.locator('[data-action="canonical-farm-move"][data-id="'+bench.id+'"]').click();await page.getByText('サーバーに変更を保存しました。').waitFor();
    const promoted=await post('read',{slot:2});a.equal(promoted.revision,afterFarm.revision+1);a.equal(promoted.game.club.roster.find(p=>p.id===bench.id).tier,1);
  }
  await page.locator('[data-action="canonical-ops-back"]').click();
  await page.locator('[data-action="canonical-ops-open"][data-kind="free"]').click();await page.locator('[data-action="canonical-free-next"]').waitFor();
  const beforeSign=await post('read',{slot:2}),free=await post('free-page',{slot:2,world:beforeSign.world,revision:beforeSign.revision,command:{offset:0,limit:30,query:''}});
  const affordable=free.page.items.find(p=>p.cost<=beforeSign.game.team.cash);
  if(affordable&&beforeSign.game.club.roster.length<beforeSign.game.club.rosterLimit){
    page.once('dialog',d=>d.accept());await page.locator('[data-action="canonical-free-sign"][data-id="'+affordable.id+'"]').click();await page.getByText('サーバーに変更を保存しました。').waitFor();await page.locator('[data-action="canonical-free-next"]').waitFor();
    const signed=await post('read',{slot:2});a.equal(signed.revision,beforeSign.revision+1);a.ok(signed.game.club.roster.some(p=>p.id===affordable.id));
  }
  await page.locator('[data-action="canonical-ops-back"]').click();
  clockOffset+=61000;
  await page.locator('[data-action="canonical-ops-open"][data-kind="facilities"]').click();
  a.equal(await page.locator('.canonical-facility').count(),8);a.equal(await page.locator('.stadium-map svg').count(),1);
  const beforeFacility=await post('read',{slot:2}),medical=beforeFacility.game.club.facilities.find(f=>f.key==='medical');
  a.ok(medical.nextCost<=beforeFacility.game.team.cash);
  page.once('dialog',d=>d.accept());await page.locator('[data-action="canonical-facility-change"][data-key="medical"][data-direction="1"]').click();await page.getByText('サーバーに変更を保存しました。').waitFor();
  let afterFacility=await post('read',{slot:2});a.equal(afterFacility.revision,beforeFacility.revision+1);a.equal(afterFacility.game.club.facilities.find(f=>f.key==='medical').level,medical.level+1);a.ok(Math.abs(afterFacility.game.team.cash-beforeFacility.game.team.cash+medical.nextCost)<.011);
  page.once('dialog',d=>d.accept());await page.locator('[data-action="canonical-facility-change"][data-key="medical"][data-direction="-1"]').click();await page.getByText('サーバーに変更を保存しました。').waitFor();
  let afterDown=await post('read',{slot:2});a.equal(afterDown.revision,afterFacility.revision+1);a.equal(afterDown.game.team.cash,afterFacility.game.team.cash);a.equal(afterDown.game.club.facilities.find(f=>f.key==='medical').level,medical.level);
  if(afterDown.game.club.canPrice){
    const price=afterDown.game.club.prices[0],next=price===20000?price-100:price+100;
    await page.locator('.canonical-price').first().fill(String(next));page.once('dialog',d=>d.accept());await page.locator('[data-action="canonical-prices"]').click();await page.getByText('サーバーに変更を保存しました。').waitFor();
    const priced=await post('read',{slot:2});a.equal(priced.revision,afterDown.revision+1);a.equal(priced.game.club.prices[0],next);afterDown=priced;
  }
  const travel=(afterDown.game.club.travel+1)%4;page.once('dialog',d=>d.accept());await page.locator('[data-action="canonical-travel"][data-index="'+travel+'"]').click();await page.getByText('サーバーに変更を保存しました。').waitFor();
  const travelled=await post('read',{slot:2});a.equal(travelled.revision,afterDown.revision+1);a.equal(travelled.game.club.travel,travel);
  await page.locator('[data-action="canonical-ops-back"]').click();
  await page.locator('[data-action="canonical-ops-open"][data-kind="manager"]').click();
  await page.locator('.manager-entry').waitFor();
  a.equal(await page.locator('[data-action="canonical-manager-order"]').count(),0);
  const beforeMeeting=await post('read',{slot:2});a.equal(beforeMeeting.revision,travelled.revision);
  await page.locator('[data-action="canonical-manager-enter"]').click();
  await page.locator('.manager-activity-panel').waitFor();
  a.equal(await page.locator('.manager-sheet .manager-grade').count(),4);
  const afterMeeting=await post('read',{slot:2});a.equal(afterMeeting.revision,beforeMeeting.revision);a.equal(afterMeeting.game.club.manager.trust,beforeMeeting.game.club.manager.trust);a.equal(afterMeeting.game.club.manager.discontent,beforeMeeting.game.club.manager.discontent);
  const order=travelled.game.club.manager.orders[0],policy=order.value==='attack'?'safe':'attack';
  await page.locator('[data-action="canonical-manager-order"][data-key="'+order.key+'"][data-value="'+policy+'"]').click();await page.getByText('サーバーに変更を保存しました。').waitFor();
  const ordered=await post('read',{slot:2});a.equal(ordered.revision,travelled.revision+1);a.equal(ordered.game.club.manager.orders[0].value,policy);
  await page.locator('[data-action="canonical-ops-back"]').click();
  await page.locator('[data-action="canonical-players"]').click();await page.locator('.player-row').first().click();const focus=page.locator('[data-action="canonical-focus"]:enabled').first();const key=await focus.getAttribute('data-key');
  await focus.click();await page.getByText('サーバーに変更を保存しました。').waitFor();const focused=await post('read',{slot:2});a.equal(focused.revision,ordered.revision+1);
  a.equal(focused.game.club.roster.filter(p=>p.focus!==ordered.game.club.roster.find(q=>q.id===p.id)?.focus&&p.focus===key).length,1);
  clockOffset+=61000;
  await page.locator('[data-action="canonical-history-open"]').click();await page.locator('#canonical-player-memo').waitFor();
  a.equal((await post('read',{slot:2})).revision,focused.revision);
  const memo='来季の構想：重点育成 <script>文字列</script> '+ 'あ'.repeat(1500);
  await page.locator('#canonical-player-memo').fill(memo);await page.locator('[data-action="canonical-memo-save"]').click();await page.locator('#canonical-player-memo').waitFor();a.equal(await page.locator('#canonical-player-memo').inputValue(),memo);
  const memoed=await post('read',{slot:2});a.equal(memoed.revision,focused.revision+1);
  const focusPlayer=focused.game.club.roster.find(p=>p.focus!==ordered.game.club.roster.find(q=>q.id===p.id)?.focus);
  const persisted=await post('player-page',{slot:2,world:memoed.world,revision:memoed.revision,command:{playerId:focusPlayer.id,offset:0,limit:10}});a.equal(persisted.page.memo,memo);
  await page.locator('[data-action="canonical-info-back"]').click();await page.locator('[data-action="canonical-info-back"]').click();
  await page.locator('[data-action="canonical-return"]').first().click();await slot(3).waitFor();
  clockOffset+=61000;
  fixtureRookie=true;await slot(3).click();await finish.waitFor();lost=true;await finish.click();
  await page.locator('button[data-slot="3"][data-action="continue-slot"]').waitFor();fixtureRookie=false;
  a.equal(creates,2);a.equal((await post('read',{slot:3})).revision,1);
  failSlots=true;await page.locator('[data-action="canonical-retry"]').click();
  await page.getByText('サーバーのセーブ一覧を確認できません。データは変更されていません。').waitFor();
  a.equal(await page.locator('button.save-slot').count(),0);
  failSlots=false;await page.locator('[data-action="canonical-retry"]').click();await slot(1).waitFor();
  await page.evaluate(()=>window.fixtureOnline(false));await page.getByText('サーバーのセーブ一覧を確認できません。データは変更されていません。').waitFor();
  await page.evaluate(()=>window.fixtureOnline(true));await page.locator('[data-action="canonical-retry"]').click();await slot(1).waitFor();
  a.deepEqual(await page.evaluate(async()=>[localStorage.getItem('pennant_lab_v04_slot_1'),localStorage.getItem('pennant_lab_account_v1_'+'a'.repeat(64)+'_slot_1'),(await indexedDB.databases()).some(d=>d.name==='pennant_lab_v04_saves')]),['guest-sentinel','account-sentinel',false]);
  // Reopen the saved fixture and exercise the actual packaged event UI.
  clockOffset+=61000;
  await slot(3).click();await page.getByText('サーバー保存の確認画面（開発試験）').waitFor();
  await page.locator('[data-action="canonical-hq-open"]').click();await page.locator('.hero-stadium').waitFor();
  const initialRookie=await post('read',{slot:3});
  a.equal(initialRookie.game.club,null);
  a.equal(initialRookie.game.inbox.rookie.entries[0].stage,0);
  a.equal(initialRookie.game.inbox.rookie.entries[0].appearanceSeed,null);a.equal(initialRookie.game.inbox.rookie.entries[0].hidden,true);a.equal(initialRookie.game.inbox.rookie.entries[0].specialCategory,null);
  await page.locator('[data-action="canonical-events-open"]').click();await page.getByRole('heading',{name:'新人入団報告'}).waitFor();
  const reveal=page.locator('[data-kind="rookie-reveal"]'),finishRookie=page.locator('[data-kind="rookie-finish"]');
  a.equal(await finishRookie.isDisabled(),true);
  await page.locator('[data-action="canonical-foreign-toggle"]').click();
  const foreignButtons=page.locator('[data-kind^="foreign-"]');
  for(const b of await foreignButtons.all())a.equal(await b.isDisabled(),true);
  const beforeReveal=advances;
  lostAdvance=true;await reveal.click();await page.locator('[data-action="canonical-events-refresh"]').waitFor();
  a.equal(advances,beforeReveal+1);
  await page.locator('[data-action="canonical-events-refresh"]').click();await reveal.waitFor();
  const middle=await post('read',{slot:3});a.equal(middle.revision,initialRookie.revision+1);a.equal(middle.game.inbox.rookie.entries[0].stage,1);a.equal(middle.game.inbox.rookie.entries[0].abilities,null);a.equal(middle.game.inbox.rookie.entries[0].appearanceSeed,null);a.equal(await finishRookie.isDisabled(),true);a.equal(advances,beforeReveal+1);
  const sealed=page.locator('[data-mystery-only="true"]');await sealed.waitFor();a.equal(await sealed.locator('svg[aria-hidden="true"]').count(),1);a.equal(await sealed.locator('svg').evaluate(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().width<=el.parentElement.clientWidth),true);a.doesNotMatch(await sealed.innerHTML(),/IMMORTAL|輪廻転生|99521/);a.equal(middle.game.inbox.rookie.entries[0].specialCategory,null);a.equal(middle.game.inbox.rookie.entries[0].pastLifeAppearance,null);
  await reveal.click();
  await page.locator('[data-kind="rookie-finish"]:enabled').waitFor();
  const finalRookie=await post('read',{slot:3});a.equal(finalRookie.revision,middle.revision+1);a.equal(finalRookie.game.inbox.rookie.entries[0].stage,2);a.ok(finalRookie.game.inbox.rookie.entries[0].abilities);a.equal(finalRookie.game.inbox.rookie.entries[0].specialCategory,'輪廻転生');a.equal(finalRookie.game.inbox.rookie.entries[0].pastLifeAppearance.baseCategory,'IMMORTAL');a.equal(await sealed.count(),0);
  await finishRookie.click();await page.getByText('現在対応する年間業務はありません。').waitFor();
  const finishedRookie=await post('read',{slot:3});a.equal(finishedRookie.revision,finalRookie.revision+1);a.equal(finishedRookie.game.inbox.rookie,null);a.ok(finishedRookie.game.club);
  console.log('PASS actual browser rookie stages, foreign command hold, lost response recovery without automatic replay');
  // Isolated fixture uses persisted injury and memorial evidence, not fake ad proof.
  clockOffset+=61000;
  await page.locator('[data-action="canonical-rewards-open"]').click();
  await page.locator('[data-action="canonical-achievements-open"]').waitFor();
  await page.locator('[data-action="canonical-rights-refresh"]').click();
  await page.getByText('永久広告スキップ：未保有または無効',{exact:true}).waitFor();
  await page.getByText('VIP：未保有または無効',{exact:true}).waitFor();
  await page.getByText('カード枠 · 3ポイント',{exact:true}).waitFor();
  await page.getByText('最高級カード · 50ポイント',{exact:true}).waitFor();
  const beforeReward=await post('read',{slot:3});
  a.equal(beforeReward.wallet.tickets,0);a.equal(beforeReward.wallet.points,0);
  const target=beforeReward.actions.find(x=>x.route==='medical');a.ok(target);
  const injured=beforeReward.game.club.roster.find(x=>x.injuryDays===8);a.ok(injured);
  await page.locator('[data-action="canonical-achievements-open"]').click();
  const claim=page.locator('article.panel').filter({has:page.getByRole('heading',{name:'試験用施設実績'})}).locator('[data-choice="point"]');
  await claim.waitFor();
  const artButton=page.locator('article.panel').filter({has:page.getByRole('heading',{name:'試験用施設実績'})}).locator('[data-action="canonical-achievements-art"]');
  const privateArt=page.locator('article.panel').filter({has:page.getByRole('heading',{name:'IMMORTAL輪廻転生 隔離試験'})}).locator('[data-action="canonical-achievements-art"]');
  await privateArt.click();await page.getByText('ゲーム内限定の記念作品です。共有・保存は提供しません。').waitFor();a.equal(await page.locator('[data-action="canonical-achievements-share"]').count(),0);a.equal(await page.evaluate(()=>window.fixtureShares.length),0);await page.locator('[data-action="canonical-achievements-art-close"]').click();
  await artButton.click();const art=page.locator('[data-canonical-memorial] img');
  a.equal(await page.locator('[data-action="canonical-achievements-frame"]').count(),0);
  await art.waitFor();await page.waitForFunction(()=>{const img=document.querySelector('[data-canonical-memorial] img');return img?.complete&&img.naturalWidth===1080&&img.naturalHeight===1350;});
  a.equal(await page.evaluate(()=>window.fixtureShares.length),0);
  await page.locator('[data-action="canonical-achievements-share"]').click();
  await page.waitForFunction(()=>window.fixtureShares.length===1);
  const shared=await page.evaluate(()=>window.fixtureShares[0]);a.match(shared.name,/^PENNANT_LAB_2027_memorial\.png$/);const png=Buffer.from(shared.data,'base64');a.equal(png.readUInt32BE(16),1080);a.equal(png.readUInt32BE(20),1350);
  const afterArt=await post('read',{slot:3});a.equal(afterArt.revision,beforeReward.revision);a.deepEqual(afterArt.wallet,beforeReward.wallet);
  await page.locator('[data-action="canonical-achievements-art-close"]').click();a.equal(await art.count(),0);
  page.once('dialog',d=>d.accept());await claim.click();
  await page.getByText('受け取りを確認しました：ポイント 1').waitFor();
  a.equal((await post('read',{slot:3})).wallet.points,1);
  await page.locator('[data-action="canonical-achievements-back"]').click();await page.locator('[data-action="canonical-ticket-exchange"]:enabled').waitFor();
  page.once('dialog',d=>d.accept());await page.locator('[data-action="canonical-ticket-exchange"]').click();await page.getByText('広告券への交換を確認しました。').waitFor();
  const exchanged=await post('read',{slot:3});a.equal(exchanged.wallet.points,0);a.equal(exchanged.wallet.tickets,1);a.equal(exchanged.revision,beforeReward.revision);
  const use=page.locator('[data-action="canonical-rewards-command"][data-id="'+target.operationId+'"]');
  lostSettle=true;page.once('dialog',d=>d.accept());await use.click();
  await page.getByText('報酬の確定状態を取得してください。自動再送は行いません。').waitFor();
  a.equal(reserves,1);a.equal(settles,1);
  await page.locator('[data-action="canonical-rewards-refresh"]').click();await page.locator('[data-action="canonical-achievements-open"]').waitFor();
  const afterReward=await post('read',{slot:3});a.equal(afterReward.revision,beforeReward.revision+1);a.equal(afterReward.wallet.tickets,0);a.equal(afterReward.game.club.roster.find(x=>x.id===injured.id).injuryDays,4);a.equal(afterReward.pending.length,0);a.equal(afterReward.actions.some(x=>x.operationId===target.operationId),false);a.equal(reserves,1);a.equal(settles,1);
  const medicalOrder=await post('order',{slot:3,operationId:target.operationId});a.equal(medicalOrder.order.status,'committed');a.equal(medicalOrder.order.result.before,8);a.equal(medicalOrder.order.result.after,4);
  console.log('PASS real HTTP memorial claim, ticket exchange and treatment, lost committed response without duplicate charge');
  // Isolated test-only point fixture, not a production grant route.
  const fixtureLedger=require('../server/account-ledger.cjs').openLedger(path.join(dir,'account.sqlite'));
  try{fixtureLedger.transact(owner,s=>{s.points=3;});}finally{fixtureLedger.close();}
  clockOffset+=61000;
  await page.locator('[data-action="canonical-rewards-refresh"]').click();
  const buyFrame=page.locator('[data-action="canonical-frame-exchange"]:enabled');await buyFrame.waitFor();
  page.once('dialog',d=>d.dismiss());await buyFrame.click();a.equal((await post('read',{slot:3})).wallet.points,3);
  page.once('dialog',d=>d.accept());await buyFrame.click();await page.getByText('記念カード枠への交換を確認しました。').waitFor();
  const ownedFrame=await post('read',{slot:3});a.equal(ownedFrame.wallet.points,0);a.ok(ownedFrame.wallet.owned.includes('frame'));a.equal(ownedFrame.revision,afterReward.revision);
  await page.locator('[data-action="canonical-achievements-open"]').click();await artButton.waitFor();await artButton.click();await art.waitFor();
  const plain=await art.getAttribute('src');await page.locator('[data-action="canonical-achievements-frame"][data-frame="foil"]').click();
  const foil=await art.getAttribute('src');a.notEqual(foil,plain);await page.locator('[data-action="canonical-achievements-share"]').click();await page.waitForFunction(()=>window.fixtureShares.length===2);
  a.equal((await page.evaluate(()=>window.fixtureShares[1].data)),foil.slice('data:image/png;base64,'.length));
  await page.locator('[data-action="canonical-achievements-frame"][data-frame="standard"]').click();a.equal(await art.getAttribute('src'),plain);
  await page.locator('[data-action="canonical-achievements-back"]').click();await page.locator('[data-action="canonical-rewards-back"]').waitFor();
  a.deepEqual((await post('read',{slot:3})).wallet,ownedFrame.wallet);
  // Profile is another account cosmetic, not a world mutation.
  const profileLedger=require('../server/account-ledger.cjs').openLedger(path.join(dir,'account.sqlite'));
  try{profileLedger.transact(owner,s=>{s.points=5;});}finally{profileLedger.close();}
  clockOffset+=61000;await page.locator('[data-action="canonical-rewards-refresh"]').click();
  const buyProfile=page.locator('[data-action="canonical-profile-exchange"]:enabled');await buyProfile.waitFor();
  page.once('dialog',d=>d.dismiss());await buyProfile.click();a.equal((await post('read',{slot:3})).wallet.points,5);
  page.once('dialog',d=>d.accept());await buyProfile.click();await page.getByText('GMプロフィールへの交換を確認しました。').waitFor();
  const profile=await post('read',{slot:3});a.equal(profile.wallet.points,0);a.ok(profile.wallet.owned.includes('profile'));a.equal(profile.revision,ownedFrame.revision);a.deepEqual(profile.game,ownedFrame.game);a.equal(await buyProfile.count(),0);
  const decorLedger=require('../server/account-ledger.cjs').openLedger(path.join(dir,'account.sqlite'));
  try{decorLedger.transact(owner,s=>{s.points=35;});}finally{decorLedger.close();}
  clockOffset+=61000;await page.locator('[data-action="canonical-rewards-refresh"]').click();
  for(const key of ['hq','museum']){const button=page.locator('[data-action="canonical-decor-exchange"][data-key="'+key+'"]:enabled');await button.waitFor();page.once('dialog',d=>d.accept());await button.click();await page.getByText('装飾品への交換を確認しました。').waitFor();await button.waitFor({state:'detached'});}
  const decor=await post('read',{slot:3});a.equal(decor.wallet.points,0);a.ok(decor.wallet.owned.includes('hq')&&decor.wallet.owned.includes('museum'));a.equal(decor.revision,profile.revision);a.deepEqual(decor.game,profile.game);
  await page.locator('[data-action="canonical-achievements-open"]').click();await page.locator('[data-canonical-museum]').waitFor();await page.locator('[data-canonical-museum-exhibit]').filter({has:page.getByRole('heading',{name:'試験用施設実績'})}).waitFor();await page.locator('[data-action="canonical-achievements-back"]').click();await page.locator('[data-action="canonical-rewards-back"]').waitFor();
  const extraLedger=require('../server/account-ledger.cjs').openLedger(path.join(dir,'account.sqlite'));
  try{extraLedger.transact(owner,s=>{s.points=90;});}finally{extraLedger.close();}
  clockOffset+=61000;await page.locator('[data-action="canonical-rewards-refresh"]').click();
  for(const key of ['uniform','emblem','deluxeCard']){const button=page.locator('[data-action="canonical-decor-exchange"][data-key="'+key+'"]:enabled');await button.waitFor();page.once('dialog',d=>d.accept());await button.click();await page.getByText('装飾品への交換を確認しました。').waitFor();await button.waitFor({state:'detached'});}
  const extra=await post('read',{slot:3});a.equal(extra.wallet.points,0);a.ok(['uniform','emblem','deluxeCard'].every(k=>extra.wallet.owned.includes(k)));a.deepEqual(extra.game,decor.game);a.equal(extra.revision,decor.revision);
  await page.locator('[data-action="canonical-achievements-open"]').click();await artButton.waitFor();await artButton.click();await art.waitFor();
  const standardExtra=await art.getAttribute('src');await page.locator('[data-action="canonical-achievements-frame"][data-frame="deluxe"]').click();const deluxe=await art.getAttribute('src');a.notEqual(deluxe,standardExtra);a.notEqual(deluxe,foil);
  await page.locator('[data-action="canonical-achievements-share"]').click();await page.waitForFunction(()=>window.fixtureShares.length===3);a.equal(await page.evaluate(()=>window.fixtureShares[2].data),deluxe.slice('data:image/png;base64,'.length));
  await page.locator('[data-action="canonical-achievements-back"]').click();await page.locator('[data-action="canonical-rewards-back"]').waitFor();
  const anniversaryLedger=require('../server/account-ledger.cjs').openLedger(path.join(dir,'account.sqlite'));
  try{anniversaryLedger.transact(owner,s=>{s.points=100;});}finally{anniversaryLedger.close();}
  clockOffset+=61000;await page.locator('[data-action="canonical-rewards-refresh"]').click();
  const anniversaryButton=page.locator('[data-action="canonical-decor-exchange"][data-key="anniversary"]:enabled');await anniversaryButton.waitFor();
  a.equal(await page.locator('[data-canonical-anniversary]').count(),0);
  page.once('dialog',d=>d.accept());await anniversaryButton.click();await page.getByText('装飾品への交換を確認しました。').waitFor();const anniversaryPreview=page.locator('[data-canonical-anniversary="preview"]');await anniversaryPreview.waitFor();a.ok((await anniversaryPreview.innerText()).includes('実績を獲得した表示ではありません'));
  const anniversary=await post('read',{slot:3});a.equal(anniversary.wallet.points,0);a.ok(anniversary.wallet.owned.includes('anniversary'));a.equal(anniversary.revision,extra.revision);a.deepEqual(anniversary.game,extra.game);
  await page.locator('[data-action="canonical-achievements-open"]').click();await artButton.waitFor();a.equal(await page.locator('[data-canonical-anniversary="record"]').count(),0);await page.locator('[data-action="canonical-achievements-back"]').click();await page.locator('[data-canonical-anniversary="preview"]').waitFor();
  // Return to the multiverse; deletion is hidden until an intentional gesture.
  await page.locator('[data-action="canonical-rewards-back"]').click();
  await page.locator('[data-action="canonical-events-back"]').click();
  await page.locator('[data-canonical-hq-theme]').waitFor();
  const profileCard=page.locator('[data-canonical-gm-profile]');await profileCard.waitFor();await profileCard.locator('summary').click();a.ok((await profileCard.innerText()).includes(profile.game.gmName));a.ok((await profileCard.innerText()).includes(profile.game.team.name));
  a.ok((await post('read',{slot:2})).wallet.owned.includes('profile'));
  const emblem=page.locator('[data-canonical-emblem]');await emblem.waitFor();await emblem.locator('summary').click();a.ok((await emblem.innerText()).includes(extra.game.team.name));
  await page.locator('[data-action="canonical-players"]').click();await page.locator('.player-row').first().click();const uniform=page.locator('[data-canonical-uniform]');await uniform.waitFor();await uniform.locator('summary').click();a.ok((await uniform.innerText()).includes(extra.game.team.name));
  await page.locator('[data-action="canonical-info-back"]').click();await page.locator('[data-action="canonical-info-back"]').click();
  await page.locator('[data-action="canonical-return"]').first().click();await slot(3).waitFor();
  const delete3=page.locator('[data-action="canonical-world-delete"][data-slot="3"]');
  a.equal(await delete3.isVisible(),false);
  await slot(3).scrollIntoViewIfNeeded();const box=await slot(3).boundingBox();a.ok(box);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await delete3.waitFor({timeout:5000});await page.mouse.up();
  a.equal(await slot(3).getAttribute('data-action'),'continue-slot');
  page.once('dialog',d=>d.dismiss());await delete3.click();a.equal(await slot(3).getAttribute('data-action'),'continue-slot');
  clockOffset+=61000;
  page.once('dialog',d=>d.accept());await delete3.click();await page.locator('button[data-slot="3"][data-action="new-slot"]').waitFor();
  a.equal(await slot(1).getAttribute('data-action'),'continue-slot');a.equal(await slot(2).getAttribute('data-action'),'continue-slot');a.equal(await delete3.count(),0);
  console.log('PASS long press, cancellation and confirmed server world deletion');
  // Separate recreated third world with ten synthetic historical seasons.
  clockOffset+=61000;fixtureDecade=true;
  await slot(3).click();await finish.waitFor();await finish.click();await page.getByText('サーバー保存の確認画面（開発試験）').waitFor();fixtureDecade=false;
  const beforeDecade=await post('read',{slot:3});a.equal(beforeDecade.game.inbox.decade,2036);
  await page.locator('[data-action="canonical-hq-open"]').click();await page.locator('[data-action="canonical-events-open"]').click();
  await page.locator('[data-action="canonical-decade-read"]').click();const book=page.locator('[data-canonical-decade]');await book.waitFor();
  await book.getByText('自球団の10年史',{exact:true}).click();await book.getByText('10回',{exact:true}).first().waitFor();
  a.equal((await post('read',{slot:3})).revision,beforeDecade.revision);
  await page.getByRole('button',{name:'節目の報告を確認する'}).click();
  await page.locator('[data-action="canonical-decade-read"]').waitFor({state:'detached'});
  const afterDecade=await post('read',{slot:3});a.equal(afterDecade.game.inbox.decade,null);a.equal(afterDecade.revision,beforeDecade.revision+1);
  await page.locator('[data-action="canonical-events-back"]').click();await page.locator('[data-action="canonical-reports-open"]').click();
  await page.locator('[data-action="canonical-archive-kind"][data-kind="decades"]').click();await book.waitFor();
  await book.getByText('年度別の優勝球団',{exact:true}).click();await book.getByText('2027年 · 日本一：',{exact:false}).waitFor();
  a.equal((await post('read',{slot:3})).revision,afterDecade.revision);
  console.log('PASS actual browser decade event, optional reading and later archive reread');
  a.deepEqual(errors,[]);console.log('PASS packaged canonical title, actual HTTP create/reopen, lost commit recovery, offline and local save isolation');
 }finally{await browser?.close();await runtime.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
