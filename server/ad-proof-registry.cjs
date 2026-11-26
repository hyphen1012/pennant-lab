// Durable reservation-bound SSV evidence. NOT a game reward applicator.
// Caller must authenticate the account and check a pending ad-mode ledger order
// before issue(), and recheck that order before accepting any proof for use.
const {DatabaseSync}=require('node:sqlite'),{randomBytes}=require('node:crypto');
function openAdProofRegistry(filename,{now=Date.now,ttlMs=30*60*1000}={}){
 if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>3600000||typeof now!=='function')throw Error('invalid ad proof config');
 const db=new DatabaseSync(filename);
 db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS ad_proofs(token TEXT PRIMARY KEY,account TEXT NOT NULL,operation TEXT NOT NULL,attempt INTEGER NOT NULL,unit TEXT NOT NULL,item TEXT NOT NULL,amount INTEGER NOT NULL,issued INTEGER NOT NULL,expires INTEGER NOT NULL,transaction_id TEXT UNIQUE,UNIQUE(account,operation,attempt))");
 const get=db.prepare('SELECT * FROM ad_proofs WHERE token=?'),byOrder=db.prepare('SELECT * FROM ad_proofs WHERE account=? AND operation=? AND attempt=?'),byTransaction=db.prepare('SELECT * FROM ad_proofs WHERE transaction_id=?');
 const insert=db.prepare('INSERT INTO ad_proofs(token,account,operation,attempt,unit,item,amount,issued,expires) VALUES(?,?,?,?,?,?,?,?,?)'),confirm=db.prepare('UPDATE ad_proofs SET transaction_id=? WHERE token=? AND transaction_id IS NULL');
 const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,200}$/.test(x),int=x=>Number.isSafeInteger(x)&&x>0;
 function atomic(f){db.exec('BEGIN IMMEDIATE');try{const r=f();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
 function issue({account,operationId,attempt,unit,item,amount}={}){
  const t=now();if(!id(account)||!id(operationId)||!int(attempt)||!/^\d{1,30}$/.test(unit||'')||!id(item)||!int(amount)||!int(t)||!int(t+ttlMs))throw Error('invalid reservation context');
  return atomic(()=>{
   const old=byOrder.get(account,operationId,attempt);
   if(old){if(old.unit!==unit||old.item!==item||old.amount!==amount||old.transaction_id||old.expires<=t)throw Error('reservation already used or expired');return old.token;}
   const token=randomBytes(32).toString('hex');insert.run(token,account,operationId,attempt,unit,item,amount,t,t+ttlMs);return token;
  });
 }
 function recordVerified(v){
  if(!v||!id(v.transactionId)||typeof v.customData!=='string'||! /^[0-9a-f]{64}$/.test(v.customData))throw Error('invalid signed context');
  return atomic(()=>{
   const row=get.get(v.customData),old=byTransaction.get(v.transactionId);
   if(!row||row.unit!==v.unit||row.item!==v.item||row.amount!==v.amount)throw Error('ad context mismatch');
   if(old){if(old.token!==row.token)throw Error('transaction replay on different reservation');return {duplicate:true};}
   const t=now();if(row.transaction_id||!int(t)||t<row.issued||t>=row.expires)throw Error('reservation expired or already verified');
   confirm.run(v.transactionId,row.token);return {duplicate:false};
  });
 }
 function hasProof({account,operationId,attempt}){const row=byOrder.get(account,operationId,attempt);return !!row?.transaction_id;}
 return {issue,recordVerified,hasProof,close:()=>db.close()};
}
module.exports={openAdProofRegistry};
