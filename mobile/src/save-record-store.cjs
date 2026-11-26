// Account-scoped records in the real game's IndexedDB slots store (keyPath: slot).
// Numeric legacy slots are untouched. No account is inferred from a guest save.
// Connect only after verified identity and an explicit legacy migration decision.
function createSaveRecordStore({openDatabase,storeName='slots',encode,validate,sha256,canWrite,maxBytes=256*1024*1024}={}){
 if([openDatabase,encode,validate,sha256,canWrite].some(f=>typeof f!=='function'))throw Error('save adapters required');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>256*1024*1024)throw Error('invalid limit');
 const key=(account,slot)=>{if(typeof account!=='string'||!account||account.length>200||![1,2,3].includes(slot))throw Error('invalid account/slot');return JSON.stringify(['account-v1',account,slot]);};
 const rev=r=>{const n=r?.revision??0;if(!Number.isSafeInteger(n)||n<0)throw Error('invalid stored revision');return n;};
 async function inspect({account,slot}){
  const k=key(account,slot),db=await openDatabase();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(storeName,'readonly'),req=tx.objectStore(storeName).get(k);let result;
   req.onsuccess=()=>{try{result={revision:rev(req.result),exists:!!req.result?.data};}catch(e){reject(e);tx.abort();}};
   tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||Error('read aborted'));
  });
 }
 async function replace({account,slot,expectedRevision,sha,payload}){
  const k=key(account,slot);
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER||!(payload instanceof Uint8Array)||!payload.length||payload.length>maxBytes||typeof sha!=='string'||!/^[0-9a-f]{64}$/.test(sha)||!canWrite(account,slot))throw Error('invalid or unavailable import');
  const bytes=new Uint8Array(payload);
  if(await sha256(bytes)!==sha)throw Error('save hash mismatch');
  // Codec must perform bounded decompression and full game validation before transaction.
  const data=await encode(bytes);
  if(!await validate(data))throw Error('invalid game save');
  const db=await openDatabase();
  if(!canWrite(account,slot))throw Error('session or game state changed');
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName),req=store.get(k);let result={ok:false},failure;
   req.onsuccess=()=>{
    try{
     if(!canWrite(account,slot)||rev(req.result)!==expectedRevision)return;
     const old=req.result;
     // Backup and replacement are one transaction. Retain latest prior generation.
     if(old?.data)store.put({...old,slot:JSON.stringify(['recovery-v1',account,slot])});
     store.put({slot:k,revision:expectedRevision+1,data,sha,updatedAt:Date.now()});
     result={ok:true,revision:expectedRevision+1};
    }catch(e){failure=e;tx.abort();}
   };
   tx.oncomplete=()=>resolve(result);
   tx.onabort=()=>reject(failure||tx.error||Error('replacement aborted'));
  });
 }
 return {inspect,replace};
}
module.exports={createSaveRecordStore};
