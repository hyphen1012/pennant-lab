const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {createNativeOAuth}=require('../mobile/src/native-oauth.cjs');
const {createAccountBootstrap}=require('../mobile/src/account-bootstrap.cjs');
(async()=>{
 let authUrl=null,now=0,exchanges=0,verifier=null,token='token-a',status=200,owner='a'.repeat(64);
 const config={issuer:'https://auth.example.invalid',authorizeUrl:'https://auth.example.invalid/authorize',tokenUrl:'https://auth.example.invalid/token',clientId:'fixture-client',scope:'game',redirectUri:'jp.pennantlab.game://auth/callback'};
 const provider=createNativeOAuth({config,clock:()=>now,openExternal:async u=>{authUrl=new URL(u);},fetcher:async(url,options)=>{
  assert.equal(url,config.tokenUrl);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert(!options.body.has('client_secret'));exchanges++;
  if(options.body.get('grant_type')==='authorization_code'){verifier=options.body.get('code_verifier');assert.equal(options.body.get('redirect_uri'),config.redirectUri);}
  else assert.equal(options.body.get('refresh_token'),'refresh-a');
  return new Response(JSON.stringify({access_token:token,token_type:'Bearer',expires_in:60,refresh_token:'refresh-a'}));
 }});
 assert.equal(await provider.getAccessToken(),null);
 const login=provider.login();while(!authUrl)await new Promise(r=>setImmediate(r));
 const q=authUrl.searchParams,state=q.get('state');assert.equal(q.get('code_challenge_method'),'S256');assert.equal(q.get('response_type'),'code');assert.equal(state.length,64);
 assert.equal(await provider.handleCallback('evil://auth/callback?state='+state+'&code=x'),false);
 assert.equal(await provider.handleCallback(config.redirectUri+'?state=wrong&code=x'),false);
 assert.equal(exchanges,0);
 const cb=config.redirectUri+'?state='+state+'&code=fixture-code';
 assert.equal(await provider.handleCallback(cb),true);assert.equal(await login,'token-a');
 assert.equal(createHash('sha256').update(verifier).digest('base64url'),q.get('code_challenge'));
 assert.equal(await provider.handleCallback(cb),false);assert.equal(exchanges,1);
 now=50000;token='token-b';assert.deepEqual(await Promise.all([provider.getAccessToken(),provider.getAccessToken()]),['token-b','token-b']);assert.equal(exchanges,2);
 let session=null,opened=0,release;
 const bootstrap=createAccountBootstrap({baseUrl:'https://api.example.invalid',provider,online:()=>true,onSession:s=>session=s,
  fetcher:async(url,options)=>{assert.equal(url,'https://api.example.invalid/v1/identity');assert.equal(options.headers.Authorization,'Bearer '+token);return new Response(JSON.stringify({authenticated:true,account:owner}),{status});},
  openDialog:async({signal,session:s})=>{assert.equal(s.account,owner);opened++;await new Promise(r=>{release=r;signal.addEventListener('abort',r,{once:true});});}
 });
 const ctx=await bootstrap.start();assert(ctx.isCurrent());assert.equal(session.account,owner);
 const dialog=ctx.openCloud({openDatabase(){},canWrite:()=>true});while(!release)await Promise.resolve();assert.equal(opened,1);
 bootstrap.suspend();await dialog;assert(ctx.isCurrent());
 status=503;assert.equal(await bootstrap.revalidate(),false);assert(ctx.isCurrent(),'transient API failure does not switch account');
 status=200;assert.equal(await bootstrap.revalidate(),true);
 owner='b'.repeat(64);assert.equal(await bootstrap.revalidate(),false);assert.equal(ctx.isCurrent(),false);assert.equal(session,null);
 provider.logout();assert.equal(await provider.getAccessToken(),null);
 console.log('PASS external PKCE, replay and state rejection, token rotation and account bootstrap');
})().catch(e=>{console.error(e);process.exitCode=1;});
