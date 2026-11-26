// Session/slot-scoped controller for a server-owned game. Never imports a
// local save, computes results locally or retries a mutation after uncertainty.
function createCanonicalGameSession({client,online=()=>true}={}){
 if(!client||['setSession','gameRead','gameCreate','gameAdvance'].some(k=>typeof client[k]!=='function')||typeof online!=='function')throw Error('canonical client required');
 let generation=0,session=null,slot=null,snapshot=null,status='signed-out',active=null;
 const validSlot=n=>[1,2,3].includes(n);
 const validView=v=>v&&typeof v.world==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v.world)&&Number.isSafeInteger(v.revision)&&v.revision>=1&&v.game&&typeof v.game==='object'&&!Array.isArray(v.game);
 function inspect(){return {slot,status,busy:active!==null,snapshot:snapshot===null?null:structuredClone(snapshot)};}
 function invalidate(nextStatus='refresh-required'){generation++;active=null;snapshot=null;status=nextStatus;}
 function setSession(next){client.setSession(next);invalidate(next?'select-slot':'signed-out');session=next?{account:next.account}:null;slot=null;}
 function suspend(){invalidate(session?(slot?'refresh-required':'select-slot'):'signed-out');}
 function select(n){if(!session||!validSlot(n)||active)throw Error('slot selection unavailable');invalidate('refresh-required');slot=n;return inspect();}
 function start(){if(!session||!slot||active)throw Error('operation unavailable');const t={generation,slot,account:session.account};active=t;return t;}
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
 function refresh(){return run('read',t=>client.gameRead(t.slot));}
 function create(command,confirmed){if(confirmed!==true||snapshot||status!=='refresh-required')throw Error('explicit new game confirmation required');return run('create',t=>client.gameCreate(t.slot,command));}
 function advance(command){
  if(status!=='ready'||!snapshot||snapshot.pending?.length)throw Error('authoritative state or reward reconciliation required');
  return run('advance',(t,old)=>client.gameAdvance(t.slot,old.revision,command));
 }
 async function freePage(command){
  if(status!=='ready'||!snapshot||typeof client.gameFreePage!=='function')throw Error('authoritative state required');
  const t=start(),old=snapshot;
  try{
   if(!await online()||!current(t))throw Error('connection unavailable');
   const result=await client.gameFreePage(t.slot,old.world,old.revision,command);
   if(!current(t))return {status:'stale'};
   if(result.world!==old.world||result.revision!==old.revision)throw Error('unexpected canonical revision');
   return {status:'ready',page:structuredClone(result.page)};
  }catch{
   if(!current(t))return {status:'stale'};
   snapshot=null;status='refresh-required';return {status};
  }finally{if(current(t))active=null;}
 }
 return Object.freeze({setSession,suspend,select,refresh,create,advance,inspect,freePage});
}
module.exports={createCanonicalGameSession};
