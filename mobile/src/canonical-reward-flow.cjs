// Staging client orchestration. Render authoritative state only; never mutate
// the legacy game or infer an award from an SDK callback. No automatic retries.
function createCanonicalRewardFlow({client,requestAdProof,online}={}){
 if([client?.gameRead,client?.gameOrder,client?.gameReserve,client?.gameSettle,client?.gameCancel,requestAdProof,online].some(x=>typeof x!=='function'))throw Error('canonical reward adapters required');
 let generation=0,busy=false;
 const invalidate=()=>{generation++;};
 const args=(slot,id)=>{if(![1,2,3].includes(slot)||typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw Error('invalid reward target');};
 async function execute(slot,id,fn){
  args(slot,id);if(busy)return {status:'busy'};busy=true;const g=generation;
  const current=()=>g===generation,ready=async()=>current()&&await online()&&current();
  const uncertain=()=>({status:'reconcile_required',operationId:id});
  try{if(!await ready())return uncertain();return await fn({current,ready,uncertain});}catch{return uncertain();}finally{busy=false;}
 }
 async function observe(slot,id,{current,uncertain}){
  const result=await client.gameOrder(slot,id);
  if(!current()||!result?.order||result.order.operationId!==id)return uncertain();
  return {status:result.order.status,operationId:id,observation:result};
 }
 async function run(slot,id,choice){
  if(!['ad','ticket'].includes(choice))throw Error('invalid mode');
  return execute(slot,id,async ctx=>{
   const r=await client.gameReserve(slot,id,choice);
   if(!ctx.current())return ctx.uncertain();
   if(r.status==='unavailable')return {status:'unavailable'};
   // Existing pending/committed orders are read only; never replay an ad.
   if(r.replay||r.status!=='pending')return observe(slot,id,ctx);
   if(r.mode==='ad'){
    if(!await ctx.ready())return ctx.uncertain();
    if(!await requestAdProof({operationId:id,attempt:r.attempt}))return ctx.uncertain();
   }
   if(!await ctx.ready())return ctx.uncertain();
   const settled=await client.gameSettle(slot,id,r.attempt);
   if(!ctx.current())return ctx.uncertain();
   if(settled.status!=='committed')return {status:settled.status,operationId:id};
   return observe(slot,id,ctx);
  });
 }
 async function reconcile(slot,id){
  // Explicit recovery after interruption; no new ad is shown or reserved.
  return execute(slot,id,async ctx=>{
   const before=await observe(slot,id,ctx);if(before.status!=='pending')return before;
   if(!await ctx.ready())return ctx.uncertain();
   const r=await client.gameSettle(slot,id,before.observation.order.attempt);
   if(!ctx.current())return ctx.uncertain();
   return r.status==='committed'?observe(slot,id,ctx):{status:r.status,operationId:id};
  });
 }
 async function cancel(slot,id,confirmed){
  if(confirmed!==true)throw Error('explicit cancellation required');
  return execute(slot,id,async ctx=>{
   const before=await observe(slot,id,ctx);if(before.status!=='pending')return before;
   if(!await ctx.ready())return ctx.uncertain();
   const r=await client.gameCancel(slot,id,before.observation.order.attempt,true);
   if(!ctx.current())return ctx.uncertain();
   return r.status==='settlement_required'?{status:r.status,operationId:id}:observe(slot,id,ctx);
  });
 }
 return {run,reconcile,cancel,recover:(slot,id)=>execute(slot,id,ctx=>observe(slot,id,ctx)),invalidate};
}
module.exports={createCanonicalRewardFlow};
