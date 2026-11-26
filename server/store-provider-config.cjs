// Real provider clients. Credentials are read only from server-side files.
const fs=require('node:fs');
const {createAppleAdapter,createGoogleAdapter}=require('./store-provider-adapters.cjs');
function createStoreProviderConfig(env=process.env){
 const need=k=>{const v=env[k];if(typeof v!=='string'||!v)throw Error('missing '+k);return v;};
 if(env.PL_STORE_VERIFY_ENABLED!=='1')return null;
 if(env.PL_ENV!=='staging')throw Error('only staging store verification is enabled');
 const {AppStoreServerAPIClient,SignedDataVerifier,Environment}=require('@apple/app-store-server-library');
 const {GoogleAuth,OAuth2Client}=require('google-auth-library');
 const bundleId=need('PL_APPLE_BUNDLE_ID'),packageName=need('PL_GOOGLE_PACKAGE_NAME');
 if(bundleId!=='jp.pennantlab.game'||packageName!==bundleId)throw Error('app binding mismatch');
 const appId=Number(need('PL_APPLE_APP_ID'));if(!Number.isSafeInteger(appId)||appId<1)throw Error('invalid App Store id');
 const roots=JSON.parse(need('PL_APPLE_ROOT_CERT_FILES'));if(!Array.isArray(roots)||!roots.length||roots.length>8||roots.some(x=>typeof x!=='string'))throw Error('Apple roots required');
 const api=new AppStoreServerAPIClient(fs.readFileSync(need('PL_APPLE_PRIVATE_KEY_FILE'),'utf8'),need('PL_APPLE_KEY_ID'),need('PL_APPLE_ISSUER_ID'),bundleId,Environment.SANDBOX);
 const verifier=new SignedDataVerifier(roots.map(p=>fs.readFileSync(p)),true,Environment.SANDBOX,bundleId,appId);
 const auth=new GoogleAuth({keyFilename:need('PL_GOOGLE_SERVICE_ACCOUNT_FILE'),scopes:['https://www.googleapis.com/auth/androidpublisher']});
 const oidc=new OAuth2Client(),audience=need('PL_GOOGLE_PUSH_AUDIENCE'),email=need('PL_GOOGLE_PUSH_EMAIL'),subscription=need('PL_GOOGLE_PUSH_SUBSCRIPTION');
 const catalog=JSON.parse(need('PL_SERVER_STORE_CATALOG_JSON'));
 const tokenKey=fs.readFileSync(need('PL_GOOGLE_TOKEN_KEY_FILE'));if(tokenKey.length!==32)throw Error('Google token key must be 32 raw bytes');
 async function query(path){
  const client=await auth.getClient(),access=await client.getAccessToken();if(!access.token)throw Error('Google auth unavailable');
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),10000);
  try{
   const res=await fetch('https://androidpublisher.googleapis.com'+path,{headers:{Authorization:'Bearer '+access.token,Accept:'application/json'},signal:ctl.signal,redirect:'error',cache:'no-store'});
   if(res.status!==200)throw Object.assign(Error('Google API rejected'),{status:res.status});
   const reader=res.body.getReader(),parts=[];let n=0;try{for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>262144)throw Error('Google response too large');parts.push(Buffer.from(value));}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
   return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts,n)));
  }finally{clearTimeout(timer);}
 }
 async function verifyGooglePush(token,body){
  if(typeof token!=='string'||!token||token.length>4096||body?.subscription!==subscription||typeof body.message?.data!=='string'||body.message.data.length>32768)throw Error('invalid Google push');
  const ticket=await oidc.verifyIdToken({idToken:token,audience}),p=ticket.getPayload();
  if(!p||p.email!==email||p.email_verified!==true||!['accounts.google.com','https://accounts.google.com'].includes(p.iss))throw Error('Google push not authenticated');
  const raw=body.message.data;if(!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw Error('invalid push encoding');
  const msg=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(raw,'base64')));
  if(msg.packageName!==packageName)throw Error('wrong package');
  if(msg.testNotification)return null;
  const ns=[msg.subscriptionNotification,msg.oneTimeProductNotification,msg.voidedPurchaseNotification].filter(Boolean);
  if(ns.length!==1||typeof ns[0].purchaseToken!=='string')throw Error('unsupported Google notification');
  return {purchaseToken:ns[0].purchaseToken};
 }
 return {tokenKey,verifyGooglePush,create(registry){
  const lookup=(s,c)=>registry.find(s,c);
  const apple=createAppleAdapter({api,verifier,bundleId,environment:'Sandbox',catalog:catalog.apple,lookup});
  const google=createGoogleAdapter({query,packageName,catalog:catalog.google,vault:registry.vault,lookup,allowTest:true});
  const choose=s=>{if(s==='apple')return apple;if(s==='google')return google;throw Error('invalid store');};
  return {verifyReceipt:x=>choose(x.store).receipt(x),verifyCurrent:x=>choose(x.store).current(x),verifyNotification:async({store,proof})=>{const result=await choose(store).notification(store==='google'?JSON.parse(proof):proof);return result||{verified:true,ignored:true};}};
 }};
}
module.exports={createStoreProviderConfig};
