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
 const deletion=x=>x&&typeof x.requestId==='string'&&['requested','processing','completed'].includes(x.status)&&integer(x.requestedAt)&&integer(x.updatedAt);
 const canonicalId=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 const worldId=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
 const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const worldVersion=v=>v&&worldId(v.world)&&integer(v.revision)&&v.revision>0;
 const worldView=v=>worldVersion(v)&&object(v.game);
 const shortText=(v,max)=>typeof v==='string'&&v.length<=max*2&&!/[\u0000-\u001f\u007f]/.test(v);
 const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
 const preview=v=>{
  const t=v?.team,e=t?.emblem;
  return object(v)&&integer(v.year)&&v.year>=2027&&integer(v.day)&&v.day<=143&&shortText(v.gmName,22)&&object(t)&&integer(t.id)&&t.id<=11&&shortText(t.name,30)&&shortText(t.short,8)&&['E','W'].includes(t.league)&&color(t.color)&&shortText(t.letter,3)&&integer(t.wins)&&t.wins<=143&&Number.isFinite(t.cash)&&(e===null||object(e)&&color(e.accent)&&['circle','square','shield','diamond','hex'].includes(e.shape)&&['solid','split','stripe','rim'].includes(e.pattern)&&['bold','serif','italic','mono'].includes(e.font)&&['letter','star','vortex','wing','comet','swan','mountain','gear','moon','spark','wave','crest','bolt'].includes(e.motif));
 };
 const pending=v=>v&&canonicalId(v.operationId)&&modes.includes(v.mode)&&integer(v.attempt)&&v.attempt>0;
 const action=v=>v&&canonicalId(v.operationId)&&['draft-revival','foreign-revival','lottery','fa-retention','fa-sign','retirement','manager','medical'].includes(v.route)&&integer(v.year)&&typeof v.label==='string'&&v.label.length<=160&&['available','pending','cancelled'].includes(v.status);
 const claimResult=v=>wallet(v?.wallet)&&typeof v.result?.ok==='boolean'&&(v.result.ok?['ticket','point'].includes(v.result.kind)&&[1,2].includes(v.result.amount):typeof v.result.reason==='string');
 const checks={
  'game/slots':v=>Array.isArray(v)&&v.length<=3&&v.every(x=>[1,2,3].includes(x?.slot)&&worldVersion(x)&&(!Object.hasOwn(x,'preview')||preview(x.preview)))&&new Set(v.map(x=>x.slot)).size===v.length&&new Set(v.map(x=>x.world)).size===v.length,
  'game/create':worldView,'game/advance':worldView,
  'game/free-page':v=>{
   const p=v?.page;
   return worldVersion(v)&&object(p)&&integer(p.offset)&&integer(p.total)&&p.offset<=p.total&&Array.isArray(p.items)&&p.items.length<=80&&p.offset+p.items.length<=p.total&&p.nextOffset===(p.offset+p.items.length<p.total?p.offset+p.items.length:null)&&(p.nextOffset===null||p.items.length>0)&&new Set(p.items.map(x=>x?.id)).size===p.items.length&&p.items.every(x=>object(x)&&integer(x.id)&&x.id>0&&typeof x.name==='string'&&typeof x.pos==='string'&&integer(x.age)&&['overall','salary','cost'].every(k=>Number.isFinite(x[k])&&x[k]>=0));
  },
  'game/player-page':v=>{
   const p=v?.page,nums=x=>object(x)&&Object.keys(x).length<=24&&Object.values(x).every(Number.isFinite),row=x=>x===null||object(x)&&nums(x.stats)&&(x.team===null||typeof x.team==='string')&&(x.teamId===null||Number.isSafeInteger(x.teamId));
   return worldVersion(v)&&object(p)&&integer(p.playerId)&&p.playerId>0&&integer(p.offset)&&integer(p.total)&&p.offset<=p.total&&Array.isArray(p.items)&&p.items.length<=10&&p.offset+p.items.length<=p.total&&p.nextOffset===(p.offset+p.items.length<p.total?p.offset+p.items.length:null)&&(p.nextOffset===null||p.items.length>0)&&p.items.every((r,i)=>object(r)&&integer(r.year)&&r.year>=2027&&(i===0||p.items[i-1].year>r.year)&&row(r.official)&&row(r.farm)&&(r.overall===null||Number.isFinite(r.overall))&&(r.abilities===null||nums(r.abilities))&&Array.isArray(r.titles)&&r.titles.length<=64&&r.titles.every(t=>object(t)&&typeof t.title==='string'&&t.title.length<=120&&(t.league===null||['E','W'].includes(t.league)))&&integer(r.titlesMore))&&nums(p.officialTotal)&&nums(p.farmTotal)&&typeof p.hasFarm==='boolean'&&typeof p.memo==='string'&&p.memo.length<=2000;
  },
  'game/read':v=>worldView(v)&&wallet(v.wallet)&&Array.isArray(v.actions)&&v.actions.length<=5000&&v.actions.every(action)&&Array.isArray(v.pending)&&v.pending.length<=1&&v.pending.every(pending),
  'game/order':v=>worldVersion(v)&&wallet(v.wallet)&&(v.order===null||pending(v.order)&&['pending','committed','cancelled'].includes(v.order.status)&&Object.hasOwn(v.order,'result')&&(v.order.status==='committed'||v.order.result===null)),
  'game/reserve':v=>wallet(v?.wallet)&&canonicalId(v.operationId)&&(v.mode==='none'&&v.status==='unavailable'||pending(v)&&['pending','committed','cancelled'].includes(v.status)&&typeof v.replay==='boolean'),
  'game/settle':v=>v?.status==='committed'?wallet(v.wallet)&&typeof v.replay==='boolean'&&integer(v.revision)&&v.revision>0&&Object.hasOwn(v,'result'):['awaiting_proof','entitlement_expired','reconcile_required'].includes(v?.status)||['pending','cancelled'].includes(v?.status)&&wallet(v.wallet),
  'game/cancel':v=>['pending','committed','cancelled','settlement_required'].includes(v?.status)&&(v.status==='settlement_required'||wallet(v.wallet)),
  'game/achievement-page':v=>{const p=v?.page;return worldVersion(v)&&object(p)&&integer(p.offset)&&integer(p.total)&&p.total<=50000&&p.offset<=p.total&&Array.isArray(p.items)&&p.items.length<=40&&p.offset+p.items.length<=p.total&&p.nextOffset===(p.offset+p.items.length<p.total?p.offset+p.items.length:null)&&(p.nextOffset===null||p.items.length>0)&&new Set(p.items.map(e=>e?.eventId)).size===p.items.length&&p.items.every(e=>e&&canonicalId(e.eventId)&&typeof e.label==='string'&&e.label.length<=160&&typeof e.claimed==='boolean');},
  'game/achievements':v=>Array.isArray(v)&&v.length<=50000&&v.every(e=>e&&canonicalId(e.eventId)&&typeof e.label==='string'&&e.label.length<=160&&typeof e.claimed==='boolean'),
  'game/claim':claimResult,
  wallet:wallet,
  restore:v=>v&&typeof v.recorded==='boolean',
  'purchase-finish':v=>v?.authorized===true,
  'ads/issue':v=>typeof v?.customData==='string'&&/^[a-f0-9]{64}$/.test(v.customData),
  'ads/status':v=>typeof v?.verified==='boolean',
  'deletion/status':v=>v&&Object.hasOwn(v,'request')&&(v.request===null||deletion(v.request)),
  'deletion/request':v=>deletion(v?.request),
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
    if(!checks[route](value)||(route==='entitlements'&&value.account!==owner)||(route==='order'&&value.order&&value.order.operationId!==body.id)||(route==='game/order'&&value.order&&value.order.operationId!==body.operationId)||(route==='game/reserve'&&value.operationId!==body.operationId)||(['game/free-page','game/player-page','game/achievement-page'].includes(route)&&(value.world!==body.world||value.revision!==body.revision||value.page.offset!==body.command.offset||value.page.items.length>body.command.limit))||(route==='game/player-page'&&value.page.playerId!==body.command.playerId))throw fail('invalid_response',mutation);
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
 const slot=n=>{if(![1,2,3].includes(n))throw Error('invalid slot');return n;};
 const op=x=>{if(!canonicalId(x))throw Error('invalid operation');return x;};
 return {setSession,gameSlots:()=>request('game/slots',{}),gameCreate:(s,command)=>request('game/create',{slot:slot(s),command},true),gameRead:s=>request('game/read',{slot:slot(s)}),gameFreePage:(s,world,revision,command)=>request('game/free-page',{slot:slot(s),world,revision,command}),gamePlayerPage:(s,world,revision,command)=>request('game/player-page',{slot:slot(s),world,revision,command}),gameAdvance:(s,world,revision,command)=>request('game/advance',{slot:slot(s),world,revision,command},true),gameOrder:(s,operationId)=>request('game/order',{slot:slot(s),operationId:op(operationId)}),gameReserve:(s,operationId,choice)=>request('game/reserve',{slot:slot(s),operationId:op(operationId),choice},true),gameSettle:(s,operationId,attempt)=>request('game/settle',{slot:slot(s),operationId:op(operationId),attempt},true),gameCancel:(s,operationId,attempt,confirmed)=>{if(confirmed!==true)throw Error('explicit cancellation required');return request('game/cancel',{slot:slot(s),operationId:op(operationId),attempt,confirmed},true);},gameAchievementPage:(s,world,revision,command)=>request('game/achievement-page',{slot:slot(s),world,revision,command}),gameAchievements:s=>request('game/achievements',{slot:slot(s)}),gameClaim:(s,eventId,choice)=>request('game/claim',{slot:slot(s),eventId:op(eventId),choice},true),issueAd:body=>request('ads/issue',body,true),adStatus:body=>request('ads/status',body),deletionStatus:()=>request('deletion/status',{}),requestDeletion:(reauthProof,confirmed)=>{if(confirmed!==true)throw Error('explicit deletion confirmation required');return request('deletion/request',{confirmed:true,reauthProof},true);},snapshot:()=>request('wallet',{}),entitlements:()=>request('entitlements',{}),restorePurchase:(store,proof)=>request('restore',{store,proof},true),authorizeFinish:(store,proof)=>request('purchase-finish',{store,proof},true),claim:(eventProof,choice='ticket')=>request('claim',{eventProof,choice},true),exchange:key=>request('exchange',{key},true),reserve:(actionProof,choice)=>request('reserve',{actionProof,choice},true),finish:completionProof=>request('finish',{completionProof},true),orderStatus:id=>request('order',{id})};
}
module.exports={createAccountClient};
