// Server-side reference domain only. Never accept state, time, event eligibility or
// entitlement flags from the client. Run each mutation in a serialized durable
// account transaction with independently verified inputs; no production endpoint here.
const HOUR=3600000,MAX_TICKETS=30;
const PRICES={permanent:2980,vipMonth:480,vipYear:4800,ownerMonth:280,ownerYear:2800};
const EXCHANGE={ticket:1,frame:3,profile:5,uniform:10,hq:15,museum:20,emblem:30,deluxeCard:50,anniversary:100};
const ELIGIBLE=new Set(['ticket','goods','fanclub','sponsor','broadcast','food','prize']);
const newAccount=()=>({tickets:0,points:0,claims:{},orders:{},owned:{},lastClaim:null,claimCount:0,lastTime:0});
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9:_-]{1,200}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
const own=(o,k)=>Object.hasOwn(o,k);
function clock(s,now){if(!Number.isSafeInteger(now)||now<0||now<s.lastTime)throw Error('untrusted or regressed time');s.lastTime=now;}
function claim(s,{eventId,now,entitlements,choice='ticket'}){
  clock(s,now);if(!validId(eventId))throw Error('invalid event');
  if(own(s.claims,eventId))return {ok:false,reason:'duplicate'};
  if(s.claimCount>=3&&now-s.lastClaim<HOUR)return {ok:false,reason:'cooldown',nextAt:s.lastClaim+HOUR};
  // Event eligibility and ownership must have been verified by server caller.
  const vip=entitlements?.verified===true&&entitlements.vip===true,permanent=entitlements?.verified===true&&entitlements.adSkip===true;
  const kind=vip||permanent||choice==='point'?'point':'ticket',amount=vip?2:1;
  if(kind==='ticket'&&s.tickets>=MAX_TICKETS)return {ok:false,reason:'capacity'};
  if(kind==='ticket')s.tickets++;else s.points+=amount;
  s.claimCount++;s.lastClaim=now;s.claims[eventId]={kind,amount,at:now};return {ok:true,kind,amount};
}
function exchange(s,key){
  if(!own(EXCHANGE,key)||s.points<EXCHANGE[key])return false;
  if(key==='ticket'){if(s.tickets>=MAX_TICKETS)return false;s.tickets++;}
  else{if(own(s.owned,key))return false;s.owned[key]=true;}
  s.points-=EXCHANGE[key];return true;
}
// Stable per-account operation id must be generated/bound to eligible game action
// by server, not by the client. Pending reservations do not count as consumed.
function reserve(s,id,entitlements,choice){
  if(!validId(id)||!['ad','ticket'].includes(choice))throw Error('invalid operation');
  const previous=own(s.orders,id)?s.orders[id]:null;
  if(previous&&previous.status!=='cancelled')return {...previous,attempt:previous.attempt??1,replay:true};
  const attempt=(previous?.attempt??(previous?1:0))+1;
  const paid=entitlements?.verified===true&&(entitlements.vip===true||entitlements.adSkip===true);
  const held=Object.values(s.orders).filter(o=>o.mode==='ticket'&&o.status==='pending').length;
  if(!paid&&choice==='ticket'&&s.tickets<=held)return {mode:'none',status:'unavailable'};
  const mode=paid?'entitlement':choice;
  return {...(s.orders[id]={mode,status:'pending',attempt}),replay:false};
}
function finish(s,id,attempt,applied){
  if(!validId(id)||!Number.isSafeInteger(attempt)||attempt<1||typeof applied!=='boolean'||!own(s.orders,id))return false;
  const o=s.orders[id];
  if((o.attempt??1)!==attempt)return false;
  if(o.status!=='pending')return o.status==='committed'&&applied===true;
  if(applied){if(o.mode==='ticket'){if(s.tickets<1)throw Error('reservation invariant');s.tickets--;}o.status='committed';}
  else o.status='cancelled';
  return applied;
}
function vipBonus(kind,baseYen,entitlements){
  if(!Number.isSafeInteger(baseYen)||baseYen<0)throw Error('invalid revenue');
  return ELIGIBLE.has(kind)&&entitlements?.verified===true&&entitlements.vip===true?Math.floor(baseYen/5):0;
}
function promptDecision(state,id,tier,enabled=true){
  if(!validId(id)||!['quiet','special','top','unmeasurable'].includes(tier))throw Error('invalid prompt');
  state.seen??={};if(own(state.seen,id))return false;state.seen[id]=true;
  if(tier==='special'){state.special=(state.special||0)+1;return enabled&&state.special%3===0;}
  return enabled&&['top','unmeasurable'].includes(tier);
}
module.exports={HOUR,MAX_TICKETS,PRICES,EXCHANGE,newAccount,claim,exchange,reserve,finish,vipBonus,promptDecision};
