// Store-neutral entitlement boundary. The future adapter MUST independently
// verify purchase tokens/receipts, refund/revocation status and account binding.
// Do not feed local storage, user input, or unverified SDK responses into verify.
function createEntitlements({verify,now=Date.now,maxAgeMs=5*60*1000}={}){
  let account=null,generation=0,pending=null,snapshot=null;
  const empty=()=>({available:typeof verify==='function',verified:false,adSkip:false,vip:false});
  function invalidate(){generation++;snapshot=null;pending=null;}
  function setAccount(next){
    if(next!==null&&(typeof next!=='string'||!next.trim()))throw Error('invalid billing account');
    if(next!==account){account=next;invalidate();}
  }
  function status(){
    if(!account||!snapshot||now()>=snapshot.freshUntil)return empty();
    const active=(key)=>{const v=snapshot.entitlements[key];return v?.active===true&&(key==='adSkip'?v.expiresAt===null:Number.isFinite(v.expiresAt)&&v.expiresAt>now());};
    return {available:true,verified:true,adSkip:active('adSkip'),vip:active('vip')};
  }
  async function refresh(){
    if(typeof verify!=='function'||!account)return empty();
    if(pending)return pending;
    const owner=account,token=generation;
    snapshot=null; // fail closed while restoring or refreshing.
    const task=Promise.resolve().then(()=>verify(owner)).then(value=>{
      if(token!==generation||owner!==account)return empty();
      if(value?.verified!==true||value.account!==owner||!value.entitlements||!Number.isFinite(value.verifiedAt)||value.verifiedAt>now()||now()-value.verifiedAt>=maxAgeMs)return empty();
      const entitlements={};
      for(const key of ['adSkip','vip']){
        const e=value.entitlements[key];
        if(e?.active===true&&((key==='adSkip'&&e.expiresAt===null)||(key==='vip'&&Number.isFinite(e.expiresAt)&&e.expiresAt>now())))entitlements[key]={active:true,expiresAt:e.expiresAt};
      }
      snapshot={freshUntil:value.verifiedAt+maxAgeMs,entitlements};return status();
    },()=>empty());
    pending=task;try{return await task;}finally{if(pending===task)pending=null;}
  }
  return {status,setAccount,invalidate,refresh};
}
module.exports={createEntitlements};
