// Verified ad evidence only. Never finish a game reward from a callback.
function createAdSsvService({registry,authenticate,readOrder,verifyCallback,units}={}){
 if(!registry||[authenticate,readOrder,verifyCallback].some(x=>typeof x!=='function')||!units||!Object.keys(units).length)throw Error('ad service adapters required');
 const configured=new Map(Object.entries(units));
 for(const [platform,u] of configured){if(!['android','ios'].includes(platform)||!/^\d{1,30}$/.test(u?.unit)||!/^[A-Za-z0-9:_-]{1,200}$/.test(u?.item)||!Number.isSafeInteger(u?.amount)||u.amount<1)throw Error('invalid ad unit configuration');}
 const pending=(o,attempt)=>o?.mode==='ad'&&o.status==='pending'&&o.attempt===attempt;
 async function identity(token){const a=await authenticate(token);if(a?.authenticated!==true||typeof a.account!=='string'||!a.account)throw Error('unauthorized');return a.account;}
 async function issue(token,{operationId,attempt,platform}={}){
  const account=await identity(token),u=configured.get(platform);
  if(!u||typeof operationId!=='string'||!Number.isSafeInteger(attempt)||!pending(await readOrder(account,operationId),attempt))throw Error('no pending ad reservation');
  return {customData:registry.issue({account,operationId,attempt,...u})};
 }
 async function callback(rawQuery){
  const v=await verifyCallback(rawQuery);
  // Registry validates opaque reservation token, unit, item, amount and unique transaction.
  return registry.recordVerified(v);
 }
 async function status(token,{operationId,attempt}={}){
  const account=await identity(token);
  if(!pending(await readOrder(account,operationId),attempt))return {verified:false};
  return {verified:registry.hasProof({account,operationId,attempt})};
 }
 return {issue,callback,status};
}
module.exports={createAdSsvService};
