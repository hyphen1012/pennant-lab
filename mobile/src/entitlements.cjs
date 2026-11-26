// Read-only lease over independently verified store ownership. No local flags,
// receipts, wall-clock or test purchases are accepted as paid authority.
// now() is a MONOTONIC clock (performance.now); serverNow comes from TLS service.
function createEntitlements({verify,now=()=>performance.now(),maxAgeMs=5*60*1000}={}){
 if(typeof now!=='function'||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>300000)throw Error('invalid entitlement lease');
 let account=null,generation=0,pending=null,snapshot=null,last=-Infinity;
 const empty=()=>({available:typeof verify==='function',verified:false,adSkip:false,vip:false});
 function invalidate(){generation++;snapshot=null;pending=null;}
 function tick(){
  const t=now();if(!Number.isFinite(t)||t<0||t<last){invalidate();throw Error('monotonic clock regressed');}last=t;return t;
 }
 function setAccount(next){
  if(next!==null&&(typeof next!=='string'||!next.trim()||next.length>200))throw Error('invalid billing account');
  if(next!==account){account=next;invalidate();}
 }
 function status(){
  let t;try{t=tick();}catch{return empty();}
  if(!account||!snapshot||t>=snapshot.freshUntil)return empty();
  return {available:true,verified:true,adSkip:snapshot.adSkip,vip:snapshot.vipUntil!==null&&t<snapshot.vipUntil};
 }
 async function refresh(){
  if(typeof verify!=='function'||!account)return empty();
  if(pending)return pending;
  let start;try{start=tick();}catch{return empty();}
  const owner=account,token=generation;snapshot=null;
  const integer=x=>Number.isSafeInteger(x)&&x>=0;
  const task=Promise.resolve().then(()=>verify(owner)).then(value=>{
   if(token!==generation||owner!==account)return empty();
   const t=tick(),e=value?.entitlements;
   if(value?.verified!==true||value.account!==owner||!integer(value.serverNow)||!integer(value.verifiedAt)||value.verifiedAt>value.serverNow||typeof e?.adSkip?.active!=='boolean'||e.adSkip.expiresAt!==null||typeof e?.vip?.active!=='boolean'||!(e.vip.active?integer(e.vip.expiresAt)&&e.vip.expiresAt>value.serverNow:e.vip.expiresAt===null))return empty();
   // Anchor at request start, not arrival, to conservatively charge network delay.
   const freshUntil=start+maxAgeMs-(value.serverNow-value.verifiedAt);
   if(t>=freshUntil)return empty();
   snapshot={freshUntil,adSkip:e.adSkip.active,vipUntil:e.vip.active?start+(e.vip.expiresAt-value.serverNow):null};return status();
  }).catch(()=>empty());
  pending=task;try{return await task;}finally{if(pending===task)pending=null;}
 }
 return {status,setAccount,invalidate,refresh};
}
module.exports={createEntitlements};
