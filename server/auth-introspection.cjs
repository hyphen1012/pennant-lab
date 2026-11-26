// RFC 7662 adapter for an identity provider supporting authenticated introspection.
// Provider must return issuer, audience, immutable subject, expiry and API scope.
// Never use email, display name, client-provided account ID or unsigned JWT claims.
const {createHash}=require('node:crypto');
function createTokenAuthenticator({endpoint,issuer,audience,clientId,clientSecret,scope,fetcher=globalThis.fetch,now=Date.now,timeoutMs=5000}={}){
 const url=new URL(endpoint);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||[issuer,audience,clientId,clientSecret,scope].some(x=>typeof x!=='string'||!x||x.length>4096)||typeof fetcher!=='function'||typeof now!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw Error('invalid identity configuration');
 const auth='Basic '+Buffer.from(encodeURIComponent(clientId)+':'+encodeURIComponent(clientSecret)).toString('base64');
 const invalid=()=>({authenticated:false});
 return async token=>{
  if(typeof token!=='string'||!/^[A-Za-z0-9._~+\/=-]{1,4096}$/.test(token))return invalid();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const res=await fetcher(url.href,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({token,token_type_hint:'access_token'}),cache:'no-store',redirect:'error',signal:controller.signal});
   if(res.status!==200||!res.body)return invalid();
   const reader=res.body.getReader(),parts=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();return invalid();}parts.push(Buffer.from(value));}}finally{reader.releaseLock();}
   const x=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts,size))),t=Math.floor(now()/1000);
   if(x.active!==true||x.iss!==issuer||!(x.aud===audience||Array.isArray(x.aud)&&x.aud.includes(audience))||typeof x.sub!=='string'||!x.sub||x.sub.length>512||!Number.isSafeInteger(t)||!Number.isSafeInteger(x.exp)||x.exp<=t||x.nbf!==undefined&&(!Number.isSafeInteger(x.nbf)||x.nbf>t)||typeof x.scope!=='string'||!x.scope.split(/\s+/).includes(scope))return invalid();
   const account=createHash('sha256').update(JSON.stringify([issuer,x.sub])).digest('hex');
   return {authenticated:true,account,...(Number.isSafeInteger(x.auth_time)&&x.auth_time>=0&&x.auth_time<=t?{authTime:x.auth_time}: {})};
  }catch{return invalid();}finally{clearTimeout(timer);}
 };
}
// Enable only after the provider guarantees auth_time means actual reauthentication,
// not refresh-token issuance or silent SSO. Distinct fresh proof and same subject.
function createRecentReauthVerifier({authenticate,now=Date.now,maxAgeSeconds=120}={}){
 if(typeof authenticate!=='function'||!Number.isSafeInteger(maxAgeSeconds)||maxAgeSeconds<1||maxAgeSeconds>300)throw Error('invalid reauth policy');
 return async({token,account,proof})=>{
  if(typeof token!=='string'||typeof proof!=='string'||proof===token)return null;
  const [a,b]=await Promise.all([authenticate(token),authenticate(proof)]),t=Math.floor(now()/1000);
  if(a?.authenticated!==true||b?.authenticated!==true||a.account!==account||b.account!==account||!Number.isSafeInteger(b.authTime)||b.authTime>t||t-b.authTime>maxAgeSeconds)return null;
  return {verified:true,account};
 };
}
module.exports={createTokenAuthenticator,createRecentReauthVerifier};
