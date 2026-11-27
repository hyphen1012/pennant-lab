// Session/slot-scoped controller for a server-owned game. Never imports a
// local save, computes results locally or retries a mutation after uncertainty.
const {createCanonicalRewardFlow}=require('./canonical-reward-flow.cjs');
function createCanonicalGameSession({client,online=()=>true}={}){
 if(!client||['setSession','gameRead','gameCreate','gameAdvance'].some(k=>typeof client[k]!=='function')||typeof online!=='function')throw Error('canonical client required');
 let generation=0,session=null,slot=null,snapshot=null,status='signed-out',active=null;
 // Staging ticket/verified entitlement only. Never open an ad or manufacture evidence.
 const rewardFlow=['gameRead','gameOrder','gameReserve','gameSettle','gameCancel'].every(k=>typeof client[k]==='function')?createCanonicalRewardFlow({client,online,requestAdProof:async()=>false}):null;
 const validSlot=n=>[1,2,3].includes(n);
 const validView=v=>v&&typeof v.world==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v.world)&&Number.isSafeInteger(v.revision)&&v.revision>=1&&v.game&&typeof v.game==='object'&&!Array.isArray(v.game);
 function inspect(){return {slot,status,busy:active!==null,snapshot:snapshot===null?null:structuredClone(snapshot)};}
 function invalidate(nextStatus='refresh-required'){rewardFlow?.invalidate();generation++;active=null;snapshot=null;status=nextStatus;}
 function setSession(next){client.setSession(next);invalidate(next?'select-slot':'signed-out');session=next?{account:next.account}:null;slot=null;}
 function suspend(){invalidate(session?(slot?'refresh-required':'select-slot'):'signed-out');}
 function select(n){if(!session||!validSlot(n)||active)throw Error('slot selection unavailable');invalidate('refresh-required');slot=n;return inspect();}
 function start(requireSlot=true){if(!session||(requireSlot&&!slot)||active)throw Error('operation unavailable');const t={generation,slot,account:session.account};active=t;return t;}
 const current=t=>active===t&&t.generation===generation&&t.slot===slot&&t.account===session?.account;
 async function run(kind,fn){
  const t=start(),old=snapshot;
  try{
   if(!await online()||!current(t))throw Error('connection unavailable');
   const next=await fn(t,old);
   if(!current(t))return {status:'stale'};
   if(!validView(next)||old&&(next.world!==old.world||next.revision<old.revision)||kind==='advance'&&next.revision!==old.revision+1||kind==='create'&&next.revision!==1)throw Error('unexpected canonical revision');
   snapshot=structuredClone(next);status='ready';return {status,snapshot:structuredClone(snapshot)};
  }catch(e){
   if(!current(t))return {status:'stale'};
   // Even an HTTP error may follow a committed server mutation. Discard the
   // display and require a new authoritative read, never resend automatically.
   snapshot=null;status='refresh-required';return {status,uncertain:kind!=='read'};
  }finally{if(current(t))active=null;}
 }
 async function listSlots(){
  if(typeof client.gameSlots!=='function')throw Error('slot metadata unavailable');
  const t=start(false);
  try{
   if(!await online()||!current(t))throw Error('connection unavailable');
   const slots=await client.gameSlots();
   if(!current(t))return {status:'stale'};
   if(!Array.isArray(slots)||slots.length>3||slots.some(x=>!validSlot(x?.slot)||typeof x.world!=='string'||!Number.isSafeInteger(x.revision)||x.revision<1)||new Set(slots.map(x=>x.slot)).size!==slots.length)throw Error('invalid slots');
   return {status:'ready',slots:structuredClone(slots)};
  }catch{
   if(!current(t))return {status:'stale'};
   snapshot=null;status=slot?'refresh-required':'select-slot';return {status:'refresh-required'};
  }finally{if(current(t))active=null;}
 }
 async function deleteWorld(row,confirmed){
  if(confirmed!==true||typeof client.gameDelete!=='function'||!validSlot(row?.slot)||typeof row.world!=='string'||!Number.isSafeInteger(row.revision)||row.revision<1)throw Error('explicit world deletion required');
  const expected={slot:row.slot,world:row.world,revision:row.revision},t=start(false);
  try{
   if(!await online()||!current(t))throw Error('connection unavailable');
   const result=await client.gameDelete(expected.slot,expected.world,expected.revision,true);
   if(!current(t))return {status:'stale'};
   if(result.deleted!==true||result.slot!==expected.slot||result.world!==expected.world||result.revision!==expected.revision)throw Error('unexpected deletion response');
   invalidate('select-slot');slot=null;
   return {status:'deleted'};
  }catch{
   if(!current(t))return {status:'stale'};
   invalidate('select-slot');slot=null;
   return {status:'refresh-required',uncertain:true};
  }finally{if(current(t))active=null;}
 }
 function refresh(){return run('read',t=>client.gameRead(t.slot));}
 function create(command,confirmed){if(confirmed!==true||snapshot||status!=='refresh-required')throw Error('explicit new game confirmation required');return run('create',async t=>{
  if(typeof client.gameSlots!=='function')throw Error('slot metadata unavailable');
  const slots=await client.gameSlots();
  if(!current(t)||!Array.isArray(slots)||slots.some(x=>x.slot===t.slot))throw Error('canonical slot not confirmed empty');
  if(!await online()||!current(t))throw Error('connection unavailable');
  return client.gameCreate(t.slot,command);
 });}
 function advance(command){
  if(status!=='ready'||!snapshot||snapshot.pending?.length)throw Error('authoritative state or reward reconciliation required');
  return run('advance',(t,old)=>client.gameAdvance(t.slot,old.world,old.revision,command));
 }
 async function reward(kind,id,confirmed){
  if(confirmed!==true||!rewardFlow||status!=='ready'||!snapshot||!['ticket','reconcile','cancel'].includes(kind))throw Error('explicit authoritative reward required');
  const pending=(snapshot.pending||[]).some(x=>x.operationId===id);
  if(kind==='ticket'?(snapshot.pending?.length||!snapshot.actions?.some(x=>x.operationId===id&&['available','cancelled'].includes(x.status))):!pending)throw Error('reward unavailable');
  let outcome;
  const r=await run('reward',async(t,old)=>{
   const x=await (kind==='ticket'?rewardFlow.run(t.slot,id,'ticket'):kind==='reconcile'?rewardFlow.reconcile(t.slot,id):rewardFlow.cancel(t.slot,id,true));
   if(!current(t))throw Error('session changed');
   outcome=x.status;
   if(['reconcile_required','busy'].includes(outcome))throw Error('reward observation required');
   // A read after an explicit action is not a replay of the mutation.
   return client.gameRead(t.slot);
  });
  return {...r,rewardStatus:r.status==='ready'?outcome:null};
 }
 async function readEntitlements(){
  if(!session||typeof client.entitlements!=='function')throw Error('verified rights unavailable');
  const t=start(false);
  try{
   if(!await online()||!current(t))throw Error('connection unavailable');
   const r=await client.entitlements();
   if(!current(t))return {status:'stale'};
   if(r?.verified!==true||r.account!==t.account||typeof r.entitlements?.adSkip?.active!=='boolean'||typeof r.entitlements?.vip?.active!=='boolean')throw Error('rights unavailable');
   return {status:'ready',rights:structuredClone({serverNow:r.serverNow,adSkip:r.entitlements.adSkip,vip:r.entitlements.vip})};
  }catch{return {status:current(t)?'unavailable':'stale'};}
  finally{if(current(t))active=null;}
 }
 async function exchangeFrame(confirmed){
  if(confirmed!==true||status!=='ready'||!snapshot||snapshot.pending?.length||!snapshot.wallet||snapshot.wallet.points<3||snapshot.wallet.owned?.includes('frame')||typeof client.exchange!=='function')throw Error('explicit frame exchange unavailable');
  let exchanged=false;
  const r=await run('exchange',async(t,old)=>{const x=await client.exchange('frame');if(!current(t))throw Error('session changed');exchanged=x.ok===true;return client.gameRead(t.slot);});
  return {...r,exchangeOk:r.status==='ready'?exchanged:null};
 }
 async function exchangeProfile(confirmed){
  if(confirmed!==true||status!=='ready'||!snapshot||snapshot.pending?.length||!snapshot.wallet||snapshot.wallet.points<5||snapshot.wallet.owned?.includes('profile')||typeof client.exchange!=='function')throw Error('explicit profile exchange unavailable');
  let exchanged=false;
  const r=await run('exchange',async(t,old)=>{const x=await client.exchange('profile');if(!current(t))throw Error('session changed');exchanged=x.ok===true;return client.gameRead(t.slot);});
  return {...r,exchangeOk:r.status==='ready'?exchanged:null};
 }
 async function exchangeDecor(key,confirmed){
  const cost=Object.hasOwn({hq:15,museum:20,uniform:10,emblem:30,deluxeCard:50,anniversary:100},key)?{hq:15,museum:20,uniform:10,emblem:30,deluxeCard:50,anniversary:100}[key]:null;
  if(cost===null||confirmed!==true||status!=='ready'||!snapshot||snapshot.pending?.length||!snapshot.wallet||snapshot.wallet.points<cost||snapshot.wallet.owned?.includes(key)||typeof client.exchange!=='function')throw Error('explicit decoration exchange unavailable');
  let exchanged=false;
  const r=await run('exchange',async(t,old)=>{const x=await client.exchange(key);if(!current(t))throw Error('session changed');exchanged=x.ok===true;return client.gameRead(t.slot);});
  return {...r,exchangeOk:r.status==='ready'?exchanged:null};
 }
 async function exchangeTicket(confirmed){
  if(confirmed!==true||status!=='ready'||!snapshot||snapshot.pending?.length||!snapshot.wallet||snapshot.wallet.points<1||snapshot.wallet.tickets>=30||typeof client.exchange!=='function')throw Error('explicit ticket exchange unavailable');
  let exchanged=false;
  const r=await run('exchange',async(t,old)=>{const x=await client.exchange('ticket');if(!current(t))throw Error('session changed');exchanged=x.ok===true;return client.gameRead(t.slot);});
  return {...r,exchangeOk:r.status==='ready'?exchanged:null};
 }
 async function tradePage(command){return readPage('gameTradePage',command);}
 async function reportPage(command){return readPage('gameReportPage',command);}
 async function achievementPage(command){return readPage('gameAchievementPage',command);}
 async function claimAchievement(id,choice,confirmed){
  if(confirmed!==true||status!=='ready'||!snapshot||snapshot.pending?.length||typeof client.gameClaim!=='function'||typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id)||!['ticket','point'].includes(choice))throw Error('explicit achievement claim required');
  let result;
  const r=await run('claim',async(t,old)=>{const x=await client.gameClaim(t.slot,id,choice);if(!current(t))throw Error('session changed');result=x.result;return client.gameRead(t.slot);});
  return {...r,claimResult:r.status==='ready'?result:null};
 }
 async function freePage(command){return readPage('gameFreePage',command);}
 async function playerPage(command){return readPage('gamePlayerPage',command);}
 async function readPage(method,command){
  if(status!=='ready'||!snapshot||typeof client[method]!=='function')throw Error('authoritative state required');
  const t=start(),old=snapshot;
  try{
   if(!await online()||!current(t))throw Error('connection unavailable');
   const result=await client[method](t.slot,old.world,old.revision,command);
   if(!current(t))return {status:'stale'};
   if(result.world!==old.world||result.revision!==old.revision)throw Error('unexpected canonical revision');
   return {status:'ready',page:structuredClone(result.page)};
  }catch{
   if(!current(t))return {status:'stale'};
   snapshot=null;status='refresh-required';return {status};
  }finally{if(current(t))active=null;}
 }
 return Object.freeze({setSession,suspend,select,refresh,create,deleteWorld,advance,inspect,freePage,playerPage,listSlots,reward,achievementPage,claimAchievement,reportPage,exchangeTicket,exchangeFrame,exchangeProfile,exchangeDecor,readEntitlements,tradePage});
}
module.exports={createCanonicalGameSession};
