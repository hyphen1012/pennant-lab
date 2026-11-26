// Real game title, account namespace and dialog with a fixture transport only.
// No production identity, payment, or advertising authority is simulated in-app.
const {chromium}=require('playwright'),{buildSync}=require('esbuild'),assert=require('node:assert/strict');
const fixture=buildSync({stdin:{contents:`
 const {createAccountBootstrap}=require('./mobile/src/account-bootstrap.cjs');
 const {exportGameRecord}=require('./mobile/src/save-gzip-codec.cjs');
 const read=key=>new Promise((resolve,reject)=>{const req=indexedDB.open('pennant_lab_v04_saves',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('slots'),r=tx.objectStore('slots').get(key);let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=()=>{db.close();reject(tx.error);};};req.onerror=()=>reject(req.error);});
 const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
 window.readFixtureRecord=read;
 let bootstrap=null;
 const owner=(sessionStorage.getItem('fixture-account')||'a').repeat(64);
 const rows=new Map(),history=new Map();
 const json=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
 const fetcher=async(url,options)=>{
  if(options.headers.Authorization!=='Bearer fixture-token')return new Response(null,{status:403});
  const p=new URL(url).pathname;if(p==='/v1/identity')return json({authenticated:true,account:owner});
  if(p==='/v1/saves')return json([...rows].map(([slot,r])=>({slot,revision:r.revision,sha:r.sha,bytes:r.payload.length,updatedAt:r.updatedAt})));
  const m=/^\\/v1\\/saves\\/([123])(?:\\/history(?:\\/([0-9]+))?)?$/.exec(p);if(!m)return new Response(null,{status:404});
  const slot=Number(m[1]),r=rows.get(slot),old=history.get(slot)||[];
  if(options.method==='PUT'){
   const rev=Number(options.headers['X-Save-Revision']);if(rev!==(r?.revision||0))return new Response(null,{status:409});
   const payload=new Uint8Array(options.body),digest=await sha(payload);
   if(digest!==options.headers['X-Save-SHA256'])return new Response(null,{status:400});
   if(r)history.set(slot,[r,...old].slice(0,3));
   rows.set(slot,{revision:rev+1,sha:digest,payload,updatedAt:Date.now()});return json({revision:rev+1,sha:digest,unchanged:false});
  }
  if(p.endsWith('/history'))return json(old.map(x=>({revision:x.revision,sha:x.sha,bytes:x.payload.length,updatedAt:x.updatedAt})));
  const x=m[2]?old.find(x=>x.revision===Number(m[2])):r;if(!x)return new Response(null,{status:404});
  return new Response(x.payload,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(x.payload.length),'X-Save-Revision':String(x.revision),'X-Save-SHA256':x.sha}});
 };
 window.PennantNative={accountRequired:true,ready:()=>true,check:async()=>true,get accountContext(){return bootstrap?.context()??null;},async accountReady(){
  const guest=await read(1),exported=await exportGameRecord(guest.data),payload=exported.bytes;
  rows.set(1,{revision:1,sha:await sha(payload),payload,updatedAt:1700000000000});
  bootstrap=createAccountBootstrap({baseUrl:'https://fixture.invalid',provider:{getAccessToken:async()=>'fixture-token'},fetcher,online:()=>true});
  await bootstrap.start();
 }};
 `,resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife'}).outputFiles[0].text;
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),url='http://127.0.0.1:8765/';
  await page.route('**/PARALAB_GAMES_startup_v8_SFX_reverb.mp4',r=>r.abort());
  await page.goto(url);
  await page.locator('[data-action="launch-start"]').waitFor();
  await page.waitForFunction(()=>!!localStorage.getItem('pennant_lab_v04_slot_1'));
  const guestPreview=await page.evaluate(()=>localStorage.getItem('pennant_lab_v04_slot_1'));
  await page.addInitScript({content:fixture});await page.reload();
  await page.locator('[data-action="launch-start"]').click();
  await page.locator('[data-cloud-save-open]').waitFor();
  assert.equal(await page.evaluate(async()=>await readFixtureRecord(JSON.stringify(['account-v1','a'.repeat(64),1]))),undefined,'no implicit guest migration');
  const dialog=page.locator('[data-cloud-save-dialog]');
  await page.locator('[data-cloud-save-open]').click();await dialog.getByText('最新の一覧を取得しました。').waitFor();
  const section=n=>dialog.locator('section').filter({has:page.getByRole('heading',{name:'DATA 0'+n,exact:true})});
  async function stage(){await section(1).getByRole('button',{name:'端末へ取り込む'}).click();await dialog.getByLabel('端末の取込先').selectOption('3');await dialog.getByRole('button',{name:'内容を取得して確認'}).click();await dialog.getByRole('heading',{name:'端末のデータを置き換えますか？'}).waitFor();}
  await stage();await dialog.getByRole('button',{name:'キャンセル',exact:true}).click();await dialog.getByText('最新の一覧を取得しました。').waitFor();
  const key=JSON.stringify(['account-v1','a'.repeat(64),3]);assert.equal(await page.evaluate(k=>readFixtureRecord(k),key),undefined);
  await stage();await dialog.getByRole('button',{name:'内容を確認して実行する'}).click();await dialog.getByText('取り込みが完了しました。').waitFor();
  assert.equal(await page.evaluate(async k=>(await readFixtureRecord(k)).revision,key),1);
  await section(3).getByRole('button',{name:'端末からアップロード'}).click();await dialog.getByRole('heading',{name:'クラウドへ保存しますか？'}).waitFor();
  await dialog.getByRole('button',{name:'内容を確認して実行する'}).click();await dialog.getByText('クラウドに保存しました。').waitFor();
  await stage();await dialog.getByRole('button',{name:'内容を確認して実行する'}).click();await dialog.getByText('取り込みが完了しました。').waitFor();
  await section(3).getByRole('button',{name:'端末の直前世代を復元'}).click();await dialog.getByRole('heading',{name:'端末の直前世代に戻しますか？'}).waitFor();
  await dialog.getByRole('button',{name:'内容を確認して実行する'}).click();await dialog.getByText('端末の直前世代を復元しました。').waitFor();
  await dialog.getByRole('button',{name:'閉じる',exact:true}).click();await page.locator('[data-cloud-save-open]').waitFor();
  assert.equal(await page.evaluate(async k=>(await readFixtureRecord(k)).revision,key),3);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pennant_lab_v04_slot_1')),guestPreview);
  assert.equal(await page.evaluate(async()=>await readFixtureRecord(JSON.stringify(['account-v1','a'.repeat(64),2]))),undefined);
  await page.locator('[data-slot-group="3"] .save-slot').click();await page.locator('[data-action="pick-setup-team"]').first().waitFor();
  await page.locator('[data-action="finish-setup"]').click();
  await page.waitForFunction(async k=>(await readFixtureRecord(k))?.revision>=4,key);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pennant_lab_v04_slot_1')),guestPreview);
  await page.evaluate(()=>sessionStorage.setItem('fixture-account','b'));await page.reload();
  await page.locator('[data-action="launch-start"]').click();await page.locator('[data-cloud-save-open]').waitFor();
  assert.equal(await page.locator('.save-slot.has-game').count(),0);
  assert.equal(await page.evaluate(async()=>await readFixtureRecord(JSON.stringify(['account-v1','b'.repeat(64),3]))),undefined);
  console.log('PASS real title cloud dialog, explicit upload/import/cancel/restore, scoped gameplay writes and account isolation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
