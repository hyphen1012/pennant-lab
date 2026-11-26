// Browser integration: real packaged title/portal/setup, real engine + HTTP,
// test-only native auth bridge. No provider credentials or production service.
const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright'),esbuild=require('esbuild');
const {createServiceRuntime}=require('../server/service-runtime.cjs'),{createHeadlessEngine}=require('../server/headless-engine.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pl-title-browser-')),owner='a'.repeat(64),deny=async()=>null;
 const runtime=createServiceRuntime({dataDir:dir,authenticate:async t=>t==='a'?{authenticated:true,account:owner}:{authenticated:false},verifyRecentReauth:deny,verifyReceipt:deny,verifyCurrent:deny,verifyNotification:deny,verifyEvent:deny,verifyAction:deny,verifyCompletion:deny,canonicalEngine:createHeadlessEngine(),units:{android:{unit:'123',item:'ticket',amount:1}},origins:[]});
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
  let creates=0,lost=false,failSlots=false,lostAdvance=false,advances=0;
  await page.route('**/canonical-fixture/v1/**',async r=>{
   const q=r.request(),p=new URL(q.url()).pathname.replace('/canonical-fixture','');
   if(p.endsWith('/slots')&&failSlots){await r.abort();return;}
   const response=await fetch(base+p,{method:'POST',headers:{Authorization:q.headers().authorization,'Content-Type':'application/json'},body:q.postData()});
   const body=await response.text();
   if(p.endsWith('/create')){creates++;if(lost){lost=false;a.equal(response.status,200);await r.abort();return;}}
   if(p.endsWith('/advance')){advances++;if(lostAdvance){lostAdvance=false;a.equal(response.status,200);await r.abort();return;}}
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
  await page.locator('[data-action="canonical-return"]').first().click();await slot(1).waitFor();
  a.equal(await slot(1).getAttribute('data-action'),'continue-slot');
  await slot(2).click();await page.getByText('サーバー保存の確認画面（開発試験）').waitFor();
  a.equal((await post('read',{slot:2})).world,seeded.world);
  await page.locator('[data-action="canonical-return"]').first().click();await slot(3).waitFor();
  await slot(3).click();await finish.waitFor();lost=true;await finish.click();
  await page.locator('button[data-slot="3"][data-action="continue-slot"]').waitFor();
  a.equal(creates,2);a.equal((await post('read',{slot:3})).revision,1);
  failSlots=true;await page.locator('[data-action="canonical-retry"]').click();
  await page.getByText('サーバーのセーブ一覧を確認できません。データは変更されていません。').waitFor();
  a.equal(await page.locator('button.save-slot').count(),0);
  failSlots=false;await page.locator('[data-action="canonical-retry"]').click();await slot(1).waitFor();
  await page.evaluate(()=>window.fixtureOnline(false));await page.getByText('サーバーのセーブ一覧を確認できません。データは変更されていません。').waitFor();
  await page.evaluate(()=>window.fixtureOnline(true));await page.locator('[data-action="canonical-retry"]').click();await slot(1).waitFor();
  a.deepEqual(await page.evaluate(async()=>[localStorage.getItem('pennant_lab_v04_slot_1'),localStorage.getItem('pennant_lab_account_v1_'+'a'.repeat(64)+'_slot_1'),(await indexedDB.databases()).some(d=>d.name==='pennant_lab_v04_saves')]),['guest-sentinel','account-sentinel',false]);
  a.deepEqual(errors,[]);console.log('PASS packaged canonical title, actual HTTP create/reopen, lost commit recovery, offline and local save isolation');
 }finally{await browser?.close();await runtime.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
