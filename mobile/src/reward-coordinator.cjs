// Reference orchestration for explicit, optional reward use. The server must
// verify the action and perform idempotent application; this module never grants
// a local reward from a reservation, SDK callback, or replay response.
function createRewardCoordinator({client,requestAdProof,applyVerified,online,reconcileVerified=null}={}){
 if(!client||[client.reserve,client.finish,client.orderStatus,requestAdProof,applyVerified,online].some(f=>typeof f!=='function'))throw Error('trusted reward adapters required');
 let generation=0,busy=false;
 function invalidate(){generation++;} // keep busy until outstanding provider call settles
 const valid=o=>o&&typeof o.operationId==='string'&&Number.isSafeInteger(o.attempt)&&o.attempt>0&&['ad','ticket','entitlement'].includes(o.mode);
 async function run({actionProof,choice='ad'}={}){
  if(busy)return {status:'busy'};
  if(typeof actionProof!=='string'||!actionProof||!['ad','ticket'].includes(choice))throw Error('invalid reward request');
  busy=true;const gen=generation;let order=null;
  const current=()=>generation===gen;
  const uncertain=()=>({status:'reconcile_required',operationId:order?.operationId??null});
  try{
   if(!await online()||!current())return {status:'unavailable'};
   order=await client.reserve(actionProof,choice);
   if(!current())return uncertain();
   if(order?.status==='unavailable')return {status:'unavailable'};
   if(!valid(order))return uncertain();
   // A replay is an observation, never authority to show a second ad or apply twice.
   if(order.replay||order.status!=='pending')return uncertain();
   let adProof=null;
   if(order.mode==='ad'){
    adProof=await requestAdProof({operationId:order.operationId,attempt:order.attempt});
    if(typeof adProof!=='string'||!adProof)return uncertain();
   }
   if(!current()||!await online()||!current())return uncertain();
   // This injected adapter must authorize AND durably apply/cancel on the trusted
   // backend, bound to account, operation and attempt. A local boolean is invalid.
   const proof=await applyVerified({operationId:order.operationId,attempt:order.attempt,mode:order.mode,adProof});
   if(!current()||typeof proof!=='string'||!proof)return uncertain();
   const finish=await client.finish(proof);
   if(!current()||finish?.ok!==true)return uncertain();
   const settled=await client.orderStatus(order.operationId);
   if(!current()||settled?.order?.status!=='committed'||settled.order.attempt!==order.attempt||settled.order.mode!==order.mode)return uncertain();
   return {status:'committed',operationId:order.operationId,wallet:settled.wallet};
  }catch{return uncertain();}finally{busy=false;}
 }
 async function recover(operationId){
  const gen=generation;
  if(typeof operationId!=='string'||!operationId)throw Error('invalid operation');
  const result=await client.orderStatus(operationId);
  if(gen!==generation)throw Error('session changed');
  return result; // read only; no application or automatic mutation retry
 }
 // Explicit user-initiated reconciliation. No proof of application is inferred
 // from elapsed time, ad dismissal, local save or a lost connection.
 async function reconcile(operationId){
  if(busy)return {status:'busy'};
  if(typeof reconcileVerified!=='function')return {status:'reconcile_required',operationId};
  if(typeof operationId!=='string'||!operationId)throw Error('invalid operation');
  busy=true;const gen=generation;
  try{
   if(!await online()||gen!==generation)return {status:'reconcile_required',operationId};
   const before=await client.orderStatus(operationId);
   if(gen!==generation)return {status:'reconcile_required',operationId};
   const o=before?.order;
   if(!valid(o)||o.operationId!==operationId)return {status:'reconcile_required',operationId};
   if(o.status==='committed'||o.status==='cancelled')return {status:o.status,operationId,wallet:before.wallet};
   if(o.status!=='pending')return {status:'reconcile_required',operationId};
   const proof=await reconcileVerified({operationId,attempt:o.attempt,mode:o.mode});
   if(gen!==generation||typeof proof!=='string'||!proof)return {status:'reconcile_required',operationId};
   await client.finish(proof); // verified cancellation returns ok=false by existing rules
   if(gen!==generation)return {status:'reconcile_required',operationId};
   const after=await client.orderStatus(operationId);
   if(gen!==generation||after?.order?.operationId!==operationId||after.order.attempt!==o.attempt||after.order.mode!==o.mode||!['committed','cancelled'].includes(after.order.status))return {status:'reconcile_required',operationId};
   return {status:after.order.status,operationId,wallet:after.wallet};
  }catch{return {status:'reconcile_required',operationId};}finally{busy=false;}
 }
 return {run,recover,reconcile,invalidate};
}
module.exports={createRewardCoordinator};
