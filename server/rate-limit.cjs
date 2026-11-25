// Single-process reference limiter. Use a shared atomic limiter behind multiple
// instances; trust socket address only, not client-supplied forwarding headers.
const {createHash}=require('node:crypto');
function createRateLimiter({now=Date.now,windowMs=60000,ipLimit=120,tokenLimit=40,maxEntries=10000}={}){
 if([windowMs,ipLimit,tokenLimit,maxEntries].some(x=>!Number.isSafeInteger(x)||x<1)||maxEntries<2)throw Error('invalid rate limits');
 const entries=new Map();let last=0;
 return ({token,remoteAddress}={})=>{
  if(typeof token!=='string'||!token||token.length>4096||typeof remoteAddress!=='string'||!remoteAddress||remoteAddress.length>200)return false;
  const t=now();if(!Number.isSafeInteger(t)||t<last)return false;last=t;
  for(const [k,v] of entries){if(t-v.start>=windowMs)entries.delete(k);}
  const keys=['ip:'+remoteAddress,'token:'+createHash('sha256').update(token).digest('hex')];
  const limits=[ipLimit,tokenLimit];
  if(entries.size+keys.filter(k=>!entries.has(k)).length>maxEntries)return false;
  if(keys.some((k,i)=>(entries.get(k)?.count||0)>=limits[i]))return false;
  for(const k of keys){const v=entries.get(k)||{start:t,count:0};v.count++;entries.set(k,v);}
  return true;
 };
}
module.exports={createRateLimiter};
