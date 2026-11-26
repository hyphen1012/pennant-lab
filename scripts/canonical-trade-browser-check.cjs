// Real packaged UI + HTTP authority; isolated trade fixture, no production settings.
'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright'),esbuild=require('esbuild');
const {createServiceRuntime}=require('../server/service-runtime.cjs'),{createHeadlessEngine}=require('../server/headless-engine.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pl-trade-browser-')),owner='a'.repeat(64),deny=async()=>null,engine=createHeadlessEngine();
 const fixtureEngine={...engine,newWorld(command){
   let w=engine.newWorld(command);
   for(let i=0;i<25&&!w.games.length;i++)w=engine.advance(w,{step:1});
   a.ok(w.games.length);w.pendingReview=null;w.pendingMonth=null;w.pendingMilestoneIds=[];w.pendingRareIds=[];w.pendingEvent=null;
   for(const t of w.teams)t.cash=300; // isolated deterministic quote fixture only
   a.equal(engine.view(w).club.tradeAvailable,true);return w;
 }};
 const runtime=createServiceRuntime({dataDir:dir,authenticate:async t=>t==='a'?{authenticated:true,account:owner}:{authenticated:false},verifyRecentReauth:deny,verifyReceipt:deny,verifyCurrent:deny,verifyNotification:deny,verifyEvent:deny,verifyAction:deny,verifyCompletion:deny,canonicalEngine:fixtureEngine,units:{android:{unit:'123',item:'ticket',amount:1}},origins:[]});
 let browser;
 try{
   await new Promise(ok=>runtime.server.listen(0,'127.0.0.1',ok));
   const base='http://127.0.0.1:'+runtime.server.address().port;
   const post=async(route,body)=>{const r=await fetch(base+'/v1/game/'+route,{method:'POST',headers:{Authorization:'Bearer a','Content-Type':'application/json'},body:JSON.stringify(body)});a.equal(r.status,200,route);return r.json();};
   await post('create',{slot:1,command:{team:0}});
   const before=await post('read',{slot:1}),clubs=before.game.club.standings.filter(x=>x.id!==before.game.team.id),other=clubs[0];
   const pageFor=command=>post('trade-page',{slot:1,world:before.world,revision:before.revision,command});
   const pool=(await pageFor({mode:'list',clubId:other.id})).page;
   const give=pool.out.find(p=>pool.in.some(q=>q.pos===p.pos));a.ok(give);const take=pool.in.find(p=>p.pos===give.pos);
   const terms={clubId:other.id,out:[give.id],in:[take.id],fee:20};
   const expected=(await pageFor({mode:'quote',...terms})).page;a.equal(expected.ok,true,expected.reason);
   const bridge=esbuild.buildSync({stdin:{contents:[
     "const {createAccountClient}=require('./mobile/src/account-client.cjs');",
     "const {createCanonicalGameSession}=require('./mobile/src/canonical-game-session.cjs');",
     "const owner='a'.repeat(64);let ctx=null;",
     "const client=createAccountClient({baseUrl:'https://fixture.invalid',fetcher:(u,o)=>fetch('/canonical-fixture'+new URL(u).pathname,o)});",
     "const session=createCanonicalGameSession({client,online:()=>true});",
     "window.PennantNative={accountRequired:true,ready:()=>true,check:async()=>true,canonicalGame:session,get accountContext(){return ctx;},accountReady:async()=>{ctx={account:owner,isCurrent:()=>true,openCloud:async()=>{throw Error('legacy forbidden');}};session.setSession({account:owner,token:'a'});},logoutAccount:()=>{throw Error('not in fixture');}};"
   ].join('\n'),resolveDir:process.cwd()},bundle:true,write:false,platform:'browser'}).outputFiles[0].text;
   browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));let advances=0,lose=false;
   await page.route('**/native-runtime.js',r=>r.fulfill({contentType:'application/javascript',body:bridge}));
   await page.route('**/*.mp4',r=>r.abort());
   await page.route('**/canonical-fixture/v1/**',async r=>{
     const q=r.request(),p=new URL(q.url()).pathname.replace('/canonical-fixture','');
     const response=await fetch(base+p,{method:'POST',headers:{Authorization:q.headers().authorization,'Content-Type':'application/json'},body:q.postData()});
     const body=await response.text();if(p.endsWith('/advance')){advances++;if(lose){lose=false;a.equal(response.status,200);await r.abort();return;}}
     a.notEqual(response.status,429);await r.fulfill({status:response.status,contentType:'application/json',body});
   });
   await page.goto('http://127.0.0.1:8765/mobile/www/');
   const start=page.locator('[data-action="launch-start"]');await start.waitFor();await page.waitForFunction(()=>!document.body.classList.contains('official-startup-active'));await start.click();
   await page.locator('button.save-slot[data-slot="1"]').click();await page.locator('[data-action="canonical-hq-open"]').click();await page.locator('.hero-stadium').waitFor();
   await page.locator('[data-action="canonical-ops-open"][data-kind="trade"]').click();
   const club=page.locator('#canonical-trade-club'),load=page.locator('[data-action="canonical-trade-load"]'),commit=page.locator('[data-action="canonical-trade-commit"]'),review=page.locator('[data-action="canonical-trade-review"]'),fee=page.locator('#canonical-trade-fee');
   const out=page.locator('.canonical-trade-pick[data-side="out"]'),inc=page.locator('.canonical-trade-pick[data-side="in"]');
   const enter=async()=>{await load.click();await out.first().waitFor();a.equal(await out.count(),3);a.equal(await inc.count(),3);await out.first().selectOption(String(give.id));await inc.first().selectOption(String(take.id));await fee.fill('20');await review.click();await commit.waitFor();};
   await club.selectOption(String(other.id));await enter();
   a.equal((await post('read',{slot:1})).revision,before.revision);a.equal(advances,0);
   await fee.fill('19.99');a.equal(await commit.count(),0);await page.getByText('条件を変更しました。もう一度条件を確認してください。').waitFor();
   await fee.fill('20');await review.click();await commit.waitFor();
   await club.selectOption(String(clubs[1].id));a.equal(await out.count(),0);a.equal(await commit.count(),0);
   await club.selectOption(String(other.id));await enter();
   page.once('dialog',d=>d.dismiss());await commit.click();a.equal(advances,0);a.equal((await post('read',{slot:1})).revision,before.revision);
   lose=true;page.once('dialog',d=>d.accept());await commit.click();
   await page.locator('[data-action="canonical-ops-refresh"]').waitFor();a.equal(advances,1);a.equal(await commit.count(),0);
   await page.locator('[data-action="canonical-ops-refresh"]').click();await load.waitFor();
   const after=await post('read',{slot:1});a.equal(after.revision,before.revision+1);a.equal(after.game.team.cash,before.game.team.cash-20);
   a.ok(!after.game.club.roster.some(p=>p.id===give.id));a.ok(after.game.club.roster.some(p=>p.id===take.id));a.equal(advances,1);a.deepEqual(errors,[]);
   console.log('PASS real trade quote, invalidation, cancel, committed response loss, single roster and cash transfer');
 }finally{await browser?.close();await runtime.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
