const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:8765/health.txt');
  await page.addScriptTag({content:'(()=>{const module={exports:{}};'+fs.readFileSync('mobile/src/save-record-store.cjs','utf8')+';window.createSaveRecordStore=module.exports.createSaveRecordStore;})();'});
  const result=await page.evaluate(async()=>{
   const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('pennant_lab_v04_saves',1);req.onupgradeneeded=()=>req.result.createObjectStore('slots',{keyPath:'slot'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
   const key=(...a)=>JSON.stringify(a),get=k=>new Promise((resolve,reject)=>{const tx=db.transaction('slots'),r=tx.objectStore('slots').get(k);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const put=v=>new Promise((resolve,reject)=>{const tx=db.transaction('slots','readwrite');tx.objectStore('slots').put(v);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
   const sha256=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
   let owner='a',active=false;
   const store=createSaveRecordStore({openDatabase:async()=>db,encode:async b=>({value:b[0]}),validate:d=>d.value!==0,sha256,canWrite:(a,s)=>a===owner&&!active&&s!==2});
   await put({slot:1,data:{guest:true}});
   await put({slot:key('account-v1','b',1),revision:4,data:{value:9}});
   const write=async (value,expectedRevision,slot=1)=>{const payload=new Uint8Array([value]);return store.replace({account:'a',slot,expectedRevision,sha:await sha256(payload),payload});};
   const first=await write(1,0);
   const pair=await Promise.all([write(2,1),write(3,1)]);
   const backup=await get(key('recovery-v1','a',1));
   const current=await get(key('account-v1','a',1));
   const fails=async f=>{try{await f();return false;}catch{return true;}};
   const invalid=await fails(()=>write(0,2)),protectedSlot=await fails(()=>write(4,0,2));
   active=true;const protectedGame=await fails(()=>write(4,2));active=false;
   owner='b';const switched=await fails(()=>write(4,2));
   const guest=await get(1),other=await get(key('account-v1','b',1));db.close();
   return {first,pair,backup,current,invalid,protectedSlot,protectedGame,switched,guest,other};
  });
  assert.equal(result.first.ok,true);assert.equal(result.pair.filter(x=>x.ok).length,1);
  assert.equal(result.backup.revision,1);assert.equal(result.backup.data.value,1);assert.equal(result.current.revision,2);
  assert.ok(result.invalid&&result.protectedSlot&&result.protectedGame&&result.switched);
  assert.equal(result.guest.data.guest,true);assert.equal(result.other.revision,4);assert.equal(result.other.data.value,9);
  console.log('PASS real Chromium IndexedDB CAS, recovery generation and account isolation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
