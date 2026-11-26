// Reference purchase registry. Store verification MUST be performed by trusted
// adapters; no SDK success, local flags, or raw client transaction IDs suffice.
const {DatabaseSync}=require('node:sqlite');
const {MAX_AGE_MS}=require('./purchase-rights.cjs');
const id=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\x00-\x1f]/.test(v);
const int=v=>Number.isSafeInteger(v)&&v>=0;
function openPurchaseRegistry(filename,{tokenKey=null}={}){
 const db=new DatabaseSync(filename);
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS purchases (store TEXT NOT NULL, chain TEXT NOT NULL, account TEXT NOT NULL, product TEXT NOT NULL, revision INTEGER NOT NULL, status TEXT NOT NULL, expires INTEGER, PRIMARY KEY(store,chain)); CREATE INDEX IF NOT EXISTS purchase_account ON purchases(account)');
 // Immutable Google replacement fence. Keep this with purchase ownership
 // evidence through backup and the reviewed legal-retention process.
 db.exec('CREATE TABLE IF NOT EXISTS google_supersession (old_chain TEXT PRIMARY KEY, new_chain TEXT UNIQUE NOT NULL, account TEXT NOT NULL)');
 const predecessor=db.prepare('SELECT * FROM google_supersession WHERE new_chain=?'),successor=db.prepare('SELECT * FROM google_supersession WHERE old_chain=?'),link=db.prepare('INSERT INTO google_supersession VALUES(?,?,?)');
 const isSuperseded=(store,chain)=>store==='google'&&!!successor.get(chain);
 const vault=tokenKey?require('./store-token-vault.cjs').createTokenVault({db,key:tokenKey}):null;
 const find=db.prepare('SELECT * FROM purchases WHERE store=? AND chain=?');
 const byAccount=db.prepare('SELECT * FROM purchases WHERE account=? ORDER BY store,chain');
 const write=db.prepare('INSERT INTO purchases(store,chain,account,product,revision,status,expires) VALUES(?,?,?,?,?,?,?) ON CONFLICT(store,chain) DO UPDATE SET revision=excluded.revision,status=excluded.status,expires=excluded.expires');
 function atomic(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
 function validate(v,account){
  if(v?.verified!==true||!id(account)||v.account!==account||!['apple','google'].includes(v.store)||!id(v.chain)||!['permanent','vip'].includes(v.product)||!int(v.revision)||!['active','revoked','expired','pending'].includes(v.status)||!(v.product==='permanent'?v.expiresAt===null:int(v.expiresAt)))throw Error('unverified purchase');
  if(v.linkedChain!==undefined&&!(v.store==='google'&&v.product==='vip'&&v.status==='active'&&/^[a-f0-9]{64}$/.test(v.chain)&&/^[a-f0-9]{64}$/.test(v.linkedChain)&&v.chain!==v.linkedChain))throw Error('invalid linked subscription');
  return v;
 }
 function put(v,account){
  validate(v,account);const old=find.get(v.store,v.chain);
  if(old&&(old.account!==account||old.product!==v.product))throw Error('purchase binding conflict');
  if(isSuperseded(v.store,v.chain)){
   const fence=successor.get(v.chain);
   if(!old||fence.account!==account||old.status!=='revoked')throw Error('supersession invariant');
   // No provider replay or late notification may reactivate this old token.
   return false;
  }
  if(old&&v.revision<old.revision)throw Error('stale purchase revision');
  let replaced=false;
  if(v.linkedChain!==undefined){
   const previous=find.get('google',v.linkedChain),existing=successor.get(v.linkedChain),parent=predecessor.get(v.chain);
   if(!previous||previous.account!==account||previous.product!=='vip')throw Error('linked subscription ownership unavailable');
   if((existing&&(existing.new_chain!==v.chain||existing.account!==account))||(parent&&(parent.old_chain!==v.linkedChain||parent.account!==account)))throw Error('linked subscription conflict');
   // For new links, reject stale provider observations rather than overwrite a
   // more recent old-token observation. Existing links remain immutable.
   if(!existing){
    if(v.revision<previous.revision)throw Error('stale subscription replacement');
    link.run(v.linkedChain,v.chain,account);
    write.run('google',previous.chain,account,'vip',v.revision,'revoked',previous.expires);
    replaced=true;
   }
  }
  if(old&&v.revision===old.revision){
   if(old.status!==v.status||old.expires!==v.expiresAt)throw Error('conflicting purchase revision');
   return replaced;
  }
  write.run(v.store,v.chain,account,v.product,v.revision,v.status,v.expiresAt);return true;
 }
 return {vault,isSuperseded,record:(v,account)=>atomic(()=>put(v,account)),find:(store,chain)=>find.get(store,chain),list:account=>byAccount.all(account),reconcile:(account,expected,values)=>atomic(()=>{
  const current=byAccount.all(account);
  if(JSON.stringify(current)!==JSON.stringify(expected))throw Error('purchase registry changed; refresh required');
  if(values.length!==current.length)throw Error('incomplete purchase verification');
  const keys=new Set();
  for(const v of values){validate(v,account);const k=JSON.stringify([v.store,v.chain]);if(keys.has(k)||!current.some(x=>x.store===v.store&&x.chain===v.chain))throw Error('unexpected purchase chain');keys.add(k);put(v,account);}
  return byAccount.all(account);
 }),close:()=>db.close()};
}
function createPurchaseService({registry,authenticate,verifyReceipt,verifyCurrent,verifyNotification,now=Date.now}={}){
 if(!registry||[authenticate,verifyReceipt,verifyCurrent,verifyNotification,now].some(f=>typeof f!=='function'))throw Error('trusted purchase adapters required');
 async function identity(token){const v=await authenticate(token);if(v?.authenticated!==true||!id(v.account))throw Error('unauthorized');return v.account;}
 function fresh(v){const t=now();if(!int(t)||!int(v?.verifiedAt)||v.verifiedAt>t||t-v.verifiedAt>=MAX_AGE_MS)throw Error('stale purchase verification');return v;}
 async function restore(token,store,proof){
  const account=await identity(token);
  if(!['apple','google'].includes(store)||typeof proof!=='string'||!proof||proof.length>65536)throw Error('invalid receipt');
  const v=fresh(await verifyReceipt({account,store,proof}));
  if(v.store!==store)throw Error('store mismatch');
  return {recorded:registry.record(v,account)};
 }
 // Re-verify this specific receipt; a generic active VIP is not sufficient.
 async function authorizeFinish(token,store,proof){
  const account=await identity(token);
  if(!['apple','google'].includes(store)||typeof proof!=='string'||!proof||proof.length>65536)throw Error('invalid receipt');
  const v=fresh(await verifyReceipt({account,store,proof}));
  if(v.store!==store||v.status!=='active'||v.product==='vip'&&v.expiresAt<=now()||registry.isSuperseded(store,v.chain))throw Error('purchase not active');
  registry.record(v,account);
  if(registry.isSuperseded(store,v.chain))throw Error('purchase superseded');
  return {authorized:true};
 }
 async function notification(store,proof){
  if(!['apple','google'].includes(store)||typeof proof!=='string'||!proof||proof.length>65536)throw Error('invalid notification');
  const verified=await verifyNotification({store,proof});
  if(verified?.verified===true&&verified.ignored===true)return {recorded:false,ignored:true};
  const v=fresh(verified);
  if(v.store!==store||v.verified!==true)throw Error('notification not verified');
  const old=registry.find(store,v.chain);
  // Unknown transactions must first be bound through authenticated restore.
  if(!old||old.account!==v.account)throw Error('unknown purchase binding');
  return {recorded:registry.record(v,old.account)};
 }
 async function verifyEntitlements(account){
  if(!id(account))throw Error('invalid account');
  const start=now();if(!int(start))throw Error('invalid server time');
  const rows=registry.list(account);
  const values=await Promise.all(rows.map(async x=>registry.isSuperseded(x.store,x.chain)
   ?{verified:true,verifiedAt:start,revision:x.revision,account,store:x.store,chain:x.chain,product:x.product,status:'revoked',expiresAt:x.expires}
   :fresh(await verifyCurrent({account,store:x.store,chain:x.chain,product:x.product,expiresAt:x.expires,status:x.status}))));
  const t=now(),verifiedAt=values.reduce((at,v)=>Math.min(at,v.verifiedAt),start);
  if(!int(t)||t<start||t-verifiedAt>=MAX_AGE_MS)throw Error('stale purchase reconciliation');
  const current=registry.reconcile(account,rows,values);
  const active=current.filter(x=>x.status==='active');
  const expiry=Math.max(0,...active.filter(x=>x.product==='vip'&&x.expires>t).map(x=>x.expires));
  return {verified:true,account,verifiedAt,entitlements:{adSkip:{active:active.some(x=>x.product==='permanent'),expiresAt:null},vip:{active:expiry>0,expiresAt:expiry||null}}};
 }
 return {restore,authorizeFinish,notification,verifyEntitlements};
}
module.exports={openPurchaseRegistry,createPurchaseService};
