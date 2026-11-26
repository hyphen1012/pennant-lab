// Read-only adapter wiring, NOT a sign-in screen or live billing integration.
// Session must be supplied by a real trusted identity provider; no local storage.
const {createAccountClient}=require('./account-client.cjs');
const {createEntitlements}=require('./entitlements.cjs');
function createEntitlementBridge(options={}){
 const client=createAccountClient(options);
 const lease=createEntitlements({verify:()=>client.entitlements(),now:options.now,maxAgeMs:options.maxAgeMs});
 function setSession(session){
  client.setSession(session);
  lease.invalidate();lease.setAccount(session?.account??null);
 }
 return {setSession,status:lease.status,refresh:lease.refresh,invalidate:lease.invalidate};
}
module.exports={createEntitlementBridge};
