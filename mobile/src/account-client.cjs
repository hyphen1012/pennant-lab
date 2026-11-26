// Account HTTP client reference; not connected to the game or a live service.
// A response is a ledger observation, NOT permission to apply a game reward.
function createAccountClient({baseUrl,fetcher=globalThis.fetch,timeoutMs=10000}={}){
 const u=new URL(baseUrl);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000||typeof fetcher!=='function')throw Error('HTTPS account endpoint and bounded timeout required');
 const base=u.href.replace(/\/$/,'');
 let session=null,generation=0,busy=false;
 const active=new Set();
 function setSession(next){
  if(next!==null&&(!next||typeof next.account!=='string'||!next.account||next.account.length>200||typeof next.token!=='string'||!/^[A-Za-z0-9._~+\/=-]{1,4096}$/.test(next.token)))throw Error('invalid session');
  generation++;for(const ctl of active)ctl.abort();active.clear();busy=false;
  session=next?{account:next.account,token:next.token}:null;
 }
 const fail=(code,uncertain=false)=>Object.assign(Error(code),{code,uncertain});
 const integer=v=>Number.isSafeInteger(v)&&v>=0;
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9:_-]{1,200}$/.test(v);
 const modes=['ad','ticket','entitlement'];
 const wallet=v=>v&&integer(v.tickets)&&v.tickets<=30&&integer(v.points)&&integer(v.claimCount)&&(v.nextAt===null||integer(v.nextAt))&&Array.isArray(v.owned)&&v.owned.every(x=>typeof x==='string')&&new Set(v.owned).size===v.owned.length;
 const order=v=>v&&id(v.operationId)&&modes.includes(v.mode)&&['pending','committed','cancelled'].includes(v.status)&&integer(v.attempt)&&v.attempt>0;
 const checks={
  wallet:wallet,
  restore:v=>v&&typeof v.recorded==='boolean',
  entitlements:v=>v?.verified===true&&typeof v.account==='string'&&integer(v.serverNow)&&integer(v.verifiedAt)&&v.verifiedAt<=v.serverNow&&v.serverNow-v.verifiedAt<300000&&typeof v.entitlements?.adSkip?.active==='boolean'&&v.entitlements.adSkip.expiresAt===null&&typeof v.entitlements?.vip?.active==='boolean'&&(v.entitlements.vip.active?integer(v.entitlements.vip.expiresAt)&&v.entitlements.vip.expiresAt>v.serverNow:v.entitlements.vip.expiresAt===null),
  order:v=>wallet(v?.wallet)&&(v.order===null||order(v.order)),
  claim:v=>wallet(v?.wallet)&&typeof v.result?.ok==='boolean'&&(v.result.ok?['ticket','point'].includes(v.result.kind)&&[1,2].includes(v.result.amount):typeof v.result.reason==='string'),
  exchange:v=>wallet(v?.wallet)&&typeof v.ok==='boolean',
  reserve:v=>wallet(v?.wallet)&&id(v.operationId)&&(v.mode==='none'&&v.status==='unavailable'||order(v)&&typeof v.replay==='boolean'),
  finish:v=>wallet(v?.wallet)&&typeof v.ok==='boolean'
 };
 async function request(route,body,mutation=false){
  if(!session)throw fail('authentication_required');
  if(mutation&&busy)throw fail('mutation_in_progress');
  const gen=generation,token=session.token,owner=session.account,ctl=new AbortController();active.add(ctl);
  if(mutation)busy=true;
  let timer;
  try{
   const work=async()=>{
    const response=await fetcher(base+'/v1/'+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:ctl.signal});
    if(!response||response.status!==200)throw fail('request_rejected',mutation);
    const value=await response.json();
    if(!checks[route](value)||(route==='entitlements'&&value.account!==owner)||(route==='order'&&value.order&&value.order.operationId!==body.id))throw fail('invalid_response',mutation);
    return value;
   };
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{ctl.abort();reject(fail('timeout',mutation));},timeoutMs);});
   const value=await Promise.race([work(),timeout]);
   if(gen!==generation)throw fail('session_changed',mutation);
   return value;
  }catch(e){
   if(gen!==generation)throw fail('session_changed',mutation);
   // Never retry a mutation automatically; resolve ambiguity through wallet/order
   // reads and independent completion evidence. Do not grant locally.
   throw e?.code&&typeof e.uncertain==='boolean'?e:fail('network_error',mutation);
  }finally{clearTimeout(timer);active.delete(ctl);if(mutation&&gen===generation)busy=false;}
 }
 return {setSession,snapshot:()=>request('wallet',{}),entitlements:()=>request('entitlements',{}),restorePurchase:(store,proof)=>request('restore',{store,proof},true),claim:(eventProof,choice='ticket')=>request('claim',{eventProof,choice},true),exchange:key=>request('exchange',{key},true),reserve:(actionProof,choice)=>request('reserve',{actionProof,choice},true),finish:completionProof=>request('finish',{completionProof},true),orderStatus:id=>request('order',{id})};
}
module.exports={createAccountClient};
