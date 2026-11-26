// Store-neutral UI state machine; native StoreKit/Play adapters are not included.
// Only independently verified backend rights may activate a paid entitlement.
function createStorePurchaseFlow({sdk,bridge,catalog,onChange=()=>{}}={}){
 if(!sdk||[sdk.products,sdk.purchase,sdk.restore,sdk.finish,bridge?.restorePurchase,bridge?.status,onChange].some(f=>typeof f!=='function')||!Array.isArray(catalog)||!catalog.length||catalog.some(x=>typeof x!=='string'||!x)||new Set(catalog).size!==catalog.length)throw Error('purchase adapters required');
 let generation=0,busy=false,session=false,products=new Map();
 const allowed=new Set(catalog);
 function invalidate(){generation++;session=false;products.clear();bridge.invalidate?.();}
 function setAuthenticated(value){invalidate();session=value===true;}
 async function task(work){if(!session||busy)throw Error('purchase unavailable');const g=generation;busy=true;try{return await work(()=>{if(g!==generation||!session)throw Error('session changed');});}finally{busy=false;}}
 const emit=phase=>onChange({phase});
 function list(){return task(async current=>{emit('loading');const rows=await sdk.products([...allowed]);current();if(!Array.isArray(rows)||rows.some(x=>!allowed.has(x?.id)||typeof x.formattedPrice!=='string'||!x.formattedPrice)||new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('invalid store catalog');products=new Map(rows.map(x=>[x.id,{id:x.id,formattedPrice:x.formattedPrice}]));emit('ready');return [...products.values()];});}
 async function confirmReceipt(receipt,current){
  if(!receipt||!['apple','google'].includes(receipt.store)||!allowed.has(receipt.id)||typeof receipt.proof!=='string'||!receipt.proof||receipt.proof.length>65536)throw Error('invalid store receipt');
  const rights=await bridge.restorePurchase(receipt.store,receipt.proof);current();
  if(rights?.verified!==true)return {phase:'verification_required'};
  // Backend restore can be idempotent. Store-specific acknowledgement/finish
  // is allowed only after verified reconciliation; no local benefit here.
  await sdk.finish(receipt);current();
  return {phase:'verified',rights:bridge.status()};
 }
 function purchase(id,confirmed){return task(async current=>{
  if(confirmed!==true||!products.has(id))throw Error('store price confirmation required');
  emit('purchasing');const r=await sdk.purchase(id);current();
  if(['pending','cancelled'].includes(r?.status)){emit(r.status);return {phase:r.status};}
  if(r?.status!=='purchased'||r.id!==id)throw Error('purchase failed');
  const result=await confirmReceipt(r,current);emit(result.phase);return result;
 });}
 function restore(){return task(async current=>{emit('restoring');const rows=await sdk.restore();current();if(!Array.isArray(rows)||rows.length>100)throw Error('invalid restore result');const results=[];for(const r of rows){current();if(r?.status==='purchased')results.push(await confirmReceipt(r,current));}emit('restored');return results;});}
 return {setAuthenticated,invalidate,list,purchase,restore};
}
module.exports={createStorePurchaseFlow};
