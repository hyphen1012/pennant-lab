// Provider-neutral OAuth 2 public native client. RFC 8252 / RFC 9700.
// No client secret, password collection, WebView login, or persistent tokens.
// A cold start requires provider sign-in; refresh tokens live only in memory.
function createNativeOAuth({config,openExternal,closeExternal=async()=>{},fetcher=globalThis.fetch,clock=()=>performance.now(),cryptoImpl=globalThis.crypto}={}){
 const https=v=>{const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search)throw Error('invalid OAuth endpoint');return u.href;};
 const auth=https(config.authorizeUrl),tokenUrl=https(config.tokenUrl),issuer=https(config.issuer).replace(/\/$/,'');
 const redirect=new URL(config.redirectUri);
 if(!/^[a-z][a-z0-9]*(?:\.[a-z0-9]+)+:$/.test(redirect.protocol)||redirect.hostname!=='auth'||redirect.pathname!=='/callback'||redirect.search||redirect.hash||redirect.username||redirect.password||redirect.port||typeof config.clientId!=='string'||!config.clientId||typeof config.scope!=='string'||!config.scope.trim()||typeof openExternal!=='function'||typeof fetcher!=='function'||!cryptoImpl?.subtle)throw Error('invalid OAuth client configuration');
 const redirectUri=redirect.href;
 const random=()=>Array.from(cryptoImpl.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
 const base64url=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const validToken=t=>typeof t==='string'&&/^[A-Za-z0-9._~+\/=-]{1,4096}$/.test(t);
 let generation=0,attempt=null,session=null,refreshing=null,request=null;
 function cancel(){const old=attempt;attempt=null;if(old){clearTimeout(old.timer);old.reject(Error('sign-in cancelled'));}}
 function logout(){generation++;cancel();request?.abort();request=null;session=null;refreshing=null;}
 async function exchange(params,gen){
  const ctl=new AbortController();request=ctl;const timer=setTimeout(()=>ctl.abort(),15000);
  try{
   const res=await fetcher(tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({client_id:config.clientId,...params}),cache:'no-store',credentials:'omit',redirect:'error',signal:ctl.signal});
   if(res.status!==200||!res.body?.getReader)throw Error('token exchange failed');
   const reader=res.body.getReader(),parts=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw Error('token response too large');parts.push(value);}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
   const all=new Uint8Array(size);let n=0;for(const p of parts){all.set(p,n);n+=p.length;}
   const x=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all)),now=clock();
   if(gen!==generation||!validToken(x.access_token)||String(x.token_type).toLowerCase()!=='bearer'||!Number.isSafeInteger(x.expires_in)||x.expires_in<30||x.expires_in>86400||!Number.isFinite(now)||x.refresh_token!==undefined&&!validToken(x.refresh_token))throw Error('invalid token response');
   session={access:x.access_token,refresh:x.refresh_token??session?.refresh??null,until:now+x.expires_in*1000-15000};
   return session.access;
  }finally{clearTimeout(timer);if(request===ctl)request=null;}
 }
 async function login({reauthenticate=false}={}){
  if(attempt||refreshing||request)throw Error('sign-in already in progress');
  logout();const gen=generation,verifier=random(),state=random(),challenge=base64url(await cryptoImpl.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  if(gen!==generation)throw Error('sign-in cancelled');
  const u=new URL(auth);u.search=new URLSearchParams({response_type:'code',client_id:config.clientId,redirect_uri:redirectUri,scope:config.scope,state,code_challenge:challenge,code_challenge_method:'S256',...(reauthenticate===true?{prompt:'login',max_age:'0'}:{})}).toString();
  return new Promise((resolve,reject)=>{
   const current={gen,verifier,state,resolve,reject,timer:setTimeout(()=>{if(attempt===current)cancel();},180000)};
   attempt=current;
   Promise.resolve().then(()=>openExternal(u.href)).catch(()=>{if(attempt===current)cancel();});
  });
 }
 async function handleCallback(value){
  const a=attempt;if(!a||typeof value!=='string'||value.length>8192)return false;
  let u;try{u=new URL(value);}catch{return false;}
  if(u.protocol!==redirect.protocol||u.host!==redirect.host||u.pathname!==redirect.pathname||u.hash||u.username||u.password)return false;
  const q=u.searchParams;if(q.getAll('state').length!==1||q.get('state')!==a.state)return false;
  // Only one callback can consume the authorization code.
  attempt=null;clearTimeout(a.timer);
  try{
   if(q.has('error')||q.getAll('code').length!==1||!q.get('code')||q.get('code').length>4096||q.getAll('iss').length>1||(q.has('iss')&&q.get('iss')!==issuer&&q.get('iss')!==config.issuer))throw Error('authorization failed');
   await closeExternal().catch(()=>{});
   if(a.gen!==generation)throw Error('sign-in cancelled');
   const t=await exchange({grant_type:'authorization_code',code:q.get('code'),redirect_uri:redirectUri,code_verifier:a.verifier},a.gen);a.resolve(t);
  }catch(e){if(a.gen===generation)session=null;a.reject(e);}
  return true;
 }
 async function getAccessToken(){
  if(!session)return null;
  const now=clock();if(Number.isFinite(now)&&now<session.until)return session.access;
  if(!session.refresh){session=null;return null;}
  if(refreshing)return refreshing;
  const gen=generation,refresh=session.refresh;
  const task=exchange({grant_type:'refresh_token',refresh_token:refresh},gen).catch(e=>{if(gen===generation)session=null;throw e;});refreshing=task;
  try{return await task;}finally{if(refreshing===task)refreshing=null;}
 }
 return {login,handleCallback,getAccessToken,cancel,logout};
}
module.exports={createNativeOAuth};
