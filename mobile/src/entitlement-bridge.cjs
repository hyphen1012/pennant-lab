// Read-only adapter wiring, NOT a sign-in screen or live billing integration.
// Session must be supplied by a real trusted identity provider; no local storage.
const {createAccountClient}=require('./account-client.cjs');
const {createEntitlements}=require('./entitlements.cjs');
const {createRewardCoordinator}=require('./reward-coordinator.cjs');
const {createSaveTransferClient}=require('./save-transfer-client.cjs');
function createEntitlementBridge(options={}){
 const client=createAccountClient(options);
 let generation=0;
 const reward=options.reward?createRewardCoordinator({...options.reward,client}):null;
 const migration=options.migration?createSaveTransferClient(options.migration):null;
 const lease=createEntitlements({verify:()=>client.entitlements(),now:options.now,maxAgeMs:options.maxAgeMs});
 function setSession(session){
  client.setSession(session);
  generation++;reward?.invalidate();lease.invalidate();migration?.invalidate();
  try{migration?.setSession(session);}catch(e){client.setSession(null);lease.setAccount(null);throw e;}lease.setAccount(session?.account??null);
 }
 function suspend(){generation++;reward?.invalidate();lease.invalidate();migration?.invalidate();}
 async function restorePurchase(store,proof){
  suspend();const gen=generation;
  await client.restorePurchase(store,proof);
  if(gen!==generation)throw Error('session changed');
  return lease.refresh(); // fresh verified server rights, never a receipt response alone
 }
 return {setSession,status:lease.status,refresh:lease.refresh,invalidate:suspend,restorePurchase,reward,migration};
}
module.exports={createEntitlementBridge};
