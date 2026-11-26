// Local/reference account service. NOT a public API or a deployed authority.
const {DatabaseSync}=require('node:sqlite');
const rules=require('../shared/monetization.cjs');
const {normalizeRights}=require('./purchase-rights.cjs');
function openLedger(filename){
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS account_ledger (id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
  require('./game-authority.cjs').installAuthorityTables(db);
  const read=db.prepare('SELECT payload FROM account_ledger WHERE id=?');
  const write=db.prepare('INSERT INTO account_ledger(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload');
  function transact(account,fn){
    if(typeof account!=='string'||!account||account.length>200)throw Error('invalid account');
    db.exec('BEGIN IMMEDIATE');
    try{
      const row=read.get(account),state=row?JSON.parse(row.payload):rules.newAccount();
      const result=fn(state,db);
      if(result&&typeof result.then==='function')throw Error('transaction must be synchronous');
      write.run(account,JSON.stringify(state));db.exec('COMMIT');return result;
    }catch(err){db.exec('ROLLBACK');throw err;}
  }
  // Coherent read snapshot without rewriting the account's entire wallet.
  // Always roll back, including accidental writes in trusted callbacks.
  function inspect(account,fn){
    if(typeof account!=='string'||!account||account.length>200)throw Error('invalid account');
    db.exec('BEGIN');
    try{const row=read.get(account),state=row?JSON.parse(row.payload):rules.newAccount();const result=fn(state,db);if(result&&typeof result.then==='function')throw Error('inspection must be synchronous');return result;}
    finally{db.exec('ROLLBACK');}
  }
  function readOrder(account,id){
 if(typeof account!=='string'||!account||typeof id!=='string'||!id)return null;
 const row=read.get(account);if(!row)return null;const s=JSON.parse(row.payload);
 const o=Object.hasOwn(s.orders,id)?s.orders[id]:null;return o?{mode:o.mode,status:o.status,attempt:o.attempt??1}:null;
 }
 return {transact,inspect,readOrder,close:()=>db.close()};
}
function createAccountService({ledger,authenticate,verifyEvent,verifyEntitlements,verifyAction,verifyCompletion,purchaseService=null,exchangeAvailable=()=>true,now=Date.now}){
  if(!ledger?.transact||[authenticate,verifyEvent,verifyEntitlements,verifyAction,verifyCompletion].some(f=>typeof f!=='function'))throw Error('trusted adapters required');
  async function identity(token){
    const auth=await authenticate(token);
    if(auth?.authenticated!==true||typeof auth.account!=='string'||!auth.account)throw Error('unauthorized');
    return auth.account;
  }
  async function verifiedRights(account){
    const result=await verifyEntitlements(account);
    return normalizeRights(account,result,now());
  }
  async function rights(account){
    const result=await verifiedRights(account);
    return {verified:true,vip:result.entitlements.vip.active,adSkip:result.entitlements.adSkip.active};
  }
  async function identitySnapshot(token){return {authenticated:true,account:await identity(token)};}
  async function entitlementSnapshot(token){return verifiedRights(await identity(token));}
  async function restorePurchase(token,store,proof){await identity(token);if(typeof purchaseService?.restore!=='function')throw Error('purchase restoration unavailable');return purchaseService.restore(token,store,proof);}
  async function authorizePurchaseFinish(token,store,proof){await identity(token);if(typeof purchaseService?.authorizeFinish!=='function')throw Error('purchase verification unavailable');return purchaseService.authorizeFinish(token,store,proof);}
  const publicState=s=>({tickets:s.tickets,points:s.points,owned:Object.keys(s.owned).filter(k=>s.owned[k]===true),claimCount:s.claimCount,nextAt:s.claimCount>=3?s.lastClaim+rules.HOUR:null});
  async function snapshot(token){const account=await identity(token);return ledger.transact(account,publicState);}
  async function claim(token,eventProof,choice='ticket'){
    const account=await identity(token),event=await verifyEvent(account,eventProof);
    // Canonical event ID comes ONLY from trusted verifier. Never use save slot,
    // client clock, user-supplied achievement ID or proof of social posting.
    if(event?.verified!==true||event.account!==account||event.eligible!==true)throw Error('achievement not verified');
    if(!['ticket','point'].includes(choice))throw Error('invalid reward choice');
    const entitlements=await rights(account);
    return ledger.transact(account,s=>({result:rules.claim(s,{eventId:event.id,now:now(),entitlements,choice}),wallet:publicState(s)}));
  }
  async function exchange(token,key){
    const account=await identity(token);
    return ledger.transact(account,s=>({ok:exchangeAvailable(key)===true&&rules.exchange(s,key),wallet:publicState(s)}));
  }
  async function reserve(token,actionProof,choice){
    const account=await identity(token),action=await verifyAction(account,actionProof);
    if(action?.verified!==true||action.account!==account||action.eligible!==true)throw Error('action not verified');
    if(!['ad','ticket'].includes(choice))throw Error('invalid mode');
    const entitlements=await rights(account);
    return ledger.transact(account,(s,db)=>{
      if(db.prepare('SELECT 1 FROM authority_actions WHERE account=? AND operation=?').get(account,action.id))throw Error('canonical action requires canonical settlement');
      return {operationId:action.id,...rules.reserve(s,action.id,entitlements,choice),wallet:publicState(s)};
    });
  }
  async function finish(token,completionProof){
    const account=await identity(token),receipt=await verifyCompletion(account,completionProof);
    // Completion must be independently verified as applied or cancelled. A
    // lost connection is not cancellation; recover/resolve on server later.
    if(receipt?.verified!==true||receipt.account!==account||typeof receipt.applied!=='boolean'||!['ad','ticket','entitlement'].includes(receipt.mode)||!Number.isSafeInteger(receipt.attempt)||receipt.attempt<1)throw Error('completion not verified');
    return ledger.transact(account,(s,db)=>{
      if(db.prepare('SELECT 1 FROM authority_actions WHERE account=? AND operation=?').get(account,receipt.id))throw Error('canonical action requires canonical settlement');
      return {ok:Object.hasOwn(s.orders,receipt.id)&&s.orders[receipt.id].mode===receipt.mode&&rules.finish(s,receipt.id,receipt.attempt,receipt.applied),wallet:publicState(s)};
    });
  }
  async function orderStatus(token,id){
    const account=await identity(token);
    if(typeof id!=='string'||!id||id.length>200)throw Error('invalid operation');
    return ledger.transact(account,s=>{
      const o=Object.hasOwn(s.orders,id)?s.orders[id]:null;
      return {order:o?{operationId:id,mode:o.mode,status:o.status,attempt:o.attempt??1}:null,wallet:publicState(s)};
    });
  }
  return {snapshot,identitySnapshot,entitlementSnapshot,restorePurchase,authorizePurchaseFinish,claim,exchange,reserve,finish,orderStatus};
}
module.exports={openLedger,createAccountService};
