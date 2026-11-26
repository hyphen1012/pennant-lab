// Browser integration: real packaged title/portal/setup, real engine + HTTP,
// test-only native auth bridge. No provider credentials or production service.
const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright'),esbuild=require('esbuild');
const {createServiceRuntime}=require('../server/service-runtime.cjs'),{createHeadlessEngine}=require('../server/headless-engine.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pl-title-browser-')),owner='a'.repeat(64),deny=async()=>null;
 let clockOffset=0,fixtureRookie=false;
 const engine=createHeadlessEngine();
 // Isolated third-slot fixture, persisted through the real HTTP authority.
 const fixtureEngine={...engine,newWorld(command){const w=engine.newWorld(command);if(fixtureRookie){const p=w.players.find(p=>p.teamId===w.selectedId&&!p.retired);a.ok(p);w.pendingDraftReveal={year:w.year-1,entries:[{id:p.id,revealStage:0}]};const injured=w.players.find(q=>q.id!==p.id&&q.teamId===w.selectedId&&!q.retired);a.ok(injured);injured.injury={date:w.year+'-03-01',daysLeft:8,label:'試験用負傷'};w.memorialHistory={...(w.memorialHistory||{}),'fixture:facility':{id:'fixture:facility',year:w.year,teamId:w.selectedId,kind:'facility',title:'試験用施設実績',body:'隔離試験用'}};}return w;}};
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
  await start.click();
  const slot=n=>page.locator('button.save-slot[data-slot="'+n+'"]');
  await slot(2).waitFor();a.equal(await page.locator('button.save-slot').count(),3);
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
  a.equal(initialRookie.game.inbox.rookie.entries[0].appearanceSeed,null);
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
  await reveal.click();
  await page.locator('[data-kind="rookie-finish"]:enabled').waitFor();
  const finalRookie=await post('read',{slot:3});a.equal(finalRookie.revision,middle.revision+1);a.equal(finalRookie.game.inbox.rookie.entries[0].stage,2);a.ok(finalRookie.game.inbox.rookie.entries[0].abilities);
  await finishRookie.click();await page.getByText('現在対応する年間業務はありません。').waitFor();
  const finishedRookie=await post('read',{slot:3});a.equal(finishedRookie.revision,finalRookie.revision+1);a.equal(finishedRookie.game.inbox.rookie,null);a.ok(finishedRookie.game.club);
  console.log('PASS actual browser rookie stages, foreign command hold, lost response recovery without automatic replay');
  // Isolated fixture uses persisted injury and memorial evidence, not fake ad proof.
  clockOffset+=61000;
  await page.locator('[data-action="canonical-rewards-open"]').click();
  await page.locator('[data-action="canonical-achievements-open"]').waitFor();
  const beforeReward=await post('read',{slot:3});
  a.equal(beforeReward.wallet.tickets,0);a.equal(beforeReward.wallet.points,0);
  const target=beforeReward.actions.find(x=>x.route==='medical');a.ok(target);
  const injured=beforeReward.game.club.roster.find(x=>x.injuryDays===8);a.ok(injured);
  await page.locator('[data-action="canonical-achievements-open"]').click();
  const claim=page.locator('article.panel').filter({has:page.getByRole('heading',{name:'試験用施設実績'})}).locator('[data-choice="point"]');
  await claim.waitFor();page.once('dialog',d=>d.accept());await claim.click();
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
  // Return to the multiverse; deletion is hidden until an intentional gesture.
  await page.locator('[data-action="canonical-rewards-back"]').click();
  await page.locator('[data-action="canonical-events-back"]').click();
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
  a.deepEqual(errors,[]);console.log('PASS packaged canonical title, actual HTTP create/reopen, lost commit recovery, offline and local save isolation');
 }finally{await browser?.close();await runtime.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
