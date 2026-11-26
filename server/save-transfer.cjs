// Account-scoped save transfer reference. Not a cloud sync deployment.
// Payload bytes are opaque gameplay data, NEVER payment/achievement authority.
// Explicit authenticated import with compare-and-swap; no silent overwrites.
const {DatabaseSync}=require('node:sqlite'),{createHash}=require('node:crypto');
const digest=b=>createHash('sha256').update(b).digest('hex');
const id=v=>typeof v==='string'&&v.length>0&&v.length<=200;
const rev=v=>Number.isSafeInteger(v)&&v>=0;
function openSaveTransfer(filename,{maxBytes=256*1024*1024,retainGenerations=3,now=Date.now}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>256*1024*1024)throw Error('invalid size limit');
 if(typeof now!=='function'||!Number.isSafeInteger(retainGenerations)||retainGenerations<1||retainGenerations>10)throw Error('invalid backup retention');
 const db=new DatabaseSync(filename);
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS transfers(account TEXT NOT NULL, slot INTEGER NOT NULL, revision INTEGER NOT NULL, sha TEXT NOT NULL, payload BLOB NOT NULL, PRIMARY KEY(account,slot)); CREATE TABLE IF NOT EXISTS transfer_history(account TEXT NOT NULL,slot INTEGER NOT NULL,revision INTEGER NOT NULL,sha TEXT NOT NULL,payload BLOB NOT NULL,PRIMARY KEY(account,slot,revision))');
 // Add nullable timestamps without fabricating historical dates for legacy rows.
 db.exec('BEGIN IMMEDIATE');
 try{for(const table of ['transfers','transfer_history']){if(!db.prepare('PRAGMA table_info('+table+')').all().some(c=>c.name==='updated_at'))db.exec('ALTER TABLE '+table+' ADD COLUMN updated_at INTEGER');}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');db.close();throw e;}
 const find=db.prepare('SELECT revision,sha,payload FROM transfers WHERE account=? AND slot=?');
 const meta=db.prepare('SELECT slot,revision,sha,length(payload) AS bytes,updated_at AS updatedAt FROM transfers WHERE account=? ORDER BY slot');
 const write=db.prepare('INSERT INTO transfers(account,slot,revision,sha,payload,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(account,slot) DO UPDATE SET revision=excluded.revision,sha=excluded.sha,payload=excluded.payload,updated_at=excluded.updated_at');
 const archive=db.prepare('INSERT INTO transfer_history(account,slot,revision,sha,payload,updated_at) SELECT account,slot,revision,sha,payload,updated_at FROM transfers WHERE account=? AND slot=?');
 const prune=db.prepare('DELETE FROM transfer_history WHERE account=? AND slot=? AND revision NOT IN (SELECT revision FROM transfer_history WHERE account=? AND slot=? ORDER BY revision DESC LIMIT ?)');
 const history=db.prepare('SELECT revision,sha,length(payload) AS bytes,updated_at AS updatedAt FROM transfer_history WHERE account=? AND slot=? ORDER BY revision DESC');
 const historical=db.prepare('SELECT revision,sha,payload FROM transfer_history WHERE account=? AND slot=? AND revision=?');
 function key(account,slot){if(!id(account)||![1,2,3].includes(slot))throw Error('invalid save destination');}
 function put(account,slot,expectedRevision,payload,sha){
  key(account,slot);if(!rev(expectedRevision)||!Buffer.isBuffer(payload)||!payload.length||payload.length>maxBytes||typeof sha!=='string'||digest(payload)!==sha)throw Error('invalid save payload');
  db.exec('BEGIN IMMEDIATE');
  try{
   const old=find.get(account,slot),revision=old?.revision??0;
   if(revision!==expectedRevision)throw Error('save revision conflict');
   if(!Number.isSafeInteger(revision+1))throw Error('revision exhausted');
   if(old&&digest(Buffer.from(old.payload))!==old.sha)throw Error('corrupt current save');
   if(old&&old.sha===sha){db.exec('COMMIT');return {revision,sha,unchanged:true};}
   if(old){archive.run(account,slot);prune.run(account,slot,account,slot,retainGenerations);}
   const at=now();if(!Number.isSafeInteger(at)||at<=0)throw Error('invalid server time');
   write.run(account,slot,revision+1,sha,payload,at);db.exec('COMMIT');return {revision:revision+1,sha,unchanged:false};
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 function backup(account,slot,revision){key(account,slot);if(!rev(revision)||revision<1)throw Error('invalid backup revision');const row=historical.get(account,slot,revision);if(!row)return null;const payload=Buffer.from(row.payload);if(digest(payload)!==row.sha)throw Error('corrupt backup');return {revision:row.revision,sha:row.sha,payload};}
 return {put,maxBytes,backup,history:(account,slot)=>{key(account,slot);return history.all(account,slot);},list:account=>{if(!id(account))throw Error('invalid account');return meta.all(account);},get:(account,slot)=>{key(account,slot);const row=find.get(account,slot);if(!row)return null;const payload=Buffer.from(row.payload);if(digest(payload)!==row.sha)throw Error('corrupt stored save');return {revision:row.revision,sha:row.sha,payload};},close:()=>db.close()};
}
function createSaveTransferService({storage,authenticate,validateSave}={}){
 if(!storage||typeof authenticate!=='function'||typeof validateSave!=='function')throw Error('trusted adapters required');
 async function owner(token){const a=await authenticate(token);if(a?.authenticated!==true||!id(a.account))throw Error('unauthorized');return a.account;}
 return {
  list:async token=>storage.list(await owner(token)),
  download:async(token,slot)=>storage.get(await owner(token),slot),
  history:async(token,slot)=>storage.history(await owner(token),slot),
  downloadBackup:async(token,slot,revision)=>storage.backup(await owner(token),slot,revision),
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
