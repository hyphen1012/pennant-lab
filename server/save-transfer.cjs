// Account-scoped save transfer reference. Not a cloud sync deployment.
// Payload bytes are opaque gameplay data, NEVER payment/achievement authority.
// Explicit authenticated import with compare-and-swap; no silent overwrites.
const {DatabaseSync}=require('node:sqlite'),{createHash}=require('node:crypto');
const digest=b=>createHash('sha256').update(b).digest('hex');
const id=v=>typeof v==='string'&&v.length>0&&v.length<=200;
const rev=v=>Number.isSafeInteger(v)&&v>=0;
function openSaveTransfer(filename,{maxBytes=256*1024*1024}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>256*1024*1024)throw Error('invalid size limit');
 const db=new DatabaseSync(filename);
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS transfers(account TEXT NOT NULL, slot INTEGER NOT NULL, revision INTEGER NOT NULL, sha TEXT NOT NULL, payload BLOB NOT NULL, PRIMARY KEY(account,slot))');
 const find=db.prepare('SELECT revision,sha,payload FROM transfers WHERE account=? AND slot=?');
 const meta=db.prepare('SELECT slot,revision,sha,length(payload) AS bytes FROM transfers WHERE account=? ORDER BY slot');
 const write=db.prepare('INSERT INTO transfers(account,slot,revision,sha,payload) VALUES(?,?,?,?,?) ON CONFLICT(account,slot) DO UPDATE SET revision=excluded.revision,sha=excluded.sha,payload=excluded.payload');
 function key(account,slot){if(!id(account)||![1,2,3].includes(slot))throw Error('invalid save destination');}
 function put(account,slot,expectedRevision,payload,sha){
  key(account,slot);if(!rev(expectedRevision)||!Buffer.isBuffer(payload)||!payload.length||payload.length>maxBytes||typeof sha!=='string'||digest(payload)!==sha)throw Error('invalid save payload');
  db.exec('BEGIN IMMEDIATE');
  try{
   const old=find.get(account,slot),revision=old?.revision??0;
   if(revision!==expectedRevision)throw Error('save revision conflict');
   if(!Number.isSafeInteger(revision+1))throw Error('revision exhausted');
   if(old&&old.sha===sha){db.exec('COMMIT');return {revision,sha,unchanged:true};}
   write.run(account,slot,revision+1,sha,payload);db.exec('COMMIT');return {revision:revision+1,sha,unchanged:false};
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 return {put,maxBytes,list:account=>{if(!id(account))throw Error('invalid account');return meta.all(account);},get:(account,slot)=>{key(account,slot);const row=find.get(account,slot);if(!row)return null;const payload=Buffer.from(row.payload);if(digest(payload)!==row.sha)throw Error('corrupt stored save');return {revision:row.revision,sha:row.sha,payload};},close:()=>db.close()};
}
function createSaveTransferService({storage,authenticate,validateSave}={}){
 if(!storage||typeof authenticate!=='function'||typeof validateSave!=='function')throw Error('trusted adapters required');
 async function owner(token){const a=await authenticate(token);if(a?.authenticated!==true||!id(a.account))throw Error('unauthorized');return a.account;}
 return {
  list:async token=>storage.list(await owner(token)),
  download:async(token,slot)=>storage.get(await owner(token),slot),
  importSave:async(token,{slot,expectedRevision,payload,sha,confirmed}={})=>{
   const account=await owner(token);
   if(confirmed!==true||![1,2,3].includes(slot)||!rev(expectedRevision)||!Buffer.isBuffer(payload)||!payload.length||payload.length>storage.maxBytes||digest(payload)!==sha)throw Error('explicit valid import required');
   const copy=Buffer.from(payload);
   if(await validateSave(Buffer.from(copy))!==true)throw Error('incompatible save');
   return storage.put(account,slot,expectedRevision,copy,sha);
  }
 };
}
module.exports={openSaveTransfer,createSaveTransferService,digest};
