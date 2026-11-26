// Offline, restart-safe maintenance workflow. No HTTP path directly deletes
// databases. All external steps must be verified, idempotent provider adapters.
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const {openDeletionRequests}=require('./deletion-requests.cjs');
async function executeOfflineDeletion({dataDir,account,requestId,writersStopped,revokeIdentity,applyPurchaseRetention,reconcileBackups}={}){
 if(writersStopped!==true||typeof dataDir!=='string'||!path.isAbsolute(dataDir)||!/^[a-f0-9]{64}$/.test(account||'')||typeof requestId!=='string'||[revokeIdentity,applyPurchaseRetention,reconcileBackups].some(f=>typeof f!=='function'))throw Error('offline deletion authority required');
 const root=fs.realpathSync(dataDir),file=n=>{const f=path.join(root,n+'.sqlite');if(!fs.lstatSync(f).isFile())throw Error('invalid db');return f;};
 for(const n of ['deletion','account','saves','ad-proofs','purchases'])file(n);
 const deletion=openDeletionRequests(file('deletion'));
 const context=Object.freeze({account,requestId});
 const remove=(n,statements)=>{const db=new DatabaseSync(file(n));try{
  db.exec('PRAGMA secure_delete=ON; BEGIN IMMEDIATE');
  try{for(const sql of statements)db.prepare(sql).run(account);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
 }finally{db.close();}};
 try{
  const row=deletion.status(account);if(!row||row.requestId!==requestId)throw Error('deletion request mismatch');
  if(row.status==='completed')return row;
  if(row.status==='requested'&&!deletion.advance(account,'requested','processing'))throw Error('deletion changed');
  // Identity provider confirms token revocation/account treatment. False or
  // ambiguous outcomes leave the request in processing, never completed.
  if(await revokeIdentity(context)!==true)throw Error('identity deletion not verified');
  remove('account',['DELETE FROM account_ledger WHERE id=?']);
  remove('saves',['DELETE FROM transfer_history WHERE account=?','DELETE FROM transfers WHERE account=?']);
  remove('ad-proofs',['DELETE FROM ad_proofs WHERE account=?']);
  // Purchase evidence may have legally required retention. Adapter must
  // enforce the reviewed policy, prevent stale ownership reuse and attest.
  if(await applyPurchaseRetention({...context,purchaseDb:file('purchases')})!==true)throw Error('purchase retention unresolved');
  // Independently verify backup erasure/expiry and restoration tombstone policy.
  if(await reconcileBackups(context)!==true)throw Error('backup deletion unresolved');
  if(!deletion.advance(account,'processing','completed'))throw Error('deletion changed');
  return deletion.status(account);
 }finally{deletion.close();}
}
module.exports={executeOfflineDeletion};
