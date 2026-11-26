// Fixed official origin; untrusted key IDs never determine an outbound URL.
const {createPublicKey}=require('node:crypto');
const URL='https://www.gstatic.com/admob/reward/verifier-keys.json';
function createAdMobKeyResolver({fetcher=globalThis.fetch,now=Date.now,ttlMs=6*3600000,unknownRefreshMs=60000}={}){
 if(typeof fetcher!=='function'||typeof now!=='function'||!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>86400000||!Number.isSafeInteger(unknownRefreshMs)||unknownRefreshMs<1000)throw Error('invalid key resolver');
 let keys=new Map(),loadedAt=-Infinity,lastAttempt=-Infinity,pending=null;
 async function refresh(){
  if(pending)return pending;
  lastAttempt=now();
  const job=(async()=>{
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),5000);
   try{
    const r=await fetcher(URL,{redirect:'error',cache:'no-store',signal:ctl.signal});
    if(r.status!==200||!r.body?.getReader)throw Error('key server unavailable');
    const reader=r.body.getReader(),parts=[];let size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw Error('key response too large');parts.push(Buffer.from(value));}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
    const x=JSON.parse(Buffer.concat(parts,size).toString('utf8'));
    if(!Array.isArray(x.keys)||!x.keys.length||x.keys.length>32)throw Error('invalid key list');
    const next=new Map();for(const row of x.keys){
     if(!Number.isSafeInteger(row.keyId)||row.keyId<0||typeof row.pem!=='string'||row.pem.length>2048||next.has(String(row.keyId)))throw Error('invalid key');
     const k=createPublicKey(row.pem);if(k.asymmetricKeyType!=='ec'||k.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('unexpected key type');
     next.set(String(row.keyId),k);
    }
    keys=next;loadedAt=now();
   }finally{clearTimeout(timer);}
  })();
  pending=job;try{await job;}finally{if(pending===job)pending=null;}
 }
 return async id=>{
  if(typeof id!=='string'||!/^\d{1,16}$/.test(id))return null;
  const t=now();if(!Number.isSafeInteger(t)||t<loadedAt||t<lastAttempt)return null;
  if(t-loadedAt>=ttlMs||!keys.has(id)&&t-lastAttempt>=unknownRefreshMs)await refresh();
  const end=now();return end>=loadedAt&&end-loadedAt<ttlMs?keys.get(id)||null:null;
 };
}
module.exports={createAdMobKeyResolver};
